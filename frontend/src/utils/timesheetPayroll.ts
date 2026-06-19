import type { Employee } from "../types/employee";
import type { TimesheetRow, TimesheetWeekRecord } from "../types/timesheet";
import { normalizeUserRole } from "../types/roles";

export type PayrollRunStatus = "Draft" | "Calculated" | "Locked";
export type RowPayrollStatus = "Calculated" | "Needs Review" | "Held" | "Locked";

export type PayrollProfile = {
  payrollType: "Hourly" | "Salaried";
  baseRate: number;
  overtimeMultiplier: number;
};

export type PayrollRowView = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  payrollType: PayrollProfile["payrollType"];
  expectedHours: number;
  approvedHours: number;
  billableHours: number;
  nonBillableHours: number;
  overtimeHours: number;
  shortfallHours: number;
  rate: number;
  overtimeRate: number;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  status: RowPayrollStatus;
  latestWeek?: TimesheetWeekRecord;
  weeks: TimesheetWeekRecord[];
  exceptions: string[];
};

export const rowStatusStyles: Record<RowPayrollStatus, string> = {
  Calculated: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  "Needs Review": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Held: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  Locked: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
};

export const getDateOnly = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatDisplayDate = (value: string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const formatWeekRange = (record: Pick<TimesheetWeekRecord, "weekStart" | "weekEnd">) =>
  `${formatDisplayDate(record.weekStart)} - ${formatDisplayDate(record.weekEnd)}`;

export const formatHours = (value: number) => `${Number(value || 0).toFixed(1).replace(".0", "")}h`;

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export const getRowHours = (row: TimesheetRow) =>
  Object.values(row.hours).reduce((sum, hours) => sum + Number(hours || 0), 0);

export const getWorkingDaysInMonth = (year: number, month: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= lastDay; day += 1) {
    const weekday = new Date(year, month, day).getDay();
    if (weekday !== 0 && weekday !== 6) {
      workingDays += 1;
    }
  }

  return workingDays;
};

export const getEmployeeCode = (employee: Employee) => `EMP-${employee.id.slice(-4).toUpperCase()}`;

export const getPayrollProfile = (employee: Employee): PayrollProfile => {
  const role = normalizeUserRole(employee.role);
  const departmentRates: Record<Employee["department"], number> = {
    Engineering: 780,
    "Human Resources": 620,
    Finance: 700,
    Design: 730,
    Operations: 640,
    Sales: 680,
  };

  const baseRate = departmentRates[employee.department] ?? 650;

  if (role === "Employee") {
    return { payrollType: "Hourly", baseRate, overtimeMultiplier: 1.5 };
  }

  return {
    payrollType: "Salaried",
    baseRate: Math.round(baseRate * 1.25),
    overtimeMultiplier: 1.25,
  };
};

export const getApprovedRecordsInPeriod = (
  records: TimesheetWeekRecord[],
  selectedMonth: number,
  selectedYear: number,
) => {
  const periodStart = new Date(selectedYear, selectedMonth, 1);
  const periodEnd = new Date(selectedYear, selectedMonth + 1, 0);

  return records
    .filter((record) => record.status === "Approved")
    .filter((record) => {
      const weekStart = getDateOnly(record.weekStart);
      const weekEnd = getDateOnly(record.weekEnd);
      return weekStart <= periodEnd && weekEnd >= periodStart;
    });
};

export const buildPayrollRows = ({
  payrollEmployees,
  approvedRecordsInPeriod,
  periodExpectedHours,
  bonusAdjustments = {},
  manualDeductions = {},
  heldRowIds = [],
  runStatus = "Draft",
}: {
  payrollEmployees: Employee[];
  approvedRecordsInPeriod: TimesheetWeekRecord[];
  periodExpectedHours: number;
  bonusAdjustments?: Record<string, number>;
  manualDeductions?: Record<string, number>;
  heldRowIds?: string[];
  runStatus?: PayrollRunStatus;
}): PayrollRowView[] =>
  payrollEmployees
    .map((employee) => {
      const weeks = approvedRecordsInPeriod
        .filter((record) => record.userId === employee.id)
        .sort((left, right) => right.weekStart.localeCompare(left.weekStart));
      const approvedHours = weeks.reduce((sum, record) => sum + Number(record.totalHours || 0), 0);
      const billableHours = weeks.reduce(
        (sum, record) =>
          sum + record.rows.filter((row) => row.billable).reduce((rowSum, row) => rowSum + getRowHours(row), 0),
        0,
      );
      const nonBillableHours = Math.max(approvedHours - billableHours, 0);
      const overtimeHours = Math.max(approvedHours - periodExpectedHours, 0);
      const regularHours = Math.min(approvedHours, periodExpectedHours);
      const shortfallHours = Math.max(periodExpectedHours - approvedHours, 0);
      const profile = getPayrollProfile(employee);
      const bonusAmount = Number(bonusAdjustments[employee.id] ?? 0);
      const manualDeduction = Number(manualDeductions[employee.id] ?? 0);
      const overtimeRate = Math.round(profile.baseRate * profile.overtimeMultiplier);
      const regularPay = regularHours * profile.baseRate;
      const overtimePay = overtimeHours * overtimeRate;
      const shortfallDeduction = profile.payrollType === "Hourly" ? shortfallHours * profile.baseRate : 0;
      const deductionAmount = shortfallDeduction + Math.max(manualDeduction, 0);
      const grossAmount = regularPay + overtimePay + Math.max(bonusAmount, 0);
      const netAmount = Math.max(grossAmount - deductionAmount, 0);

      const exceptions: string[] = [];
      if (weeks.length === 0) {
        exceptions.push("Missing approved timesheet");
      }
      if (shortfallHours > 16) {
        exceptions.push("Under target hours for the selected payroll month");
      }
      if (overtimeHours > 24) {
        exceptions.push("High overtime variance");
      }

      const held = heldRowIds.includes(employee.id);
      const status: RowPayrollStatus =
        runStatus === "Locked" ? "Locked" : held ? "Held" : exceptions.length > 0 ? "Needs Review" : "Calculated";

      return {
        id: employee.id,
        employeeId: employee.id,
        employeeName: employee.fullName,
        employeeCode: getEmployeeCode(employee),
        department: employee.department,
        payrollType: profile.payrollType,
        expectedHours: periodExpectedHours,
        approvedHours,
        billableHours,
        nonBillableHours,
        overtimeHours,
        shortfallHours,
        rate: profile.baseRate,
        overtimeRate,
        grossAmount,
        deductionAmount,
        netAmount,
        status,
        latestWeek: weeks[0],
        weeks,
        exceptions,
      };
    })
    .sort((left, right) => right.netAmount - left.netAmount);

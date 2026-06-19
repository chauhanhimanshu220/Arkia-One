import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { ToastContainer } from "../../components/ToastContainer";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { Employee } from "../../types/employee";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import { normalizeUserRole } from "../../types/roles";
import {
  buildPayrollRows,
  formatCurrency,
  formatHours,
  formatWeekRange,
  getApprovedRecordsInPeriod,
  getPayrollProfile,
  getWorkingDaysInMonth,
  type PayrollRowView,
} from "../../utils/timesheetPayroll";

type CycleStatus = "Draft" | "Generated" | "Calculated" | "Validation Failed" | "Validation Passed" | "Finalized" | "Locked";
type PayrollType = "Regular Payroll" | "Off-cycle Payroll" | "Bonus Payroll" | "Arrears Payroll" | "Correction Payroll";
type CycleType = "Monthly" | "Weekly" | "Biweekly" | "Custom";
type RowStatus = "Pending" | "Calculated" | "Warning" | "Error" | "Verified" | "Hold" | "Finalized" | "Excluded";
type ValidationSeverity = "error" | "warning";

interface ProcessingRow {
  source: PayrollRowView;
  employee: Employee;
  status: RowStatus;
  salaryStructure: string;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  approvedHours: number;
  overtimeHours: number;
  basicSalary: number;
  allowances: number;
  overtimeAmount: number;
  bonusAmount: number;
  reimbursements: number;
  leaveDeduction: number;
  manualDeduction: number;
  taxDeduction: number;
  pfDeduction: number;
  esiDeduction: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  employerContribution: number;
  warnings: string[];
  errors: string[];
}

const PAGE_SIZE = 10;
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, value) => ({ label, value }));
const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);
const cycleTypes: CycleType[] = ["Monthly", "Weekly", "Biweekly", "Custom"];
const payrollTypes: PayrollType[] = ["Regular Payroll", "Off-cycle Payroll", "Bonus Payroll", "Arrears Payroll", "Correction Payroll"];
const statusSteps: CycleStatus[] = ["Draft", "Generated", "Calculated", "Validation Passed", "Finalized", "Locked"];

const inputClass =
  "h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-100";
const buttonClass =
  "h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900";
const primaryButtonClass =
  "h-11 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const dangerButtonClass =
  "h-11 rounded-lg border border-rose-300 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
const panelClass = "rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black";

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPeriodStart = (year: number, month: number) => formatDateInput(new Date(year, month, 1));
const getPeriodEnd = (year: number, month: number) => formatDateInput(new Date(year, month + 1, 0));
const formatNumber = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const downloadCsv = (filename: string, rows: Array<Array<string | number>>) => {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const url = window.URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const statusClass = (status: RowStatus) => {
  switch (status) {
    case "Error":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
    case "Warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
    case "Verified":
    case "Finalized":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
    case "Hold":
      return "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200";
    case "Excluded":
      return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
  }
};

const buildSalaryStructure = (employee: Employee) => {
  const profile = getPayrollProfile(employee);
  return `${employee.department || "Default"} ${profile.payrollType} Rate Card`;
};

const buildProcessingRow = ({
  source,
  employee,
  selectedMonth,
  selectedYear,
  bonusAmount,
  manualDeduction,
  verified,
  held,
  excluded,
  cycleStatus,
}: {
  source: PayrollRowView;
  employee: Employee;
  selectedMonth: number;
  selectedYear: number;
  bonusAmount: number;
  manualDeduction: number;
  verified: boolean;
  held: boolean;
  excluded: boolean;
  cycleStatus: CycleStatus;
}): ProcessingRow => {
  const workingDays = getWorkingDaysInMonth(selectedYear, selectedMonth);
  const presentDays = Math.min(workingDays, Math.floor(source.approvedHours / 8));
  const leaveDays = Math.max(workingDays - presentDays, 0);
  const paidLeaveDays = source.approvedHours > 0 ? Math.min(leaveDays, 2) : 0;
  const unpaidLeaveDays = Math.max(leaveDays - paidLeaveDays, 0);
  const regularHours = Math.min(source.approvedHours, source.expectedHours);
  const regularPay = regularHours * source.rate;
  const basicSalary = Math.round(regularPay * 0.52);
  const allowances = Math.round(regularPay - basicSalary);
  const overtimeAmount = Math.round(source.overtimeHours * source.overtimeRate);
  const reimbursements = source.billableHours > 0 ? Math.min(Math.round(source.billableHours * 15), 2500) : 0;
  const grossPay = Math.max(basicSalary + allowances + overtimeAmount + bonusAmount + reimbursements, 0);
  const leaveDeduction = source.payrollType === "Hourly" ? Math.round(source.shortfallHours * source.rate) : 0;
  const taxDeduction = grossPay >= 50000 ? Math.round(grossPay * 0.08) : 0;
  const pfDeduction = Math.min(Math.round(basicSalary * 0.12), 1800);
  const esiDeduction = grossPay > 0 && grossPay <= 21000 ? Math.round(grossPay * 0.0075) : 0;
  const totalDeductions = Math.max(leaveDeduction + manualDeduction + taxDeduction + pfDeduction + esiDeduction, 0);
  const netPay = Math.max(grossPay - totalDeductions, 0);
  const employerContribution = Math.round(pfDeduction + grossPay * 0.0325);
  const salaryStructure = buildSalaryStructure(employee);
  const warnings = [...source.exceptions.filter((item) => item !== "Missing approved timesheet")];
  const errors: string[] = [];
  const joinedDuringCycle = employee.createdAt.slice(0, 7) === `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  if (!employee.department || !employee.designation) {
    errors.push("Missing salary structure mapping");
  }

  if (source.weeks.length === 0) {
    errors.push("No approved timesheet found");
  }

  if (netPay <= 0 && !excluded) {
    errors.push("Net pay is zero or negative");
  }

  if (source.overtimeHours > 0 && source.latestWeek?.status !== "Approved") {
    warnings.push("Overtime source is not approved");
  }

  if (manualDeduction > grossPay * 0.4 && grossPay > 0) {
    warnings.push("Manual deduction exceeds normal threshold");
  }

  if (joinedDuringCycle) {
    warnings.push("Employee joined during the selected cycle");
  }

  const status: RowStatus =
    excluded
      ? "Excluded"
      : cycleStatus === "Locked" || cycleStatus === "Finalized"
        ? "Finalized"
        : held
          ? "Hold"
          : errors.length > 0
            ? "Error"
            : verified
              ? "Verified"
              : warnings.length > 0
                ? "Warning"
                : cycleStatus === "Draft"
                  ? "Pending"
                  : "Calculated";

  return {
    source,
    employee,
    status,
    salaryStructure,
    workingDays,
    presentDays,
    leaveDays,
    paidLeaveDays,
    unpaidLeaveDays,
    approvedHours: source.approvedHours,
    overtimeHours: source.overtimeHours,
    basicSalary,
    allowances,
    overtimeAmount,
    bonusAmount,
    reimbursements,
    leaveDeduction,
    manualDeduction,
    taxDeduction,
    pfDeduction,
    esiDeduction,
    grossPay,
    totalDeductions,
    netPay,
    employerContribution,
    warnings,
    errors,
  };
};

const DetailDrawer = ({
  row,
  onClose,
  onBonusChange,
  onDeductionChange,
  onVerify,
  onHold,
  onExclude,
  locked,
}: {
  row: ProcessingRow | null;
  onClose: () => void;
  onBonusChange: (employeeId: string, value: number) => void;
  onDeductionChange: (employeeId: string, value: number) => void;
  onVerify: (employeeId: string) => void;
  onHold: (employeeId: string) => void;
  onExclude: (employeeId: string) => void;
  locked: boolean;
}) => {
  if (!row) {
    return null;
  }

  const sourceWeeks = row.source.weeks.slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 bg-black/30" role="dialog" aria-modal="true" aria-label={`Payroll details for ${row.employee.fullName}`}>
      <div className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-black">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-black">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Payroll Detail</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">{row.employee.fullName}</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{row.employee.employeeCode} / {row.employee.department} / {row.employee.designation}</p>
          </div>
          <button type="button" onClick={onClose} className={buttonClass}>
            Close
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Net payable formula</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ["Gross Pay", formatCurrency(row.grossPay)],
                ["Deductions", formatCurrency(row.totalDeductions)],
                ["Net Pay", formatCurrency(row.netPay)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-950 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Earnings</h3>
              <dl className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {[
                  ["Basic Salary", row.basicSalary],
                  ["Allowances", row.allowances],
                  ["Overtime", row.overtimeAmount],
                  ["Bonus / Incentive", row.bonusAmount],
                  ["Reimbursements", row.reimbursements],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3 text-sm">
                    <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                    <dd className="font-semibold text-zinc-900 dark:text-white">{formatCurrency(Number(value))}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Deductions</h3>
              <dl className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {[
                  ["Unpaid leave", row.leaveDeduction],
                  ["Manual deduction", row.manualDeduction],
                  ["Tax", row.taxDeduction],
                  ["PF", row.pfDeduction],
                  ["ESI", row.esiDeduction],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3 text-sm">
                    <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                    <dd className="font-semibold text-zinc-900 dark:text-white">{formatCurrency(Number(value))}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Attendance and timesheet source</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {[
                ["Working Days", row.workingDays],
                ["Present Days", row.presentDays],
                ["Paid Leave", row.paidLeaveDays],
                ["Unpaid Leave", row.unpaidLeaveDays],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-950 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
              {sourceWeeks.length === 0 ? (
                <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">No approved timesheet source is attached to this payroll row.</p>
              ) : (
                sourceWeeks.map((week) => (
                  <div key={week.id} className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 text-sm last:border-b-0 dark:border-zinc-800">
                    <span className="text-zinc-700 dark:text-zinc-200">{formatWeekRange(week)}</span>
                    <span className="font-semibold text-zinc-950 dark:text-white">{formatHours(week.totalHours)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Manual adjustments</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Bonus / incentive</span>
                <input
                  type="number"
                  min={0}
                  value={row.bonusAmount}
                  onChange={(event) => onBonusChange(row.employee.id, Number(event.target.value))}
                  disabled={locked}
                  className={inputClass}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Manual deduction</span>
                <input
                  type="number"
                  min={0}
                  value={row.manualDeduction}
                  onChange={(event) => onDeductionChange(row.employee.id, Number(event.target.value))}
                  disabled={locked}
                  className={inputClass}
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Validation notes</h3>
            <div className="mt-3 space-y-2">
              {[...row.errors.map((message) => ({ message, severity: "error" as ValidationSeverity })), ...row.warnings.map((message) => ({ message, severity: "warning" as ValidationSeverity }))].length === 0 ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                  This payroll row has no current validation issues.
                </p>
              ) : (
                [...row.errors.map((message) => ({ message, severity: "error" as ValidationSeverity })), ...row.warnings.map((message) => ({ message, severity: "warning" as ValidationSeverity }))].map((item) => (
                  <p
                    key={`${item.severity}-${item.message}`}
                    className={`rounded-lg border px-4 py-3 text-sm ${
                      item.severity === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                    }`}
                  >
                    {item.message}
                  </p>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Row actions</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <button type="button" disabled={locked || row.status === "Excluded"} onClick={() => onVerify(row.employee.id)} className={buttonClass}>
                Mark Verified
              </button>
              <button type="button" disabled={locked || row.status === "Excluded"} onClick={() => onHold(row.employee.id)} className={buttonClass}>
                {row.status === "Hold" ? "Release Hold" : "Put on Hold"}
              </button>
              <button type="button" disabled={locked} onClick={() => onExclude(row.employee.id)} className={dangerButtonClass}>
                {row.status === "Excluded" ? "Include" : "Exclude"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export const PayrollProcessingPage = ({ user }: { user: AuthUser }) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [periodStart, setPeriodStart] = useState(getPeriodStart(currentYear, currentDate.getMonth()));
  const [periodEnd, setPeriodEnd] = useState(getPeriodEnd(currentYear, currentDate.getMonth()));
  const [payGroup, setPayGroup] = useState("All");
  const [office, setOffice] = useState("All offices");
  const [cycleType, setCycleType] = useState<CycleType>("Monthly");
  const [payrollType, setPayrollType] = useState<PayrollType>("Regular Payroll");
  const [cycleStatus, setCycleStatus] = useState<CycleStatus>("Draft");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | RowStatus>("All");
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [bonusAdjustments, setBonusAdjustments] = useState<Record<string, number>>({});
  const [manualDeductions, setManualDeductions] = useState<Record<string, number>>({});
  const [verifiedRowIds, setVerifiedRowIds] = useState<string[]>([]);
  const [heldRowIds, setHeldRowIds] = useState<string[]>([]);
  const [excludedRowIds, setExcludedRowIds] = useState<string[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [lastActionAt, setLastActionAt] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const locked = cycleStatus === "Locked" || cycleStatus === "Finalized";

  const loadRecords = async () => {
    setLoading(true);
    try {
      const items = await timesheetService.listWeeks();
      setRecords(items);
    } catch {
      showToast("Unable to load approved timesheets for payroll processing.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  useEffect(() => {
    setPeriodStart(getPeriodStart(selectedYear, selectedMonth));
    setPeriodEnd(getPeriodEnd(selectedYear, selectedMonth));
  }, [selectedMonth, selectedYear]);

  const payrollEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "Active" && normalizeUserRole(employee.role) !== "System Admin"),
    [employees],
  );

  const departmentOptions = useMemo(
    () => Array.from(new Set(payrollEmployees.map((employee) => employee.department))).sort((left, right) => left.localeCompare(right)),
    [payrollEmployees],
  );

  const periodExpectedHours = useMemo(() => getWorkingDaysInMonth(selectedYear, selectedMonth) * 8, [selectedMonth, selectedYear]);

  const approvedRecordsInPeriod = useMemo(
    () => getApprovedRecordsInPeriod(records, selectedMonth, selectedYear),
    [records, selectedMonth, selectedYear],
  );

  const basePayrollRows = useMemo(
    () =>
      buildPayrollRows({
        payrollEmployees,
        approvedRecordsInPeriod,
        periodExpectedHours,
        bonusAdjustments,
        manualDeductions,
        heldRowIds,
        runStatus: cycleStatus === "Locked" || cycleStatus === "Finalized" ? "Locked" : cycleStatus === "Draft" ? "Draft" : "Calculated",
      }),
    [approvedRecordsInPeriod, bonusAdjustments, cycleStatus, heldRowIds, manualDeductions, payrollEmployees, periodExpectedHours],
  );

  const rows = useMemo<ProcessingRow[]>(() => {
    const employeesById = new Map(payrollEmployees.map((employee) => [employee.id, employee]));

    return basePayrollRows
      .map((source) => {
        const employee = employeesById.get(source.employeeId);
        if (!employee) {
          return null;
        }

        return buildProcessingRow({
          source,
          employee,
          selectedMonth,
          selectedYear,
          bonusAmount: Number(bonusAdjustments[source.employeeId] ?? 0),
          manualDeduction: Number(manualDeductions[source.employeeId] ?? 0),
          verified: verifiedRowIds.includes(source.employeeId),
          held: heldRowIds.includes(source.employeeId),
          excluded: excludedRowIds.includes(source.employeeId),
          cycleStatus,
        });
      })
      .filter((row): row is ProcessingRow => Boolean(row));
  }, [basePayrollRows, bonusAdjustments, cycleStatus, excludedRowIds, heldRowIds, manualDeductions, payrollEmployees, selectedMonth, selectedYear, verifiedRowIds]);

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return rows.filter((row) => {
      if (payGroup !== "All" && row.employee.department !== payGroup) {
        return false;
      }

      if (office !== "All offices" && row.employee.workLocation !== office) {
        return false;
      }

      if (statusFilter !== "All" && row.status !== statusFilter) {
        return false;
      }

      if (exceptionsOnly && row.errors.length === 0 && row.warnings.length === 0) {
        return false;
      }

      if (query) {
        const haystack = `${row.employee.fullName} ${row.employee.employeeCode} ${row.employee.department} ${row.employee.designation}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [exceptionsOnly, office, payGroup, rows, searchText, statusFilter]);

  const payableRows = useMemo(() => filteredRows.filter((row) => row.status !== "Excluded" && row.status !== "Hold"), [filteredRows]);
  const allPayableRows = useMemo(() => rows.filter((row) => row.status !== "Excluded" && row.status !== "Hold"), [rows]);
  const selectedRows = useMemo(() => rows.filter((row) => selectedRowIds.includes(row.employee.id)), [rows, selectedRowIds]);
  const selectedRow = useMemo(() => rows.find((row) => row.employee.id === selectedEmployeeId) ?? null, [rows, selectedEmployeeId]);

  const summary = useMemo(() => {
    const gross = payableRows.reduce((sum, row) => sum + row.grossPay, 0);
    const deductions = payableRows.reduce((sum, row) => sum + row.totalDeductions, 0);
    const net = payableRows.reduce((sum, row) => sum + row.netPay, 0);
    const overtimeAmount = payableRows.reduce((sum, row) => sum + row.overtimeAmount, 0);
    const leaveDeduction = payableRows.reduce((sum, row) => sum + row.leaveDeduction, 0);
    const errorRows = filteredRows.filter((row) => row.errors.length > 0).length;
    const warningRows = filteredRows.filter((row) => row.warnings.length > 0).length;
    const verifiedRows = filteredRows.filter((row) => row.status === "Verified" || row.status === "Finalized").length;

    return {
      totalEmployees: filteredRows.length,
      processedEmployees: payableRows.length,
      pendingValidations: Math.max(filteredRows.length - verifiedRows, 0),
      errorRows,
      warningRows,
      gross,
      deductions,
      net,
      overtimeAmount,
      leaveDeduction,
      heldRows: filteredRows.filter((row) => row.status === "Hold").length,
      excludedRows: filteredRows.filter((row) => row.status === "Excluded").length,
    };
  }, [filteredRows, payableRows]);

  const finalizeBlockers = useMemo(() => {
    const includedRows = rows.filter((row) => row.status !== "Excluded");

    return {
      errorRows: includedRows.filter((row) => row.errors.length > 0).length,
      heldRows: includedRows.filter((row) => row.status === "Hold").length,
    };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [currentPage, filteredRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [exceptionsOnly, payGroup, searchText, selectedMonth, selectedYear, statusFilter]);

  useEffect(() => {
    setSelectedRowIds((current) => current.filter((id) => filteredRows.some((row) => row.employee.id === id)));
  }, [filteredRows]);

  const markAction = () => setLastActionAt(new Date().toISOString());

  const setRowsUnique = (setter: (value: string[]) => void, ids: string[]) => {
    setter(Array.from(new Set(ids)));
  };

  const toggleRowSelection = (employeeId: string) => {
    setSelectedRowIds((current) => (current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]));
  };

  const handleSelectVisible = (checked: boolean) => {
    setSelectedRowIds(checked ? paginatedRows.map((row) => row.employee.id) : []);
  };

  const handleGenerate = () => {
    setCycleStatus("Generated");
    setVerifiedRowIds([]);
    setSelectedRowIds([]);
    markAction();
    showToast("Payroll draft generated from active employees and approved timesheets.", "success");
  };

  const handleRecalculate = (employeeIds?: string[]) => {
    if (locked) {
      showToast("Finalized payroll cannot be recalculated.", "info");
      return;
    }

    const targetIds = employeeIds ?? rows.map((row) => row.employee.id);
    setRowsUnique(setVerifiedRowIds, verifiedRowIds.filter((id) => !targetIds.includes(id)));
    setCycleStatus("Calculated");
    markAction();
    showToast(employeeIds ? "Selected payroll rows recalculated." : "Payroll cycle recalculated.", "success");
  };

  const handleValidate = () => {
    const errorCount = rows.filter((row) => row.status !== "Excluded" && row.errors.length > 0).length;
    setCycleStatus(errorCount > 0 ? "Validation Failed" : "Validation Passed");
    markAction();
    showToast(errorCount > 0 ? "Payroll validation found blocking errors." : "Payroll validation passed.", errorCount > 0 ? "error" : "success");
  };

  const handleFinalize = () => {
    if (cycleStatus === "Draft") {
      showToast("Generate payroll before finalizing the cycle.", "info");
      return;
    }

    if (allPayableRows.length === 0) {
      showToast("There are no payable payroll rows to finalize.", "info");
      return;
    }

    if (finalizeBlockers.errorRows > 0 || finalizeBlockers.heldRows > 0) {
      const blockers = [
        finalizeBlockers.errorRows > 0 ? `${finalizeBlockers.errorRows} error row${finalizeBlockers.errorRows === 1 ? "" : "s"}` : "",
        finalizeBlockers.heldRows > 0 ? `${finalizeBlockers.heldRows} held row${finalizeBlockers.heldRows === 1 ? "" : "s"}` : "",
      ].filter(Boolean);

      showToast(`Resolve ${blockers.join(" and ")} before finalizing payroll.`, "error");
      return;
    }

    if (!window.confirm("Finalize this payroll cycle? Finalized payroll becomes read-only for this workspace.")) {
      return;
    }

    setCycleStatus("Finalized");
    setVerifiedRowIds(rows.map((row) => row.employee.id));
    setSelectedRowIds([]);
    markAction();
    showToast("Payroll cycle finalized and ready for export.", "success");
  };

  const handleLock = () => {
    if (cycleStatus !== "Finalized") {
      showToast("Finalize payroll before locking the cycle.", "info");
      return;
    }

    setCycleStatus("Locked");
    markAction();
    showToast("Payroll cycle locked. Export and history can now use this snapshot.", "success");
  };

  const toggleId = (setter: React.Dispatch<React.SetStateAction<string[]>>, employeeId: string) => {
    setter((current) => (current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]));
  };

  const handleVerify = (employeeId: string) => {
    if (locked) {
      showToast("Finalized payroll rows are read-only.", "info");
      return;
    }

    setVerifiedRowIds((current) => (current.includes(employeeId) ? current : [...current, employeeId]));
    setHeldRowIds((current) => current.filter((id) => id !== employeeId));
    markAction();
  };

  const handleHold = (employeeId: string) => {
    if (locked) {
      showToast("Finalized payroll rows are read-only.", "info");
      return;
    }

    toggleId(setHeldRowIds, employeeId);
    setVerifiedRowIds((current) => current.filter((id) => id !== employeeId));
    markAction();
  };

  const handleExclude = (employeeId: string) => {
    if (locked) {
      showToast("Finalized payroll rows are read-only.", "info");
      return;
    }

    toggleId(setExcludedRowIds, employeeId);
    setSelectedRowIds((current) => current.filter((id) => id !== employeeId));
    markAction();
  };

  const handleBulkVerify = () => {
    const ids = selectedRows.filter((row) => row.status !== "Excluded").map((row) => row.employee.id);
    setRowsUnique(setVerifiedRowIds, [...verifiedRowIds, ...ids]);
    setHeldRowIds((current) => current.filter((id) => !ids.includes(id)));
    setSelectedRowIds([]);
    markAction();
    showToast("Selected payroll rows marked verified.", "success");
  };

  const handleBulkHold = () => {
    const ids = selectedRows.filter((row) => row.status !== "Excluded").map((row) => row.employee.id);
    setRowsUnique(setHeldRowIds, [...heldRowIds, ...ids]);
    setVerifiedRowIds((current) => current.filter((id) => !ids.includes(id)));
    setSelectedRowIds([]);
    markAction();
    showToast("Selected payroll rows placed on hold.", "success");
  };

  const handleBulkExclude = () => {
    const ids = selectedRows.map((row) => row.employee.id);
    setRowsUnique(setExcludedRowIds, [...excludedRowIds, ...ids]);
    setSelectedRowIds([]);
    markAction();
    showToast("Selected payroll rows excluded from the cycle.", "success");
  };

  const handleExportPreview = () => {
    if (payableRows.length === 0) {
      showToast("There are no payable payroll rows to export.", "info");
      return;
    }

    downloadCsv(`payroll-processing-preview-${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}.csv`, [
      ["Employee ID", "Employee Name", "Department", "Payroll Type", "Working Days", "Present Days", "Approved Hours", "Overtime Hours", "Gross Pay", "Deductions", "Net Pay", "Status"],
      ...payableRows.map((row) => [
        row.employee.employeeCode,
        row.employee.fullName,
        row.employee.department,
        payrollType,
        row.workingDays,
        row.presentDays,
        row.approvedHours,
        row.overtimeHours,
        row.grossPay,
        row.totalDeductions,
        row.netPay,
        row.status,
      ]),
    ]);
    showToast("Payroll export preview downloaded.", "success");
  };

  const visibleValidationRows = filteredRows
    .filter((row) => row.errors.length > 0 || row.warnings.length > 0)
    .slice(0, 8);

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading payroll processing..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <DetailDrawer
        row={selectedRow}
        onClose={() => setSelectedEmployeeId(null)}
        onBonusChange={(employeeId, value) => setBonusAdjustments((current) => ({ ...current, [employeeId]: value }))}
        onDeductionChange={(employeeId, value) => setManualDeductions((current) => ({ ...current, [employeeId]: value }))}
        onVerify={handleVerify}
        onHold={handleHold}
        onExclude={handleExclude}
        locked={locked}
      />

      <div className="space-y-6">
        <section className={panelClass}>
          <div className="flex flex-col gap-5 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-zinc-500 dark:text-zinc-400">Payroll Management</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">Payroll Processing</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                Convert approved timesheets, salary rules, adjustments, and validation checks into a reviewable payroll cycle.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[560px]">
              <button type="button" onClick={handleGenerate} disabled={locked} className={primaryButtonClass}>
                Generate Payroll
              </button>
              <button type="button" onClick={() => handleRecalculate()} disabled={locked} className={buttonClass}>
                Recalculate
              </button>
              <button type="button" onClick={handleValidate} disabled={locked} className={buttonClass}>
                Validate
              </button>
              <button type="button" onClick={handleFinalize} disabled={locked} className={dangerButtonClass}>
                Finalize Payroll
              </button>
              <button type="button" onClick={handleLock} disabled={cycleStatus !== "Finalized"} className={buttonClass}>
                Lock Payroll
              </button>
              <button type="button" onClick={handleExportPreview} className={buttonClass}>
                Export Preview
              </button>
            </div>
          </div>

          <div className="grid gap-3 px-6 py-5 md:grid-cols-3 xl:grid-cols-6">
            {statusSteps.map((step, index) => {
              const currentIndex = statusSteps.indexOf(cycleStatus === "Validation Failed" ? "Calculated" : cycleStatus);
              const active = step === cycleStatus || (cycleStatus === "Validation Failed" && step === "Calculated");
              const complete = currentIndex >= index && currentIndex !== -1;
              return (
                <div
                  key={step}
                  className={`rounded-lg border px-4 py-3 ${
                    active
                      ? "border-zinc-900 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-black"
                      : complete
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.24em]">Step {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold">{step}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className={panelClass}>
          <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Payroll period and run setup</h2>
          </div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Payroll month</span>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} className={inputClass}>
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Payroll year</span>
              <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className={inputClass}>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Pay period start</span>
              <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className={inputClass} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Pay period end</span>
              <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className={inputClass} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Pay group / department</span>
              <select value={payGroup} onChange={(event) => setPayGroup(event.target.value)} className={inputClass}>
                <option value="All">All departments</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Office</span>
              <select value={office} onChange={(event) => setOffice(event.target.value)} className={inputClass}>
                <option value="All offices">All offices</option>
                <option value="Office">Office</option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Salary cycle type</span>
              <select value={cycleType} onChange={(event) => setCycleType(event.target.value as CycleType)} className={inputClass}>
                {cycleTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Payroll type</span>
              <select value={payrollType} onChange={(event) => setPayrollType(event.target.value as PayrollType)} className={inputClass}>
                {payrollTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Employees", summary.totalEmployees, "Rows in the selected payroll scope"],
            ["Processed", summary.processedEmployees, "Rows included for payable totals"],
            ["Validation Issues", summary.errorRows + summary.warningRows, "Errors and warnings before lock"],
            ["Net Payable", summary.net, "Salary-ready payable amount"],
            ["Gross Payroll", summary.gross, "Earnings before deductions"],
            ["Total Deductions", summary.deductions, "Leave, tax, PF, ESI, and manual deductions"],
            ["Overtime Amount", summary.overtimeAmount, "Approved overtime cost in this cycle"],
            ["Leave Deduction", summary.leaveDeduction, "Unpaid leave or shortfall impact"],
          ].map(([label, value, description]) => (
            <div key={String(label)} className={panelClass}>
              <div className="px-5 py-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">
                  {String(label).includes("Payable") || String(label).includes("Payroll") || String(label).includes("Deductions") || String(label).includes("Amount") || String(label).includes("Deduction")
                    ? formatCurrency(Number(value))
                    : formatNumber(Number(value))}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
              </div>
            </div>
          ))}
        </section>

        {selectedRowIds.length > 0 ? (
          <section className={`${panelClass} px-5 py-4`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{selectedRowIds.length} payroll row(s) selected</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={locked} onClick={() => handleRecalculate(selectedRowIds)} className={buttonClass}>
                  Recalculate Selected
                </button>
                <button type="button" disabled={locked} onClick={handleBulkVerify} className={buttonClass}>
                  Mark Verified
                </button>
                <button type="button" disabled={locked} onClick={handleBulkHold} className={buttonClass}>
                  Put on Hold
                </button>
                <button type="button" disabled={locked} onClick={handleBulkExclude} className={dangerButtonClass}>
                  Exclude Selected
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]">
          <div className={`${panelClass} overflow-hidden`}>
            <div className="flex flex-col gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Employee payroll records</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Review salary components, exceptions, source timesheets, and final payable amounts.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] xl:w-[620px]">
                <label className="sr-only" htmlFor="payroll-search">Search payroll rows</label>
                <input
                  id="payroll-search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search employee, ID, department, designation"
                  className={inputClass}
                />
                <label className="sr-only" htmlFor="payroll-status-filter">Payroll row status</label>
                <select id="payroll-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | RowStatus)} className={inputClass}>
                  <option value="All">All statuses</option>
                  {["Pending", "Calculated", "Warning", "Error", "Verified", "Hold", "Finalized", "Excluded"].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <label className="flex h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                  <input type="checkbox" checked={exceptionsOnly} onChange={(event) => setExceptionsOnly(event.target.checked)} />
                  Exceptions only
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-950">
                  <tr>
                    <th className="w-12 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        aria-label="Select visible payroll rows"
                        checked={paginatedRows.length > 0 && paginatedRows.every((row) => selectedRowIds.includes(row.employee.id))}
                        onChange={(event) => handleSelectVisible(event.target.checked)}
                      />
                    </th>
                    {[
                      "Employee",
                      "Pay Type",
                      "Working",
                      "Leave",
                      "Approved",
                      "Overtime",
                      "Gross",
                      "Deductions",
                      "Net",
                      "Status",
                      "Actions",
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-16 text-center">
                        <p className="font-semibold text-zinc-950 dark:text-white">No payroll rows match the current filters.</p>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Change the period, department, status, or exception filter.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr key={row.employee.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-950">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            aria-label={`Select payroll row for ${row.employee.fullName}`}
                            checked={selectedRowIds.includes(row.employee.id)}
                            onChange={() => toggleRowSelection(row.employee.id)}
                            disabled={row.status === "Excluded"}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <button type="button" onClick={() => setSelectedEmployeeId(row.employee.id)} className="text-left">
                            <span className="block font-semibold text-zinc-950 hover:underline dark:text-white">{row.employee.fullName}</span>
                            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{row.employee.employeeCode} / {row.employee.department}</span>
                          </button>
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">
                          <p>{row.source.payrollType}</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{row.salaryStructure}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{row.workingDays} days</td>
                        <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">
                          {row.leaveDays} total
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.unpaidLeaveDays} unpaid</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatHours(row.approvedHours)}</td>
                        <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatHours(row.overtimeHours)}</td>
                        <td className="px-4 py-4 text-sm font-medium text-zinc-950 dark:text-white">{formatCurrency(row.grossPay)}</td>
                        <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatCurrency(row.totalDeductions)}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-zinc-950 dark:text-white">{formatCurrency(row.netPay)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                          {row.errors[0] ? <p className="mt-2 max-w-[180px] text-xs text-rose-600 dark:text-rose-300">{row.errors[0]}</p> : row.warnings[0] ? <p className="mt-2 max-w-[180px] text-xs text-amber-600 dark:text-amber-300">{row.warnings[0]}</p> : null}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setSelectedEmployeeId(row.employee.id)} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                              Details
                            </button>
                            <button type="button" disabled={locked || row.status === "Excluded"} onClick={() => handleVerify(row.employee.id)} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">
                              Verify
                            </button>
                            <button type="button" disabled={locked} onClick={() => handleHold(row.employee.id)} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">
                              {row.status === "Hold" ? "Release" : "Hold"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>

          <aside className="space-y-6">
            <section className={panelClass}>
              <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Validation panel</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{summary.errorRows} errors and {summary.warningRows} warnings in the current view.</p>
              </div>
              <div className="space-y-3 px-5 py-4">
                {visibleValidationRows.length === 0 ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                    No validation issues are visible for this payroll scope.
                  </p>
                ) : (
                  visibleValidationRows.map((row) => (
                    <button
                      key={row.employee.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(row.employee.id)}
                      className="block w-full rounded-lg border border-zinc-200 px-4 py-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-950"
                    >
                      <span className="block font-semibold text-zinc-950 dark:text-white">{row.employee.fullName}</span>
                      <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">
                        {[...row.errors, ...row.warnings][0]}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className={panelClass}>
              <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Final review</h2>
              </div>
              <dl className="divide-y divide-zinc-200 px-5 dark:divide-zinc-800">
                {[
                  ["Employee count", summary.processedEmployees],
                  ["Total gross", formatCurrency(summary.gross)],
                  ["Total net", formatCurrency(summary.net)],
                  ["Total deductions", formatCurrency(summary.deductions)],
                  ["Exceptions", summary.errorRows + summary.warningRows],
                  ["Prepared by", user.fullName || user.email],
                  ["Run date", lastActionAt ? new Date(lastActionAt).toLocaleString() : "Not processed yet"],
                  ["Cycle type", cycleType],
                  ["Payroll type", payrollType],
                  ["Approval status", cycleStatus],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                    <dd className="text-right font-semibold text-zinc-950 dark:text-white">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <button type="button" disabled={locked} onClick={handleValidate} className={buttonClass}>
                  Submit for Validation
                </button>
                <button type="button" disabled={locked} onClick={handleFinalize} className={primaryButtonClass}>
                  Finalize Payroll
                </button>
                <Link to={workspaceRoutes["payroll-export"].path} className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                  Open Payroll Export
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </>
  );
};

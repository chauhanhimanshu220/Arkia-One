import type { Employee } from "../types/employee";
import type { Project } from "../types/project";
import type { TimesheetWeekRecord } from "../types/timesheet";
import type {
  ClientBillingDiscountType,
  ClientBillingLineItem,
  ClientBillingRecord,
  ClientBillingType,
} from "../types/clientBilling";

const roundNumber = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export const toNumber = (value: string | number | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const todayInput = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addDays = (value: string, days: number) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  parsed.setDate(parsed.getDate() + days);
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatCurrency = (value: number, currencyCode = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

export const formatCompactCurrency = (value: number, currencyCode = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);

export const formatHours = (value: number) =>
  `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(Number.isFinite(value) ? value : 0)}h`;

export const formatDateLabel = (value: string | null | undefined) => {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatBillingPeriod = (periodStart: string, periodEnd: string) =>
  `${formatDateLabel(periodStart)} to ${formatDateLabel(periodEnd)}`;

export const isDateRangeOverlapping = (
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
) => {
  const leftFrom = new Date(`${leftStart}T00:00:00`).getTime();
  const leftTo = new Date(`${leftEnd}T00:00:00`).getTime();
  const rightFrom = new Date(`${rightStart}T00:00:00`).getTime();
  const rightTo = new Date(`${rightEnd}T00:00:00`).getTime();

  return leftFrom <= rightTo && rightFrom <= leftTo;
};

export const deriveSuggestedBillingType = (project: Project): ClientBillingType => {
  const deliveryModel = project.deliveryModel.trim().toLowerCase();

  if (deliveryModel.includes("retainer") || deliveryModel.includes("support")) {
    return "Retainer";
  }

  if (deliveryModel.includes("milestone")) {
    return "Milestone";
  }

  if (deliveryModel.includes("fixed")) {
    return "Fixed Project";
  }

  return "Hourly";
};

export const deriveSuggestedRate = (project: Project) => {
  const deliveryModel = project.deliveryModel.trim().toLowerCase();
  let rate = 1000;

  if (deliveryModel.includes("retainer") || deliveryModel.includes("support")) {
    rate = 900;
  } else if (deliveryModel.includes("dedicated")) {
    rate = 1250;
  } else if (deliveryModel.includes("squad")) {
    rate = 1350;
  } else if (deliveryModel.includes("fixed")) {
    rate = 1150;
  }

  if (project.priority === "High") {
    rate += 150;
  } else if (project.priority === "Critical") {
    rate += 300;
  } else if (project.priority === "Low") {
    rate -= 100;
  }

  return Math.max(rate, 650);
};

export const buildClientBillingAmounts = ({
  billingType,
  billableHours,
  rate,
  fixedAmount,
  milestoneAmount,
  retainerAmount,
  taxPercentage,
  discountType,
  discountValue,
  adjustmentAmount,
}: {
  billingType: ClientBillingType;
  billableHours: number;
  rate: number;
  fixedAmount: number;
  milestoneAmount: number;
  retainerAmount: number;
  taxPercentage: number;
  discountType: ClientBillingDiscountType;
  discountValue: number;
  adjustmentAmount: number;
}) => {
  const baseAmount =
    billingType === "Hourly"
      ? roundNumber(billableHours * rate)
      : billingType === "Fixed Project"
        ? roundNumber(fixedAmount)
        : billingType === "Milestone"
          ? roundNumber(milestoneAmount)
          : roundNumber(retainerAmount);
  const taxAmount = roundNumber((baseAmount * Math.max(taxPercentage, 0)) / 100);
  const discountAmount =
    discountType === "Percentage"
      ? roundNumber((baseAmount * Math.max(discountValue, 0)) / 100)
      : discountType === "Fixed"
        ? roundNumber(Math.max(discountValue, 0))
        : 0;
  const finalAmount = roundNumber(baseAmount + taxAmount - discountAmount + roundNumber(adjustmentAmount));

  return {
    baseAmount,
    taxAmount,
    discountAmount,
    finalAmount,
  };
};

export const buildApprovedBillingLineItems = ({
  employees,
  records,
  projectId,
  periodStart,
  periodEnd,
  rate,
}: {
  employees: Employee[];
  records: TimesheetWeekRecord[];
  projectId: string;
  periodStart: string;
  periodEnd: string;
  rate: number;
}): ClientBillingLineItem[] => {
  if (!projectId || !periodStart || !periodEnd) {
    return [];
  }

  const employeeDirectory = new Map(employees.map((employee) => [employee.id, employee]));
  const start = new Date(`${periodStart}T00:00:00`).getTime();
  const end = new Date(`${periodEnd}T00:00:00`).getTime();

  return records
    .filter((record) => record.status === "Approved")
    .flatMap((record) => {
      const employee = employeeDirectory.get(record.userId);
      return record.rows
        .filter((row) => row.billable && row.projectId === projectId)
        .flatMap((row) =>
          Object.entries(row.hours)
            .filter(([, hours]) => Number(hours) > 0)
            .filter(([date]) => {
              const current = new Date(`${date}T00:00:00`).getTime();
              return current >= start && current <= end;
            })
            .map(([date, hours]) => {
              const billableHours = roundNumber(Number(hours));
              return {
                id: `${record.id}-${row.id}-${date}`,
                employeeId: record.userId,
                employeeName: employee?.fullName ?? "Employee",
                taskName: row.taskName.trim() || "Timesheet task",
                description: row.notesByDate?.[date]?.trim() || row.notes.trim() || row.projectName,
                workDate: date,
                billableHours,
                rate: roundNumber(rate),
                amount: roundNumber(billableHours * rate),
                isBillable: true,
              };
            }),
        );
    })
    .sort((left, right) => {
      const dateDifference = right.workDate.localeCompare(left.workDate);
      if (dateDifference !== 0) {
        return dateDifference;
      }

      return left.employeeName.localeCompare(right.employeeName);
    });
};

export const buildClientBillingRecordSignature = (
  record: Pick<
    ClientBillingRecord,
    | "clientName"
    | "projectId"
    | "billingPeriodStart"
    | "billingPeriodEnd"
    | "billingType"
    | "currencyCode"
    | "totalBillableHours"
    | "rate"
    | "fixedAmount"
    | "milestoneLabel"
    | "milestoneAmount"
    | "retainerAmount"
    | "baseAmount"
    | "taxPercentage"
    | "taxAmount"
    | "discountType"
    | "discountValue"
    | "discountAmount"
    | "adjustmentAmount"
    | "finalAmount"
    | "notes"
    | "lineItems"
  >,
) =>
  JSON.stringify({
    clientName: record.clientName.trim(),
    projectId: record.projectId,
    billingPeriodStart: record.billingPeriodStart,
    billingPeriodEnd: record.billingPeriodEnd,
    billingType: record.billingType,
    currencyCode: record.currencyCode,
    totalBillableHours: roundNumber(record.totalBillableHours),
    rate: roundNumber(record.rate),
    fixedAmount: roundNumber(record.fixedAmount),
    milestoneLabel: record.milestoneLabel?.trim() ?? "",
    milestoneAmount: roundNumber(record.milestoneAmount),
    retainerAmount: roundNumber(record.retainerAmount),
    baseAmount: roundNumber(record.baseAmount),
    taxPercentage: roundNumber(record.taxPercentage),
    taxAmount: roundNumber(record.taxAmount),
    discountType: record.discountType,
    discountValue: roundNumber(record.discountValue),
    discountAmount: roundNumber(record.discountAmount),
    adjustmentAmount: roundNumber(record.adjustmentAmount),
    finalAmount: roundNumber(record.finalAmount),
    notes: record.notes.trim(),
    lineItems: [...record.lineItems]
      .map((item) => ({
        employeeId: item.employeeId,
        taskName: item.taskName.trim(),
        description: item.description.trim(),
        workDate: item.workDate,
        billableHours: roundNumber(item.billableHours),
        rate: roundNumber(item.rate),
        amount: roundNumber(item.amount),
        isBillable: item.isBillable,
      }))
      .sort((left, right) => {
        const dateDifference = left.workDate.localeCompare(right.workDate);
        if (dateDifference !== 0) {
          return dateDifference;
        }

        return left.employeeId.localeCompare(right.employeeId);
      }),
  });

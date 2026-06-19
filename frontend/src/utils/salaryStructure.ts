import type {
  SalaryCalculationBase,
  SalaryComponentDefinition,
  SalaryStructureRecord,
  SalaryTimesheetRules,
} from "../types/salaryStructure";

export interface SalaryPreviewInputs {
  monthlyCtc: number;
  overtimeHours: number;
  unpaidLeaveDays: number;
  lateEntries: number;
  bonusAdjustment: number;
}

export interface SalaryPreviewLineItem {
  id: string;
  name: string;
  amount: number;
  meta: string;
}

export interface SalaryPreviewResult {
  earnings: SalaryPreviewLineItem[];
  deductions: SalaryPreviewLineItem[];
  adjustments: SalaryPreviewLineItem[];
  warnings: string[];
  totalEarnings: number;
  totalDeductions: number;
  totalAdjustmentImpact: number;
  grossSalary: number;
  netSalary: number;
}

const componentNameToKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isBasicSalaryComponent = (value: string) => {
  const normalized = componentNameToKey(value);
  return normalized === "basic" || normalized === "basic-salary";
};

const roundCurrency = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const resolveBaseAmount = ({
  base,
  monthlyCtc,
  totalEarnings,
  totalDeductions,
  workingDaysPerMonth,
  basicSalary,
}: {
  base: SalaryCalculationBase;
  monthlyCtc: number;
  totalEarnings: number;
  totalDeductions: number;
  workingDaysPerMonth: number;
  basicSalary: number;
}) => {
  switch (base) {
    case "Basic Salary":
      return basicSalary;
    case "Gross Salary":
      return totalEarnings > 0 ? totalEarnings : monthlyCtc;
    case "Net Salary":
      return Math.max(totalEarnings - totalDeductions, 0);
    case "Per Day Salary":
      return workingDaysPerMonth > 0 ? monthlyCtc / workingDaysPerMonth : 0;
    case "CTC":
    default:
      return monthlyCtc;
  }
};

const buildComponentAmount = ({
  component,
  monthlyCtc,
  totalEarnings,
  totalDeductions,
  workingDaysPerMonth,
  basicSalary,
}: {
  component: SalaryComponentDefinition;
  monthlyCtc: number;
  totalEarnings: number;
  totalDeductions: number;
  workingDaysPerMonth: number;
  basicSalary: number;
}) => {
  if (!component.isActive) {
    return 0;
  }

  if (component.calculationType === "Fixed") {
    return roundCurrency(component.value);
  }

  if (component.calculationType === "Formula") {
    return roundCurrency(component.value);
  }

  const baseAmount = resolveBaseAmount({
    base: component.calculationBase,
    monthlyCtc,
    totalEarnings,
    totalDeductions,
    workingDaysPerMonth,
    basicSalary,
  });

  return roundCurrency((baseAmount * component.value) / 100);
};

const buildComponentMeta = (component: SalaryComponentDefinition) => {
  if (component.calculationType === "Fixed") {
    return `Fixed ${formatCurrency(component.value)}`;
  }

  if (component.calculationType === "Formula") {
    return component.formulaExpression?.trim() || "Formula rule";
  }

  return `${component.value}% of ${component.calculationBase}`;
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

export const formatDateLabel = (value: string | null | undefined) => {
  if (!value) {
    return "Open ended";
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

export const getEffectiveWindowLabel = (structure: Pick<SalaryStructureRecord, "effectiveFrom" | "effectiveTo">) =>
  `${formatDateLabel(structure.effectiveFrom)} to ${formatDateLabel(structure.effectiveTo)}`;

export const buildSalaryPreview = ({
  components,
  timesheetRules,
  previewInputs,
}: {
  components: SalaryComponentDefinition[];
  timesheetRules: SalaryTimesheetRules;
  previewInputs: SalaryPreviewInputs;
}): SalaryPreviewResult => {
  const activeComponents = [...components]
    .filter((component) => component.isActive)
    .sort((left, right) => left.displayOrder - right.displayOrder);
  const earningComponents = activeComponents.filter((component) => component.componentType === "Earning");
  const deductionComponents = activeComponents.filter((component) => component.componentType === "Deduction");

  const warnings: string[] = [];
  let totalEarnings = 0;
  let totalDeductions = 0;
  let basicSalary = 0;

  const earnings = earningComponents.map((component) => {
    const amount = buildComponentAmount({
      component,
      monthlyCtc: previewInputs.monthlyCtc,
      totalEarnings,
      totalDeductions,
      workingDaysPerMonth: timesheetRules.workingDaysPerMonth,
      basicSalary,
    });

    totalEarnings += amount;
    if (isBasicSalaryComponent(component.componentName)) {
      basicSalary = amount;
    }

    if (component.calculationType === "Formula") {
      warnings.push(`${component.componentName} uses an indicative preview value until the backend formula engine is connected.`);
    }

    return {
      id: component.id,
      name: component.componentName,
      amount,
      meta: buildComponentMeta(component),
    };
  });

  const deductions = deductionComponents.map((component) => {
    const amount = buildComponentAmount({
      component,
      monthlyCtc: previewInputs.monthlyCtc,
      totalEarnings,
      totalDeductions,
      workingDaysPerMonth: timesheetRules.workingDaysPerMonth,
      basicSalary,
    });

    totalDeductions += amount;

    if (component.calculationType === "Formula") {
      warnings.push(`${component.componentName} uses an indicative preview value until the backend formula engine is connected.`);
    }

    return {
      id: component.id,
      name: component.componentName,
      amount,
      meta: buildComponentMeta(component),
    };
  });

  const hourlyRate =
    timesheetRules.workingDaysPerMonth > 0 && timesheetRules.workingHoursPerDay > 0
      ? previewInputs.monthlyCtc / (timesheetRules.workingDaysPerMonth * timesheetRules.workingHoursPerDay)
      : 0;
  const overtimeAmount = !timesheetRules.overtimeAllowed
    ? 0
    : timesheetRules.overtimeRateType === "Hourly Multiplier"
      ? roundCurrency(previewInputs.overtimeHours * hourlyRate * timesheetRules.overtimeRate)
      : roundCurrency(previewInputs.overtimeHours * timesheetRules.overtimeRate);
  const perDaySalary =
    timesheetRules.workingDaysPerMonth > 0 ? roundCurrency(previewInputs.monthlyCtc / timesheetRules.workingDaysPerMonth) : 0;
  const leaveWithoutPayDeduction = timesheetRules.leaveWithoutPayEnabled
    ? roundCurrency(perDaySalary * previewInputs.unpaidLeaveDays)
    : 0;
  const lateDeduction = timesheetRules.lateDeductionEnabled
    ? roundCurrency(timesheetRules.lateDeductionAmount * previewInputs.lateEntries)
    : 0;

  const adjustments: SalaryPreviewLineItem[] = [];
  if (overtimeAmount > 0) {
    adjustments.push({
      id: "overtime",
      name: "Overtime Pay",
      amount: overtimeAmount,
      meta:
        timesheetRules.overtimeRateType === "Hourly Multiplier"
          ? `${previewInputs.overtimeHours} hour(s) x ${timesheetRules.overtimeRate}x hourly rate`
          : `${previewInputs.overtimeHours} hour(s) x ${formatCurrency(timesheetRules.overtimeRate)}`,
    });
  }

  if (previewInputs.bonusAdjustment > 0) {
    adjustments.push({
      id: "bonus-adjustment",
      name: "Bonus / Incentive",
      amount: roundCurrency(previewInputs.bonusAdjustment),
      meta: "Preview-only manual incentive",
    });
  }

  if (leaveWithoutPayDeduction > 0) {
    adjustments.push({
      id: "leave-without-pay",
      name: "Leave Without Pay",
      amount: -leaveWithoutPayDeduction,
      meta: `${previewInputs.unpaidLeaveDays} day(s) x ${formatCurrency(perDaySalary)}`,
    });
  }

  if (lateDeduction > 0) {
    adjustments.push({
      id: "late-deduction",
      name: "Late Entry Deduction",
      amount: -lateDeduction,
      meta: `${previewInputs.lateEntries} mark(s) x ${formatCurrency(timesheetRules.lateDeductionAmount)}`,
    });
  }

  const totalAdjustmentImpact = roundCurrency(adjustments.reduce((sum, item) => sum + item.amount, 0));
  const grossSalary = roundCurrency(totalEarnings);
  const netSalary = roundCurrency(Math.max(grossSalary - totalDeductions + totalAdjustmentImpact, 0));

  if (!earnings.some((component) => isBasicSalaryComponent(component.name))) {
    warnings.push("Preview is missing a Basic Salary component, so PF-style deductions may not reflect production rules.");
  }

  const ctcBasedPercent = earningComponents
    .filter((component) => component.isActive && component.calculationType === "Percentage" && component.calculationBase === "CTC")
    .reduce((sum, component) => sum + component.value, 0);

  if (ctcBasedPercent > 100) {
    warnings.push("Active earning components currently exceed 100% of CTC.");
  }

  return {
    earnings,
    deductions,
    adjustments,
    warnings,
    totalEarnings: roundCurrency(totalEarnings),
    totalDeductions: roundCurrency(totalDeductions),
    totalAdjustmentImpact,
    grossSalary,
    netSalary,
  };
};

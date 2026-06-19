export type SalaryStructureStatus = "Active" | "Inactive" | "Draft";

export type SalaryComponentType = "Earning" | "Deduction";

export type SalaryCalculationType = "Fixed" | "Percentage" | "Formula";

export type SalaryCalculationBase = "CTC" | "Basic Salary" | "Gross Salary" | "Net Salary" | "Per Day Salary";

export type SalaryDeductionFrequency = "Monthly" | "One-time";

export type SalaryEmploymentType =
  | "Full-Time"
  | "Intern"
  | "Senior Staff"
  | "Manager"
  | "Contract"
  | "Consultant";

export type SalaryOvertimeRateType = "Fixed" | "Hourly Multiplier";

export interface SalaryComponentDefinition {
  id: string;
  componentName: string;
  componentType: SalaryComponentType;
  calculationType: SalaryCalculationType;
  calculationBase: SalaryCalculationBase;
  value: number;
  formulaExpression?: string;
  isTaxable: boolean;
  isActive: boolean;
  deductionFrequency?: SalaryDeductionFrequency;
  displayOrder: number;
}

export interface SalaryTimesheetRules {
  workingHoursPerDay: number;
  workingDaysPerMonth: number;
  overtimeAllowed: boolean;
  overtimeRateType: SalaryOvertimeRateType;
  overtimeRate: number;
  lateDeductionEnabled: boolean;
  lateDeductionAmount: number;
  leaveWithoutPayEnabled: boolean;
  minimumHoursRequired: number;
}

export interface SalaryStructureRecord {
  id: string;
  parentStructureId?: string | null;
  structureName: string;
  structureCode: string;
  applicableRole: string;
  department: string;
  employmentType: SalaryEmploymentType;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: SalaryStructureStatus;
  versionNo: number;
  description: string;
  monthlyCtc: number;
  employeesAssignedCount: number;
  components: SalaryComponentDefinition[];
  timesheetRules: SalaryTimesheetRules;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

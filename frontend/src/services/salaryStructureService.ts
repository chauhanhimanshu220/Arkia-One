import type { SalaryComponentDefinition, SalaryStructureRecord } from "../types/salaryStructure";

const SALARY_STRUCTURES_STORAGE_KEY = "finance-salary-structure-records";
const SALARY_STRUCTURES_STORAGE_VERSION_KEY = `${SALARY_STRUCTURES_STORAGE_KEY}:version`;
const SALARY_STRUCTURES_STORAGE_VERSION = "1";

const sortStructures = (structures: SalaryStructureRecord[]) =>
  [...structures].sort((left, right) => {
    const statusWeight = (status: SalaryStructureRecord["status"]) => {
      switch (status) {
        case "Active":
          return 0;
        case "Draft":
          return 1;
        case "Inactive":
        default:
          return 2;
      }
    };

    const weightDifference = statusWeight(left.status) - statusWeight(right.status);
    if (weightDifference !== 0) {
      return weightDifference;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

const createComponent = (input: Omit<SalaryComponentDefinition, "id"> & { id?: string }): SalaryComponentDefinition => ({
  id: input.id ?? crypto.randomUUID(),
  componentName: input.componentName,
  componentType: input.componentType,
  calculationType: input.calculationType,
  calculationBase: input.calculationBase,
  value: input.value,
  formulaExpression: input.formulaExpression ?? "",
  isTaxable: input.isTaxable,
  isActive: input.isActive,
  deductionFrequency: input.deductionFrequency,
  displayOrder: input.displayOrder,
});

const seedStructures: SalaryStructureRecord[] = [
  {
    id: "salary-structure-full-time-v2",
    parentStructureId: "salary-structure-full-time",
    structureName: "Full-Time Employee Salary Structure",
    structureCode: "SAL-FT-001",
    applicableRole: "Software Developer",
    department: "Engineering",
    employmentType: "Full-Time",
    effectiveFrom: "2026-04-01",
    effectiveTo: null,
    status: "Active",
    versionNo: 2,
    description: "Primary full-time salary model used for engineering contributors on monthly payroll.",
    monthlyCtc: 50000,
    employeesAssignedCount: 42,
    createdBy: "Finance Admin",
    createdAt: "2026-04-01T09:00:00.000Z",
    updatedBy: "Finance Admin",
    updatedAt: "2026-04-28T11:15:00.000Z",
    components: [
      createComponent({ componentName: "Basic Salary", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 50, isTaxable: true, isActive: true, displayOrder: 1 }),
      createComponent({ componentName: "HRA", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 20, isTaxable: true, isActive: true, displayOrder: 2 }),
      createComponent({ componentName: "Special Allowance", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 20, isTaxable: true, isActive: true, displayOrder: 3 }),
      createComponent({ componentName: "Medical Allowance", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 5, isTaxable: false, isActive: true, displayOrder: 4 }),
      createComponent({ componentName: "Travel Allowance", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 5, isTaxable: false, isActive: true, displayOrder: 5 }),
      createComponent({ componentName: "PF Deduction", componentType: "Deduction", calculationType: "Percentage", calculationBase: "Basic Salary", value: 12, isTaxable: false, isActive: true, deductionFrequency: "Monthly", displayOrder: 6 }),
      createComponent({ componentName: "Professional Tax", componentType: "Deduction", calculationType: "Fixed", calculationBase: "CTC", value: 200, isTaxable: false, isActive: true, deductionFrequency: "Monthly", displayOrder: 7 }),
      createComponent({ componentName: "TDS", componentType: "Deduction", calculationType: "Percentage", calculationBase: "Gross Salary", value: 8, isTaxable: false, isActive: true, deductionFrequency: "Monthly", displayOrder: 8 }),
    ],
    timesheetRules: {
      workingHoursPerDay: 9,
      workingDaysPerMonth: 22,
      overtimeAllowed: true,
      overtimeRateType: "Fixed",
      overtimeRate: 500,
      lateDeductionEnabled: true,
      lateDeductionAmount: 300,
      leaveWithoutPayEnabled: true,
      minimumHoursRequired: 198,
    },
  },
  {
    id: "salary-structure-senior-staff-v1",
    parentStructureId: null,
    structureName: "Senior Developer Salary Structure",
    structureCode: "SAL-SEN-002",
    applicableRole: "Senior Staff",
    department: "Engineering",
    employmentType: "Senior Staff",
    effectiveFrom: "2026-03-01",
    effectiveTo: null,
    status: "Active",
    versionNo: 1,
    description: "Enhanced allowance mix for senior engineers leading delivery and architecture tracks.",
    monthlyCtc: 90000,
    employeesAssignedCount: 12,
    createdBy: "System Admin",
    createdAt: "2026-03-01T08:45:00.000Z",
    updatedBy: "Finance Admin",
    updatedAt: "2026-04-18T14:20:00.000Z",
    components: [
      createComponent({ componentName: "Basic Salary", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 45, isTaxable: true, isActive: true, displayOrder: 1 }),
      createComponent({ componentName: "HRA", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 18, isTaxable: true, isActive: true, displayOrder: 2 }),
      createComponent({ componentName: "Special Allowance", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 22, isTaxable: true, isActive: true, displayOrder: 3 }),
      createComponent({ componentName: "Performance Incentive", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 10, isTaxable: true, isActive: true, displayOrder: 4 }),
      createComponent({ componentName: "Medical Allowance", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 5, isTaxable: false, isActive: true, displayOrder: 5 }),
      createComponent({ componentName: "PF Deduction", componentType: "Deduction", calculationType: "Percentage", calculationBase: "Basic Salary", value: 12, isTaxable: false, isActive: true, deductionFrequency: "Monthly", displayOrder: 6 }),
      createComponent({ componentName: "TDS", componentType: "Deduction", calculationType: "Percentage", calculationBase: "Gross Salary", value: 10, isTaxable: false, isActive: true, deductionFrequency: "Monthly", displayOrder: 7 }),
    ],
    timesheetRules: {
      workingHoursPerDay: 9,
      workingDaysPerMonth: 22,
      overtimeAllowed: true,
      overtimeRateType: "Hourly Multiplier",
      overtimeRate: 1.75,
      lateDeductionEnabled: false,
      lateDeductionAmount: 0,
      leaveWithoutPayEnabled: true,
      minimumHoursRequired: 198,
    },
  },
  {
    id: "salary-structure-manager-v1",
    parentStructureId: null,
    structureName: "Manager Salary Structure",
    structureCode: "SAL-MGR-003",
    applicableRole: "Team Manager",
    department: "Operations",
    employmentType: "Manager",
    effectiveFrom: "2026-02-01",
    effectiveTo: null,
    status: "Draft",
    versionNo: 1,
    description: "Manager plan with performance loading and a stronger fixed allowance mix before activation.",
    monthlyCtc: 110000,
    employeesAssignedCount: 0,
    createdBy: "Finance Admin",
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedBy: "Finance Admin",
    updatedAt: "2026-04-27T16:05:00.000Z",
    components: [
      createComponent({ componentName: "Basic Salary", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 40, isTaxable: true, isActive: true, displayOrder: 1 }),
      createComponent({ componentName: "HRA", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 18, isTaxable: true, isActive: true, displayOrder: 2 }),
      createComponent({ componentName: "Leadership Allowance", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 20, isTaxable: true, isActive: true, displayOrder: 3 }),
      createComponent({ componentName: "Travel Allowance", componentType: "Earning", calculationType: "Fixed", calculationBase: "CTC", value: 7000, isTaxable: false, isActive: true, displayOrder: 4 }),
      createComponent({ componentName: "PF Deduction", componentType: "Deduction", calculationType: "Percentage", calculationBase: "Basic Salary", value: 12, isTaxable: false, isActive: true, deductionFrequency: "Monthly", displayOrder: 5 }),
      createComponent({ componentName: "Professional Tax", componentType: "Deduction", calculationType: "Fixed", calculationBase: "CTC", value: 200, isTaxable: false, isActive: true, deductionFrequency: "Monthly", displayOrder: 6 }),
      createComponent({ componentName: "TDS", componentType: "Deduction", calculationType: "Percentage", calculationBase: "Gross Salary", value: 12, isTaxable: false, isActive: true, deductionFrequency: "Monthly", displayOrder: 7 }),
    ],
    timesheetRules: {
      workingHoursPerDay: 9,
      workingDaysPerMonth: 22,
      overtimeAllowed: false,
      overtimeRateType: "Fixed",
      overtimeRate: 0,
      lateDeductionEnabled: false,
      lateDeductionAmount: 0,
      leaveWithoutPayEnabled: true,
      minimumHoursRequired: 198,
    },
  },
  {
    id: "salary-structure-contract-v1",
    parentStructureId: null,
    structureName: "Contract Employee Structure",
    structureCode: "SAL-CON-004",
    applicableRole: "Consultant",
    department: "Finance",
    employmentType: "Contract",
    effectiveFrom: "2026-01-15",
    effectiveTo: null,
    status: "Inactive",
    versionNo: 1,
    description: "Legacy contractor setup retained for historical payroll audit and export references.",
    monthlyCtc: 65000,
    employeesAssignedCount: 6,
    createdBy: "Finance Admin",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedBy: "Finance Admin",
    updatedAt: "2026-03-30T18:30:00.000Z",
    components: [
      createComponent({ componentName: "Contract Base Pay", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 80, isTaxable: true, isActive: true, displayOrder: 1 }),
      createComponent({ componentName: "Travel Allowance", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 10, isTaxable: false, isActive: true, displayOrder: 2 }),
      createComponent({ componentName: "Special Allowance", componentType: "Earning", calculationType: "Percentage", calculationBase: "CTC", value: 10, isTaxable: true, isActive: true, displayOrder: 3 }),
      createComponent({ componentName: "TDS", componentType: "Deduction", calculationType: "Percentage", calculationBase: "Gross Salary", value: 10, isTaxable: false, isActive: true, deductionFrequency: "Monthly", displayOrder: 4 }),
    ],
    timesheetRules: {
      workingHoursPerDay: 8,
      workingDaysPerMonth: 22,
      overtimeAllowed: true,
      overtimeRateType: "Fixed",
      overtimeRate: 650,
      lateDeductionEnabled: true,
      lateDeductionAmount: 450,
      leaveWithoutPayEnabled: true,
      minimumHoursRequired: 176,
    },
  },
];

const clearStoredSalaryStructures = () => {
  window.localStorage.removeItem(SALARY_STRUCTURES_STORAGE_KEY);
  window.localStorage.removeItem(SALARY_STRUCTURES_STORAGE_VERSION_KEY);
};

const getStoredSalaryStructures = (): SalaryStructureRecord[] => {
  const version = window.localStorage.getItem(SALARY_STRUCTURES_STORAGE_VERSION_KEY);
  if (version !== SALARY_STRUCTURES_STORAGE_VERSION) {
    clearStoredSalaryStructures();
    return sortStructures(seedStructures);
  }

  const raw = window.localStorage.getItem(SALARY_STRUCTURES_STORAGE_KEY);
  if (!raw) {
    return sortStructures(seedStructures);
  }

  try {
    const parsed = JSON.parse(raw) as SalaryStructureRecord[];
    return Array.isArray(parsed) && parsed.length > 0 ? sortStructures(parsed) : sortStructures(seedStructures);
  } catch {
    clearStoredSalaryStructures();
    return sortStructures(seedStructures);
  }
};

const setStoredSalaryStructures = (structures: SalaryStructureRecord[]) => {
  window.localStorage.setItem(SALARY_STRUCTURES_STORAGE_VERSION_KEY, SALARY_STRUCTURES_STORAGE_VERSION);
  window.localStorage.setItem(SALARY_STRUCTURES_STORAGE_KEY, JSON.stringify(sortStructures(structures)));
};

export const salaryStructureService = {
  async getSalaryStructures() {
    return getStoredSalaryStructures();
  },

  async replaceSalaryStructures(structures: SalaryStructureRecord[]) {
    setStoredSalaryStructures(structures);
    return sortStructures(structures);
  },

  async saveSalaryStructure(structure: SalaryStructureRecord) {
    const current = getStoredSalaryStructures();
    const next = current.some((item) => item.id === structure.id)
      ? current.map((item) => (item.id === structure.id ? structure : item))
      : [structure, ...current];
    setStoredSalaryStructures(next);
    return structure;
  },

  async deactivateSalaryStructure(id: string) {
    const current = getStoredSalaryStructures();
    const next = current.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "Inactive" as const,
            updatedAt: new Date().toISOString(),
            updatedBy: "Finance Admin",
          }
        : item,
    );
    setStoredSalaryStructures(next);
    return sortStructures(next);
  },
};

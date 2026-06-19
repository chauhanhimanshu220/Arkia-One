import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { useToast } from "../../hooks/useToast";
import { salaryStructureService } from "../../services/salaryStructureService";
import type {
  SalaryCalculationBase,
  SalaryCalculationType,
  SalaryComponentDefinition,
  SalaryComponentType,
  SalaryDeductionFrequency,
  SalaryEmploymentType,
  SalaryOvertimeRateType,
  SalaryStructureRecord,
  SalaryStructureStatus,
} from "../../types/salaryStructure";
import { buildSalaryPreview, formatCurrency, formatDateLabel, getEffectiveWindowLabel } from "../../utils/salaryStructure";

type ComponentFormState = {
  id: string;
  componentName: string;
  componentType: SalaryComponentType;
  calculationType: SalaryCalculationType;
  calculationBase: SalaryCalculationBase;
  value: string;
  formulaExpression: string;
  isTaxable: boolean;
  isActive: boolean;
  deductionFrequency: SalaryDeductionFrequency;
};

type SalaryStructureFormState = {
  id?: string;
  parentStructureId?: string | null;
  structureName: string;
  structureCode: string;
  applicableRole: string;
  department: string;
  employmentType: SalaryEmploymentType;
  effectiveFrom: string;
  effectiveTo: string;
  status: SalaryStructureStatus;
  description: string;
  monthlyCtc: string;
  employeesAssignedCount: number;
  versionNo: number;
  components: ComponentFormState[];
  timesheetRules: {
    workingHoursPerDay: string;
    workingDaysPerMonth: string;
    overtimeAllowed: boolean;
    overtimeRateType: SalaryOvertimeRateType;
    overtimeRate: string;
    lateDeductionEnabled: boolean;
    lateDeductionAmount: string;
    leaveWithoutPayEnabled: boolean;
    minimumHoursRequired: string;
  };
  previewInputs: {
    overtimeHours: string;
    unpaidLeaveDays: string;
    lateEntries: string;
    bonusAdjustment: string;
  };
};

const inputClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";
const selectClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";
const panelClass = "rounded-[2rem] border border-white/70 bg-white/85 shadow-panel dark:border-zinc-800 dark:bg-black/85";
const secondaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900";
const primaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100";

const departmentOptions = ["Engineering", "Finance", "Operations", "Human Resources", "Administration", "Management"];
const roleOptions = ["Software Developer", "Senior Staff", "Team Manager", "Finance Analyst", "Consultant", "System Admin"];
const employmentTypeOptions: SalaryEmploymentType[] = ["Full-Time", "Intern", "Senior Staff", "Manager", "Contract", "Consultant"];
const calculationTypeOptions: SalaryCalculationType[] = ["Fixed", "Percentage", "Formula"];
const calculationBaseOptions: SalaryCalculationBase[] = ["CTC", "Basic Salary", "Gross Salary", "Net Salary", "Per Day Salary"];
const deductionFrequencyOptions: SalaryDeductionFrequency[] = ["Monthly", "One-time"];
const statusOptions: SalaryStructureStatus[] = ["Active", "Draft", "Inactive"];
const overtimeRateOptions: SalaryOvertimeRateType[] = ["Fixed", "Hourly Multiplier"];

const payrollTouchpoints = ["Timesheet Payroll", "Payroll Processing", "Payroll History", "Payroll Export"];

const componentNameToKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isBasicComponent = (value: string) => {
  const normalized = componentNameToKey(value);
  return normalized === "basic" || normalized === "basic-salary";
};

const todayInput = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dayBefore = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  parsed.setDate(parsed.getDate() - 1);
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildComponentRow = ({
  componentType,
  componentName,
  calculationType = "Percentage",
  calculationBase = "CTC",
  value = componentType === "Deduction" ? "12" : "10",
  isTaxable = componentType === "Earning",
  deductionFrequency = "Monthly",
}: {
  componentType: SalaryComponentType;
  componentName: string;
  calculationType?: SalaryCalculationType;
  calculationBase?: SalaryCalculationBase;
  value?: string;
  isTaxable?: boolean;
  deductionFrequency?: SalaryDeductionFrequency;
}): ComponentFormState => ({
  id: crypto.randomUUID(),
  componentName,
  componentType,
  calculationType,
  calculationBase,
  value,
  formulaExpression: "",
  isTaxable,
  isActive: true,
  deductionFrequency,
});

const buildDefaultFormState = (): SalaryStructureFormState => ({
  structureName: "",
  structureCode: "",
  applicableRole: "Software Developer",
  department: "Engineering",
  employmentType: "Full-Time",
  effectiveFrom: todayInput(),
  effectiveTo: "",
  status: "Draft",
  description: "",
  monthlyCtc: "50000",
  employeesAssignedCount: 0,
  versionNo: 1,
  components: [
    buildComponentRow({ componentType: "Earning", componentName: "Basic Salary", calculationType: "Percentage", calculationBase: "CTC", value: "50" }),
    buildComponentRow({ componentType: "Earning", componentName: "HRA", calculationType: "Percentage", calculationBase: "CTC", value: "20" }),
    buildComponentRow({ componentType: "Earning", componentName: "Special Allowance", calculationType: "Percentage", calculationBase: "CTC", value: "20" }),
    buildComponentRow({ componentType: "Deduction", componentName: "PF Deduction", calculationType: "Percentage", calculationBase: "Basic Salary", value: "12", isTaxable: false }),
    buildComponentRow({ componentType: "Deduction", componentName: "Professional Tax", calculationType: "Fixed", calculationBase: "CTC", value: "200", isTaxable: false }),
  ],
  timesheetRules: {
    workingHoursPerDay: "9",
    workingDaysPerMonth: "22",
    overtimeAllowed: true,
    overtimeRateType: "Fixed",
    overtimeRate: "500",
    lateDeductionEnabled: true,
    lateDeductionAmount: "300",
    leaveWithoutPayEnabled: true,
    minimumHoursRequired: "198",
  },
  previewInputs: {
    overtimeHours: "4",
    unpaidLeaveDays: "1",
    lateEntries: "2",
    bonusAdjustment: "0",
  },
});

const toFormComponent = (component: SalaryComponentDefinition): ComponentFormState => ({
  id: component.id,
  componentName: component.componentName,
  componentType: component.componentType,
  calculationType: component.calculationType,
  calculationBase: component.calculationBase,
  value: String(component.value),
  formulaExpression: component.formulaExpression ?? "",
  isTaxable: component.isTaxable,
  isActive: component.isActive,
  deductionFrequency: component.deductionFrequency ?? "Monthly",
});

const toFormState = (record: SalaryStructureRecord): SalaryStructureFormState => ({
  id: record.id,
  parentStructureId: record.parentStructureId ?? null,
  structureName: record.structureName,
  structureCode: record.structureCode,
  applicableRole: record.applicableRole,
  department: record.department,
  employmentType: record.employmentType,
  effectiveFrom: record.effectiveFrom,
  effectiveTo: record.effectiveTo ?? "",
  status: record.status,
  description: record.description,
  monthlyCtc: String(record.monthlyCtc),
  employeesAssignedCount: record.employeesAssignedCount,
  versionNo: record.versionNo,
  components: [...record.components]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map(toFormComponent),
  timesheetRules: {
    workingHoursPerDay: String(record.timesheetRules.workingHoursPerDay),
    workingDaysPerMonth: String(record.timesheetRules.workingDaysPerMonth),
    overtimeAllowed: record.timesheetRules.overtimeAllowed,
    overtimeRateType: record.timesheetRules.overtimeRateType,
    overtimeRate: String(record.timesheetRules.overtimeRate),
    lateDeductionEnabled: record.timesheetRules.lateDeductionEnabled,
    lateDeductionAmount: String(record.timesheetRules.lateDeductionAmount),
    leaveWithoutPayEnabled: record.timesheetRules.leaveWithoutPayEnabled,
    minimumHoursRequired: String(record.timesheetRules.minimumHoursRequired),
  },
  previewInputs: {
    overtimeHours: "4",
    unpaidLeaveDays: "1",
    lateEntries: "2",
    bonusAdjustment: "0",
  },
});

const buildRecordSignature = (record: SalaryStructureRecord) =>
  JSON.stringify({
    structureName: record.structureName,
    structureCode: record.structureCode,
    applicableRole: record.applicableRole,
    department: record.department,
    employmentType: record.employmentType,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo ?? null,
    status: record.status,
    description: record.description,
    monthlyCtc: record.monthlyCtc,
    components: record.components
      .map((component) => ({
        componentName: component.componentName,
        componentType: component.componentType,
        calculationType: component.calculationType,
        calculationBase: component.calculationBase,
        value: component.value,
        formulaExpression: component.formulaExpression ?? "",
        isTaxable: component.isTaxable,
        isActive: component.isActive,
        deductionFrequency: component.deductionFrequency ?? "Monthly",
      }))
      .sort((left, right) => left.componentName.localeCompare(right.componentName)),
    timesheetRules: record.timesheetRules,
  });

const rangesOverlap = (leftStart: string, leftEnd: string | null | undefined, rightStart: string, rightEnd: string | null | undefined) => {
  const leftFrom = new Date(`${leftStart}T00:00:00`).getTime();
  const leftTo = leftEnd ? new Date(`${leftEnd}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  const rightFrom = new Date(`${rightStart}T00:00:00`).getTime();
  const rightTo = rightEnd ? new Date(`${rightEnd}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;

  return leftFrom <= rightTo && rightFrom <= leftTo;
};

const normalizeComponents = (components: ComponentFormState[]): SalaryComponentDefinition[] =>
  components.map((component, index) => ({
    id: component.id || crypto.randomUUID(),
    componentName: component.componentName.trim(),
    componentType: component.componentType,
    calculationType: component.calculationType,
    calculationBase: component.calculationBase,
    value: Math.max(toNumber(component.value), 0),
    formulaExpression: component.formulaExpression.trim(),
    isTaxable: component.isTaxable,
    isActive: component.isActive,
    deductionFrequency: component.componentType === "Deduction" ? component.deductionFrequency : undefined,
    displayOrder: index + 1,
  }));

export const SalaryStructureSetupPage = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [structures, setStructures] = useState<SalaryStructureRecord[]>([]);
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [form, setForm] = useState<SalaryStructureFormState>(buildDefaultFormState);

  const loadStructures = async () => {
    setLoading(true);
    try {
      const records = await salaryStructureService.getSalaryStructures();
      setStructures(records);
    } catch {
      showToast("Unable to load salary structures right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStructures();
  }, []);

  const selectedStructure = useMemo(
    () => structures.find((structure) => structure.id === selectedStructureId) ?? null,
    [selectedStructureId, structures],
  );

  useEffect(() => {
    if (selectedStructure) {
      setForm(toFormState(selectedStructure));
      return;
    }

    setForm(buildDefaultFormState());
  }, [selectedStructure]);

  const filteredStructures = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return structures;
    }

    return structures.filter((structure) =>
      [
        structure.structureName,
        structure.structureCode,
        structure.department,
        structure.applicableRole,
        structure.employmentType,
        structure.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchText, structures]);

  const stats = useMemo(() => {
    const activeStructures = structures.filter((structure) => structure.status === "Active");
    const lastUpdated = [...structures]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
      ?.updatedAt;

    return {
      total: structures.length,
      active: activeStructures.length,
      assigned: activeStructures.reduce((sum, structure) => sum + structure.employeesAssignedCount, 0),
      lastUpdated: lastUpdated ? formatDateLabel(lastUpdated.slice(0, 10)) : "No updates yet",
    };
  }, [structures]);

  const normalizedComponents = useMemo(() => normalizeComponents(form.components), [form.components]);

  const preview = useMemo(
    () =>
      buildSalaryPreview({
        components: normalizedComponents,
        timesheetRules: {
          workingHoursPerDay: Math.max(toNumber(form.timesheetRules.workingHoursPerDay), 0),
          workingDaysPerMonth: Math.max(toNumber(form.timesheetRules.workingDaysPerMonth), 0),
          overtimeAllowed: form.timesheetRules.overtimeAllowed,
          overtimeRateType: form.timesheetRules.overtimeRateType,
          overtimeRate: Math.max(toNumber(form.timesheetRules.overtimeRate), 0),
          lateDeductionEnabled: form.timesheetRules.lateDeductionEnabled,
          lateDeductionAmount: Math.max(toNumber(form.timesheetRules.lateDeductionAmount), 0),
          leaveWithoutPayEnabled: form.timesheetRules.leaveWithoutPayEnabled,
          minimumHoursRequired: Math.max(toNumber(form.timesheetRules.minimumHoursRequired), 0),
        },
        previewInputs: {
          monthlyCtc: Math.max(toNumber(form.monthlyCtc), 0),
          overtimeHours: Math.max(toNumber(form.previewInputs.overtimeHours), 0),
          unpaidLeaveDays: Math.max(toNumber(form.previewInputs.unpaidLeaveDays), 0),
          lateEntries: Math.max(toNumber(form.previewInputs.lateEntries), 0),
          bonusAdjustment: Math.max(toNumber(form.previewInputs.bonusAdjustment), 0),
        },
      }),
    [form.monthlyCtc, form.previewInputs, form.timesheetRules, normalizedComponents],
  );

  const versionHistory = useMemo(() => {
    const selectedId = selectedStructure?.parentStructureId ?? selectedStructure?.id;
    if (!selectedId) {
      return [];
    }

    return structures
      .filter((structure) => structure.id === selectedId || structure.parentStructureId === selectedId)
      .sort((left, right) => right.versionNo - left.versionNo);
  }, [selectedStructure, structures]);

  const resetForm = () => {
    setSelectedStructureId(null);
    setForm(buildDefaultFormState());
  };

  const updateComponent = (componentId: string, patch: Partial<ComponentFormState>) => {
    setForm((current) => ({
      ...current,
      components: current.components.map((component) => (component.id === componentId ? { ...component, ...patch } : component)),
    }));
  };

  const addComponent = (componentType: SalaryComponentType) => {
    const nextName = componentType === "Earning" ? "New Earning" : "New Deduction";
    setForm((current) => ({
      ...current,
      components: [
        ...current.components,
        buildComponentRow({
          componentType,
          componentName: nextName,
          calculationType: componentType === "Deduction" ? "Percentage" : "Fixed",
          calculationBase: componentType === "Deduction" ? "Gross Salary" : "CTC",
          value: componentType === "Deduction" ? "0" : "0",
          isTaxable: componentType === "Earning",
        }),
      ],
    }));
  };

  const removeComponent = (componentId: string) => {
    setForm((current) => ({
      ...current,
      components: current.components.filter((component) => component.id !== componentId),
    }));
  };

  const handleExportSnapshot = () => {
    const blob = new Blob([JSON.stringify(structures, null, 2)], { type: "application/json;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `salary-structures-${todayInput()}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    showToast("Salary structure snapshot exported.", "success");
  };

  const handleDeactivate = async (structure: SalaryStructureRecord) => {
    setSaving(true);
    try {
      const next = await salaryStructureService.deactivateSalaryStructure(structure.id);
      setStructures(next);
      if (selectedStructureId === structure.id) {
        setSelectedStructureId(structure.id);
      }
      showToast(`${structure.structureName} moved to inactive.`, "success");
    } catch {
      showToast("Unable to deactivate this salary structure right now.", "error");
    } finally {
      setSaving(false);
    }
  };

  const buildRecordFromForm = (): SalaryStructureRecord => {
    const now = new Date().toISOString();
    const baseRecord = selectedStructure;

    return {
      id: form.id ?? crypto.randomUUID(),
      parentStructureId: form.parentStructureId ?? null,
      structureName: form.structureName.trim(),
      structureCode: form.structureCode.trim().toUpperCase(),
      applicableRole: form.applicableRole.trim(),
      department: form.department.trim(),
      employmentType: form.employmentType,
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo.trim() || null,
      status: form.status,
      versionNo: baseRecord?.versionNo ?? form.versionNo,
      description: form.description.trim(),
      monthlyCtc: Math.max(toNumber(form.monthlyCtc), 0),
      employeesAssignedCount: form.employeesAssignedCount,
      components: normalizeComponents(form.components),
      timesheetRules: {
        workingHoursPerDay: Math.max(toNumber(form.timesheetRules.workingHoursPerDay), 0),
        workingDaysPerMonth: Math.max(toNumber(form.timesheetRules.workingDaysPerMonth), 0),
        overtimeAllowed: form.timesheetRules.overtimeAllowed,
        overtimeRateType: form.timesheetRules.overtimeRateType,
        overtimeRate: Math.max(toNumber(form.timesheetRules.overtimeRate), 0),
        lateDeductionEnabled: form.timesheetRules.lateDeductionEnabled,
        lateDeductionAmount: Math.max(toNumber(form.timesheetRules.lateDeductionAmount), 0),
        leaveWithoutPayEnabled: form.timesheetRules.leaveWithoutPayEnabled,
        minimumHoursRequired: Math.max(toNumber(form.timesheetRules.minimumHoursRequired), 0),
      },
      createdBy: baseRecord?.createdBy ?? "Finance Admin",
      createdAt: baseRecord?.createdAt ?? now,
      updatedBy: "Finance Admin",
      updatedAt: now,
    };
  };

  const validateForm = (record: SalaryStructureRecord) => {
    if (!record.structureName) {
      return "Structure name is required.";
    }

    if (!record.structureCode) {
      return "Structure code is required.";
    }

    if (!record.effectiveFrom) {
      return "Effective from date is required.";
    }

    if (record.effectiveTo && record.effectiveTo < record.effectiveFrom) {
      return "Effective to date cannot be earlier than effective from date.";
    }

    if (record.components.filter((component) => component.componentType === "Earning" && component.isActive).length === 0) {
      return "At least one active earning component is required.";
    }

    if (!record.components.some((component) => component.componentType === "Earning" && component.isActive && isBasicComponent(component.componentName))) {
      return "A Basic Salary earning component is required.";
    }

    if (record.components.some((component) => component.value < 0)) {
      return "Component values cannot be negative.";
    }

    const ctcPercent = record.components
      .filter((component) => component.componentType === "Earning" && component.isActive && component.calculationType === "Percentage" && component.calculationBase === "CTC")
      .reduce((sum, component) => sum + component.value, 0);

    if (ctcPercent > 100) {
      return "Active earning percentages based on CTC cannot exceed 100%.";
    }

    if (record.timesheetRules.workingHoursPerDay <= 0) {
      return "Working hours per day must be greater than zero.";
    }

    const overlappingActiveStructure = structures.find((structure) => {
      if (structure.id === record.id) {
        return false;
      }

      if (structure.status !== "Active" || record.status !== "Active") {
        return false;
      }

      return (
        structure.department === record.department &&
        structure.employmentType === record.employmentType &&
        rangesOverlap(structure.effectiveFrom, structure.effectiveTo, record.effectiveFrom, record.effectiveTo)
      );
    });

    if (overlappingActiveStructure) {
      return "Only one active structure can exist for the same department and employment type across an overlapping effective range.";
    }

    return null;
  };

  const handleSave = async () => {
    const nextRecord = buildRecordFromForm();
    const validationError = validateForm(nextRecord);
    if (validationError) {
      showToast(validationError, "info");
      return;
    }

    setSaving(true);
    try {
      const currentSelected = selectedStructure;
      const shouldVersion =
        Boolean(currentSelected) &&
        currentSelected!.employeesAssignedCount > 0 &&
        buildRecordSignature(currentSelected!) !== buildRecordSignature(nextRecord);

      if (shouldVersion && currentSelected) {
        const versionedRecord: SalaryStructureRecord = {
          ...nextRecord,
          id: crypto.randomUUID(),
          parentStructureId: currentSelected.parentStructureId ?? currentSelected.id,
          versionNo: currentSelected.versionNo + 1,
          createdAt: new Date().toISOString(),
          createdBy: "Finance Admin",
          updatedAt: new Date().toISOString(),
          updatedBy: "Finance Admin",
          employeesAssignedCount: currentSelected.employeesAssignedCount,
        };

        const previousVersion: SalaryStructureRecord = {
          ...currentSelected,
          status: "Inactive",
          effectiveTo: currentSelected.effectiveTo ?? dayBefore(versionedRecord.effectiveFrom),
          updatedAt: new Date().toISOString(),
          updatedBy: "Finance Admin",
        };

        const replaced = await salaryStructureService.replaceSalaryStructures(
          structures.flatMap((structure) => {
            if (structure.id === currentSelected.id) {
              return [previousVersion];
            }
            return [structure];
          }).concat(versionedRecord),
        );

        setStructures(replaced);
        setSelectedStructureId(versionedRecord.id);
        showToast(`Version ${versionedRecord.versionNo} created. Existing payroll history remains unchanged.`, "success");
      } else {
        const saved = await salaryStructureService.saveSalaryStructure(nextRecord);
        setStructures((current) => {
          const next = current.some((structure) => structure.id === saved.id)
            ? current.map((structure) => (structure.id === saved.id ? saved : structure))
            : [saved, ...current];
          return [...next].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        });
        setSelectedStructureId(saved.id);
        showToast(form.id ? "Salary structure updated successfully." : "Salary structure created successfully.", "success");
      }
    } catch {
      showToast("Unable to save the salary structure right now.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading salary structure setup..." />;
  }

  const earningsRows = form.components.filter((component) => component.componentType === "Earning");
  const deductionRows = form.components.filter((component) => component.componentType === "Deduction");

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero
          title="Salary Structure Setup"
          belowTitle={
            <p className="max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
              Define salary components, allowances, deductions, and timesheet-linked payroll rules that power downstream payroll processing and export flows.
            </p>
          }
        >
          <WorkspaceHeroMeta primary="Rule engine" secondary="Used by payroll, history, and export" />
          <button type="button" onClick={resetForm} className={secondaryButtonClass}>
            <Icon name="plus" className="h-4 w-4" />
            Create New
          </button>
          <button type="button" onClick={handleExportSnapshot} className={secondaryButtonClass}>
            <Icon name="download" className="h-4 w-4" />
            Export Snapshot
          </button>
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Structures" value={stats.total} subtitle="All versions retained for payroll audit" accent="bg-zinc-400/25" />
          <StatCard label="Active Structures" value={stats.active} subtitle="Eligible for current payroll cycles" accent="bg-emerald-400/25" />
          <StatCard label="Employees Assigned" value={stats.assigned} subtitle="Active headcount linked to current salary rules" accent="bg-amber-400/25" />
          <div className="workspace-stat rounded-3xl p-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Last Updated</p>
            <p className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">{stats.lastUpdated}</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Most recent salary rule change visible to finance admins</p>
          </div>
        </div>

        <section className={`${panelClass} p-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Payroll Touchpoints</p>
              <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">These rules feed every finance-side salary calculation flow.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {payrollTouchpoints.map((item) => (
                <span
                  key={item}
                  className="inline-flex rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-black/50 dark:text-zinc-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px]">
          <div className="space-y-6">
            <section className={`${panelClass} p-6`}>
              <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">{form.id ? "Edit salary structure" : "Create salary structure"}</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Build the company’s salary formula with earnings, deductions, timesheet policy rules, and version-safe effective dates.
                  </p>
                </div>
                {form.id && form.employeesAssignedCount > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    This structure already has assigned employees. Saving changes will create a new version instead of rewriting historical payroll logic.
                  </div>
                ) : null}
              </div>

              <div className="mt-6 space-y-8">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-zinc-900 dark:text-white">Basic Structure Details</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Set identity, scope, effective dates, and the reference CTC for live preview.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Structure Name</span>
                      <input value={form.structureName} onChange={(event) => setForm((current) => ({ ...current, structureName: event.target.value }))} className={inputClass} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Structure Code</span>
                      <input value={form.structureCode} onChange={(event) => setForm((current) => ({ ...current, structureCode: event.target.value.toUpperCase() }))} className={inputClass} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Monthly CTC</span>
                      <input type="number" min="0" value={form.monthlyCtc} onChange={(event) => setForm((current) => ({ ...current, monthlyCtc: event.target.value }))} className={inputClass} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Applicable Role</span>
                      <select value={form.applicableRole} onChange={(event) => setForm((current) => ({ ...current, applicableRole: event.target.value }))} className={selectClass}>
                        {roleOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Department</span>
                      <select value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} className={selectClass}>
                        {departmentOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Employment Type</span>
                      <select value={form.employmentType} onChange={(event) => setForm((current) => ({ ...current, employmentType: event.target.value as SalaryEmploymentType }))} className={selectClass}>
                        {employmentTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Effective From</span>
                      <input type="date" value={form.effectiveFrom} onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))} className={inputClass} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Effective To</span>
                      <input type="date" value={form.effectiveTo} onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))} className={inputClass} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
                      <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SalaryStructureStatus }))} className={selectClass}>
                        {statusOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-4 block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Description</span>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      className={`${inputClass} min-h-[110px]`}
                    />
                  </label>
                </div>

                <div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-zinc-900 dark:text-white">Earnings Components</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Configure every earning line that adds value into gross salary.</p>
                    </div>
                    <button type="button" onClick={() => addComponent("Earning")} className={secondaryButtonClass}>
                      <Icon name="plus" className="h-4 w-4" />
                      Add Earning
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    {earningsRows.map((component) => (
                      <div key={component.id} className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                        <div className="grid gap-4 xl:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))_0.8fr_0.8fr_auto]">
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Component Name</span>
                            <input value={component.componentName} onChange={(event) => updateComponent(component.id, { componentName: event.target.value })} className={inputClass} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Calculation Type</span>
                            <select value={component.calculationType} onChange={(event) => updateComponent(component.id, { calculationType: event.target.value as SalaryCalculationType })} className={selectClass}>
                              {calculationTypeOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Base</span>
                            <select value={component.calculationBase} onChange={(event) => updateComponent(component.id, { calculationBase: event.target.value as SalaryCalculationBase })} className={selectClass}>
                              {calculationBaseOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Value</span>
                            <input type="number" min="0" value={component.value} onChange={(event) => updateComponent(component.id, { value: event.target.value })} className={inputClass} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Taxable</span>
                            <select value={component.isTaxable ? "Yes" : "No"} onChange={(event) => updateComponent(component.id, { isTaxable: event.target.value === "Yes" })} className={selectClass}>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Active</span>
                            <select value={component.isActive ? "Yes" : "No"} onChange={(event) => updateComponent(component.id, { isActive: event.target.value === "Yes" })} className={selectClass}>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </label>
                          <div className="flex items-end">
                            <button type="button" onClick={() => removeComponent(component.id)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {component.calculationType === "Formula" ? (
                          <label className="mt-4 block space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Formula Expression</span>
                            <input value={component.formulaExpression} onChange={(event) => updateComponent(component.id, { formulaExpression: event.target.value })} className={inputClass} placeholder="Example: Remaining CTC after fixed earnings" />
                          </label>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-zinc-900 dark:text-white">Deduction Components</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Define statutory, policy, and finance-controlled deductions.</p>
                    </div>
                    <button type="button" onClick={() => addComponent("Deduction")} className={secondaryButtonClass}>
                      <Icon name="plus" className="h-4 w-4" />
                      Add Deduction
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    {deductionRows.map((component) => (
                      <div key={component.id} className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                        <div className="grid gap-4 xl:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))_0.9fr_0.8fr_auto]">
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Deduction Name</span>
                            <input value={component.componentName} onChange={(event) => updateComponent(component.id, { componentName: event.target.value })} className={inputClass} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Calculation Type</span>
                            <select value={component.calculationType} onChange={(event) => updateComponent(component.id, { calculationType: event.target.value as SalaryCalculationType })} className={selectClass}>
                              {calculationTypeOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Base</span>
                            <select value={component.calculationBase} onChange={(event) => updateComponent(component.id, { calculationBase: event.target.value as SalaryCalculationBase })} className={selectClass}>
                              {calculationBaseOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Value</span>
                            <input type="number" min="0" value={component.value} onChange={(event) => updateComponent(component.id, { value: event.target.value })} className={inputClass} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Frequency</span>
                            <select value={component.deductionFrequency} onChange={(event) => updateComponent(component.id, { deductionFrequency: event.target.value as SalaryDeductionFrequency })} className={selectClass}>
                              {deductionFrequencyOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Active</span>
                            <select value={component.isActive ? "Yes" : "No"} onChange={(event) => updateComponent(component.id, { isActive: event.target.value === "Yes" })} className={selectClass}>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </label>
                          <div className="flex items-end">
                            <button type="button" onClick={() => removeComponent(component.id)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {component.calculationType === "Formula" ? (
                          <label className="mt-4 block space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Formula Expression</span>
                            <input value={component.formulaExpression} onChange={(event) => updateComponent(component.id, { formulaExpression: event.target.value })} className={inputClass} placeholder="Example: tax slab rule or external deduction engine reference" />
                          </label>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-base font-semibold text-zinc-900 dark:text-white">Timesheet-Based Rules</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Connect salary logic with attendance, minimum hours, overtime, and leave-without-pay behavior.</p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Working Hours / Day</span>
                      <input type="number" min="0" value={form.timesheetRules.workingHoursPerDay} onChange={(event) => setForm((current) => ({ ...current, timesheetRules: { ...current.timesheetRules, workingHoursPerDay: event.target.value } }))} className={inputClass} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Working Days / Month</span>
                      <input type="number" min="0" value={form.timesheetRules.workingDaysPerMonth} onChange={(event) => setForm((current) => ({ ...current, timesheetRules: { ...current.timesheetRules, workingDaysPerMonth: event.target.value } }))} className={inputClass} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Minimum Required Hours</span>
                      <input type="number" min="0" value={form.timesheetRules.minimumHoursRequired} onChange={(event) => setForm((current) => ({ ...current, timesheetRules: { ...current.timesheetRules, minimumHoursRequired: event.target.value } }))} className={inputClass} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Overtime Allowed</span>
                      <select value={form.timesheetRules.overtimeAllowed ? "Yes" : "No"} onChange={(event) => setForm((current) => ({ ...current, timesheetRules: { ...current.timesheetRules, overtimeAllowed: event.target.value === "Yes" } }))} className={selectClass}>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Overtime Rate Type</span>
                      <select value={form.timesheetRules.overtimeRateType} onChange={(event) => setForm((current) => ({ ...current, timesheetRules: { ...current.timesheetRules, overtimeRateType: event.target.value as SalaryOvertimeRateType } }))} className={selectClass}>
                        {overtimeRateOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Overtime Rate</span>
                      <input type="number" min="0" value={form.timesheetRules.overtimeRate} onChange={(event) => setForm((current) => ({ ...current, timesheetRules: { ...current.timesheetRules, overtimeRate: event.target.value } }))} className={inputClass} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Late Deduction Enabled</span>
                      <select value={form.timesheetRules.lateDeductionEnabled ? "Yes" : "No"} onChange={(event) => setForm((current) => ({ ...current, timesheetRules: { ...current.timesheetRules, lateDeductionEnabled: event.target.value === "Yes" } }))} className={selectClass}>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Late Deduction Amount</span>
                      <input type="number" min="0" value={form.timesheetRules.lateDeductionAmount} onChange={(event) => setForm((current) => ({ ...current, timesheetRules: { ...current.timesheetRules, lateDeductionAmount: event.target.value } }))} className={inputClass} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Leave Without Pay</span>
                      <select value={form.timesheetRules.leaveWithoutPayEnabled ? "Yes" : "No"} onChange={(event) => setForm((current) => ({ ...current, timesheetRules: { ...current.timesheetRules, leaveWithoutPayEnabled: event.target.value === "Yes" } }))} className={selectClass}>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                <button type="button" onClick={() => void handleSave()} disabled={saving} className={primaryButtonClass}>
                  <Icon name="settings" className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Structure"}
                </button>
                <button type="button" onClick={resetForm} className={secondaryButtonClass}>
                  <Icon name="close" className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className={`${panelClass} p-6`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Formula Preview</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Test the salary formula against a sample monthly run before saving.</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  Live
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Overtime Hours</span>
                  <input type="number" min="0" value={form.previewInputs.overtimeHours} onChange={(event) => setForm((current) => ({ ...current, previewInputs: { ...current.previewInputs, overtimeHours: event.target.value } }))} className={inputClass} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Unpaid Leave Days</span>
                  <input type="number" min="0" value={form.previewInputs.unpaidLeaveDays} onChange={(event) => setForm((current) => ({ ...current, previewInputs: { ...current.previewInputs, unpaidLeaveDays: event.target.value } }))} className={inputClass} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Late Entries</span>
                  <input type="number" min="0" value={form.previewInputs.lateEntries} onChange={(event) => setForm((current) => ({ ...current, previewInputs: { ...current.previewInputs, lateEntries: event.target.value } }))} className={inputClass} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Bonus / Incentive</span>
                  <input type="number" min="0" value={form.previewInputs.bonusAdjustment} onChange={(event) => setForm((current) => ({ ...current, previewInputs: { ...current.previewInputs, bonusAdjustment: event.target.value } }))} className={inputClass} />
                </label>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Monthly CTC</p>
                  <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{formatCurrency(toNumber(form.monthlyCtc))}</p>
                </div>
                <div className="rounded-[1.5rem] border border-emerald-200/80 bg-emerald-50/80 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <p className="text-sm text-emerald-700 dark:text-emerald-200">Net Salary</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(preview.netSalary)}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Earnings</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(preview.totalEarnings)}</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {preview.earnings.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.meta}</p>
                        </div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(item.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Deductions</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(preview.totalDeductions)}</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {preview.deductions.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.meta}</p>
                        </div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(item.amount)}</p>
                      </div>
                    ))}
                    {preview.deductions.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No active deductions configured.</p> : null}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Timesheet Adjustments</p>
                    <p className={`text-sm font-semibold ${preview.totalAdjustmentImpact >= 0 ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"}`}>
                      {preview.totalAdjustmentImpact >= 0 ? "+" : ""}
                      {formatCurrency(preview.totalAdjustmentImpact)}
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {preview.adjustments.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.meta}</p>
                        </div>
                        <p className={`text-sm font-semibold ${item.amount >= 0 ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"}`}>
                          {item.amount >= 0 ? "+" : ""}
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                    ))}
                    {preview.adjustments.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No preview adjustments applied.</p> : null}
                  </div>
                </div>
              </div>

              {preview.warnings.length > 0 ? (
                <div className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">Preview Warnings</p>
                  <div className="mt-3 space-y-2 text-sm text-amber-700 dark:text-amber-100">
                    {preview.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className={`${panelClass} p-6`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">{selectedStructure ? "Selected Structure" : "Governance Notes"}</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {selectedStructure
                      ? "Track versioning, assignments, and effective dates for the structure currently under review."
                      : "Use versioning instead of rewriting history once payroll has used a structure."}
                  </p>
                </div>
                {selectedStructure ? (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                    V{selectedStructure.versionNo}
                  </span>
                ) : null}
              </div>

              {selectedStructure ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{selectedStructure.structureName}</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {selectedStructure.structureCode} · {selectedStructure.department} · {selectedStructure.employmentType}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Effective Window</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{getEffectiveWindowLabel(selectedStructure)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Assigned Employees</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{selectedStructure.employeesAssignedCount}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Last Updated By</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{selectedStructure.updatedBy}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Status</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{selectedStructure.status}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Version History</p>
                    <div className="mt-4 space-y-3">
                      {versionHistory.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                              Version {item.versionNo} · {item.status}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{getEffectiveWindowLabel(item)}</p>
                          </div>
                          <button type="button" onClick={() => setSelectedStructureId(item.id)} className="text-sm font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-3 rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                  <p>Never directly overwrite a salary structure that has already been used in payroll.</p>
                  <p>Use a new effective date and version number when compensation policy changes.</p>
                  <p>Keep only one active structure per department and employment type across overlapping dates.</p>
                </div>
              )}
            </section>
          </div>
        </div>

        <section className={panelClass}>
          <div className="flex flex-col gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Existing Salary Structures</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Review active, draft, and inactive structures with version-safe edit and deactivate actions.</p>
            </div>
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search structure, code, department, or role" className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50/90 dark:bg-black/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  <th className="px-6 py-4">Structure</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Employment</th>
                  <th className="px-6 py-4">Version</th>
                  <th className="px-6 py-4">Effective Window</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Assigned</th>
                  <th className="px-6 py-4">Reference CTC</th>
                  <th className="px-6 py-4">Last Updated</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredStructures.map((structure) => (
                  <tr key={structure.id} className={selectedStructureId === structure.id ? "bg-brand-50/60 dark:bg-brand-500/10" : "transition hover:bg-zinc-50/70 dark:hover:bg-black/40"}>
                    <td className="px-6 py-4 align-top">
                      <p className="font-semibold text-zinc-900 dark:text-white">{structure.structureName}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {structure.structureCode} · {structure.applicableRole}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{structure.department}</td>
                    <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{structure.employmentType}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white">V{structure.versionNo}</td>
                    <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{getEffectiveWindowLabel(structure)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          structure.status === "Active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                            : structure.status === "Draft"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        }`}
                      >
                        {structure.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{structure.employeesAssignedCount}</td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-white">{formatCurrency(structure.monthlyCtc)}</td>
                    <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">{formatDateLabel(structure.updatedAt.slice(0, 10))}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setSelectedStructureId(structure.id)} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900">
                          <Icon name="eye" className="h-4 w-4" />
                          View
                        </button>
                        <button type="button" onClick={() => setSelectedStructureId(structure.id)} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900">
                          <Icon name="edit" className="h-4 w-4" />
                          Edit
                        </button>
                        <button type="button" onClick={() => void handleDeactivate(structure)} disabled={saving || structure.status === "Inactive"} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                          <Icon name="trash" className="h-4 w-4" />
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStructures.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No salary structures match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>
  );
};

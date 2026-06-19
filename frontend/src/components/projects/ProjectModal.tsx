import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useRef } from "react";
import type { Employee } from "../../types/employee";
import { formatUserRoles, hasUserRole, type UserRole } from "../../types/roles";
import type { Project, ProjectPriority, ProjectStatus } from "../../types/project";
import { Icon } from "../Icon";

interface ProjectFormValues {
  name: string;
  code: string;
  description: string;
  clientBusinessUnit: string;
  department: string;
  deliveryModel: string;
  managerId: string;
  teamMemberIds: string[];
  budget: string;
  isBillable: boolean;
  priority: ProjectPriority;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
}

interface ProjectModalProps {
  open: boolean;
  project: Project | null;
  projects: Project[];
  departments: string[];
  employees: Employee[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
}

type TeamMemberSortOption = "name-asc" | "name-desc";
type TeamMemberRoleFilter = "All" | UserRole;
type DropdownOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

const emptyForm: ProjectFormValues = {
  name: "",
  code: "",
  description: "",
  clientBusinessUnit: "",
  department: "Engineering",
  deliveryModel: "Dedicated Squad",
  managerId: "",
  teamMemberIds: [],
  budget: "",
  isBillable: true,
  priority: "Medium",
  startDate: "",
  endDate: "",
  status: "Pending",
};

const buildNextProjectCode = (projects: Project[]) => {
  const currentYear = new Date().getFullYear();
  const matchingProjects = projects
    .map((item) => {
      const match = item.code.match(/^PRJ-(\d{4})-(\d{3})$/i);
      if (!match) {
        return null;
      }

      return {
        year: Number(match[1]),
        sequence: Number(match[2]),
      };
    })
    .filter((item): item is { year: number; sequence: number } => Boolean(item))
    .filter((item) => item.year === currentYear);

  const nextSequence =
    matchingProjects.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;

  return `PRJ-${currentYear}-${String(nextSequence).padStart(3, "0")}`;
};

const buildEffectiveTeamMemberIds = (teamMemberIds: string[], managerId: string) =>
  Array.from(new Set([...(managerId ? [managerId] : []), ...teamMemberIds.filter((id) => id !== managerId)]));

const PROJECT_TEAM_PICKER_ROLES = new Set<UserRole>(["Employee", "Team Manager", "HR Manager", "Finance Admin", "System Admin"]);
const PROJECT_BILLABILITY_OPTIONS: Array<DropdownOption<"Billable" | "Internal">> = [
  { value: "Billable", label: "Billable (Client)" },
  { value: "Internal", label: "Non-Billable (Internal)" },
];
const PROJECT_DELIVERY_MODEL_OPTIONS: Array<DropdownOption<string>> = [
  { value: "Dedicated Squad", label: "Dedicated Squad" },
  { value: "Time & Material", label: "Time & Material" },
  { value: "Fixed Scope", label: "Fixed Scope" },
  { value: "Internal Product", label: "Internal Product" },
  { value: "Support / Maintenance", label: "Support / Maintenance" },
];
const PROJECT_PRIORITY_OPTIONS: Array<DropdownOption<ProjectPriority>> = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];
const PROJECT_STATUS_OPTIONS: Array<DropdownOption<ProjectStatus>> = [
  { value: "Active", label: "Active" },
  { value: "Completed", label: "Completed" },
  { value: "Pending", label: "Pending" },
  { value: "On Hold", label: "On Hold" },
];
const TEAM_MEMBER_SORT_OPTIONS: Array<{ value: TeamMemberSortOption; label: string }> = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
];
const TEAM_MEMBER_ROLE_FILTER_OPTIONS: Array<{ value: TeamMemberRoleFilter; label: string }> = [
  { value: "All", label: "All Roles" },
  { value: "Team Manager", label: "Team Manager" },
  { value: "HR Manager", label: "HR Manager" },
  { value: "Finance Admin", label: "Finance Admin" },
  { value: "System Admin", label: "System Admin" },
  { value: "Employee", label: "Employee" },
];
const TEAM_MEMBER_DEPARTMENT_PRIORITY = new Map([
  ["operations", 0],
  ["management", 1],
  ["hr", 2],
]);

const isProjectContributor = (employee: Employee) =>
  employee.status === "Active" && Array.from(PROJECT_TEAM_PICKER_ROLES).some((role) => hasUserRole(employee.roles, role));

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");
const renderFieldLabel = (label: string, required = false) => (
  <>
    {label}
    {required ? <span className="ml-1 text-rose-500">*</span> : null}
  </>
);

const getTeamMemberDepartmentKey = (department: string) => {
  const normalized = department.trim().toLowerCase();
  if (normalized === "human resources" || normalized === "hr") {
    return "hr";
  }

  return normalized || "unassigned";
};

const getTeamMemberDepartmentLabel = (department: string) => {
  const normalized = department.trim().toLowerCase();
  if (normalized === "human resources" || normalized === "hr") {
    return "HR";
  }

  return department.trim() || "Unassigned";
};

const compareTeamMemberNames = (left: Employee, right: Employee) =>
  left.fullName.localeCompare(right.fullName, undefined, { sensitivity: "base" });

const sortTeamMembers = (employees: Employee[], sortOption: TeamMemberSortOption) =>
  [...employees].sort((left, right) => {
    const nameDifference = compareTeamMemberNames(left, right);
    return sortOption === "name-desc" ? -nameDifference : nameDifference;
  });

interface TeamMemberFilterDropdownProps<T extends string> {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onSelect: (value: T) => void;
  panelAlign?: "left" | "right";
  variant?: "filter" | "field";
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  showOptionMeta?: boolean;
}

function TeamMemberFilterDropdown<T extends string>({
  label,
  value,
  options,
  onSelect,
  panelAlign = "left",
  variant = "filter",
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search",
  showOptionMeta = true,
}: TeamMemberFilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const isFieldVariant = variant === "field";
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return options;
    }

    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      return;
    }

    if (searchable) {
      searchInputRef.current?.focus();
    }
  }, [open, searchable]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={classNames(
          "group relative flex w-full items-center justify-between gap-3 overflow-hidden border text-left text-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-200 dark:focus-visible:ring-white/10",
          isFieldVariant
            ? "min-h-[3.5rem] rounded-2xl border-zinc-200 bg-white px-4 py-3 text-zinc-600 shadow-[0_14px_28px_-26px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50/90 hover:shadow-[0_18px_34px_-26px_rgba(0,0,0,0.18)] dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:border-white/10 dark:hover:bg-zinc-950"
            : "rounded-[1.35rem] border-zinc-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,238,238,0.94))] px-4 py-3 text-zinc-600 shadow-[0_16px_34px_-26px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_18px_38px_-24px_rgba(0,0,0,0.18)] dark:border-zinc-700 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))] dark:text-zinc-200 dark:hover:border-white/10",
          disabled && "cursor-not-allowed opacity-60 hover:translate-y-0 hover:border-zinc-200 hover:bg-white hover:shadow-none dark:hover:border-zinc-700 dark:hover:bg-black",
        )}
      >
        {isFieldVariant ? (
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {selectedOption?.label ?? value}
          </span>
        ) : (
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</span>
            <span className="mt-1 block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selectedOption?.label ?? value}</span>
          </div>
        )}
        <span
          className={classNames(
            "flex h-9 w-9 items-center justify-center rounded-2xl text-zinc-500 transition",
            isFieldVariant
              ? "bg-zinc-50 group-hover:bg-white group-hover:text-zinc-700 dark:bg-black dark:text-zinc-400 dark:group-hover:bg-white/10 dark:group-hover:text-zinc-100"
              : "bg-zinc-100/90 group-hover:bg-white group-hover:text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:group-hover:bg-white/10 dark:group-hover:text-zinc-100",
          )}
        >
          <Icon name="chevron-down" className={classNames("h-4 w-4 transition", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          className={classNames(
            "absolute top-full z-30 mt-2 min-w-full overflow-hidden rounded-[1.25rem] border border-zinc-200/90 bg-white/98 p-2 shadow-panel backdrop-blur-xl dark:border-zinc-700 dark:bg-black/98",
            panelAlign === "right" ? "right-0" : "left-0",
          )}
        >
          {searchable ? (
            <div className="px-1 pb-2">
              <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500 focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400 dark:focus-within:border-white/10 dark:focus-within:ring-white/10">
                <Icon name="search" className="h-4 w-4 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={`${label} search`}
                  className="w-full border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </label>
            </div>
          ) : null}

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">No matching options found.</p>
            ) : null}

            {filteredOptions.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className={classNames(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    isSelected
                      ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(232,232,232,0.82))] text-zinc-800 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] dark:text-white"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{option.label}</p>
                    {showOptionMeta && option.description ? (
                      <p className={classNames("mt-0.5 text-xs", isSelected ? "text-zinc-500 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-500")}>
                        {option.description}
                      </p>
                    ) : showOptionMeta && isSelected ? (
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-300">Current</p>
                    ) : null}
                  </div>
                  <span
                    className={classNames(
                      "h-2.5 w-2.5 rounded-full transition",
                      isSelected
                        ? "bg-zinc-500 shadow-[0_0_0_4px_rgba(148,148,148,0.12)] dark:bg-zinc-200"
                        : "border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-black",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const ProjectModal = ({ open, project, projects, departments, employees, loading, onClose, onSubmit }: ProjectModalProps) => {
  useBodyScrollLock(open);
  const activeEmployees = useMemo(() => employees.filter((employee) => employee.status === "Active"), [employees]);
  const contributorEmployees = useMemo(() => employees.filter(isProjectContributor), [employees]);
  const managers = useMemo(() => {
    const selectedManager = project ? employees.find((employee) => employee.id === project.managerId) ?? null : null;

    if (selectedManager && !activeEmployees.some((employee) => employee.id === selectedManager.id)) {
      return [selectedManager, ...activeEmployees];
    }

    return activeEmployees;
  }, [activeEmployees, employees, project]);
  const departmentOptions = useMemo(() => {
    const unique = new Set(departments);
    employees.forEach((employee) => unique.add(employee.department));
    if (project?.department) {
      unique.add(project.department);
    }
    return Array.from(unique).sort((left, right) => left.localeCompare(right));
  }, [departments, employees, project?.department]);
  const nextProjectCode = useMemo(() => buildNextProjectCode(projects), [projects]);
  const [form, setForm] = useState<ProjectFormValues>(emptyForm);
  const [error, setError] = useState("");
  const [teamMemberSearch, setTeamMemberSearch] = useState("");
  const [teamMemberSort, setTeamMemberSort] = useState<TeamMemberSortOption>("name-asc");
  const [teamMemberRoleFilter, setTeamMemberRoleFilter] = useState<TeamMemberRoleFilter>("All");
  const [teamMemberDepartmentFilter, setTeamMemberDepartmentFilter] = useState("All");
  const selectedManager = useMemo(() => employees.find((employee) => employee.id === form.managerId) ?? null, [employees, form.managerId]);
  const projectDepartmentSelectOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      { value: "", label: "Select department" },
      ...departmentOptions.map((department) => ({ value: department, label: department })),
    ],
    [departmentOptions],
  );
  const managerSelectOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      {
        value: "",
        label: managers.length === 0 ? "No user available" : "Select project manager",
      },
      ...managers.map((manager) => ({
        value: manager.id,
        label: manager.fullName,
      })),
    ],
    [managers],
  );
  const teamMemberDepartmentFilterOptions = useMemo(() => {
    const departments = new Map<string, string>();

    contributorEmployees.forEach((employee) => {
      const key = getTeamMemberDepartmentKey(employee.department);
      if (!departments.has(key)) {
        departments.set(key, getTeamMemberDepartmentLabel(employee.department));
      }
    });

    return [
      { value: "All", label: "All Departments" },
      ...Array.from(departments.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => {
          const leftPriority = TEAM_MEMBER_DEPARTMENT_PRIORITY.get(left.value) ?? Number.MAX_SAFE_INTEGER;
          const rightPriority = TEAM_MEMBER_DEPARTMENT_PRIORITY.get(right.value) ?? Number.MAX_SAFE_INTEGER;

          if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
          }

          return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
        }),
    ];
  }, [contributorEmployees]);

  const filteredTeamMembers = useMemo(() => {
    const query = teamMemberSearch.trim().toLowerCase();
    return contributorEmployees.filter((employee) => {
      if (teamMemberRoleFilter !== "All" && !hasUserRole(employee.roles, teamMemberRoleFilter)) {
        return false;
      }

      const departmentKey = getTeamMemberDepartmentKey(employee.department);
      if (teamMemberDepartmentFilter !== "All" && departmentKey !== teamMemberDepartmentFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = `${employee.fullName} ${formatUserRoles(employee.roles)} ${employee.department} ${employee.email}`.toLowerCase();
      return searchableText.includes(query);
    });
  }, [contributorEmployees, teamMemberDepartmentFilter, teamMemberRoleFilter, teamMemberSearch]);
  const sortedTeamMembers = useMemo(
    () => sortTeamMembers(filteredTeamMembers, teamMemberSort),
    [filteredTeamMembers, teamMemberSort],
  );
  const effectiveTeamMemberIds = useMemo(
    () => buildEffectiveTeamMemberIds(form.teamMemberIds, form.managerId),
    [form.managerId, form.teamMemberIds],
  );
  const selectedTeamMemberCount = effectiveTeamMemberIds.length;
  const projectNamesByEmployeeId = useMemo(() => {
    const namesByEmployeeId = new Map<string, string[]>();

    projects.forEach((existingProject) => {
      if (existingProject.id === project?.id) {
        return;
      }

      new Set([existingProject.managerId, ...existingProject.teamMemberIds].filter(Boolean)).forEach((employeeId) => {
        namesByEmployeeId.set(employeeId, [...(namesByEmployeeId.get(employeeId) ?? []), existingProject.name]);
      });
    });

    return namesByEmployeeId;
  }, [project?.id, projects]);
  const selectedProjectConflictAlerts = useMemo(
    () =>
      form.teamMemberIds
        .map((employeeId) => {
          const assignedProjectNames = projectNamesByEmployeeId.get(employeeId) ?? [];
          const employee = employees.find((item) => item.id === employeeId) ?? null;
          return employee && assignedProjectNames.length > 0 ? { employee, assignedProjectNames } : null;
        })
        .filter((item): item is { employee: Employee; assignedProjectNames: string[] } => Boolean(item)),
    [employees, form.teamMemberIds, projectNamesByEmployeeId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (project) {
      setForm({
        name: project.name,
        code: project.code,
        description: project.description,
        clientBusinessUnit: project.clientBusinessUnit,
        department: project.department,
        deliveryModel: project.deliveryModel,
        managerId: project.managerId,
        teamMemberIds: project.teamMemberIds.filter((id) => id !== project.managerId && contributorEmployees.some((employee) => employee.id === id)),
        budget: String(project.budget),
        isBillable: project.isBillable,
        priority: project.priority,
        startDate: project.startDate,
        endDate: project.endDate,
        status: project.status,
      });
      setError("");
      setTeamMemberSearch("");
      setTeamMemberSort("name-asc");
      setTeamMemberRoleFilter("All");
      setTeamMemberDepartmentFilter("All");
      return;
    }

    setForm({
      ...emptyForm,
      code: nextProjectCode,
      managerId: managers[0]?.id ?? "",
    });
    setError("");
    setTeamMemberSearch("");
    setTeamMemberSort("name-asc");
    setTeamMemberRoleFilter("All");
    setTeamMemberDepartmentFilter("All");
  }, [contributorEmployees, managers, nextProjectCode, open, project]);

  if (!open) {
    return null;
  }

  const sectionClass = "rounded-[2rem] border border-zinc-200 bg-white/95 p-6 dark:border-zinc-800 dark:bg-black/60";
  const inputClass =
    "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-300 focus:ring-4 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:focus:border-white/10 dark:focus:ring-white/10";
  const labelClass = "mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300";

  const toggleTeamMember = (employeeId: string) => {
    if (employeeId === form.managerId) {
      return;
    }

    setForm((current) => ({
      ...current,
      teamMemberIds: current.teamMemberIds.includes(employeeId)
        ? current.teamMemberIds.filter((id) => id !== employeeId)
        : [...current.teamMemberIds, employeeId],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !form.name.trim() ||
      !form.code.trim() ||
      !form.description.trim() ||
      !form.managerId ||
      !form.startDate ||
      !form.endDate ||
      !form.budget.trim()
    ) {
      setError("Please complete all required fields.");
      return;
    }
    const budget = Number(form.budget);
    if (Number.isNaN(budget) || budget < 0) {
      setError("Budget must be a valid non-negative number.");
      return;
    }
    if (form.isBillable && !form.clientBusinessUnit.trim()) {
      setError("Client name is required for billable projects.");
      return;
    }
    if (form.endDate < form.startDate) {
      setError("End date must be later than start date.");
      return;
    }
    setError("");
    await onSubmit({
      ...form,
      teamMemberIds: effectiveTeamMemberIds,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      clientBusinessUnit: form.isBillable ? form.clientBusinessUnit.trim() : form.clientBusinessUnit.trim() || "Internal",
      deliveryModel: form.deliveryModel.trim() || "Dedicated Squad",
      budget: budget.toFixed(2),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2.25rem] border border-white/70 bg-white/95 px-7 py-6 shadow-panel dark:border-zinc-800 dark:bg-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-300">
              {project ? "Edit Project" : "Add Project"}
            </p>
            <h2 className="mt-3 text-[2rem] font-bold tracking-tight text-zinc-900 dark:text-white">Project details</h2>
            <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">Set ownership, timeline, team members, and delivery status.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-white p-3 text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
            aria-label="Close project modal"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className={sectionClass}>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-300">Basic Info</p>
            <h3 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">Project master data</h3>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className={labelClass}>{renderFieldLabel("Project Name", true)}</label>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={inputClass}
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className={labelClass}>Project Code</label>
              <input
                value={form.code}
                readOnly={!project}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                className={inputClass}
                placeholder="PRJ-2026-001"
              />
              {!project ? <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Project code is auto-generated.</p> : null}
            </div>
            </div>

          <div className="mt-5">
            <label className={labelClass}>{renderFieldLabel("Description", true)}</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className={inputClass}
              placeholder="Describe scope, outcomes, and success metrics"
            />
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className={labelClass}>Billability</label>
              <TeamMemberFilterDropdown
                label="Billability"
                value={form.isBillable ? "Billable" : "Internal"}
                options={PROJECT_BILLABILITY_OPTIONS}
                onSelect={(value) => {
                  const isBillable = value === "Billable";
                  setForm((current) => ({
                    ...current,
                    isBillable,
                    clientBusinessUnit: isBillable
                      ? (current.clientBusinessUnit.trim().toLowerCase() === "internal" ? "" : current.clientBusinessUnit)
                      : current.clientBusinessUnit.trim() || "Internal",
                  }));
                }}
                variant="field"
              />
            </div>
            <div>
              <label className={labelClass}>{renderFieldLabel(form.isBillable ? "Client Name" : "Internal Unit", form.isBillable)}</label>
              <input
                value={form.clientBusinessUnit}
                onChange={(event) => setForm((current) => ({ ...current, clientBusinessUnit: event.target.value }))}
                className={inputClass}
                placeholder={form.isBillable ? "Client name" : "Internal"}
              />
            </div>
            <div>
              <label className={labelClass}>Project Type</label>
              <TeamMemberFilterDropdown
                label="Project Type"
                value={form.deliveryModel}
                options={PROJECT_DELIVERY_MODEL_OPTIONS}
                onSelect={(value) => setForm((current) => ({ ...current, deliveryModel: value }))}
                variant="field"
              />
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <TeamMemberFilterDropdown
                label="Department"
                value={form.department}
                options={projectDepartmentSelectOptions}
                onSelect={(value) => setForm((current) => ({ ...current, department: value }))}
                variant="field"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <div>
              <label className={labelClass}>{renderFieldLabel("Budget / Planned Cost", true)}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.budget}
                onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))}
                className={inputClass}
                placeholder="50000"
              />
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <TeamMemberFilterDropdown
                label="Priority"
                value={form.priority}
                options={PROJECT_PRIORITY_OPTIONS}
                onSelect={(value) => setForm((current) => ({ ...current, priority: value }))}
                variant="field"
              />
            </div>
            <div>
              <label className={labelClass}>{renderFieldLabel("Assign Project Manager", true)}</label>
              <TeamMemberFilterDropdown
                label="Assign Project Manager"
                value={form.managerId}
                options={managerSelectOptions}
                onSelect={(managerId) => {
                  setForm((current) => ({
                    ...current,
                    managerId,
                    teamMemberIds: current.teamMemberIds.filter((id) => id !== managerId),
                  }));
                }}
                variant="field"
                disabled={managerSelectOptions.length <= 1}
                searchable
                searchPlaceholder="Search manager by name"
                showOptionMeta={false}
              />
              {managers.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-300">
                  No active users are available for manager assignment right now.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <div>
              <label className={labelClass}>{renderFieldLabel("Start Date", true)}</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{renderFieldLabel("End Date", true)}</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <TeamMemberFilterDropdown
                label="Status"
                value={form.status}
                options={PROJECT_STATUS_OPTIONS}
                onSelect={(value) => setForm((current) => ({ ...current, status: value }))}
                variant="field"
              />
            </div>
          </div>
          </div>

          <div className={sectionClass}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Contributor Employees</label>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{selectedTeamMemberCount} team member(s) selected</span>
            </div>
            <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">This picker lists active Employees, Team Managers, HR Managers, Finance Admins, and System Admins. Use the premium filters below to narrow contributors quickly.</p>
            <div className="mb-4 rounded-2xl border border-zinc-300 bg-white/75 px-4 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-300">Assigned Manager</p>
              {selectedManager ? (
                <p className="mt-1 font-semibold text-zinc-900 dark:text-white">
                  {selectedManager.fullName}
                  <span className="font-normal text-zinc-500 dark:text-zinc-400"> - {formatUserRoles(selectedManager.roles)} - {selectedManager.department}</span>
                </p>
              ) : (
                <p className="mt-1 font-semibold text-zinc-600 dark:text-zinc-300">Select a team manager above before assigning contributors.</p>
              )}
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-black/70">
              <label className="mb-4 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-black">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
                </svg>
                <input
                  value={teamMemberSearch}
                  onChange={(event) => setTeamMemberSearch(event.target.value)}
                  placeholder="Search team members by name, department, role, or email"
                  className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200 dark:placeholder:text-zinc-500"
                />
              </label>

              <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.25fr)_minmax(240px,0.9fr)]">
                  <TeamMemberFilterDropdown
                    label="Role"
                    value={teamMemberRoleFilter}
                    options={TEAM_MEMBER_ROLE_FILTER_OPTIONS}
                    onSelect={(value) => setTeamMemberRoleFilter(value)}
                  />

                  <TeamMemberFilterDropdown
                    label="Department"
                    value={teamMemberDepartmentFilter}
                    options={teamMemberDepartmentFilterOptions}
                    onSelect={(value) => setTeamMemberDepartmentFilter(value)}
                  />

                  <TeamMemberFilterDropdown
                    label="Sort By"
                    value={teamMemberSort}
                    options={TEAM_MEMBER_SORT_OPTIONS}
                    onSelect={(value) => setTeamMemberSort(value)}
                    panelAlign="right"
                  />
              </div>

              {selectedProjectConflictAlerts.length > 0 ? (
                <div className="mb-3 rounded-2xl border border-zinc-300 bg-white/80 px-4 py-3 text-xs leading-5 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200">
                  <p className="font-semibold">Note: selected employee already exists in another project.</p>
                  {selectedProjectConflictAlerts.map(({ employee, assignedProjectNames }) => (
                    <p key={employee.id}>
                      {employee.fullName} is already added to {assignedProjectNames.slice(0, 2).join(", ")}
                      {assignedProjectNames.length > 2 ? ` and ${assignedProjectNames.length - 2} more project(s)` : ""}. You can still save this project.
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {sortedTeamMembers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-400">
                    No active team members match your search.
                  </div>
                ) : sortedTeamMembers.map((employee) => {
                  const assignedProjectNames = projectNamesByEmployeeId.get(employee.id) ?? [];
                  const isAssignedManager = employee.id === form.managerId;
                  const selected = effectiveTeamMemberIds.includes(employee.id);

                  return (
                    <label
                      key={employee.id}
                      className={classNames(
                        "flex items-center gap-3 rounded-2xl border px-4 py-4 text-sm text-zinc-700 transition",
                        isAssignedManager && "cursor-default",
                        selected && assignedProjectNames.length > 0
                          ? "border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/10 dark:text-zinc-100"
                          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:border-white/10 dark:hover:bg-zinc-900",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={isAssignedManager}
                        onChange={() => toggleTeamMember(employee.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                      />
                      <div>
                        <p className="font-semibold text-zinc-800 dark:text-white">{employee.fullName}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatUserRoles(employee.roles)} - {employee.department}
                        </p>
                        {selected && assignedProjectNames.length > 0 ? (
                          <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                            Already in {assignedProjectNames.slice(0, 2).join(", ")}
                            {assignedProjectNames.length > 2 ? ` +${assignedProjectNames.length - 2} more` : ""}. Still addable.
                          </p>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {error && <p className="rounded-2xl border border-zinc-300 bg-white/80 px-4 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200">{error}</p>}

          <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl border border-zinc-300 bg-zinc-950 px-6 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              {loading ? "Saving..." : "Save Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


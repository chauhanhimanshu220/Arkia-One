import { useEffect, useMemo, useState } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import type { DepartmentDetail } from "../../types/department";
import { Icon } from "../Icon";

type DetailTab = "Overview" | "Employees" | "Projects" | "Approval / Policy" | "History";

interface DepartmentDetailsDrawerProps {
  open: boolean;
  department: DepartmentDetail | null;
  loading: boolean;
  onClose: () => void;
}

const TABS: DetailTab[] = ["Overview", "Employees", "Projects", "Approval / Policy", "History"];

const statusTone = (status: DepartmentDetail["status"]) =>
  status === "Active"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const DepartmentDetailsDrawer = ({ open, department, loading, onClose }: DepartmentDetailsDrawerProps) => {
  useBodyScrollLock(open);
  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");

  useEffect(() => {
    if (open) {
      setActiveTab("Overview");
    }
  }, [department?.id, open]);

  const summaryCards = useMemo(() => {
    if (!department) {
      return [];
    }

    return [
      { label: "Employees", value: department.employeeCount },
      { label: "Active Employees", value: department.activeEmployeeCount },
      { label: "Projects", value: department.projectCount },
      { label: "Active Projects", value: department.activeProjectCount },
    ];
  }, [department]);

  if (!open) {
    return null;
  }

  const cardClass = "rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-black/70";
  const metricCardClass = "rounded-3xl border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-black/70";
  const tableShellClass = "mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black/70";
  const tableHeadClass = "bg-zinc-50 dark:bg-black/80";
  const tableRowTextClass = "px-5 py-4 text-sm text-zinc-700 dark:text-zinc-200";
  const tabClass = (selected: boolean) =>
    selected
      ? "bg-zinc-950 dark:bg-white text-white dark:text-black"
      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/70 bg-white px-6 py-6 text-zinc-900 shadow-panel dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600 dark:text-zinc-400 dark:text-zinc-500">Department Profile</p>
            <h2 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
              {loading ? "Loading..." : department?.name ?? "Department details"}
            </h2>
            {department ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{department.code}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(department.status)}`}>{department.status}</span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-white p-3 text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
            aria-label="Close department details"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {loading || !department ? (
          <div className="mt-8 rounded-3xl border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Loading the latest department details...
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div key={card.label} className={metricCardClass}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tabClass(activeTab === tab)}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "Overview" ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className={cardClass}>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Overview</p>
                  <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                    <p><span className="font-semibold text-zinc-800 dark:text-zinc-100">Parent Department:</span> {department.parentDepartmentName ?? "None"}</p>
                    <p><span className="font-semibold text-zinc-800 dark:text-zinc-100">Department Head:</span> {department.headEmployeeName ?? "Not assigned"}</p>
                    <p><span className="font-semibold text-zinc-800 dark:text-zinc-100">Email Alias:</span> {department.emailAlias || "Not configured"}</p>
                    <p><span className="font-semibold text-zinc-800 dark:text-zinc-100">Cost Center:</span> {department.costCenter || "Not configured"}</p>
                    <p><span className="font-semibold text-zinc-800 dark:text-zinc-100">Description:</span> {department.description || "No description added yet."}</p>
                  </div>
                </div>

                <div className={cardClass}>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Operational Notes</p>
                  <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                    <p>
                      {department.headEmployeeName
                        ? "Department head is assigned, so this department is ready to participate in approval routing and dashboard ownership."
                        : "Assign a department head to strengthen approval routing and operational ownership."}
                    </p>
                    <p>
                      {department.projectCount > 0
                        ? `${department.projectCount} linked project(s) currently use this department label.`
                        : "No projects are currently mapped to this department."}
                    </p>
                    <p>
                      {department.employeeCount > 0
                        ? `${department.employeeCount} employee record(s) currently inherit this department in directory, leave, and reporting flows.`
                        : "No employees are mapped yet, so you can still shape the department before adding staff."}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "Employees" ? (
              <div className={tableShellClass}>
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Employee</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Role</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {department.employees.length > 0 ? (
                      department.employees.map((employee) => (
                        <tr key={employee.id} className="transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-zinc-900 dark:text-white">{employee.fullName}</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{employee.email}</p>
                          </td>
                          <td className={tableRowTextClass}>{employee.role}</td>
                          <td className="px-5 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${employee.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"}`}>
                              {employee.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-5 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                          No employees are assigned to this department yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}

            {activeTab === "Projects" ? (
              <div className={tableShellClass}>
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Project</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Manager</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Status</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">End Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {department.projects.length > 0 ? (
                      department.projects.map((project) => (
                        <tr key={project.id} className="transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-zinc-900 dark:text-white">{project.name}</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{project.code}</p>
                          </td>
                          <td className={tableRowTextClass}>{project.managerName || "Unassigned"}</td>
                          <td className="px-5 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${project.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"}`}>
                              {project.status}
                            </span>
                          </td>
                          <td className={tableRowTextClass}>{project.endDate || "No end date"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                          No projects are linked to this department yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}

            {activeTab === "Approval / Policy" ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className={cardClass}>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Approval Readiness</p>
                  <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {department.headEmployeeName
                      ? `${department.headEmployeeName} can now be used as the operating owner when approval chains or review dashboards need a department lead reference.`
                      : "No department head is configured yet, so approval ownership still needs a manual fallback in related modules."}
                  </p>
                </div>
                <div className={cardClass}>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Policy Mapping</p>
                  <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    This department record is now available as a consistent source for employee setup, project ownership, reporting filters, and future approval-policy mapping.
                  </p>
                </div>
              </div>
            ) : null}

            {activeTab === "History" ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className={cardClass}>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Lifecycle</p>
                  <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                    <p><span className="font-semibold text-zinc-800 dark:text-zinc-100">Created:</span> {formatDateTime(department.createdAtUtc)}</p>
                    <p><span className="font-semibold text-zinc-800 dark:text-zinc-100">Updated:</span> {formatDateTime(department.updatedAtUtc)}</p>
                    <p><span className="font-semibold text-zinc-800 dark:text-zinc-100">Current Status:</span> {department.status}</p>
                  </div>
                </div>
                <div className={cardClass}>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Data Integrity Notes</p>
                  <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    Department name updates now cascade to employee, project, and leave department labels so downstream reporting stays aligned with this master record.
                  </p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </aside>
    </div>
  );
};

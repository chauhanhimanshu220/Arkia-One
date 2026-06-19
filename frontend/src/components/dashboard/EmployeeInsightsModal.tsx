import { useEffect, useMemo, useState } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import type { AuthUser } from "../../types/auth";
import { canReviewTimesheets, formatUserRoles } from "../../types/roles";
import { Icon } from "../Icon";
import {
  formatDisplayDate,
  type EmployeeInsight,
  type EmployeeProjectAssignment,
  type WorkLog,
  type WorkLogStatus,
} from "../../utils/adminDashboard";

interface EmployeeInsightsModalProps {
  insight: EmployeeInsight | null;
  open: boolean;
  viewer: AuthUser;
  onClose: () => void;
  onUpdateLogStatus: (employeeId: string, logId: string, status: WorkLogStatus) => void;
}

type TabKey = "profile" | "timesheet" | "projects";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "profile", label: "Profile" },
  { key: "timesheet", label: "Timesheet" },
  { key: "projects", label: "Projects" },
];

const statusClasses: Record<WorkLogStatus, string> = {
  Draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Submitted: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const projectStatusClasses: Record<EmployeeProjectAssignment["status"], string> = {
  Active: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200",
  Completed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100",
};

const initialsFromName = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const filterLogs = (workLogs: WorkLog[], startDate: string, endDate: string) =>
  workLogs.filter((log) => (!startDate || log.date >= startDate) && (!endDate || log.date <= endDate));

const canReviewLog = (log: WorkLog) => log.status === "Pending" || log.status === "Submitted";

export const EmployeeInsightsModal = ({
  insight,
  open,
  viewer,
  onClose,
  onUpdateLogStatus,
}: EmployeeInsightsModalProps) => {
  useBodyScrollLock(open);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setActiveTab("profile");
      setStartDate("");
      setEndDate("");
    }
  }, [open]);

  const filteredLogs = useMemo(() => (insight ? filterLogs(insight.workLogs, startDate, endDate) : []), [endDate, insight, startDate]);
  const weeklyHours = filteredLogs.slice(0, 7).reduce((sum, log) => sum + log.hoursWorked, 0);
  const monthlyHours = filteredLogs.reduce((sum, log) => sum + log.hoursWorked, 0);
  const canModerate = canReviewTimesheets(viewer.roles ?? viewer.role);

  if (!open || !insight) {
    return null;
  }

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 backdrop-blur-md sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-insights-title"
        className="animate-modal-in flex h-full w-full scale-100 flex-col overflow-hidden border border-white/10 bg-white shadow-2xl transition-all duration-300 dark:border-zinc-800 dark:bg-black sm:h-auto sm:max-h-[90vh] sm:max-w-6xl sm:rounded-[2rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,rgba(200,200,200,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.14),transparent_22%)] px-5 py-5 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(251,146,60,0.14),transparent_22%)] sm:px-8 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-black via-brand-600 to-accent-500 text-lg font-bold text-white shadow-lg shadow-brand-600/20">
                {initialsFromName(insight.employee.fullName)}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600 dark:text-brand-100">Employee Insights</p>
                <h2 id="employee-insights-title" className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                  {insight.employee.fullName}
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {insight.employee.email} · {insight.employee.department} · {formatUserRoles(insight.employee.roles)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="grid grid-cols-2 gap-3 text-left sm:min-w-[320px]">
                <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/80">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">Weekly</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">{insight.weeklyHours}h</p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/80">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">Utilization</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">{insight.utilization}%</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close employee details"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white/90 text-zinc-500 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800 sm:px-8">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-black text-white dark:text-black dark:bg-white dark:text-black"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 dark:bg-black sm:px-8 sm:py-7">
          {activeTab === "profile" && (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-black">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Full Name</p>
                    <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{insight.employee.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Email</p>
                    <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{insight.employee.email}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Department</p>
                    <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{insight.employee.department}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Role</p>
                    <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{formatUserRoles(insight.employee.roles)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Status</p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                        insight.employee.status === "Active"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
                      }`}
                    >
                      {insight.employee.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Joined Date</p>
                    <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">
                      {formatDisplayDate(insight.employee.createdAt.slice(0, 10), { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-black">
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Performance Snapshot</p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                        <span>Monthly hours</span>
                        <span>{insight.monthlyHours}h</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-900">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-cyan-500" style={{ width: `${insight.utilization}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-zinc-50 px-4 py-4 dark:bg-zinc-900/70">
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Projects</p>
                        <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{insight.projects.length}</p>
                      </div>
                      <div className="rounded-2xl bg-zinc-50 px-4 py-4 dark:bg-zinc-900/70">
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Recent logs</p>
                        <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{insight.workLogs.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "timesheet" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-base font-semibold text-zinc-900 dark:text-white">Timesheet Review</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Filter by date range and moderate pending logs directly from the employee panel.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
                    <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">From</span>
                    <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="bg-transparent outline-none" />
                  </label>
                  <label className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
                    <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">To</span>
                    <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="bg-transparent outline-none" />
                  </label>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-black">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Weekly total</p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{weeklyHours}h</p>
                </div>
                <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-black">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Monthly total</p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{monthlyHours}h</p>
                </div>
                <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-black">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Pending review</p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                    {filteredLogs.filter((log) => log.status === "Pending").length}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black">
                <div className="overflow-x-auto">
                  <table className="min-w-[820px] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-black/70">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Date</th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Hours Worked</th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Work Description</th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Status</th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="align-top hover:bg-zinc-50/80 dark:hover:bg-zinc-950/60">
                          <td className="px-5 py-4 text-sm font-medium text-zinc-900 dark:text-white">{formatDisplayDate(log.date)}</td>
                          <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">{log.hoursWorked}h</td>
                          <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">{log.workDescription}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[log.status]}`}>{log.status}</span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              {canModerate ? (
                                canReviewLog(log) ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onUpdateLogStatus(insight.employee.id, log.id, "Approved")}
                                      className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onUpdateLogStatus(insight.employee.id, log.id, "Rejected")}
                                      className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
                                    >
                                      Reject
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-sm text-zinc-400 dark:text-zinc-500">
                                    {log.status === "Draft" ? "Awaiting submission" : "Reviewed"}
                                  </span>
                                )
                              ) : (
                                <span className="text-sm text-zinc-400 dark:text-zinc-500">View only</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-14 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            No work logs found for the selected date range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "projects" && (
            <div className="grid gap-4 lg:grid-cols-2">
              {insight.projects.map((project) => (
                <div key={project.id} className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-black">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-zinc-900 dark:text-white">{project.projectName}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{project.roleInProject}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${projectStatusClasses[project.status]}`}>{project.status}</span>
                  </div>
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                      <span>Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-900">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-brand-600" style={{ width: `${project.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


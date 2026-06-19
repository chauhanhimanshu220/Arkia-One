import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { setTimesheetNavigationTarget } from "../../config/timesheetNavigation";
import { WEEKLY_WORK_HOURS as WEEKLY_HOUR_LIMIT } from "../../constants/timesheet";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { projectService } from "../../services/projectService";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { Employee } from "../../types/employee";
import type { Project } from "../../types/project";
import { normalizeUserRole } from "../../types/roles";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import { buildTeamScope } from "../../utils/teamScope";

const PAGE_SIZE = 8;
const WORKING_DAYS_PER_WEEK = 6;

const statusThemes: Record<TimesheetWeekRecord["status"], string> = {
  Draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Submitted: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  "Manager Approved": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const getDateOnly = (value: string | Date) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value: string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatWeekRange = (record: Pick<TimesheetWeekRecord, "weekStart" | "weekEnd">) =>
  `${formatDisplayDate(record.weekStart)} - ${formatDisplayDate(record.weekEnd)}`;

const formatHours = (value: number) => `${Number(value || 0).toFixed(1).replace(".0", "")}h`;

const getWeekDates = (weekStart: string) => {
  const start = getDateOnly(weekStart);
  return Array.from({ length: WORKING_DAYS_PER_WEEK }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return formatDateInput(next);
  });
};

export const TeamTimesheetsPage = ({ user }: { user: AuthUser }) => {
  const navigate = useNavigate();
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("All");
  const [selectedWeekStart, setSelectedWeekStart] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<"All" | TimesheetWeekRecord["status"]>("All");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const role = normalizeUserRole(user.role);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const [items, projectRecords] = await Promise.all([timesheetService.listWeeks(), projectService.getProjects()]);
      setRecords(items);
      setProjects(projectRecords);
    } catch {
      showToast("Unable to load team timesheets right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const viewerEmployee = useMemo(() => employees.find((employee) => employee.id === user.id), [employees, user.id]);
  const teamScope = useMemo(
    () => buildTeamScope({ role, employees, projects, userId: user.id }),
    [employees, projects, role, user.id],
  );
  const teamMembers = teamScope.employees;
  const teamMemberIds = useMemo(() => new Set(teamMembers.map((employee) => employee.id)), [teamMembers]);

  const teamRecords = useMemo(
    () =>
      records
        .filter((record) => teamMemberIds.has(record.userId))
        .sort((left, right) => right.weekStart.localeCompare(left.weekStart) || right.updatedAt.localeCompare(left.updatedAt)),
    [records, teamMemberIds],
  );

  const weekOptions = useMemo(
    () => Array.from(new Set(teamRecords.map((record) => record.weekStart))).sort((left, right) => right.localeCompare(left)),
    [teamRecords],
  );

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return teamRecords.filter((record) => {
      if (selectedEmployeeId !== "All" && record.userId !== selectedEmployeeId) {
        return false;
      }

      if (selectedWeekStart !== "All" && record.weekStart !== selectedWeekStart) {
        return false;
      }

      if (selectedStatus !== "All" && record.status !== selectedStatus) {
        return false;
      }

      if (query) {
        const employee = teamMembers.find((member) => member.id === record.userId);
        const haystack = [employee?.fullName ?? "", employee?.department ?? "", record.status, record.weekStart].join(" ").toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [searchText, selectedEmployeeId, selectedStatus, selectedWeekStart, teamMembers, teamRecords]);

  const summary = useMemo(
    () => ({
      total: filteredRecords.length,
      draft: filteredRecords.filter((record) => record.status === "Draft").length,
      submitted: filteredRecords.filter((record) => record.status === "Submitted").length,
      approved: filteredRecords.filter((record) => record.status === "Approved").length,
      rejected: filteredRecords.filter((record) => record.status === "Rejected").length,
    }),
    [filteredRecords],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, selectedEmployeeId, selectedStatus, selectedWeekStart]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedRecordId) ?? paginatedRecords[0] ?? filteredRecords[0] ?? null;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!selectedRecord) {
      setSelectedRecordId(null);
      return;
    }

    if (selectedRecord.id !== selectedRecordId) {
      setSelectedRecordId(selectedRecord.id);
    }
  }, [selectedRecord, selectedRecordId]);

  useEffect(() => {
    const visibleIds = new Set(filteredRecords.map((record) => record.id));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [filteredRecords]);

  const visibleSubmittedIds = paginatedRecords.filter((record) => record.status === "Submitted").map((record) => record.id);
  const allVisibleSubmittedSelected = visibleSubmittedIds.length > 0 && visibleSubmittedIds.every((id) => selectedIds.includes(id));

  const selectedEmployeeName = selectedRecord ? teamMembers.find((member) => member.id === selectedRecord.userId)?.fullName ?? "Unknown employee" : "";

  const selectedWeekTotals = useMemo(() => {
    if (!selectedRecord) {
      return [] as Array<{ date: string; label: string; hours: number }>;
    }

    const weekDates = getWeekDates(selectedRecord.weekStart);
    return weekDates.map((date) => {
      const hours = selectedRecord.rows.reduce((sum, row) => sum + Number(row.hours[date] || 0), 0);
      return {
        date,
        label: getDateOnly(date).toLocaleDateString(undefined, { weekday: "short" }),
        hours,
      };
    });
  }, [selectedRecord]);

  const projectSummary = useMemo(() => {
    if (!selectedRecord) {
      return [] as Array<{ id: string; projectName: string; taskName: string; hours: number }>;
    }

    return selectedRecord.rows.map((row) => ({
      id: row.id,
      projectName: row.projectName || "Unassigned project",
      taskName: row.taskName || "No task label",
      hours: Object.values(row.hours).reduce((sum, value) => sum + Number(value || 0), 0),
    }));
  }, [selectedRecord]);

  const handleOpenWeek = (record: TimesheetWeekRecord) => {
    setTimesheetNavigationTarget(record.weekStart, "weekly");
    navigate("/admin/timesheet");
  };

  const updateStatus = async (record: TimesheetWeekRecord, nextStatus: TimesheetWeekRecord["status"]) => {
    setActingId(record.id);
    try {
      const isSystemAdmin = role === "System Admin";
      const updated = await timesheetService.saveWeek(
        {
          ...record,
          status: nextStatus,
          managerApprovalStatus: isSystemAdmin ? record.managerApprovalStatus : (nextStatus === "Approved" ? "Approved" : record.managerApprovalStatus),
          adminApprovalStatus: isSystemAdmin ? (nextStatus === "Approved" ? "Approved" : record.adminApprovalStatus) : record.adminApprovalStatus,
          approvedBy: user.fullName,
          approvalFlowType: isSystemAdmin 
            ? (record.status === "Submitted" ? "Direct Approved by Admin" : "Fully Approved (Manager + Admin)")
            : "Approved by Manager"
        },
        record.userId,
      );

      setRecords((current) => current.map((item) => (item.id === record.id ? updated : item)));
      setSelectedIds((current) => current.filter((id) => id !== record.id));
      showToast(`Timesheet ${nextStatus.toLowerCase()} successfully.`, "success");
    } catch {
      showToast("Unable to update the timesheet status right now.", "error");
    } finally {
      setActingId(null);
    }
  };

  const handleBulkApprove = async () => {
    const items = filteredRecords.filter((record) => selectedIds.includes(record.id) && record.status === "Submitted");
    if (items.length === 0) {
      showToast("Select at least one submitted timesheet first.", "info");
      return;
    }

    setBulkApproving(true);
    try {
      const updatedRecords = await Promise.all(
        items.map((record) => {
          const isSystemAdmin = role === "System Admin";
          return timesheetService.saveWeek(
            {
              ...record,
              status: "Approved",
              managerApprovalStatus: isSystemAdmin ? record.managerApprovalStatus : "Approved",
              adminApprovalStatus: isSystemAdmin ? "Approved" : record.adminApprovalStatus,
              approvedBy: user.fullName,
              approvalFlowType: isSystemAdmin 
                ? (record.status === "Submitted" ? "Direct Approved by Admin" : "Fully Approved (Manager + Admin)")
                : "Approved by Manager"
            },
            record.userId,
          );
        }),
      );

      const updatesById = new Map(updatedRecords.map((record) => [record.id, record]));
      setRecords((current) => current.map((record) => updatesById.get(record.id) ?? record));
      setSelectedIds([]);
      showToast(`${updatedRecords.length} timesheet(s) approved.`, "success");
    } catch {
      showToast("Unable to bulk approve the selected timesheets right now.", "error");
    } finally {
      setBulkApproving(false);
    }
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading team timesheets..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Team timesheets">
          <WorkspaceHeroMeta primary={`${teamScope.label} · ${teamMembers.length} teammate(s)`} />
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Visible Records" value={summary.total} subtitle="Filtered team timesheets" accent="bg-zinc-500/20" />
          <StatCard label="Submitted" value={summary.submitted} subtitle="Ready for manager review" accent="bg-amber-500/20" />
          <StatCard label="Approved" value={summary.approved} subtitle="Cleared weekly sheets" accent="bg-emerald-500/20" />
          <StatCard label="Rejected" value={summary.rejected} subtitle="Needs correction and resubmission" accent="bg-rose-500/20" />
        </div>

        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Employee</span>
              <select
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All teammates</option>
                {teamMembers.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Week</span>
              <select
                value={selectedWeekStart}
                onChange={(event) => setSelectedWeekStart(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All weeks</option>
                {weekOptions.map((weekStart) => (
                  <option key={weekStart} value={weekStart}>
                    {formatDisplayDate(weekStart)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as "All" | TimesheetWeekRecord["status"])}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All statuses</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </label>

            <label className="space-y-2 xl:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Search</span>
              <div className="flex rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-black">
                <Icon name="search" className="h-5 w-5 text-zinc-400" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Employee, department, status, or week"
                  className="ml-3 w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200"
                />
              </div>
            </label>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-panel dark:border-zinc-800 dark:bg-black/85">
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Weekly Review Table</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {filteredRecords.length} team timesheet record(s) match the current filters.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(
                      allVisibleSubmittedSelected
                        ? selectedIds.filter((id) => !visibleSubmittedIds.includes(id))
                        : Array.from(new Set([...selectedIds, ...visibleSubmittedIds])),
                    )
                  }
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  {allVisibleSubmittedSelected ? "Clear Page Selection" : "Select Submitted"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkApprove()}
                  disabled={bulkApproving}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkApproving ? "Approving..." : "Bulk Approve"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50/80 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:bg-black/70 dark:text-zinc-400">
                  <tr>
                    <th className="px-6 py-4">Select</th>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Week</th>
                    <th className="px-6 py-4">Hours</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Updated</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {paginatedRecords.map((record) => {
                    const employee = teamMembers.find((member) => member.id === record.userId);
                    const isSelected = selectedRecord?.id === record.id;
                    const canAct = record.status === "Submitted";
                    const checked = selectedIds.includes(record.id);

                    return (
                      <tr
                        key={record.id}
                        className={`transition ${isSelected ? "bg-brand-50/70 dark:bg-brand-500/10" : "hover:bg-zinc-50/80 dark:hover:bg-black/70"}`}
                      >
                        <td className="px-6 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canAct}
                            onChange={(event) =>
                              setSelectedIds((current) =>
                                event.target.checked ? [...current, record.id] : current.filter((id) => id !== record.id),
                              )
                            }
                            className="mt-1 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                        <td className="px-6 py-4 align-top">
                          <button type="button" onClick={() => setSelectedRecordId(record.id)} className="text-left">
                            <p className="font-semibold text-zinc-900 dark:text-white">{employee?.fullName ?? "Unknown employee"}</p>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{employee?.department ?? "Unknown department"}</p>
                          </button>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-zinc-600 dark:text-zinc-300">{formatWeekRange(record)}</td>
                        <td className="px-6 py-4 align-top font-semibold text-zinc-900 dark:text-white">
                          {formatHours(record.totalHours)}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusThemes[record.status]}`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-zinc-600 dark:text-zinc-300">{formatDisplayDate(record.updatedAt)}</td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecordId(record.id);
                                handleOpenWeek(record);
                              }}
                              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              <Icon name="eye" className="h-4 w-4" />
                              View
                            </button>
                            {canAct ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void updateStatus(record, "Approved")}
                                  disabled={actingId === record.id}
                                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
                                >
                                  <Icon name="approvals" className="h-4 w-4" />
                                  {actingId === record.id ? "Saving..." : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void updateStatus(record, "Rejected")}
                                  disabled={actingId === record.id}
                                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
                                >
                                  <Icon name="close" className="h-4 w-4" />
                                  Reject
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="mx-auto max-w-md space-y-3">
                          <p className="text-base font-semibold text-zinc-900 dark:text-white">No team timesheets match the current filters.</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Try selecting another week or widening the status filter.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </section>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Selected Week Detail</p>
              {selectedRecord ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold text-zinc-900 dark:text-white">{selectedEmployeeName}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{formatWeekRange(selectedRecord)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusThemes[selectedRecord.status]}`}>
                      {selectedRecord.status}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Total Hours</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{formatHours(selectedRecord.totalHours)}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Rows Logged</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{selectedRecord.rows.length} row(s)</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Daily Summary</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {selectedWeekTotals.map((day) => (
                        <div key={day.date} className="rounded-2xl bg-white p-3 dark:bg-black">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{day.label}</p>
                          <p className="mt-2 font-semibold text-zinc-900 dark:text-white">{formatHours(day.hours)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Project Breakdown</p>
                    <div className="mt-3 space-y-3">
                      {projectSummary.map((project) => (
                        <div key={project.id} className="rounded-2xl bg-white p-3 dark:bg-black">
                          <p className="font-semibold text-zinc-900 dark:text-white">{project.projectName}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{project.taskName}</p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{formatHours(project.hours)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenWeek(selectedRecord)}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      Open Week
                    </button>
                    {selectedRecord.status === "Submitted" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void updateStatus(selectedRecord, "Approved")}
                          disabled={actingId === selectedRecord.id}
                          className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actingId === selectedRecord.id ? "Saving..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateStatus(selectedRecord, "Rejected")}
                          disabled={actingId === selectedRecord.id}
                          className="inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actingId === selectedRecord.id ? "Saving..." : "Reject"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Select a team timesheet from the table to inspect daily hours, project rows, and review context.
                </p>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Manager Review Notes</p>
              <div className="mt-4 space-y-3">
                {[
                  `${summary.submitted} submitted weekly sheet(s) are currently waiting for review.`,
                  `${summary.draft} draft record(s) are still incomplete inside the visible team scope.`,
                  `${filteredRecords.filter((record) => Number(record.totalHours || 0) > WEEKLY_HOUR_LIMIT).length} visible week(s) are above the ${WEEKLY_HOUR_LIMIT}-hour mark.`,
                ].map((note) => (
                  <div key={note} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-black/70 dark:text-zinc-300">
                    {note}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  );
};

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { leaveService } from "../../services/leaveService";
import { projectService } from "../../services/projectService";
import { taskService } from "../../services/taskService";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { Employee } from "../../types/employee";
import type { LeaveRequest } from "../../types/leave";
import type { Project } from "../../types/project";
import { normalizeUserRole } from "../../types/roles";
import type { TaskItem } from "../../types/task";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import { buildTeamScope } from "../../utils/teamScope";

const today = new Date();
today.setHours(0, 0, 0, 0);

const getDateOnly = (value: string | Date) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekStart = (date: Date) => {
  const normalized = getDateOnly(date);
  const day = normalized.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + offset);
  return normalized;
};

const formatDisplayDate = (value: string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatWeekRange = (record: Pick<TimesheetWeekRecord, "weekStart" | "weekEnd">) =>
  `${formatDisplayDate(record.weekStart)} - ${formatDisplayDate(record.weekEnd)}`;

const formatShortDate = (value: string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });

const statusBadge: Record<string, string> = {
  Submitted: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  "Manager Approved": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  Draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Completed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  "On Hold": "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
};

const leaveBadge = {
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  "Manager Approved": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  "HR Approved": "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
} as const;

export const TeamOverviewPage = ({ user }: { user: AuthUser }) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const role = normalizeUserRole(user.role);

  const loadData = async () => {
    setLoading(true);
    try {
      const [weeks, leaveRequests, projectRecords, taskRecords] = await Promise.all([
        timesheetService.listWeeks(),
        leaveService.getLeaves(),
        projectService.getProjects(),
        taskService.getTaskHistory(),
      ]);
      setRecords(weeks);
      setLeaves(leaveRequests);
      setProjects(projectRecords);
      setTasks(taskRecords);
    } catch {
      showToast("Unable to load team overview right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const teamScope = useMemo(
    () => buildTeamScope({ role, employees, projects, userId: user.id }),
    [employees, projects, role, user.id],
  );
  const teamMembers = teamScope.employees;
  const teamMemberIds = teamScope.employeeIds;
  const teamProjects = teamScope.projects;
  const teamProjectIds = teamScope.projectIds;
  const teamRecords = useMemo(() => records.filter((record) => teamMemberIds.has(record.userId)), [records, teamMemberIds]);
  const teamLeaves = useMemo(() => leaves.filter((leave) => teamMemberIds.has(leave.employeeId)), [leaves, teamMemberIds]);
  const teamTasks = useMemo(
    () => tasks.filter((task) => teamProjectIds.has(task.projectId ?? "") || teamMemberIds.has(task.assignedTo)),
    [tasks, teamMemberIds, teamProjectIds],
  );
  const activeProjects = useMemo(() => teamProjects.filter((project) => project.status === "Active"), [teamProjects]);

  const currentWeekStart = useMemo(() => formatDateInput(getWeekStart(today)), []);
  const activeWeekStart = useMemo(() => {
    const exactCurrentWeek = teamRecords.some((record) => record.weekStart === currentWeekStart);
    if (exactCurrentWeek) {
      return currentWeekStart;
    }

    return [...teamRecords]
      .sort((left, right) => right.weekStart.localeCompare(left.weekStart))
      .find(() => true)?.weekStart ?? currentWeekStart;
  }, [currentWeekStart, teamRecords]);

  const weekRecords = useMemo(
    () => teamRecords.filter((record) => record.weekStart === activeWeekStart),
    [activeWeekStart, teamRecords],
  );

  const pendingReviews = useMemo(
    () =>
      [...teamRecords]
        .filter((record) => record.status === "Submitted")
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [teamRecords],
  );

  const teamHoursSnapshot = useMemo(() => {
    const totals = new Map<string, { employeeName: string; hours: number; status: TimesheetWeekRecord["status"] }>();

    weekRecords.forEach((record) => {
      const employee = teamMembers.find((member) => member.id === record.userId);
      const current = totals.get(record.userId) ?? {
        employeeName: employee?.fullName ?? "Unknown employee",
        hours: 0,
        status: record.status,
      };
      current.hours += Number(record.totalHours || 0);
      current.status = record.status;
      totals.set(record.userId, current);
    });

    return Array.from(totals.values()).sort((left, right) => right.hours - left.hours);
  }, [teamMembers, weekRecords]);

  const totalTeamHours = useMemo(
    () => teamHoursSnapshot.reduce((sum, item) => sum + item.hours, 0),
    [teamHoursSnapshot],
  );

  const averageTeamHours = useMemo(
    () => (teamHoursSnapshot.length === 0 ? 0 : totalTeamHours / teamHoursSnapshot.length),
    [teamHoursSnapshot.length, totalTeamHours],
  );

  const overloadedEmployees = useMemo(
    () => teamHoursSnapshot.filter((item) => item.hours > 45).sort((left, right) => right.hours - left.hours),
    [teamHoursSnapshot],
  );

  const todaysLeave = useMemo(
    () =>
      teamLeaves.filter((leave) => {
        const start = getDateOnly(leave.startDate);
        const end = getDateOnly(leave.endDate);
        return leave.status === "Approved" && start <= today && end >= today;
      }),
    [teamLeaves],
  );

  const upcomingLeave = useMemo(() => {
    return [...teamLeaves]
      .filter((leave) => leave.status === "Approved")
      .filter((leave) => getDateOnly(leave.endDate) >= today)
      .sort((left, right) => left.startDate.localeCompare(right.startDate))
      .slice(0, 6);
  }, [teamLeaves]);

  const pendingLeaveRequests = useMemo(
    () => teamLeaves.filter((leave) => leave.status === "Pending").sort((left, right) => left.startDate.localeCompare(right.startDate)),
    [teamLeaves],
  );

  const coverageAlerts = useMemo(() => {
    const alerts = new Map<string, { date: string; employees: string[] }>();

    upcomingLeave.forEach((leave) => {
      let cursor = getDateOnly(leave.startDate);
      const end = getDateOnly(leave.endDate);

      while (cursor <= end) {
        const key = formatDateInput(cursor);
        const current = alerts.get(key) ?? { date: key, employees: [] };
        if (!current.employees.includes(leave.employeeName)) {
          current.employees.push(leave.employeeName);
        }
        alerts.set(key, current);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      }
    });

    return Array.from(alerts.values())
      .filter((alert) => alert.employees.length >= 2)
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(0, 4);
  }, [upcomingLeave]);

  const handleUpdateStatus = async (record: TimesheetWeekRecord, status: TimesheetWeekRecord["status"]) => {
    setActingId(record.id);
    try {
      const isSystemAdmin = role === "System Admin";
      await timesheetService.saveWeek(
        {
          ...record,
          status,
          managerApprovalStatus: isSystemAdmin ? record.managerApprovalStatus : (status === "Approved" ? "Approved" : record.managerApprovalStatus),
          adminApprovalStatus: isSystemAdmin ? (status === "Approved" ? "Approved" : record.adminApprovalStatus) : record.adminApprovalStatus,
          approvedBy: user.fullName,
          approvalFlowType: isSystemAdmin 
            ? (record.status === "Submitted" ? "Direct Approved by Admin" : "Fully Approved (Manager + Admin)")
            : "Approved by Manager"
        },
        record.userId,
      );
      showToast(`Timesheet ${status.toLowerCase()} successfully.`, "success");
      await loadData();
    } catch {
      showToast("Unable to update the timesheet status right now.", "error");
    } finally {
      setActingId(null);
    }
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading team overview..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Team overview">
          <WorkspaceHeroMeta primary={`${teamScope.label} · ${teamMembers.length} teammate(s)`} />
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending Reviews" value={pendingReviews.length} subtitle="Weekly timesheets awaiting manager action" accent="bg-amber-500/20" />
          <StatCard label="Team Hours" value={Math.round(totalTeamHours)} subtitle={`Tracked for week starting ${formatDisplayDate(activeWeekStart)}`} accent="bg-zinc-500/20" />
          <StatCard label="Leaves Today" value={todaysLeave.length} subtitle="Approved absences impacting today's coverage" accent="bg-emerald-500/20" />
          <StatCard label="Active Projects" value={activeProjects.length} subtitle={`${teamTasks.length} SQL task(s) in scope`} accent="bg-zinc-100 dark:bg-white/10" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <section className="rounded-[2rem] border border-white/70 bg-white/85 shadow-panel dark:border-zinc-800 dark:bg-black/85">
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Pending Timesheet Reviews</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Submitted weekly timesheets from your visible team appear here for quick action.
                </p>
              </div>
              <Link
                to="/admin/approvals/team-timesheets"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Open Team Timesheets
              </Link>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {pendingReviews.length > 0 ? (
                pendingReviews.slice(0, 6).map((record) => {
                  const employee = teamMembers.find((member) => member.id === record.userId);
                  return (
                    <div key={record.id} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white">{employee?.fullName ?? "Unknown employee"}</p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          {formatWeekRange(record)} · {Number(record.totalHours || 0).toFixed(1).replace(".0", "")}h logged
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[record.status]}`}>{record.status}</span>
                        <button
                          type="button"
                          onClick={() => void handleUpdateStatus(record, "Approved")}
                          disabled={actingId === record.id}
                          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                        >
                          <Icon name="approvals" className="h-4 w-4" />
                          {actingId === record.id ? "Saving..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleUpdateStatus(record, "Rejected")}
                          disabled={actingId === record.id}
                          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
                        >
                          <Icon name="close" className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-6 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No submitted weekly timesheets are waiting for your review right now.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Weekly Team Hours Snapshot</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Current snapshot is based on week starting {formatDisplayDate(activeWeekStart)}.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Total Hours</p>
                <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{Math.round(totalTeamHours)}h</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Average / Employee</p>
                <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{averageTeamHours.toFixed(1)}h</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {teamHoursSnapshot.length > 0 ? (
                teamHoursSnapshot.slice(0, 6).map((item) => (
                  <div key={item.employeeName}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="font-semibold text-zinc-900 dark:text-white">{item.employeeName}</p>
                      <p className={`${item.hours > 45 ? "text-rose-600 dark:text-rose-300" : "text-zinc-500 dark:text-zinc-400"}`}>
                        {item.hours.toFixed(1).replace(".0", "")}h
                      </p>
                    </div>
                    <div className="mt-2 h-3 rounded-full bg-zinc-100 dark:bg-zinc-900">
                      <div
                        className={`h-3 rounded-full ${item.hours > 45 ? "bg-rose-500" : "bg-zinc-950 dark:bg-white"}`}
                        style={{ width: `${Math.min((item.hours / 50) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No weekly time data is available for your team yet.</p>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Leave Coverage Watchlist</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Approved and pending leave affecting your team coverage.</p>
              </div>
              <Link
                to="/admin/leave/calendar"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Team Calendar
              </Link>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Today</p>
                <div className="mt-3 space-y-3">
                  {todaysLeave.length > 0 ? (
                    todaysLeave.map((leave) => (
                      <div key={leave.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-white">{leave.employeeName}</p>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{leave.type}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${leaveBadge[leave.status]}`}>{leave.status}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No one in your team is on approved leave today.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Upcoming Approved Leave</p>
                <div className="mt-3 space-y-3">
                  {upcomingLeave.length > 0 ? (
                    upcomingLeave.map((leave) => (
                      <div key={`upcoming-${leave.id}`} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-white">{leave.employeeName}</p>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                              {leave.type} · {formatShortDate(leave.startDate)} to {formatShortDate(leave.endDate)}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${leaveBadge[leave.status]}`}>{leave.days} day(s)</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No approved leave is lined up for your team right now.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Pending Leave Requests</p>
                <div className="mt-3 space-y-3">
                  {pendingLeaveRequests.length > 0 ? (
                    pendingLeaveRequests.slice(0, 4).map((leave) => (
                      <div key={`pending-${leave.id}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <p className="font-semibold text-amber-800 dark:text-amber-200">{leave.employeeName}</p>
                        <p className="mt-1 text-sm text-amber-700 dark:text-amber-200">
                          {leave.type} · {formatShortDate(leave.startDate)} to {formatShortDate(leave.endDate)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No pending leave requests are waiting in your team watchlist.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Delivery Health Alerts</p>
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">SQL Project Sync</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-3 dark:bg-black">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Projects</p>
                  <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">{teamProjects.length}</p>
                </div>
                <div className="rounded-2xl bg-white p-3 dark:bg-black">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Tasks</p>
                  <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">{teamTasks.length}</p>
                </div>
                <div className="rounded-2xl bg-white p-3 dark:bg-black">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Scope</p>
                  <p className="mt-2 text-xl font-bold capitalize text-zinc-900 dark:text-white">{teamScope.mode}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {teamProjects.length > 0 ? (
                  teamProjects.slice(0, 4).map((project) => (
                    <div key={project.id} className="rounded-2xl bg-white px-4 py-3 dark:bg-black">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">{project.name}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {project.code} · {project.department} · {project.teamMemberIds.length} member(s)
                          </p>
                        </div>
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[project.status]}`}>
                          {project.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No SQL project mapping is visible for this Team Manager yet.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                `${pendingReviews.length} submitted weekly review(s) are pending your action.`,
                overloadedEmployees.length > 0
                  ? `${overloadedEmployees[0]?.employeeName ?? "A teammate"} is currently leading the hours chart with ${overloadedEmployees[0]?.hours.toFixed(1).replace(".0", "")}h.`
                  : "No employee has crossed the 45-hour overload threshold in the current week snapshot.",
                coverageAlerts.length > 0
                  ? `${coverageAlerts[0].employees.length} team members are away on ${formatDisplayDate(coverageAlerts[0].date)}.`
                  : "No same-day leave overlap alert is currently detected in the upcoming watchlist.",
              ].map((note) => (
                <div key={note} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-black/70 dark:text-zinc-300">
                  {note}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Coverage Alerts</p>
              <div className="mt-3 space-y-3">
                {coverageAlerts.length > 0 ? (
                  coverageAlerts.map((alert) => (
                    <div key={alert.date} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/20 dark:bg-rose-500/10">
                      <p className="font-semibold text-rose-700 dark:text-rose-200">{formatDisplayDate(alert.date)}</p>
                      <p className="mt-1 text-sm text-rose-700 dark:text-rose-200">{alert.employees.join(", ")} are unavailable on the same day.</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No upcoming multi-person leave overlap alert is visible right now.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>
    </>
  );
};

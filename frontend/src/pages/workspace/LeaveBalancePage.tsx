import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { useEmployees } from "../../hooks/useEmployees";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { WorkspaceHeroMeta, WorkspacePageHero, workspaceHeroAsideClass } from "../../components/WorkspacePageHero";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";
import { leaveService } from "../../services/leaveService";
import { projectService } from "../../services/projectService";
import type { AuthUser } from "../../types/auth";
import type { LeaveRequest, LeaveTypeDefinition } from "../../types/leave";
import type { Project } from "../../types/project";
import { canApplyLeave, canApproveLeave, normalizeUserRole } from "../../types/roles";
import { buildTeamScope } from "../../utils/teamScope";

const currentYear = new Date().getFullYear();
const today = new Date();
today.setHours(0, 0, 0, 0);

const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);

const leaveTypeStyles: Record<
  string,
  {
    accent: string;
    chip: string;
    iconBackground: string;
    iconColor: string;
    progress: string;
    card: string;
  }
> = {
  "Casual Leave": {
    accent: "text-zinc-700 dark:text-sky-200",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    iconBackground: "bg-sky-100 dark:bg-sky-500/15",
    iconColor: "text-zinc-700 dark:text-sky-200",
    progress: "bg-zinc-100 dark:bg-white/10",
    card: "bg-[radial-gradient(circle_at_top_right,rgba(200,200,200,0.14),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,249,255,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(200,200,200,0.16),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
  },
  "Sick Leave": {
    accent: "text-emerald-700 dark:text-emerald-200",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    iconBackground: "bg-emerald-100 dark:bg-emerald-500/15",
    iconColor: "text-emerald-700 dark:text-emerald-200",
    progress: "bg-emerald-500",
    card: "bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
  },
  "Earned Leave": {
    accent: "text-violet-700 dark:text-violet-200",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
    iconBackground: "bg-violet-100 dark:bg-violet-500/15",
    iconColor: "text-violet-700 dark:text-violet-200",
    progress: "bg-violet-500",
    card: "bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,243,255,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
  },
  "Unpaid Leave": {
    accent: "text-amber-700 dark:text-amber-200",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    iconBackground: "bg-amber-100 dark:bg-amber-500/15",
    iconColor: "text-amber-700 dark:text-amber-200",
    progress: "bg-amber-500",
    card: "bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,251,235,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
  },
  "Work From Home": {
    accent: "text-rose-700 dark:text-rose-200",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    iconBackground: "bg-rose-100 dark:bg-rose-500/15",
    iconColor: "text-rose-700 dark:text-rose-200",
    progress: "bg-rose-500",
    card: "bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,241,242,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
  },
};

const defaultTypeStyle = {
  accent: "text-zinc-700 dark:text-zinc-300",
  chip: "bg-brand-50 text-zinc-700 dark:bg-brand-500/15 dark:text-zinc-300",
  iconBackground: "bg-brand-50 dark:bg-brand-500/15",
  iconColor: "text-zinc-700 dark:text-zinc-300",
  progress: "bg-brand-500",
  card: "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,246,255,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
};

const formatDisplayDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatCompactDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });

const getDateValue = (value: string) => new Date(`${value}T00:00:00`);

export const LeaveBalancePage = ({ user }: { user: AuthUser }) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const role = normalizeUserRole(user.role);
  const accessRoles = user.role;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDefinition[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const teamScope = useMemo(
    () => buildTeamScope({ role, employees, projects, userId: user.id, includeSelf: role !== "Team Manager" }),
    [employees, projects, role, user.id],
  );

  const scopeMeta = useMemo(() => {
    if (role === "Employee") {
      return {
        summaryLabel: "your balance",
        reservationLabel: "your availability",
      };
    }

    if (role === "Team Manager") {
      return {
        summaryLabel: "your visible team",
        reservationLabel: "team availability",
      };
    }

    return {
      summaryLabel: role === "HR Manager" ? "the organisation" : "the workspace",
      reservationLabel: "workforce availability",
    };
  }, [role]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (employeesLoading) {
        return;
      }

      setLoading(true);

      try {
        const [types, requests, projectRecords] = await Promise.all([
          leaveService.getLeaveTypes(),
          role === "Employee" ? leaveService.getLeaves({ employeeId: user.id, year: selectedYear }) : leaveService.getLeaves({ year: selectedYear }),
          projectService.getProjects(),
        ]);

        if (!active) {
          return;
        }

        setProjects(projectRecords);
        const nextScope = buildTeamScope({ role, employees, projects: projectRecords, userId: user.id, includeSelf: role !== "Team Manager" });
        const visibleEmployeeIds = nextScope.employeeIds;
        const scopedRequests =
          role === "Employee"
            ? requests
            : requests.filter((request) => visibleEmployeeIds.has(request.employeeId));

        setLeaveTypes(types.filter((leaveType) => leaveType.active));
        setLeaveRequests(
          [...scopedRequests].sort((left, right) => getDateValue(left.startDate).getTime() - getDateValue(right.startDate).getTime()),
        );
      } catch {
        if (active) {
          showToast("Unable to load leave balance right now.", "error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [employees, employeesLoading, role, selectedYear, showToast, user.id]);

  const balanceCards = useMemo(() => {
    return leaveTypes.map((leaveType) => {
      const relevantRequests = leaveRequests.filter((leaveRequest) => leaveRequest.type === leaveType.name);
      const approvedUsed = relevantRequests
        .filter((leaveRequest) => leaveRequest.status === "Approved")
        .reduce((sum, leaveRequest) => sum + leaveRequest.days, 0);
      const pendingReserved = relevantRequests
        .filter((leaveRequest) => leaveRequest.status === "Pending")
        .reduce((sum, leaveRequest) => sum + leaveRequest.days, 0);
      const entitlement = leaveType.annualAllocation;
      const remainingOfficial = Math.max(entitlement - approvedUsed, 0);
      const remainingAfterPending = Math.max(entitlement - approvedUsed - pendingReserved, 0);
      const progressSource = entitlement > 0 ? Math.min(100, Math.round(((approvedUsed + pendingReserved) / entitlement) * 100)) : 0;

      return {
        ...leaveType,
        approvedUsed,
        pendingReserved,
        entitlement,
        remainingOfficial,
        remainingAfterPending,
        progressSource,
        relevantRequests,
      };
    });
  }, [leaveRequests, leaveTypes]);

  const upcomingReservations = useMemo(() => {
    return [...leaveRequests]
      .filter((leaveRequest) => {
        if (leaveRequest.status !== "Approved" && leaveRequest.status !== "Pending") {
          return false;
        }

        return getDateValue(leaveRequest.endDate) >= today;
      })
      .sort((left, right) => getDateValue(left.startDate).getTime() - getDateValue(right.startDate).getTime());
  }, [leaveRequests]);

  const planningSummary = useMemo(() => {
    const totalEntitlement = balanceCards.reduce((sum, balance) => sum + balance.entitlement, 0);
    const totalApprovedUsed = balanceCards.reduce((sum, balance) => sum + balance.approvedUsed, 0);
    const totalPendingReserved = balanceCards.reduce((sum, balance) => sum + balance.pendingReserved, 0);
    const totalOfficialRemaining = balanceCards.reduce((sum, balance) => sum + balance.remainingOfficial, 0);
    const totalRemainingAfterPending = balanceCards.reduce((sum, balance) => sum + balance.remainingAfterPending, 0);
    const nextBookedLeave = upcomingReservations[0] ?? null;

    return {
      totalEntitlement,
      totalApprovedUsed,
      totalPendingReserved,
      totalOfficialRemaining,
      totalRemainingAfterPending,
      nextBookedLeave,
    };
  }, [balanceCards, upcomingReservations]);

  if (loading || (role !== "Employee" && employeesLoading)) {
    return <LoadingSpinner label="Loading leave balance..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Leave Balance">
          <label className={`inline-flex items-center gap-3 ${workspaceHeroAsideClass}`}>
            <span className="font-semibold text-zinc-600 dark:text-zinc-300">Year</span>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <WorkspaceHeroMeta
            primary={`${planningSummary.totalOfficialRemaining} day(s) left`}
            secondary={`${planningSummary.totalPendingReserved} pending`}
          />
        </WorkspacePageHero>

        {balanceCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {balanceCards.map((balance) => {
              const style = leaveTypeStyles[balance.name] ?? defaultTypeStyle;

              return (
                <article
                  key={balance.id}
                  className={`rounded-[2rem] border border-white/70 p-6 shadow-panel dark:border-zinc-800 ${style.card}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-lg font-semibold ${style.accent}`}>{balance.name}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{balance.description}</p>
                    </div>
                    <span className={`rounded-2xl p-3 ${style.iconBackground} ${style.iconColor}`}>
                      <Icon name="leave" className="h-5 w-5" />
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.chip}`}>
                      {balance.entitlement > 0 ? `${balance.entitlement} days / year` : "No fixed yearly limit"}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      {balance.approvalRequired ? "Approval required" : "Auto-approved type"}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Allowed</p>
                      <p className="mt-2 text-2xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{balance.entitlement}</p>
                    </div>
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Used</p>
                      <p className="mt-2 text-2xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{balance.approvedUsed}</p>
                    </div>
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Pending</p>
                      <p className="mt-2 text-2xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{balance.pendingReserved}</p>
                    </div>
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Remaining</p>
                      <p className="mt-2 text-2xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{balance.remainingOfficial}</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">Planning balance after pending</span>
                      <span className="font-semibold text-zinc-900 dark:text-white">{balance.remainingAfterPending} day(s)</span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/80 dark:bg-black/70">
                      <div
                        className={`h-full rounded-full transition-all ${style.progress}`}
                        style={{ width: `${balance.progressSource}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {balance.entitlement > 0
                        ? `${balance.progressSource}% of yearly entitlement is already used or reserved.`
                        : "This leave type does not currently carry a fixed yearly quota."}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {canApplyLeave(accessRoles) ? (
                      <>
                        <Link
                          to="/admin/leave/request"
                          className="inline-flex h-10 items-center justify-center rounded-2xl bg-black px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                        >
                          Request Leave
                        </Link>
                        <Link
                          to="/admin/leave/history"
                          className="inline-flex h-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          View History
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/admin/leave/calendar"
                          className="inline-flex h-10 items-center justify-center rounded-2xl bg-black px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                        >
                          Open Calendar
                        </Link>
                        {canApproveLeave(accessRoles) ? (
                          <Link
                            to="/admin/approvals/leave"
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            Leave Inbox
                          </Link>
                        ) : null}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 px-6 py-14 text-center shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-zinc-400 dark:text-zinc-500">
              <Icon name="leave" className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-zinc-900 dark:text-white">No leave policy configured yet</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Leave types are not available for the selected year right now, so we cannot calculate a balance summary yet.
            </p>
          </section>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Upcoming Leave Reservations</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Approved and pending leave that may affect {scopeMeta.reservationLabel}.
                </p>
              </div>
              {canApplyLeave(accessRoles) ? (
                <Link
                  to="/admin/leave/history"
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Open Full History
                </Link>
              ) : null}
            </div>

            {upcomingReservations.length > 0 ? (
              <div className="mt-5 space-y-3">
                {upcomingReservations.map((leaveRequest) => (
                  <div
                    key={leaveRequest.id}
                    className="flex flex-col gap-4 rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-zinc-900 dark:text-white">{leaveRequest.type}</p>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            leaveRequest.status === "Approved"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
                          }`}
                        >
                          {leaveRequest.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {formatDisplayDate(leaveRequest.startDate)} to {formatDisplayDate(leaveRequest.endDate)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{leaveRequest.reason}</p>
                    </div>

                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-right dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Booked Time</p>
                      <p className="mt-2 text-lg font-bold text-[#185FA5] dark:text-[#B5D4F4]">{leaveRequest.days} day(s)</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-r-[1.5rem] rounded-l-none border border-dashed border-zinc-300 bg-zinc-50/70 px-5 py-10 text-center dark:border-zinc-700 dark:bg-black/60">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No upcoming approved or pending leave is reserved for the selected year yet.
                </p>
              </div>
            )}
          </section>

          <div className="space-y-6">
            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Planning View</p>
              <div className="mt-5 grid gap-3">
                {[
                  { label: "Total Entitlement", value: `${planningSummary.totalEntitlement} day(s)` },
                  { label: "Approved Used", value: `${planningSummary.totalApprovedUsed} day(s)` },
                  { label: "Pending Reserved", value: `${planningSummary.totalPendingReserved} day(s)` },
                  { label: "Official Remaining", value: `${planningSummary.totalOfficialRemaining} day(s)` },
                  { label: "Usable After Pending", value: `${planningSummary.totalRemainingAfterPending} day(s)` },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{item.label}</span>
                    <span className="text-sm font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Next Booked Leave</p>
                {planningSummary.nextBookedLeave ? (
                  <>
                    <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{planningSummary.nextBookedLeave.type}</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {formatCompactDate(planningSummary.nextBookedLeave.startDate)} to {formatCompactDate(planningSummary.nextBookedLeave.endDate)}
                    </p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {planningSummary.nextBookedLeave.days} day(s) currently {planningSummary.nextBookedLeave.status.toLowerCase()}.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    No future reservation is currently booked for the selected year.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Balance Guidance</p>
              <div className="mt-4 space-y-3">
                {[
                  "Official remaining subtracts only approved leave from the yearly entitlement scope you are viewing.",
                  "Planning balance also deducts pending requests so you can avoid overbooking future dates.",
                  canApplyLeave(accessRoles)
                    ? "Use Leave History to review approval outcomes before sending another request for the same period."
                    : "Use Team Calendar and the leave inbox together when planning coverage-heavy periods.",
                ].map((note) => (
                  <div key={note} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:text-zinc-300">
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

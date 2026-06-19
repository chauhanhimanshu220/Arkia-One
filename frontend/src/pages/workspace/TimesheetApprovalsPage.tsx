import { useCallback, useEffect, useMemo, useState } from "react";
import { TimesheetApprovalDetailsModal } from "../../components/approvals/TimesheetApprovalDetailsModal";
import { Icon } from "../../components/Icon";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { WEEKLY_WORK_HOURS as WEEKLY_HOUR_LIMIT } from "../../constants/timesheet";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { leaveService } from "../../services/leaveService";
import { projectService } from "../../services/projectService";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { LeaveRequest } from "../../types/leave";
import type { Project } from "../../types/project";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import { normalizeUserRole } from "../../types/roles";
import { buildTeamScope } from "../../utils/teamScope";

const PAGE_SIZE = 10;
const DECISION_NOTES_KEY = "timesheet-approvals-decision-notes";
const today = new Date();
today.setHours(0, 0, 0, 0);

type ApprovalFilterStatus = "Action Required" | "Approved" | "Rejected" | "All";
type ApprovalPriority = "Ready" | "Heavy Week" | "Overdue";

interface ApprovalTimesheetItem {
  key: string;
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  periodStart: string;
  periodEnd: string;
  status: TimesheetWeekRecord["status"];
  submittedAt: string;
  totalHours: number;
  priority: ApprovalPriority;
  timesheet: TimesheetWeekRecord;
}

const statusBadgeClass: Record<TimesheetWeekRecord["status"], string> = {
  Draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Submitted: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  "Manager Approved": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const priorityBadgeClass: Record<ApprovalPriority, string> = {
  Ready: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  "Heavy Week": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  Overdue: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const getDateOnly = (value: string | Date) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatShortDate = (value: string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });

const formatRelativeLabel = (value: string) => {
  const target = new Date(value);
  const diffInDays = Math.floor((today.getTime() - getDateOnly(target).getTime()) / 86_400_000);

  if (diffInDays <= 0) return "Today";
  if (diffInDays === 1) return "1 day ago";
  return `${diffInDays} days ago`;
};

const getAgeInDays = (value: string) =>
  Math.max(0, Math.floor((today.getTime() - getDateOnly(new Date(value)).getTime()) / 86_400_000));

const getApprovalPriority = (totalHours: number, submittedAt: string): ApprovalPriority => {
  if (getAgeInDays(submittedAt) >= 3) return "Overdue";
  if (totalHours > WEEKLY_HOUR_LIMIT) return "Heavy Week";
  return "Ready";
};

const isActionRequired = (status: TimesheetWeekRecord["status"], role: string) => {
  if (role === "System Admin" || role === "HR Manager") {
    return status === "Submitted" || status === "Manager Approved";
  }
  return status === "Submitted";
};

const getStoredDecisionNotes = () => {
  const raw = window.localStorage.getItem(DECISION_NOTES_KEY);
  if (!raw) return {} as Record<string, string>;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
};

const setStoredDecisionNotes = (notes: Record<string, string>) => {
  window.localStorage.setItem(DECISION_NOTES_KEY, JSON.stringify(notes));
};

export const TimesheetApprovalsPage = ({ user }: { user: AuthUser }) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const role = normalizeUserRole(user.role);

  const [timesheets, setTimesheets] = useState<TimesheetWeekRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<ApprovalFilterStatus>("Action Required");
  const [selectedWeek, setSelectedWeek] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [detailModalKey, setDetailModalKey] = useState<string | null>(null);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  const [rejectModalKey, setRejectModalKey] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>(() => getStoredDecisionNotes());

  useBodyScrollLock(Boolean(detailModalKey) || Boolean(rejectModalKey));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [weekRecords, leaveRequests, projectRecords] = await Promise.all([
        timesheetService.listWeeks(),
        leaveService.getLeaves(),
        projectService.getProjects(),
      ]);
      setTimesheets(weekRecords);
      setLeaves(leaveRequests);
      setProjects(projectRecords);
    } catch {
      showToast("Unable to load timesheet approvals right now.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teamScope = useMemo(
    () => buildTeamScope({ role, employees, projects, userId: user.id }),
    [employees, projects, role, user.id],
  );
  const scopeEmployees = teamScope.employees;
  const scopeEmployeeIds = useMemo(() => new Set(scopeEmployees.map((e) => e.id)), [scopeEmployees]);

  const validEmployeeIds = useMemo(() => new Set(employees.map((e) => e.id).concat(user.id)), [employees, user.id]);

  const scopedTimesheets = useMemo(() => {
    if (role === "System Admin" || role === "HR Manager") {
      return timesheets.filter((record) => record.userId !== user.id && validEmployeeIds.has(record.userId));
    }
    return timesheets.filter((record) => scopeEmployeeIds.has(record.userId) && validEmployeeIds.has(record.userId));
  }, [role, scopeEmployeeIds, timesheets, user.id, validEmployeeIds]);

  const departments = useMemo(
    () => Array.from(new Set(scopeEmployees.map((e) => e.department).filter(Boolean))).sort(),
    [scopeEmployees],
  );

  const weeks = useMemo(
    () => Array.from(new Set(scopedTimesheets.map((t) => t.weekStart))).sort((a, b) => b.localeCompare(a)),
    [scopedTimesheets],
  );

  const approvalItems = useMemo<ApprovalTimesheetItem[]>(() => {
    return scopedTimesheets.map((record) => {
      const employee = employees.find((e) => e.id === record.userId);
      const totalHours = Number(record.totalHours || 0);
      const itemKey = `timesheet:${record.id}`;

      return {
        key: itemKey,
        id: record.id,
        employeeId: record.userId,
        employeeName: employee?.fullName ?? "Unknown employee",
        department: employee?.department ?? "Unassigned",
        periodStart: record.weekStart,
        periodEnd: record.weekEnd,
        status: record.status,
        submittedAt: record.updatedAt,
        totalHours,
        priority: getApprovalPriority(totalHours, record.updatedAt),
        timesheet: record,
      };
    }).sort((left, right) => {
      const priorityRank: Record<ApprovalPriority, number> = { Overdue: 0, "Heavy Week": 1, Ready: 2 };
      const leftRank = priorityRank[left.priority];
      const rightRank = priorityRank[right.priority];
      if (leftRank !== rightRank) return leftRank - rightRank;
      return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
    });
  }, [employees, scopedTimesheets]);

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return approvalItems.filter((item) => {
      if (selectedEmployeeId !== "All" && item.employeeId !== selectedEmployeeId) return false;
      if (selectedDepartment !== "All" && item.department !== selectedDepartment) return false;
      if (selectedWeek !== "All" && item.periodStart !== selectedWeek) return false;

      if (selectedStatus === "Action Required" && !isActionRequired(item.status, role)) return false;
      if (selectedStatus === "Approved" && item.status !== "Approved") return false;
      if (selectedStatus === "Rejected" && item.status !== "Rejected") return false;

      if (query) {
        const haystack = [item.employeeName, item.department, item.status, item.periodStart, item.periodEnd].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [approvalItems, role, searchText, selectedDepartment, selectedEmployeeId, selectedStatus, selectedWeek]);

  const summary = useMemo(() => {
    const pendingItems = approvalItems.filter((item) => isActionRequired(item.status, role));
    const approvedCount = approvalItems.filter((item) => item.status === "Approved").length;
    const rejectedCount = approvalItems.filter((item) => item.status === "Rejected").length;
    const heavyCount = approvalItems.filter((item) => item.priority === "Heavy Week").length;

    return {
      pending: pendingItems.length,
      approved: approvedCount,
      rejected: rejectedCount,
      heavy: heavyCount,
      total: approvalItems.length,
    };
  }, [approvalItems, role]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, selectedDepartment, selectedEmployeeId, selectedStatus, selectedWeek]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [filteredItems]);

  const visibleActionRequiredIds = paginatedItems.filter((item) => isActionRequired(item.status, role)).map((item) => item.id);
  const allVisibleSelected = visibleActionRequiredIds.length > 0 && visibleActionRequiredIds.every((id) => selectedIds.includes(id));

  const detailModalItem = approvalItems.find((item) => item.key === detailModalKey) ?? null;
  const detailModalDecisionNote = detailModalItem ? decisionNotes[detailModalItem.key] : null;

  const updateDecisionNote = (key: string, note?: string) => {
    const nextNotes = { ...decisionNotes };
    if (note?.trim()) {
      nextNotes[key] = note.trim();
    } else {
      delete nextNotes[key];
    }
    setDecisionNotes(nextNotes);
    setStoredDecisionNotes(nextNotes);
  };

  const handleApprove = async (item: ApprovalTimesheetItem) => {
    setActingKey(item.key);
    try {
      const isSystemAdmin = role === "System Admin";
      const { id, adminId, adminName, ...rest } = item.timesheet;
      const updated = await timesheetService.saveWeek(
        {
          ...rest,
          status: "Approved",
          managerApprovalStatus: isSystemAdmin ? item.timesheet.managerApprovalStatus : "Approved",
          adminApprovalStatus: isSystemAdmin ? "Approved" : item.timesheet.adminApprovalStatus,
          approvedBy: user.fullName,
          approvalFlowType: isSystemAdmin
            ? (item.timesheet.status === "Submitted" ? "Direct Approved by Admin" : "Fully Approved (Manager + Admin)")
            : "Approved by Manager",
        },
        item.employeeId,
      );

      setTimesheets((current) => current.map((r) => (r.id === item.id ? updated : r)));
      setSelectedIds((current) => current.filter((i) => i !== item.id));
      updateDecisionNote(item.key);
      showToast("Timesheet approved successfully.", "success");
      return true;
    } catch {
      showToast("Unable to approve this timesheet right now.", "error");
      return false;
    } finally {
      setActingKey(null);
    }
  };

  const handleReject = async () => {
    const item = approvalItems.find((entry) => entry.key === rejectModalKey);
    if (!item) return;

    if (!rejectReason.trim()) {
      showToast("Rejection reason is required.", "info");
      return;
    }

    setActingKey(item.key);
    try {
      const updated = await timesheetService.saveWeek(
        {
          weekStart: item.timesheet.weekStart,
          status: "Rejected",
          rows: item.timesheet.rows,
          managerApprovalStatus: "Rejected",
          adminApprovalStatus: "Rejected",
          approvedBy: user.fullName || "System Admin",
          approvalFlowType: "Rejected",
        },
        item.employeeId,
      );

      setTimesheets((current) => current.map((r) => (r.id === item.id ? updated : r)));
      setSelectedIds((current) => current.filter((i) => i !== item.id));
      updateDecisionNote(item.key, rejectReason);
      setRejectModalKey(null);
      setRejectReason("");
      showToast("Timesheet rejected.", "success");
    } catch {
      showToast("Unable to reject this timesheet right now.", "error");
    } finally {
      setActingKey(null);
    }
  };

  const handleBulkApprove = async () => {
    const itemsToApprove = filteredItems.filter((item) => selectedIds.includes(item.id) && isActionRequired(item.status, role));
    if (itemsToApprove.length === 0) {
      showToast("Select at least one pending timesheet first.", "info");
      return;
    }

    setBulkApproving(true);
    try {
      const updatedRecords = await Promise.all(
        itemsToApprove.map((item) => {
          const isSystemAdmin = role === "System Admin";
          return timesheetService.saveWeek(
            {
              ...item.timesheet,
              status: "Approved",
              managerApprovalStatus: isSystemAdmin ? item.timesheet.managerApprovalStatus : "Approved",
              adminApprovalStatus: isSystemAdmin ? "Approved" : item.timesheet.adminApprovalStatus,
              approvedBy: user.fullName,
              approvalFlowType: isSystemAdmin
                ? (item.timesheet.status === "Submitted" ? "Direct Approved by Admin" : "Fully Approved (Manager + Admin)")
                : "Approved by Manager",
            },
            item.employeeId,
          );
        }),
      );

      const updatesById = new Map(updatedRecords.map((r) => [r.id, r]));
      setTimesheets((current) => current.map((r) => updatesById.get(r.id) ?? r));
      setSelectedIds([]);
      showToast(`${updatedRecords.length} timesheet(s) approved successfully.`, "success");
    } catch {
      showToast("Unable to bulk approve the selected timesheets right now.", "error");
    } finally {
      setBulkApproving(false);
    }
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading timesheet approvals..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {rejectModalKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-black">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                  <Icon name="close" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Reject Timesheet</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Provide required feedback for correction</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalKey(null)}
                className="h-10 w-10 rounded-2xl border border-zinc-200 flex items-center justify-center text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="space-y-2 block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Reason for Rejection *</span>
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Explain what needs to be corrected (e.g. incorrect project hours, missing work notes)..."
                  rows={4}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 text-sm text-zinc-800 outline-none transition focus:border-rose-500 focus:bg-white dark:border-zinc-700 dark:bg-black/50 dark:text-zinc-200 dark:focus:border-rose-500"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalKey(null)}
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleReject()}
                  disabled={Boolean(actingKey) || !rejectReason.trim()}
                  className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actingKey ? "Processing..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailModalItem && detailModalItem.timesheet && (
        <TimesheetApprovalDetailsModal
          item={{
            key: detailModalItem.key,
            employeeId: detailModalItem.employeeId,
            employeeName: detailModalItem.employeeName,
            department: detailModalItem.department,
            periodStart: detailModalItem.periodStart,
            periodEnd: detailModalItem.periodEnd,
            status: detailModalItem.timesheet.status,
            submittedAt: detailModalItem.submittedAt,
            priority: detailModalItem.priority,
            totalHours: detailModalItem.totalHours,
            timesheet: detailModalItem.timesheet,
          }}
          employee={employees.find((e) => e.id === detailModalItem.employeeId)}
          projects={projects}
          leaves={leaves}
          decisionNote={detailModalDecisionNote}
          acting={actingKey === detailModalItem.key}
          onClose={() => setDetailModalKey(null)}
          onDecisionNoteChange={(note) => updateDecisionNote(detailModalItem.key, note)}
          onApprove={() => void handleApprove(detailModalItem)}
          onReject={() => {
            setRejectModalKey(detailModalItem.key);
            setRejectReason(decisionNotes[detailModalItem.key] ?? "");
          }}
        />
      )}

      <section className="space-y-6">
        <WorkspacePageHero title="Timesheet Approvals">
          <WorkspaceHeroMeta primary={teamScope.label} />
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending Review" value={summary.pending} subtitle="Timesheets requiring action" accent="bg-amber-500/20" />
          <StatCard label="Approved" value={summary.approved} subtitle="Cleared weekly sheets" accent="bg-emerald-500/20" />
          <StatCard label="Rejected" value={summary.rejected} subtitle="Needs correction and resubmission" accent="bg-rose-500/20" />
          <StatCard label="Heavy Weeks (>40h)" value={summary.heavy} subtitle="Timesheets with high logged hours" accent="bg-sky-500/20" />
        </div>

        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as ApprovalFilterStatus)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="Action Required">Action Required</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="All">All statuses</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Department</span>
              <select
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Employee</span>
              <select
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All visible employees</option>
                {scopeEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.department || "No dept"})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Week Start</span>
              <select
                value={selectedWeek}
                onChange={(event) => setSelectedWeek(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All weeks</option>
                {weeks.map((week) => (
                  <option key={week} value={week}>
                    {formatShortDate(week)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Search</span>
              <div className="flex rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-black">
                <Icon name="search" className="h-5 w-5 text-zinc-400" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Employee, dept, or status"
                  className="ml-3 w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200"
                />
              </div>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="flex flex-col gap-3 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Timesheet Review Table</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {filteredItems.length} timesheet(s) match current filters
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(
                    allVisibleSelected
                      ? selectedIds.filter((id) => !visibleActionRequiredIds.includes(id))
                      : Array.from(new Set([...selectedIds, ...visibleActionRequiredIds])),
                  )
                }
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                {allVisibleSelected ? "Clear Page Selection" : "Select Pending"}
              </button>
              <button
                type="button"
                onClick={() => void handleBulkApprove()}
                disabled={bulkApproving || selectedIds.length === 0}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white px-5 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
              >
                <Icon name="approvals" className="mr-2 h-4 w-4" />
                {bulkApproving ? "Approving..." : `Bulk Approve (${selectedIds.length})`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50/80 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:bg-black/70 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-4 w-12">Select</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Period</th>
                  <th className="px-6 py-4">Total Hours</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {paginatedItems.map((item) => {
                  const actionRequired = isActionRequired(item.status, role);
                  const checked = selectedIds.includes(item.id);

                  return (
                    <tr key={item.key} className="transition hover:bg-zinc-50/80 dark:hover:bg-black/70">
                      <td className="px-6 py-4 align-middle">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!actionRequired}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                            )
                          }
                          className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                      <td className="px-6 py-4 align-top">
                        <button type="button" onClick={() => setDetailModalKey(item.key)} className="text-left">
                          <p className="font-semibold text-zinc-900 dark:text-white">{item.employeeName}</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.department}</p>
                        </button>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-zinc-600 dark:text-zinc-300">
                        <p>{formatShortDate(item.periodStart)} to {formatShortDate(item.periodEnd)}</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Submitted {formatRelativeLabel(item.submittedAt)}</p>
                      </td>
                      <td className="px-6 py-4 align-top font-semibold text-zinc-900 dark:text-white">
                        {item.totalHours.toFixed(1).replace(".0", "")}h
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityBadgeClass[item.priority]}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass[item.status]}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailModalKey(item.key)}
                            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900 shadow-sm"
                          >
                            <Icon name="eye" className="h-4 w-4" />
                            Review
                          </button>
                          {actionRequired && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleApprove(item)}
                                disabled={actingKey === item.key}
                                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15 shadow-sm"
                              >
                                <Icon name="approvals" className="h-4 w-4" />
                                {actingKey === item.key ? "Saving..." : "Approve"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModalKey(item.key);
                                  setRejectReason(decisionNotes[item.key] ?? "");
                                }}
                                disabled={actingKey === item.key}
                                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15 shadow-sm"
                              >
                                <Icon name="close" className="h-4 w-4" />
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paginatedItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-md space-y-3">
                        <p className="text-base font-semibold text-zinc-900 dark:text-white">No timesheets match current filters.</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Try widening your search or selecting another department or status.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </section>
      </section>
    </>
  );
};

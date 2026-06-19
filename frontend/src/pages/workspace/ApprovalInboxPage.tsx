import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { leaveService, type LeavePayload } from "../../services/leaveService";
import { projectService } from "../../services/projectService";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { LeaveRequest } from "../../types/leave";
import type { Project } from "../../types/project";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import { normalizeUserRole } from "../../types/roles";
import { buildTeamScope } from "../../utils/teamScope";

const PAGE_SIZE = 8;
const DECISION_NOTES_KEY = "approval-inbox-decision-notes";
const today = new Date();
today.setHours(0, 0, 0, 0);

type ApprovalType = "Timesheet" | "Leave";
type ApprovalFilterType = "All" | ApprovalType;
type ApprovalFilterStatus = "Action Required" | "Approved" | "Rejected" | "All";
type ApprovalPriority = "Ready" | "Heavy Week" | "Coverage Risk" | "Overdue";

interface ApprovalInboxItem {
  key: string;
  id: string;
  type: ApprovalType;
  employeeId: string;
  employeeName: string;
  department: string;
  periodStart: string;
  periodEnd: string;
  status: TimesheetWeekRecord["status"] | LeaveRequest["status"];
  submittedAt: string;
  summary: string;
  totalHours?: number;
  totalDays?: number;
  riskCount: number;
  priority: ApprovalPriority;
  timesheet?: TimesheetWeekRecord;
  leave?: LeaveRequest;
}

const statusBadgeClass: Record<ApprovalInboxItem["status"], string> = {
  Draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Submitted: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  "Manager Approved": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  "HR Approved": "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const priorityBadgeClass: Record<ApprovalPriority, string> = {
  Ready: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  "Heavy Week": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  "Coverage Risk": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Overdue: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const getStoredDecisionNotes = () => {
  const raw = window.localStorage.getItem(DECISION_NOTES_KEY);
  if (!raw) {
    return {} as Record<string, string>;
  }

  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
};

const setStoredDecisionNotes = (notes: Record<string, string>) => {
  window.localStorage.setItem(DECISION_NOTES_KEY, JSON.stringify(notes));
};

const getDateOnly = (value: string | Date) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatDisplayDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatShortDate = (value: string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });

const formatRelativeLabel = (value: string) => {
  const target = new Date(value);
  const diffInDays = Math.floor((today.getTime() - getDateOnly(target).getTime()) / 86_400_000);

  if (diffInDays <= 0) {
    return "Today";
  }

  if (diffInDays === 1) {
    return "1 day ago";
  }

  return `${diffInDays} days ago`;
};

const intersects = (leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) =>
  getDateOnly(leftStart) <= getDateOnly(rightEnd) && getDateOnly(leftEnd) >= getDateOnly(rightStart);

const countLeaveConflicts = (request: LeaveRequest, leaves: LeaveRequest[]) =>
  leaves.filter(
    (item) =>
      item.id !== request.id &&
      item.status === "Approved" &&
      item.department === request.department &&
      item.employeeId !== request.employeeId &&
      intersects(item.startDate, item.endDate, request.startDate, request.endDate),
  ).length;

const getAgeInDays = (value: string) =>
  Math.max(0, Math.floor((today.getTime() - getDateOnly(new Date(value)).getTime()) / 86_400_000));

const getApprovalPriority = ({
  type,
  riskCount,
  totalHours,
  submittedAt,
}: Pick<ApprovalInboxItem, "type" | "riskCount" | "totalHours" | "submittedAt">): ApprovalPriority => {
  if (getAgeInDays(submittedAt) >= 3) {
    return "Overdue";
  }

  if (type === "Leave" && riskCount > 0) {
    return "Coverage Risk";
  }

  if (type === "Timesheet" && Number(totalHours ?? 0) > WEEKLY_HOUR_LIMIT) {
    return "Heavy Week";
  }

  return "Ready";
};

const isActionRequired = (item: ApprovalInboxItem, role: string) => {
  if (item.type === "Leave") return item.status === "Pending";
  
  if (item.type === "Timesheet") {
    if (role === "System Admin" || role === "HR Manager") {
      return item.status === "Submitted" || item.status === "Manager Approved";
    }
    return item.status === "Submitted";
  }
  
  return false;
};

export const ApprovalInboxPage = ({ user }: { user: AuthUser }) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const role = normalizeUserRole(user.role);
  const [timesheets, setTimesheets] = useState<TimesheetWeekRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<ApprovalFilterType>("All");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<ApprovalFilterStatus>("Action Required");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailModalKey, setDetailModalKey] = useState<string | null>(null);
  const [actingKey, setActingKey] = useState<string | null>(null);
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
      showToast("Unable to load the approval inbox right now.", "error");
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

  const scopeEmployeeIds = useMemo(() => new Set(scopeEmployees.map((employee) => employee.id)), [scopeEmployees]);
  const validEmployeeIds = useMemo(() => new Set(employees.map((e) => e.id).concat(user.id)), [employees, user.id]);

  const scopedLeaves = useMemo(() => {
    if (role === "System Admin") {
      return leaves.filter((leave) => validEmployeeIds.has(leave.employeeId));
    }

    return leaves.filter((leave) => scopeEmployeeIds.has(leave.employeeId) && validEmployeeIds.has(leave.employeeId));
  }, [leaves, role, scopeEmployeeIds, validEmployeeIds]);

  const scopedTimesheets = useMemo(() => {
    if (role === "System Admin" || role === "HR Manager") {
      return timesheets.filter((record) => record.userId !== user.id && validEmployeeIds.has(record.userId));
    }

    return timesheets.filter((record) => scopeEmployeeIds.has(record.userId) && validEmployeeIds.has(record.userId));
  }, [role, scopeEmployeeIds, timesheets, user.id, validEmployeeIds]);

  const approvalItems = useMemo(() => {
    const timesheetItems: ApprovalInboxItem[] = scopedTimesheets.map((record) => {
      const employee = employees.find((item) => item.id === record.userId);
      const item: ApprovalInboxItem = {
        key: `timesheet:${record.id}`,
        id: record.id,
        type: "Timesheet",
        employeeId: record.userId,
        employeeName: employee?.fullName ?? "Unknown employee",
        department: employee?.department ?? "Unknown department",
        periodStart: record.weekStart,
        periodEnd: record.weekEnd,
        status: record.status,
        submittedAt: record.updatedAt,
        summary: `${record.rows.length} project row(s) in the weekly sheet`,
        totalHours: Number(record.totalHours || 0),
        riskCount: 0,
        priority: "Ready",
        timesheet: record,
      };

      return {
        ...item,
        priority: getApprovalPriority(item),
      };
    });

    const leaveItems: ApprovalInboxItem[] = scopedLeaves.map((request) => {
      const conflictCount = countLeaveConflicts(request, scopedLeaves);
      const item: ApprovalInboxItem = {
        key: `leave:${request.id}`,
        id: request.id,
        type: "Leave",
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        department: request.department,
        periodStart: request.startDate,
        periodEnd: request.endDate,
        status: request.status,
        submittedAt: request.createdAt,
        summary: request.reason,
        totalDays: request.days,
        riskCount: conflictCount,
        priority: "Ready",
        leave: request,
      };

      return {
        ...item,
        priority: getApprovalPriority(item),
      };
    });

    return [...timesheetItems, ...leaveItems].sort((left, right) => {
      const priorityRank: Record<ApprovalPriority, number> = {
        Overdue: 0,
        "Coverage Risk": 1,
        "Heavy Week": 2,
        Ready: 3,
      };

      const leftRank = priorityRank[left.priority];
      const rightRank = priorityRank[right.priority];
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
    });
  }, [employees, scopedLeaves, scopedTimesheets]);

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return approvalItems.filter((item) => {
      if (selectedType !== "All" && item.type !== selectedType) {
        return false;
      }

      if (selectedEmployeeId !== "All" && item.employeeId !== selectedEmployeeId) {
        return false;
      }

      if (selectedStatus === "Action Required" && !isActionRequired(item, role)) {
        return false;
      }

      if (selectedStatus === "Approved" && item.status !== "Approved") {
        return false;
      }

      if (selectedStatus === "Rejected" && item.status !== "Rejected") {
        return false;
      }

      if (dateFrom && getDateOnly(item.periodEnd) < getDateOnly(dateFrom)) {
        return false;
      }

      if (dateTo && getDateOnly(item.periodStart) > getDateOnly(dateTo)) {
        return false;
      }

      if (query) {
        const haystack = [item.employeeName, item.department, item.type, item.summary, item.status].join(" ").toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [approvalItems, dateFrom, dateTo, searchText, selectedEmployeeId, selectedStatus, selectedType]);

  const summary = useMemo(() => {
    const pendingItems = approvalItems.filter((item) => isActionRequired(item, role));
    const timesheetQueue = pendingItems.filter((item) => item.type === "Timesheet").length;
    const leaveQueue = pendingItems.filter((item) => item.type === "Leave").length;
    const overdue = pendingItems.filter((item) => item.priority === "Overdue").length;

    return {
      totalPending: pendingItems.length,
      timesheetQueue,
      leaveQueue,
      overdue,
    };
  }, [approvalItems]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, searchText, selectedEmployeeId, selectedStatus, selectedType]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const detailModalItem = approvalItems.find((item) => item.key === detailModalKey) ?? null;

  const dailySummary = useMemo(() => {
    const submittedToday = approvalItems.filter((item) => getAgeInDays(item.submittedAt) === 0 && isActionRequired(item, role)).length;
    const readyNow = approvalItems.filter((item) => isActionRequired(item, role) && item.priority === "Ready").length;
    const escalations = approvalItems.filter((item) => isActionRequired(item, role) && item.priority === "Overdue").length;

    return {
      submittedToday,
      readyNow,
      escalations,
    };
  }, [approvalItems]);

  const coverageWatch = useMemo(() => {
    return approvalItems
      .filter((item) => item.type === "Leave" && item.riskCount > 0 && isActionRequired(item, role))
      .slice(0, 5);
  }, [approvalItems]);

  const detailModalDecisionNote = detailModalItem ? decisionNotes[detailModalItem.key] : null;

  const detailModalOverlappingLeave = useMemo(() => {
    if (!detailModalItem?.leave) {
      return [] as LeaveRequest[];
    }

    return scopedLeaves.filter(
      (item) =>
        item.id !== detailModalItem.leave?.id &&
        item.status === "Approved" &&
        item.department === detailModalItem.leave?.department &&
        item.employeeId !== detailModalItem.leave?.employeeId &&
        intersects(item.startDate, item.endDate, detailModalItem.leave.startDate, detailModalItem.leave.endDate),
    );
  }, [scopedLeaves, detailModalItem]);

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

  const handleApprove = async (item: ApprovalInboxItem) => {
    setActingKey(item.key);

    try {
      if (item.type === "Timesheet" && item.timesheet) {
        const isSystemAdmin = role === "System Admin";
        
        const { id, adminId, adminName, updatedAt, ...rest } = item.timesheet;
        const updated = await timesheetService.saveWeek(
          {
            ...rest,
            status: "Approved",
            managerApprovalStatus: isSystemAdmin ? item.timesheet.managerApprovalStatus : "Approved",
            adminApprovalStatus: isSystemAdmin ? "Approved" : item.timesheet.adminApprovalStatus,
            approvedBy: user.fullName,
            approvalFlowType: isSystemAdmin 
              ? (item.timesheet.status === "Submitted" ? "Direct Approved by Admin" : "Fully Approved (Manager + Admin)")
              : "Approved by Manager"
          },
          item.timesheet.userId,
        );

        setTimesheets((current) => current.map((record) => (record.id === item.timesheet?.id ? updated : record)));
      }

      if (item.type === "Leave" && item.leave) {
        const payload: LeavePayload = {
          employeeId: item.leave.employeeId,
          employeeName: item.leave.employeeName,
          department: item.leave.department,
          type: item.leave.type,
          startDate: item.leave.startDate,
          endDate: item.leave.endDate,
          days: item.leave.days,
          reason: item.leave.reason,
          status: "Approved",
          managerApprovalStatus: role === "HR Manager" || role === "System Admin" ? "Approved" : "Approved",
          hrApprovalStatus: role === "HR Manager" || role === "System Admin" ? "Approved" : item.leave.hrApprovalStatus,
          adminApprovalStatus: role === "System Admin" ? "Approved" : item.leave.adminApprovalStatus,
        };
        const updated = await leaveService.updateLeave(item.leave.id, payload);
        setLeaves((current) => current.map((leave) => (leave.id === item.leave?.id ? updated : leave)));
      }

      updateDecisionNote(item.key);
      showToast(`${item.type} approved successfully.`, "success");
      return true;
    } catch {
      showToast(`Unable to approve this ${item.type.toLowerCase()} right now.`, "error");
      return false;
    } finally {
      setActingKey(null);
    }
  };

  const handleReject = async () => {
    const item = approvalItems.find((entry) => entry.key === rejectModalKey);
    if (!item) {
      return;
    }

    if (!rejectReason.trim()) {
      showToast("Rejection reason is required.", "info");
      return;
    }

    setActingKey(item.key);

    try {
      if (item.type === "Timesheet" && item.timesheet) {
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
          item.timesheet.userId,
        );

        setTimesheets((current) => current.map((record) => (record.id === item.timesheet?.id ? updated : record)));
      }

      if (item.type === "Leave" && item.leave) {
        const payload: LeavePayload = {
          employeeId: item.leave.employeeId,
          employeeName: item.leave.employeeName,
          department: item.leave.department,
          type: item.leave.type,
          startDate: item.leave.startDate,
          endDate: item.leave.endDate,
          days: item.leave.days,
          reason: item.leave.reason,
          status: "Rejected",
          managerApprovalStatus: "Rejected",
          hrApprovalStatus: "Rejected",
          adminApprovalStatus: "Rejected",
        };
        const updated = await leaveService.updateLeave(item.leave.id, payload);
        setLeaves((current) => current.map((leave) => (leave.id === item.leave?.id ? updated : leave)));
      }

      updateDecisionNote(item.key, rejectReason);
      setRejectModalKey(null);
      setRejectReason("");
      showToast(`${item.type} rejected.`, "success");
    } catch {
      showToast(`Unable to reject this ${item.type.toLowerCase()} right now.`, "error");
    } finally {
      setActingKey(null);
    }
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading approval inbox..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Approval Inbox">
          <WorkspaceHeroMeta primary={teamScope.label} />
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Pending" value={summary.totalPending} subtitle="Items waiting for a decision" accent="bg-amber-500/20" />
          <StatCard label="Timesheets" value={summary.timesheetQueue} subtitle="Submitted weekly sheets in queue" accent="bg-zinc-500/20" />
          <StatCard label="Leaves" value={summary.leaveQueue} subtitle="Pending leave requests in queue" accent="bg-emerald-500/20" />
          <StatCard label="Overdue" value={summary.overdue} subtitle="Action items older than 3 days" accent="bg-rose-500/20" />
        </div>

        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Type</span>
              <select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value as ApprovalFilterType)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All approvals</option>
                <option value="Timesheet">Timesheets</option>
                <option value="Leave">Leaves</option>
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
                {scopeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
            </label>

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
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Date From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Date To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Search</span>
              <div className="flex rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-black">
                <Icon name="search" className="h-5 w-5 text-zinc-400" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Employee, type, status, or reason"
                  className="ml-3 w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200"
                />
              </div>
            </label>
          </div>
        </section>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Pending Approval Queue</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Review timesheets and leave requests together in priority order.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-black/70 dark:text-zinc-300">
                {filteredItems.length} visible item(s)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50/80 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:bg-black/70 dark:text-zinc-400">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Period</th>
                    <th className="px-6 py-4">Summary</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {paginatedItems.map((item) => {
                    const selected = detailModalKey === item.key;
                    const actionRequired = isActionRequired(item, role);
                    const requiresDetailReview = item.type === "Timesheet" && actionRequired;

                    return (
                      <tr
                        key={item.key}
                        className={`transition ${
                          selected ? "bg-brand-50/70 dark:bg-brand-500/10" : "hover:bg-zinc-50/80 dark:hover:bg-black/70"
                        }`}
                      >
                        <td className="px-6 py-4 align-top">
                          <button type="button" onClick={() => setDetailModalKey(item.key)} className="text-left">
                            <p className="font-semibold text-zinc-900 dark:text-white">{item.employeeName}</p>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.department}</p>
                          </button>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                            {item.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-zinc-600 dark:text-zinc-300">
                          <p>{formatShortDate(item.periodStart)} to {formatShortDate(item.periodEnd)}</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Submitted {formatRelativeLabel(item.submittedAt)}</p>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-zinc-600 dark:text-zinc-300">
                          {item.type === "Timesheet" ? `${Number(item.totalHours ?? 0).toFixed(1).replace(".0", "")}h logged` : `${item.totalDays ?? 0} day(s) requested`}
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
                            {requiresDetailReview ? (
                              <button
                                type="button"
                                onClick={() => setDetailModalKey(item.key)}
                                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                              >
                                <Icon name="eye" className="h-4 w-4" />
                                Open Review Screen
                              </button>
                            ) : actionRequired ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setDetailModalKey(item.key)}
                                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                                >
                                  <Icon name="eye" className="h-4 w-4" />
                                  View All Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleApprove(item)}
                                  disabled={actingKey === item.key}
                                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
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
                                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
                                >
                                  <Icon name="close" className="h-4 w-4" />
                                  Reject
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDetailModalKey(item.key)}
                                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                              >
                                <Icon name="eye" className="h-4 w-4" />
                                View All Details
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="mx-auto max-w-md space-y-3">
                          <p className="text-base font-semibold text-zinc-900 dark:text-white">No approvals match the current filters.</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Try widening the date range or switching the status filter back to action required.
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

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Daily Summary</p>
              <div className="mt-4 space-y-3">
                {[
                  `${dailySummary.submittedToday} item(s) arrived today.`,
                  `${dailySummary.readyNow} item(s) are ready for a quick approval pass.`,
                  `${dailySummary.escalations} item(s) qualify as overdue and may need escalation.`,
                ].map((line) => (
                  <div key={line} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:text-zinc-300">
                    {line}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Escalation Watch</p>
              <div className="mt-4 space-y-3">
                {coverageWatch.length > 0 ? (
                  coverageWatch.map((item) => (
                    <div key={item.key} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{item.employeeName}</p>
                      <p className="mt-1 text-sm text-[#185FA5] dark:text-[#B5D4F4]">
                        {item.riskCount} overlapping approved leave request(s) in the same department.
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No current leave coverage escalation is visible in the queue.</p>
                )}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Quick Links</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/admin/team-overview"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
                >
                  My Team Overview
                </Link>
                <Link
                  to="/admin/approvals/leave"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Leave Approval Inbox
                </Link>
              </div>
            </section>
          </div>
        </div>
      </section>

      {detailModalItem?.type === "Timesheet" && detailModalItem.timesheet ? (
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
          employee={employees.find((entry) => entry.id === detailModalItem.employeeId)}
          projects={projects}
          leaves={scopedLeaves}
          decisionNote={detailModalDecisionNote}
          acting={actingKey === detailModalItem.key}
          onClose={() => setDetailModalKey(null)}
          onDecisionNoteChange={(note) => updateDecisionNote(detailModalItem.key, note)}
          onApprove={() => {
            void (async () => {
              const approved = await handleApprove(detailModalItem);
              if (approved) {
                setDetailModalKey(null);
              }
            })();
          }}
          onReject={() => {
            setRejectModalKey(detailModalItem.key);
            setRejectReason(decisionNotes[detailModalItem.key] ?? "");
            setDetailModalKey(null);
          }}
        />
      ) : null}

      {detailModalItem?.type === "Leave" && detailModalItem.leave ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl dark:border-zinc-800 dark:bg-black">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Approval Details</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Full {detailModalItem.type.toLowerCase()} information before approve or reject action.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close approval details"
                onClick={() => setDetailModalKey(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold text-zinc-900 dark:text-white">{detailModalItem.employeeName}</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {detailModalItem.department} - {detailModalItem.type}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass[detailModalItem.status]}`}>
                    {detailModalItem.status}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Approval Window</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
                      {formatShortDate(detailModalItem.periodStart)} to {formatShortDate(detailModalItem.periodEnd)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Priority</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{detailModalItem.priority}</p>
                  </div>
                </div>

                {detailModalItem.type === "Leave" && detailModalItem.leave ? (
                  <>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Leave Request</p>
                      <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">{detailModalItem.leave.type}</p>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{detailModalItem.leave.days} day(s) requested</p>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Reason</p>
                      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{detailModalItem.leave.reason}</p>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Coverage Check</p>
                      <div className="mt-3 space-y-3">
                        {detailModalOverlappingLeave.length > 0 ? (
                          detailModalOverlappingLeave.map((leave) => (
                            <div key={leave.id} className="rounded-2xl bg-white p-3 dark:bg-black">
                              <p className="font-semibold text-zinc-900 dark:text-white">{leave.employeeName}</p>
                              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                                {leave.type} - {formatShortDate(leave.startDate)} to {formatShortDate(leave.endDate)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">No overlapping approved leave found in the current scope.</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Submitted On</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{formatDisplayDate(detailModalItem.submittedAt)}</p>
                </div>

                {detailModalDecisionNote ? (
                  <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Stored Review Note</p>
                    <p className="mt-2 text-sm text-[#185FA5] dark:text-[#B5D4F4]">{detailModalDecisionNote}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 px-6 py-5 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setDetailModalKey(null)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Close
              </button>
              {isActionRequired(detailModalItem, role) ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailModalKey(null);
                      void handleApprove(detailModalItem);
                    }}
                    disabled={actingKey === detailModalItem.key}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="approvals" className="h-4 w-4" />
                    {actingKey === detailModalItem.key ? "Saving..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectModalKey(detailModalItem.key);
                      setRejectReason(decisionNotes[detailModalItem.key] ?? "");
                      setDetailModalKey(null);
                    }}
                    disabled={actingKey === detailModalItem.key}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="close" className="h-4 w-4" />
                    Reject
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {rejectModalKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Reject Approval Item</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Capture a clear rejection note before sending this item back for correction.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close reject approval dialog"
                onClick={() => {
                  setRejectModalKey(null);
                  setRejectReason("");
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-6 block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Rejection Reason</span>
              <textarea
                rows={5}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Explain the missing context, coverage issue, or correction needed."
                className="w-full rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectModalKey(null);
                  setRejectReason("");
                }}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleReject()}
                disabled={actingKey === rejectModalKey}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actingKey === rejectModalKey ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { ToastContainer } from "../../components/ToastContainer";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { leaveService, type LeavePayload } from "../../services/leaveService";
import { projectService } from "../../services/projectService";
import type { AuthUser } from "../../types/auth";
import type { LeaveRequest, LeaveTypeDefinition } from "../../types/leave";
import type { Project } from "../../types/project";
import { normalizeUserRole } from "../../types/roles";
import { buildTeamScope } from "../../utils/teamScope";

const NOTES_KEY = "leave-approval-decision-notes";
const PAGE_SIZE = 8;
const today = new Date();
today.setHours(0, 0, 0, 0);

type ConflictSeverity = "None" | "Low" | "Medium" | "High";
type FilterStatus = "All" | "Pending" | "Manager Approved" | "HR Approved" | "Approved" | "Rejected";

interface PublicHoliday {
  date: string;
  name: string;
}

const statusBadge: Record<LeaveRequest["status"], string> = {
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  "Manager Approved": "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  "HR Approved": "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const conflictBadge: Record<ConflictSeverity, string> = {
  None: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Low: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  High: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const getPublicHolidaysForYear = (year: number): PublicHoliday[] => [
  { date: `${year}-01-01`, name: "New Year" },
  { date: `${year}-01-26`, name: "Republic Day" },
  { date: `${year}-04-14`, name: "Ambedkar Jayanti" },
  { date: `${year}-05-01`, name: "Labour Day" },
  { date: `${year}-08-15`, name: "Independence Day" },
  { date: `${year}-10-02`, name: "Gandhi Jayanti" },
  { date: `${year}-12-25`, name: "Christmas" },
];

const getStoredDecisionNotes = () => {
  const raw = window.localStorage.getItem(NOTES_KEY);
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
  window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
};

const getDateOnly = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatDisplayDate = (value: string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatCreatedDate = (value: string) =>
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

const formatDateRange = (request: Pick<LeaveRequest, "startDate" | "endDate">) =>
  `${formatShortDate(request.startDate)} to ${formatShortDate(request.endDate)}`;

const intersects = (leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) =>
  getDateOnly(leftStart) <= getDateOnly(rightEnd) && getDateOnly(leftEnd) >= getDateOnly(rightStart);

const getYearsInRange = (startDate: string, endDate: string) => {
  const startYear = getDateOnly(startDate).getFullYear();
  const endYear = getDateOnly(endDate).getFullYear();
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
};

const getEmployeeScopeLabel = (role: ReturnType<typeof normalizeUserRole>, department: string | null) => {
  if (role === "HR Manager") {
    return "Level 2 approval scope";
  }

  if (department) {
    return `${department} team approval scope`;
  }

  return "Direct-report approval scope";
};

export const LeaveApprovalInboxPage = ({ user }: { user: AuthUser }) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const role = normalizeUserRole(user.role);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDefinition[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedLeaveType, setSelectedLeaveType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>("Pending");
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>(() => getStoredDecisionNotes());
  const [rejectModalRequestId, setRejectModalRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  useBodyScrollLock(Boolean(rejectModalRequestId));

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);

      try {
        const [types, requests, projectRecords] = await Promise.all([
          leaveService.getLeaveTypes(),
          leaveService.getLeaves(),
          projectService.getProjects(),
        ]);

        if (!active) {
          return;
        }

        setLeaveTypes(types.filter((leaveType) => leaveType.active));
        setProjects(projectRecords);
        setLeaveRequests(
          [...requests].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
        );
      } catch {
        if (active) {
          showToast("Unable to load leave approval inbox right now.", "error");
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
  }, [showToast]);

  const viewerEmployee = useMemo(() => employees.find((employee) => employee.id === user.id), [employees, user.id]);
  const teamScope = useMemo(
    () => buildTeamScope({ role, employees, projects, userId: user.id }),
    [employees, projects, role, user.id],
  );
  const scopedEmployeeIds = useMemo(() => teamScope.employeeIds, [teamScope.employeeIds]);

  const scopedDepartments = useMemo(() => {
    if (role === "HR Manager") {
      return Array.from(new Set(employees.map((employee) => employee.department))).sort((left, right) => left.localeCompare(right));
    }

    return teamScope.departments;
  }, [employees, role, teamScope.departments]);

  const employeeDirectory = useMemo(() => new Set(employees.map((employee) => employee.id)), [employees]);

  const scopedRequests = useMemo(() => {
    const validRequests = leaveRequests.filter((request) => employeeDirectory.has(request.employeeId));
    if (role === "HR Manager" || role === "System Admin" || role === "Finance Admin") {
      return validRequests;
    }

    return validRequests.filter((request) => scopedEmployeeIds.has(request.employeeId));
  }, [leaveRequests, employeeDirectory, role, scopedEmployeeIds]);

  const leaveTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(leaveTypes.map((leaveType) => leaveType.name).concat(scopedRequests.map((request) => request.type))),
      ).sort((left, right) => left.localeCompare(right)),
    [leaveTypes, scopedRequests],
  );

  const getConflictMeta = (request: LeaveRequest) => {
    const overlappingApproved = scopedRequests.filter(
      (item) =>
        item.id !== request.id &&
        item.status === "Approved" &&
        item.department === request.department &&
        intersects(item.startDate, item.endDate, request.startDate, request.endDate),
    );

    const holidays = getYearsInRange(request.startDate, request.endDate)
      .flatMap((year) => getPublicHolidaysForYear(year))
      .filter((holiday) => intersects(holiday.date, holiday.date, request.startDate, request.endDate));

    const overlapCount = overlappingApproved.length;
    let severity: ConflictSeverity = "None";

    if (overlapCount >= 3) {
      severity = "High";
    } else if (overlapCount === 2 || (overlapCount >= 1 && holidays.length >= 1)) {
      severity = "Medium";
    } else if (overlapCount === 1 || holidays.length >= 1) {
      severity = "Low";
    }

    return {
      severity,
      overlappingApproved,
      holidays,
    };
  };

  const filteredRequests = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return scopedRequests.filter((request) => {
      if (selectedDepartment !== "All" && request.department !== selectedDepartment) {
        return false;
      }

      if (selectedLeaveType !== "All" && request.type !== selectedLeaveType) {
        return false;
      }

      if (selectedStatus !== "All" && request.status !== selectedStatus) {
        return false;
      }

      if (dateFrom && getDateOnly(request.endDate) < getDateOnly(dateFrom)) {
        return false;
      }

      if (dateTo && getDateOnly(request.startDate) > getDateOnly(dateTo)) {
        return false;
      }

      if (query) {
        const haystack = [request.employeeName, request.department, request.type, request.reason].join(" ").toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [dateFrom, dateTo, scopedRequests, searchText, selectedDepartment, selectedLeaveType, selectedStatus]);

  const summary = useMemo(() => {
    const pendingCount = filteredRequests.filter((request) => request.status === "Pending").length;
    const approvedCount = filteredRequests.filter((request) => request.status === "Approved").length;
    const rejectedCount = filteredRequests.filter((request) => request.status === "Rejected").length;
    const highConflictCount = filteredRequests.filter((request) => getConflictMeta(request).severity === "High").length;

    return {
      visible: filteredRequests.length,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      highConflict: highConflictCount,
    };
  }, [filteredRequests]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, searchText, selectedDepartment, selectedLeaveType, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const selectedRequest =
    filteredRequests.find((request) => request.id === selectedRequestId) ?? paginatedRequests[0] ?? filteredRequests[0] ?? null;

  useEffect(() => {
    if (!selectedRequest) {
      setSelectedRequestId(null);
      return;
    }

    if (selectedRequest.id !== selectedRequestId) {
      setSelectedRequestId(selectedRequest.id);
    }
  }, [selectedRequest, selectedRequestId]);

  const selectedConflict = selectedRequest ? getConflictMeta(selectedRequest) : null;

  const upcomingApproved = useMemo(() => {
    const baseDepartment = selectedRequest?.department ?? (selectedDepartment === "All" ? null : selectedDepartment);

    return scopedRequests
      .filter((request) => request.status === "Approved")
      .filter((request) => (baseDepartment ? request.department === baseDepartment : true))
      .filter((request) => getDateOnly(request.endDate) >= today)
      .sort((left, right) => getDateOnly(left.startDate).getTime() - getDateOnly(right.startDate).getTime())
      .slice(0, 6);
  }, [scopedRequests, selectedDepartment, selectedRequest]);

  const todayLeave = useMemo(
    () =>
      scopedRequests.filter(
        (request) =>
          request.status === "Approved" &&
          getDateOnly(request.startDate) <= today &&
          getDateOnly(request.endDate) >= today &&
          (selectedDepartment === "All" ? true : request.department === selectedDepartment),
      ),
    [scopedRequests, selectedDepartment],
  );

  const updateRequestStatus = async (request: LeaveRequest, nextStatus: LeaveRequest["status"], note?: string, approvalData?: Partial<LeaveRequest>) => {
    const payload: LeavePayload = {
      employeeId: request.employeeId,
      employeeName: request.employeeName,
      department: request.department,
      type: request.type,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.days,
      reason: request.reason,
      status: nextStatus,
      managerApprovalStatus: approvalData?.managerApprovalStatus ?? request.managerApprovalStatus,
      hrApprovalStatus: approvalData?.hrApprovalStatus ?? request.hrApprovalStatus,
      adminApprovalStatus: approvalData?.adminApprovalStatus ?? request.adminApprovalStatus,
      approvalFlowType: approvalData?.approvalFlowType ?? request.approvalFlowType,
      approvedBy: approvalData?.approvedBy ?? request.approvedBy,
    };

    const updated = await leaveService.updateLeave(request.id, payload);
    setLeaveRequests((current) => current.map((item) => (item.id === request.id ? updated : item)));

    const nextNotes = { ...decisionNotes };
    if (note) {
      nextNotes[request.id] = note;
    } else if (nextStatus === "Approved") {
      delete nextNotes[request.id];
    }
    setDecisionNotes(nextNotes);
    setStoredDecisionNotes(nextNotes);
  };

  const handleApprove = async (request: LeaveRequest) => {
    setActingId(request.id);
    try {
      const approvalData: Partial<LeaveRequest> = {};
      
      if (role === "System Admin") {
        approvalData.adminApprovalStatus = "Approved";
        approvalData.approvedBy = user.fullName || "System Admin";
        approvalData.approvalFlowType = "Admin Override";
      } else if (role === "HR Manager") {
        approvalData.hrApprovalStatus = "Approved";
      } else {
        // Default to Manager
        approvalData.managerApprovalStatus = "Approved";
      }

      await updateRequestStatus(request, request.status, undefined, approvalData);
      showToast("Leave approval stage processed.", "success");
    } catch {
      showToast("Unable to process approval right now.", "error");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async () => {
    const request = filteredRequests.find((item) => item.id === rejectModalRequestId);
    if (!request) {
      return;
    }

    if (!rejectReason.trim()) {
      showToast("Rejection reason is required.", "info");
      return;
    }

    setRejectingId(request.id);

    try {
      await updateRequestStatus(request, "Rejected", rejectReason.trim());
      showToast("Leave request rejected.", "success");
      setRejectModalRequestId(null);
      setRejectReason("");
    } catch {
      showToast("Unable to reject this leave request right now.", "error");
    } finally {
      setRejectingId(null);
    }
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading leave approval inbox..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Leave approvals">
          <WorkspaceHeroMeta
            primary={
              role === "HR Manager"
                ? `${getEmployeeScopeLabel(role, viewerEmployee?.department ?? null)} · ${summary.pending} pending`
                : `${teamScope.label} · ${summary.pending} pending`
            }
          />
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Visible Requests",
              value: summary.visible,
              helper: "Filtered leave requests in scope",
              accent: "from-sky-100 to-sky-50 dark:from-sky-500/15 dark:to-black",
            },
            {
              label: "Pending Decisions",
              value: summary.pending,
              helper: "Default inbox review queue",
              accent: "from-amber-100 to-amber-50 dark:from-amber-500/15 dark:to-black",
            },
            {
              label: "Approved",
              value: summary.approved,
              helper: "Already processed from this view",
              accent: "from-emerald-100 to-emerald-50 dark:from-emerald-500/15 dark:to-black",
            },
            {
              label: "High Conflict",
              value: summary.highConflict,
              helper: "Coverage risk requests in result set",
              accent: "from-rose-100 to-rose-50 dark:from-rose-500/15 dark:to-black",
            },
          ].map((card) => (
            <article
              key={card.label}
              className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm transition hover:-translate-y-1 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50"
            >
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{card.label}</p>
              <p className="mt-3 text-4xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{card.value}</p>
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{card.helper}</p>
            </article>
          ))}
        </div>

        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Department</span>
              <select
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All departments</option>
                {scopedDepartments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Leave Type</span>
              <select
                value={selectedLeaveType}
                onChange={(event) => setSelectedLeaveType(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All leave types</option>
                {leaveTypeOptions.map((leaveType) => (
                  <option key={leaveType} value={leaveType}>
                    {leaveType}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as FilterStatus)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="Pending">Pending only</option>
                <option value="All">All statuses</option>
                <option value="Manager Approved">Manager Approved</option>
                <option value="HR Approved">HR Approved</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
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
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Search</span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Employee, department, leave type, reason"
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>

            <div className="flex flex-wrap items-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedDepartment("All");
                  setSelectedLeaveType("All");
                  setSelectedStatus("Pending");
                  setSearchText("");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Pending Requests Table</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Use the conflict badge and side panel before making a final approval decision.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                  <thead className="bg-zinc-50/90 dark:bg-black/70">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Leave</th>
                      <th className="px-6 py-4">Dates</th>
                      <th className="px-6 py-4">Days</th>
                      <th className="px-6 py-4">Conflict</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {paginatedRequests.map((request) => {
                      const isSelected = selectedRequest?.id === request.id;
                      const conflict = getConflictMeta(request);
                      
                      // Can approve if it's pending OR if it's in a state that the current user can move forward
                      const isPending = request.status === "Pending" || request.status === "Manager Approved" || request.status === "HR Approved";
                      const canApprove = (role === "System Admin" && request.status !== "Approved") ||
                                       (role === "HR Manager" && (request.status === "Pending" || request.status === "Manager Approved")) ||
                                       (role === "Team Manager" && request.status === "Pending");

                      return (
                        <tr
                          key={request.id}
                          className={`transition ${
                            isSelected
                              ? "bg-brand-50/70 dark:bg-brand-500/10"
                              : "bg-transparent hover:bg-zinc-50/80 dark:hover:bg-black/70"
                          }`}
                        >
                          <td className="px-6 py-4 align-top">
                            <button
                              type="button"
                              onClick={() => setSelectedRequestId(request.id)}
                              className="text-left"
                            >
                              <p className="font-semibold text-zinc-900 dark:text-white">{request.employeeName}</p>
                              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{request.department}</p>
                            </button>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <p className="font-semibold text-zinc-900 dark:text-white">{request.type}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">{request.reason}</p>
                          </td>
                          <td className="px-6 py-4 align-top text-sm text-zinc-600 dark:text-zinc-300">
                            <p>{formatDateRange(request)}</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Submitted {formatCreatedDate(request.createdAt)}</p>
                          </td>
                          <td className="px-6 py-4 align-top text-sm font-semibold text-zinc-900 dark:text-white">{request.days} day(s)</td>
                          <td className="px-6 py-4 align-top">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${conflictBadge[conflict.severity]}`}>
                              {conflict.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[request.status]}`}>{request.status}</span>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="flex justify-end gap-2">
                              {canApprove ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleApprove(request)}
                                    disabled={actingId === request.id || rejectingId === request.id}
                                    className={`inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                      role === "System Admin" 
                                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                                    }`}
                                  >
                                    <Icon name={role === "System Admin" ? "shield" : "approvals"} className="h-4 w-4" />
                                    {actingId === request.id ? "Processing..." : role === "System Admin" ? "Admin Override" : "Approve"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRejectModalRequestId(request.id);
                                      setRejectReason(decisionNotes[request.id] ?? "");
                                    }}
                                    disabled={actingId === request.id || rejectingId === request.id}
                                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
                                  >
                                    <Icon name="close" className="h-4 w-4" />
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedRequestId(request.id)}
                                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                                >
                                  <Icon name="eye" className="h-4 w-4" />
                                  View
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {paginatedRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <div className="mx-auto max-w-md space-y-3">
                            <p className="text-base font-semibold text-zinc-900 dark:text-white">No leave requests match the current filters.</p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              Try widening the date range or switching back to pending-only mode.
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
          </div>

          <div className="space-y-6">
            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Selected Request</p>
              {selectedRequest && selectedConflict ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold text-zinc-900 dark:text-white">{selectedRequest.employeeName}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {selectedRequest.department} · {selectedRequest.type}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[selectedRequest.status]}`}>
                      {selectedRequest.status}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Requested Dates</p>
                      <p className="mt-2 text-sm font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{formatDateRange(selectedRequest)}</p>
                    </div>
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Conflict Severity</p>
                      <p className="mt-2 text-sm font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{selectedConflict.severity}</p>
                    </div>
                  </div>

                  {selectedRequest.approvedBy && (
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Approval Detail</p>
                      <p className="mt-2 text-sm text-[#185FA5] dark:text-[#B5D4F4]">
                        Approved by: <span className="font-semibold">{selectedRequest.approvedBy}</span>
                        {selectedRequest.approvalFlowType && ` (${selectedRequest.approvalFlowType})`}
                      </p>
                    </div>
                  )}

                  <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Reason</p>
                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{selectedRequest.reason}</p>
                  </div>

                  {decisionNotes[selectedRequest.id] ? (
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Stored Review Note</p>
                      <p className="mt-2 text-sm text-[#185FA5] dark:text-[#B5D4F4]">{decisionNotes[selectedRequest.id]}</p>
                    </div>
                  ) : null}

                  <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Calendar Conflict Check</p>
                    <div className="mt-3 space-y-3">
                      {selectedConflict.overlappingApproved.length > 0 ? (
                        selectedConflict.overlappingApproved.map((request) => (
                          <div key={`overlap-${request.id}`} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-white p-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/80">
                            <p className="font-semibold text-zinc-900 dark:text-white">{request.employeeName}</p>
                            <p className="mt-1 text-sm text-[#185FA5] dark:text-[#B5D4F4]">
                              {request.type} · {formatDateRange(request)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">No approved leave overlap found in this scope.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Public Holidays In Range</p>
                    <div className="mt-3 space-y-2">
                      {selectedConflict.holidays.length > 0 ? (
                        selectedConflict.holidays.map((holiday) => (
                          <div
                            key={`${selectedRequest.id}-${holiday.date}`}
                            className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-3 py-2 text-sm text-[#185FA5] dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:text-[#B5D4F4]"
                          >
                            {holiday.name} · {formatDisplayDate(holiday.date)}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">No public holidays intersect the selected request window.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Select a leave request from the table to review conflict details and approval context.
                </p>
              )}
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Coverage Watch</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{todayLeave.length} teammate(s) away today</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Approved leave in the current scope for today.</p>
                </div>
                <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{summary.rejected} rejected request(s) in this result</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Useful for escalation follow-up and resubmission tracking.</p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Upcoming Approved Leave</p>
              <div className="mt-4 space-y-3">
                {upcomingApproved.length > 0 ? (
                  upcomingApproved.map((request) => (
                    <div key={`upcoming-${request.id}`} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">{request.employeeName}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{request.type}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[request.status]}`}>{request.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{formatDateRange(request)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No approved leave is lined up for this scope yet.</p>
                )}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Quick Links</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/admin/leave/calendar"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
                >
                  Team Calendar
                </Link>
                <Link
                  to="/admin/reports/leave-summary"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Leave Summary
                </Link>
              </div>
            </section>
          </div>
        </div>
      </section>

      {rejectModalRequestId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Reject Leave Request</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Capture a clear reason before marking this request as rejected.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectModalRequestId(null);
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
                placeholder="Explain the coverage issue, missing context, or policy reason for rejection."
                className="w-full rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectModalRequestId(null);
                  setRejectReason("");
                }}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleReject()}
                disabled={rejectingId === rejectModalRequestId}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rejectingId === rejectModalRequestId ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

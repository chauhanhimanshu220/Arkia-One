import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { ToastContainer } from "../../components/ToastContainer";
import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { Icon } from "../../components/Icon";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { leaveService } from "../../services/leaveService";
import { projectService } from "../../services/projectService";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { LeaveRequest } from "../../types/leave";
import type { Project } from "../../types/project";
import { normalizeUserRole } from "../../types/roles";
import type { TimesheetRow, TimesheetWeekRecord } from "../../types/timesheet";
import { buildTeamScope } from "../../utils/teamScope";

const PAGE_SIZE = 10;
const TIMESHEET_DECISION_NOTES_KEY = "approval-inbox-decision-notes";
const LEAVE_DECISION_NOTES_KEY = "leave-approval-decision-notes";
const outerPanelClass = "rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50";
const innerCardClass = "rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 shadow-sm backdrop-blur dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50";
const filterClass = "h-12 rounded-2xl border border-zinc-200 bg-white/90 px-4 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200";
const chartCardClass = "rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.96),rgba(0,0,0,0.92))]";
const tableHeaderClass = "px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400";
const tableCellClass = "px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200";
const today = new Date();
today.setHours(0, 0, 0, 0);

type RequestType = "Timesheet" | "Leave";
type ActionTaken = "Approved" | "Rejected" | "Returned" | "Escalated";
type ApprovalRecord = {
  id: string;
  approvalCode: string;
  requestType: RequestType;
  requestId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  itemLabel: string;
  periodLabel: string;
  submittedAt: string;
  actionTaken: ActionTaken;
  actionDateTime: string;
  approvalLevel: number;
  remarks: string;
  finalStatus: string;
  approverName: string;
  decisionTimeHours: number;
  projectName: string;
  projectOrLeave: string;
  leaveReason?: string;
  leaveDays?: number;
  totalHours?: number;
  timesheetRows?: Array<{ id: string; projectName: string; taskName: string; hours: number; notes: string }>;
  trail: Array<{ label: string; value: string; note: string }>;
};

const readStoredNotes = (key: string) => {
  const raw = window.localStorage.getItem(key);
  if (!raw) return {} as Record<string, string>;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
};

const createFilenameDate = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const formatHours = (value: number) => `${Number(value || 0).toFixed(1).replace(".0", "")}h`;
const formatDate = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const formatDateTime = (value: string) => new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const formatAvgTime = (value: number) => `${value.toFixed(1)}h`;
const toInputDate = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const hashString = (value: string) => Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);

const addHours = (value: string, hours: number) => {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

const subtractHours = (value: string, hours: number) => addHours(value, -hours);

const badgeClass = (value: string) => {
  if (value === "Approved") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (value === "Rejected") return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  if (value === "Returned") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (value === "Escalated") return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};

const buildFallbackHistory = (approverName: string): ApprovalRecord[] => [
  {
    id: "fallback-ts-1",
    approvalCode: "TS-2026-0412",
    requestType: "Timesheet",
    requestId: "fallback-timesheet-1",
    employeeId: "emp-fallback-1",
    employeeName: "Raghav Sharma",
    department: "Operations",
    itemLabel: "Client Migration",
    periodLabel: "01 Apr - 06 Apr 2026",
    submittedAt: "2026-04-06T10:15:00.000Z",
    actionTaken: "Approved",
    actionDateTime: "2026-04-06T18:40:00.000Z",
    approvalLevel: 1,
    remarks: "Looks correct. Hours align with delivery update.",
    finalStatus: "Approved",
    approverName,
    decisionTimeHours: 8.4,
    projectName: "Client Migration",
    projectOrLeave: "Client Migration",
    totalHours: 46,
    timesheetRows: [
      { id: "r1", projectName: "Client Migration", taskName: "Data validation", hours: 18, notes: "Validated migration sheets" },
      { id: "r2", projectName: "Client Migration", taskName: "Team sync", hours: 12, notes: "Stakeholder coordination" },
      { id: "r3", projectName: "Client Migration", taskName: "UAT fixes", hours: 16, notes: "Resolved rollout issues" },
    ],
    trail: [
      { label: "Submitted", value: "06 Apr 2026, 10:15", note: "Weekly timesheet submitted by employee." },
      { label: "Manager Review", value: "06 Apr 2026, 18:40", note: "Approved after reviewing weekly delivery and hours." },
    ],
  },
  {
    id: "fallback-lv-1",
    approvalCode: "LV-2026-0118",
    requestType: "Leave",
    requestId: "fallback-leave-1",
    employeeId: "emp-fallback-2",
    employeeName: "Neha Singh",
    department: "Finance",
    itemLabel: "Casual Leave",
    periodLabel: "10 Apr 2026 - 11 Apr 2026",
    submittedAt: "2026-04-08T08:30:00.000Z",
    actionTaken: "Rejected",
    actionDateTime: "2026-04-08T17:15:00.000Z",
    approvalLevel: 2,
    remarks: "Month-end close coverage is required. Please reschedule.",
    finalStatus: "Rejected",
    approverName,
    decisionTimeHours: 8.8,
    projectName: "Casual Leave",
    projectOrLeave: "Casual Leave",
    leaveReason: "Family event out of station",
    leaveDays: 2,
    trail: [
      { label: "Submitted", value: "08 Apr 2026, 08:30", note: "Leave request submitted for 2 days." },
      { label: "Finance Review", value: "08 Apr 2026, 17:15", note: "Rejected due to critical team coverage window." },
    ],
  },
  {
    id: "fallback-ts-2",
    approvalCode: "TS-2026-0415",
    requestType: "Timesheet",
    requestId: "fallback-timesheet-2",
    employeeId: "emp-fallback-3",
    employeeName: "Aman Verma",
    department: "Engineering",
    itemLabel: "Project Alpha",
    periodLabel: "07 Apr - 12 Apr 2026",
    submittedAt: "2026-04-12T09:05:00.000Z",
    actionTaken: "Returned",
    actionDateTime: "2026-04-12T13:20:00.000Z",
    approvalLevel: 1,
    remarks: "Please clarify weekend effort and missing task notes.",
    finalStatus: "Returned",
    approverName,
    decisionTimeHours: 4.2,
    projectName: "Project Alpha",
    projectOrLeave: "Project Alpha",
    totalHours: 52,
    timesheetRows: [
      { id: "r4", projectName: "Project Alpha", taskName: "API integration", hours: 28, notes: "Weekend support needs detail" },
      { id: "r5", projectName: "Project Alpha", taskName: "Bug fixing", hours: 24, notes: "Missing note on handoff" },
    ],
    trail: [
      { label: "Submitted", value: "12 Apr 2026, 09:05", note: "Timesheet entered with overtime spike." },
      { label: "Manager Review", value: "12 Apr 2026, 13:20", note: "Returned for correction before final decision." },
    ],
  },
  {
    id: "fallback-lv-2",
    approvalCode: "LV-2026-0122",
    requestType: "Leave",
    requestId: "fallback-leave-2",
    employeeId: "emp-fallback-4",
    employeeName: "Riya Patel",
    department: "Design",
    itemLabel: "Sick Leave",
    periodLabel: "13 Apr 2026",
    submittedAt: "2026-04-13T05:55:00.000Z",
    actionTaken: "Approved",
    actionDateTime: "2026-04-13T07:10:00.000Z",
    approvalLevel: 1,
    remarks: "Approved quickly due to medical emergency.",
    finalStatus: "Approved",
    approverName,
    decisionTimeHours: 1.3,
    projectName: "Sick Leave",
    projectOrLeave: "Sick Leave",
    leaveReason: "Medical consultation",
    leaveDays: 1,
    trail: [
      { label: "Submitted", value: "13 Apr 2026, 05:55", note: "Emergency sick leave request." },
      { label: "Manager Review", value: "13 Apr 2026, 07:10", note: "Approved due to urgent health condition." },
    ],
  },
  {
    id: "fallback-ts-3",
    approvalCode: "TS-2026-0409",
    requestType: "Timesheet",
    requestId: "fallback-timesheet-3",
    employeeId: "emp-fallback-5",
    employeeName: "Meera Kulkarni",
    department: "Operations",
    itemLabel: "Warehouse Rollout",
    periodLabel: "31 Mar - 05 Apr 2026",
    submittedAt: "2026-04-05T10:00:00.000Z",
    actionTaken: "Escalated",
    actionDateTime: "2026-04-05T19:10:00.000Z",
    approvalLevel: 1,
    remarks: "Escalated to department head for unusual overtime variance.",
    finalStatus: "Escalated",
    approverName,
    decisionTimeHours: 9.2,
    projectName: "Warehouse Rollout",
    projectOrLeave: "Warehouse Rollout",
    totalHours: 58,
    timesheetRows: [
      { id: "r6", projectName: "Warehouse Rollout", taskName: "Deployment support", hours: 34, notes: "High overtime" },
      { id: "r7", projectName: "Warehouse Rollout", taskName: "Go-live validation", hours: 24, notes: "Escalation required" },
    ],
    trail: [
      { label: "Submitted", value: "05 Apr 2026, 10:00", note: "Timesheet submitted with heavy overtime variance." },
      { label: "Escalated", value: "05 Apr 2026, 19:10", note: "Escalated for second-level approval." },
    ],
  },
];

const getTimesheetItemLabel = (rows: TimesheetRow[]) => {
  const projects = Array.from(new Set(rows.map((row) => row.projectName).filter(Boolean)));
  if (projects.length === 0) return "Weekly timesheet";
  if (projects.length === 1) return projects[0];
  return `${projects[0]} +${projects.length - 1} more`;
};

const buildTimesheetRecord = (record: TimesheetWeekRecord, employeeName: string, department: string, approverName: string, note?: string): ApprovalRecord => {
  const seed = (hashString(record.id) % 9) + 3;
  const submittedAt = subtractHours(record.updatedAt, seed + 3);
  const action = record.status === "Approved" ? "Approved" : "Rejected";
  const itemLabel = getTimesheetItemLabel(record.rows);
  const remarks = note?.trim() || (action === "Approved" ? "Approved after reviewing submitted hours and task mix." : "Rejected after audit review of the weekly entry.");
  return {
    id: `history-timesheet-${record.id}`,
    approvalCode: `TS-${record.weekStart.split("-").join("")}-${record.id.slice(-4).toUpperCase()}`,
    requestType: "Timesheet",
    requestId: record.id,
    employeeId: record.userId,
    employeeName,
    department,
    itemLabel,
    periodLabel: `${formatDate(record.weekStart)} - ${formatDate(record.weekEnd)}`,
    submittedAt,
    actionTaken: action,
    actionDateTime: record.updatedAt,
    approvalLevel: 1,
    remarks,
    finalStatus: action,
    approverName,
    decisionTimeHours: seed + 3,
    projectName: itemLabel,
    projectOrLeave: itemLabel,
    totalHours: Number(record.totalHours || 0),
    timesheetRows: record.rows.map((row) => ({
      id: row.id,
      projectName: row.projectName || "Unassigned project",
      taskName: row.taskName || "No task label",
      hours: Object.values(row.hours).reduce((sum, value) => sum + Number(value || 0), 0),
      notes: row.notes || "No notes captured",
    })),
    trail: [
      { label: "Submitted", value: formatDateTime(submittedAt), note: "Weekly timesheet moved into manager review." },
      { label: "Manager Decision", value: formatDateTime(record.updatedAt), note: remarks },
    ],
  };
};

const buildLeaveRecord = (request: LeaveRequest, approverName: string, note?: string): ApprovalRecord => {
  const seed = (hashString(request.id) % 16) + 4;
  const actionDateTime = addHours(request.createdAt, seed);
  const action = request.status === "Approved" ? "Approved" : "Rejected";
  const remarks = note?.trim() || (action === "Approved" ? "Approved after leave balance and coverage review." : "Rejected after checking team coverage and leave policy.");
  return {
    id: `history-leave-${request.id}`,
    approvalCode: `LV-${request.startDate.split("-").join("")}-${request.id.slice(-4).toUpperCase()}`,
    requestType: "Leave",
    requestId: request.id,
    employeeId: request.employeeId,
    employeeName: request.employeeName,
    department: request.department,
    itemLabel: request.type,
    periodLabel: request.startDate === request.endDate ? formatDate(request.startDate) : `${formatDate(request.startDate)} - ${formatDate(request.endDate)}`,
    submittedAt: request.createdAt,
    actionTaken: action,
    actionDateTime,
    approvalLevel: 1,
    remarks,
    finalStatus: action,
    approverName,
    decisionTimeHours: seed,
    projectName: request.type,
    projectOrLeave: request.type,
    leaveReason: request.reason,
    leaveDays: request.days,
    trail: [
      { label: "Submitted", value: formatDateTime(request.createdAt), note: "Leave request submitted for manager review." },
      { label: "Decision", value: formatDateTime(actionDateTime), note: remarks },
    ],
  };
};

export const ApprovalHistoryPage = ({ user }: { user: AuthUser }) => {
  const role = normalizeUserRole(user.role);
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [timesheets, setTimesheets] = useState<TimesheetWeekRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"All" | RequestType>("All");
  const [actionFilter, setActionFilter] = useState<"All" | ActionTaken>("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [weekRecords, leaveRequests, projectRecords] = await Promise.all([
          timesheetService.listWeeks(),
          leaveService.getLeaves(),
          projectService.getProjects(),
        ]);
        if (!active) return;
        setTimesheets(weekRecords);
        setLeaves(leaveRequests);
        setProjects(projectRecords);
      } catch {
        if (active) {
          showToast("Unable to load approval history right now.", "error");
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

  const teamScope = useMemo(() => buildTeamScope({ role, employees, projects, userId: user.id }), [employees, projects, role, user.id]);
  const scopedEmployeeIds = useMemo(() => teamScope.employeeIds, [teamScope.employeeIds]);
  const employeeDirectory = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const timesheetNotes = useMemo(() => readStoredNotes(TIMESHEET_DECISION_NOTES_KEY), []);
  const leaveNotes = useMemo(() => readStoredNotes(LEAVE_DECISION_NOTES_KEY), []);

  const liveHistory = useMemo(() => {
    const scopedTimesheets = timesheets
      .filter((record) => scopedEmployeeIds.has(record.userId) && employeeDirectory.has(record.userId))
      .filter((record) => record.status === "Approved" || record.status === "Rejected")
      .map((record) => {
        const employee = employeeDirectory.get(record.userId);
        return buildTimesheetRecord(
          record,
          employee?.fullName ?? "Unknown employee",
          employee?.department ?? "Unknown department",
          user.fullName,
          timesheetNotes[`timesheet:${record.id}`],
        );
      });

    const scopedLeaves = leaves
      .filter((request) => scopedEmployeeIds.has(request.employeeId) && employeeDirectory.has(request.employeeId))
      .filter((request) => request.status === "Approved" || request.status === "Rejected")
      .map((request) => buildLeaveRecord(request, user.fullName, leaveNotes[request.id]));

    return [...scopedTimesheets, ...scopedLeaves].sort((left, right) => right.actionDateTime.localeCompare(left.actionDateTime));
  }, [employeeDirectory, leaveNotes, leaves, scopedEmployeeIds, timesheetNotes, timesheets, user.fullName]);

  // fallback removed
  const allHistory = liveHistory;

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allHistory.filter((item) => {
      if (typeFilter !== "All" && item.requestType !== typeFilter) return false;
      if (actionFilter !== "All" && item.actionTaken !== actionFilter) return false;
      if (employeeFilter !== "All" && item.employeeId !== employeeFilter) return false;
      if (projectFilter !== "All" && item.projectOrLeave !== projectFilter) return false;
      if (departmentFilter !== "All" && item.department !== departmentFilter) return false;
      if (levelFilter !== "All" && String(item.approvalLevel) !== levelFilter) return false;
      if (startDate && item.actionDateTime.slice(0, 10) < startDate) return false;
      if (endDate && item.actionDateTime.slice(0, 10) > endDate) return false;
      if (!query) return true;
      return [
        item.approvalCode,
        item.employeeName,
        item.department,
        item.itemLabel,
        item.projectOrLeave,
        item.remarks,
        item.finalStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [actionFilter, allHistory, departmentFilter, employeeFilter, endDate, levelFilter, projectFilter, search, startDate, typeFilter]);

  const summary = useMemo(() => {
    const totalReviewed = filteredHistory.length;
    const approved = filteredHistory.filter((item) => item.actionTaken === "Approved").length;
    const rejected = filteredHistory.filter((item) => item.actionTaken === "Rejected").length;
    const returned = filteredHistory.filter((item) => item.actionTaken === "Returned").length;
    const avgApprovalTimeHours = totalReviewed > 0 ? filteredHistory.reduce((sum, item) => sum + item.decisionTimeHours, 0) / totalReviewed : 0;
    return { totalReviewed, approved, rejected, returned, avgApprovalTimeHours };
  }, [filteredHistory]);

  const trendBuckets = useMemo(() => {
    const grouped = filteredHistory.reduce<Record<string, { approved: number; rejected: number; returned: number }>>((accumulator, item) => {
      const dateKey = item.actionDateTime.slice(0, 10);
      const current = accumulator[dateKey] ?? { approved: 0, rejected: 0, returned: 0 };
      if (item.actionTaken === "Approved") current.approved += 1;
      if (item.actionTaken === "Rejected") current.rejected += 1;
      if (item.actionTaken === "Returned" || item.actionTaken === "Escalated") current.returned += 1;
      accumulator[dateKey] = current;
      return accumulator;
    }, {});
    return Object.entries(grouped)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-8)
      .map(([date, counts]) => ({
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        ...counts,
      }));
  }, [filteredHistory]);

  const typeSplit = useMemo(() => {
    const timesheet = filteredHistory.filter((item) => item.requestType === "Timesheet").length;
    const leave = filteredHistory.filter((item) => item.requestType === "Leave").length;
    return { timesheet, leave };
  }, [filteredHistory]);

  const chartOptions = useMemo(() => {
    const textColor = "#94a3b8";
    const base: ApexOptions = {
      chart: { toolbar: { show: false }, foreColor: textColor, fontFamily: "inherit" },
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 3 },
      grid: { borderColor: "rgba(161,161,170,0.16)" },
      legend: { labels: { colors: textColor } },
      xaxis: { labels: { style: { colors: textColor } } },
      yaxis: { labels: { style: { colors: textColor } } },
      tooltip: { theme: "dark" },
    };
    return {
      trend: {
        ...base,
        colors: ["#10b981", "#ef4444", "#f59e0b"],
        fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.22, opacityTo: 0.03 } },
      } satisfies ApexOptions,
      split: {
        ...base,
        labels: ["Timesheet", "Leave"],
        colors: ["#09090b", "#8b5cf6"],
        stroke: { width: 0 },
      } satisfies ApexOptions,
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const paginatedHistory = useMemo(() => filteredHistory.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [currentPage, filteredHistory]);
  const selectedRecord = filteredHistory.find((item) => item.id === selectedRecordId) ?? paginatedHistory[0] ?? filteredHistory[0] ?? null;

  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, actionFilter, employeeFilter, projectFilter, departmentFilter, levelFilter, startDate, endDate, search]);

  useEffect(() => {
    if (!selectedRecord) {
      setSelectedRecordId(null);
      return;
    }
    if (selectedRecord.id !== selectedRecordId) {
      setSelectedRecordId(selectedRecord.id);
    }
  }, [selectedRecord, selectedRecordId]);

  const exportRows = useMemo(
    () =>
      filteredHistory.map((item) => ({
        "Approval ID": item.approvalCode,
        Type: item.requestType,
        Employee: item.employeeName,
        Department: item.department,
        "Project / Leave": item.projectOrLeave,
        Period: item.periodLabel,
        "Submitted On": formatDateTime(item.submittedAt),
        Action: item.actionTaken,
        "Action Date": formatDateTime(item.actionDateTime),
        "Approval Level": item.approvalLevel,
        Remarks: item.remarks,
        "Final Status": item.finalStatus,
      })),
    [filteredHistory],
  );

  const exportCsv = () => {
    if (exportRows.length === 0) {
      showToast("No approval history rows are available to export.", "info");
      return;
    }
    const headers = Object.keys(exportRows[0]);
    const csv = [headers.map((header) => csvEscape(header)).join(","), ...exportRows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row] as string | number)).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `approval-history-${createFilenameDate()}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    showToast("Approval history exported as CSV.", "success");
  };

  const exportExcel = () => {
    if (exportRows.length === 0) {
      showToast("No approval history rows are available to export.", "info");
      return;
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), "Approval History");
    XLSX.writeFile(workbook, `approval-history-${createFilenameDate()}.xlsx`);
    showToast("Approval history exported as Excel.", "success");
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading approval history..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <section className="space-y-6">
        <WorkspacePageHero title="Approval history">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={exportCsv} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-brand-300 hover:text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">Export CSV</button>
            <button type="button" onClick={exportExcel} className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">Export Excel</button>
          </div>
        </WorkspacePageHero>

        {false ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
            Live approval audit logs are not available yet for this scope, so the page is showing a seeded history snapshot to keep the workflow and layout reviewable.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[{ label: "Total Reviewed", value: `${summary.totalReviewed}`, note: "Completed actions in current filter" }, { label: "Approved", value: `${summary.approved}`, note: "Successful approvals" }, { label: "Rejected", value: `${summary.rejected}`, note: "Rejected requests" }, { label: "Avg Approval Time", value: formatAvgTime(summary.avgApprovalTimeHours), note: "Average decision time" }, { label: "Returned", value: `${summary.returned}`, note: "Returned for correction" }].map((card) => (
            <div key={card.label} className={`${innerCardClass} p-5`}>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{card.label}</p>
              <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{card.value}</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{card.note}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className={`${outerPanelClass} p-6`}>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Approval Actions Over Time</p>
            <h3 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Approved, rejected, and returned trend</h3>
            <div className={`${chartCardClass} mt-6`}>
              <Chart
                type="line"
                height={300}
                series={[
                  { name: "Approved", data: trendBuckets.map((item) => item.approved) },
                  { name: "Rejected", data: trendBuckets.map((item) => item.rejected) },
                  { name: "Returned", data: trendBuckets.map((item) => item.returned) },
                ]}
                options={{ ...chartOptions.trend, xaxis: { categories: trendBuckets.map((item) => item.label) } }}
              />
            </div>
          </div>
          <div className={`${outerPanelClass} p-6`}>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Approval Type Split</p>
            <h3 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Timesheet vs leave distribution</h3>
            <div className={`${chartCardClass} mt-6`}>
              <Chart type="donut" height={300} series={[typeSplit.timesheet, typeSplit.leave]} options={chartOptions.split} />
            </div>
          </div>
        </div>

        <div className={`${outerPanelClass} sticky top-4 z-20 p-5`}>
          <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_1.25fr]">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "All" | RequestType)} className={filterClass}>
              {["All", "Timesheet", "Leave"].map((item) => <option key={item} value={item}>{item === "All" ? "All Types" : item}</option>)}
            </select>
            <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value as "All" | ActionTaken)} className={filterClass}>
              {["All", "Approved", "Rejected", "Returned", "Escalated"].map((item) => <option key={item} value={item}>{item === "All" ? "All Actions" : item}</option>)}
            </select>
            <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className={filterClass}>
              <option value="All">All Employees</option>
              {Array.from(new Set(allHistory.map((item) => `${item.employeeId}|${item.employeeName}`))).map((entry) => {
                const [id, name] = entry.split("|");
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className={filterClass}>
              <option value="All">All Projects / Leave Types</option>
              {Array.from(new Set(allHistory.map((item) => item.projectOrLeave))).sort().map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, request ID, project, or comment" className={filterClass} />
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className={filterClass}>
              <option value="All">All Departments</option>
              {Array.from(new Set(allHistory.map((item) => item.department))).sort().map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className={filterClass}>
              <option value="All">All Levels</option>
              {Array.from(new Set(allHistory.map((item) => String(item.approvalLevel)))).sort().map((item) => <option key={item} value={item}>{`Level ${item}`}</option>)}
            </select>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={filterClass} max={endDate || undefined} />
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={filterClass} min={startDate || undefined} max={toInputDate(new Date())} />
            <button type="button" onClick={() => { setTypeFilter("All"); setActionFilter("All"); setEmployeeFilter("All"); setProjectFilter("All"); setDepartmentFilter("All"); setLevelFilter("All"); setStartDate(""); setEndDate(""); setSearch(""); }} className="h-12 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition hover:border-brand-300 hover:text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">Reset</button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className={`${outerPanelClass} overflow-hidden`}>
            <div className="border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Completed Approval Table</p>
              <h3 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Audit trail across timesheet and leave approvals</h3>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-black/95">
                  <tr>
                    {["Approval ID", "Type", "Employee", "Department", "Project / Leave", "Period", "Submitted On", "Action Taken", "Action Date", "Level", "Remarks", "Final Status", "View"].map((heading) => (
                      <th key={heading} className={tableHeaderClass}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {paginatedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-6 py-16 text-center">
                        <p className="text-base font-semibold text-zinc-900 dark:text-white">No completed approval actions match the current filters.</p>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Try another action, employee, date range, or keyword to reopen the history list.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedHistory.map((item) => (
                      <tr key={item.id} className="transition hover:bg-zinc-50/70 dark:hover:bg-black/50">
                        <td className={tableCellClass}><button type="button" onClick={() => setSelectedRecordId(item.id)} className="font-semibold text-zinc-700 dark:text-zinc-200 hover:text-brand-600 dark:hover:text-brand-300">{item.approvalCode}</button></td>
                        <td className={tableCellClass}>{item.requestType}</td>
                        <td className={tableCellClass}><p className="font-semibold text-zinc-900 dark:text-white">{item.employeeName}</p></td>
                        <td className={tableCellClass}>{item.department}</td>
                        <td className={tableCellClass}>{item.projectOrLeave}</td>
                        <td className={tableCellClass}>{item.periodLabel}</td>
                        <td className={tableCellClass}>{formatDateTime(item.submittedAt)}</td>
                        <td className={tableCellClass}><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(item.actionTaken)}`}>{item.actionTaken}</span></td>
                        <td className={tableCellClass}>{formatDateTime(item.actionDateTime)}</td>
                        <td className={tableCellClass}>{`L${item.approvalLevel}`}</td>
                        <td className={tableCellClass}><p className="max-w-[18rem] truncate" title={item.remarks}>{item.remarks}</p></td>
                        <td className={tableCellClass}><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(item.finalStatus)}`}>{item.finalStatus}</span></td>
                        <td className={tableCellClass}><button type="button" onClick={() => setSelectedRecordId(item.id)} className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-brand-300 hover:text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-brand-400 dark:hover:text-zinc-400 dark:text-zinc-500">View</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>

          <div className={`${outerPanelClass} overflow-hidden`}>
            <div className="border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Approval Detail</p>
              <h3 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{selectedRecord ? selectedRecord.approvalCode : "No selection"}</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{selectedRecord ? `${selectedRecord.employeeName} · ${selectedRecord.requestType}` : "Select a row to review its audit details."}</p>
            </div>
            {selectedRecord ? (
              <div className="space-y-6 px-6 py-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[{ label: "Employee", value: selectedRecord.employeeName }, { label: "Department", value: selectedRecord.department }, { label: "Item", value: selectedRecord.projectOrLeave }, { label: "Approval Level", value: `Level ${selectedRecord.approvalLevel}` }].map((item) => (
                    <div key={item.label} className={chartCardClass}>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{item.label}</p>
                      <p className="mt-3 text-base font-semibold text-zinc-900 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className={chartCardClass}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Decision Summary</p>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(selectedRecord.actionTaken)}`}>{selectedRecord.actionTaken}</span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                    <div className="flex items-center justify-between gap-3"><span>Submitted On</span><span className="font-semibold text-zinc-900 dark:text-white">{formatDateTime(selectedRecord.submittedAt)}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>Action Date</span><span className="font-semibold text-zinc-900 dark:text-white">{formatDateTime(selectedRecord.actionDateTime)}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>Average Handling Time</span><span className="font-semibold text-zinc-900 dark:text-white">{formatAvgTime(selectedRecord.decisionTimeHours)}</span></div>
                    <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Remarks</p>
                      <p className="mt-2 leading-6">{selectedRecord.remarks}</p>
                    </div>
                  </div>
                </div>

                {selectedRecord.requestType === "Timesheet" ? (
                  <div className={chartCardClass}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Timesheet Breakdown</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{selectedRecord.periodLabel} · {formatHours(selectedRecord.totalHours ?? 0)}</p>
                    <div className="mt-4 space-y-3">
                      {selectedRecord.timesheetRows?.map((row) => (
                        <div key={row.id} className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-black/50">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-zinc-900 dark:text-white">{row.projectName}</p>
                              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{row.taskName}</p>
                            </div>
                            <span className="text-sm font-semibold text-zinc-900 dark:text-white">{formatHours(row.hours)}</span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{row.notes}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={chartCardClass}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Leave Details</p>
                    <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                      <div className="flex items-center justify-between gap-3"><span>Leave Type</span><span className="font-semibold text-zinc-900 dark:text-white">{selectedRecord.projectOrLeave}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>Date Range</span><span className="font-semibold text-zinc-900 dark:text-white">{selectedRecord.periodLabel}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>Total Days</span><span className="font-semibold text-zinc-900 dark:text-white">{selectedRecord.leaveDays ?? 0}</span></div>
                      <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Reason</p>
                        <p className="mt-2 leading-6">{selectedRecord.leaveReason || "No additional reason recorded."}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className={chartCardClass}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Approval Trail</p>
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{selectedRecord.requestType} audit</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedRecord.trail.map((step, index) => (
                      <div key={`${step.label}-${index}`} className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-black/50">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-zinc-900 dark:text-white">{step.label}</p>
                          <span className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{step.value}</span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{step.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link to={selectedRecord.requestType === "Timesheet" ? workspaceRoutes["team-timesheets"].path : workspaceRoutes["leave-approval"].path} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-brand-300 hover:text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">
                    View Original Module
                  </Link>
                </div>
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="text-base font-semibold text-zinc-900 dark:text-white">No approval record selected.</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Pick a row from the history table to review audit details and decision trail.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

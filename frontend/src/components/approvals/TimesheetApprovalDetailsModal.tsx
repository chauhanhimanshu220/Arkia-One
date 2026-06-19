import { useEffect, useMemo, useState } from "react";
import { DAILY_WORK_HOURS, WEEKLY_WORK_HOURS } from "../../constants/timesheet";
import type { Employee } from "../../types/employee";
import type { LeaveRequest } from "../../types/leave";
import type { Project } from "../../types/project";
import type { TimesheetRow, TimesheetWeekRecord } from "../../types/timesheet";
import { Icon } from "../Icon";

type ApprovalPriority = "Ready" | "Heavy Week" | "Coverage Risk" | "Overdue";
type DetailTab = "overview" | "entries" | "projects" | "validations" | "timeline";
type ValidationStatus = "Passed" | "Warning" | "Failed";
type ValidationSeverity = "Info" | "Warning" | "Critical";

type TimesheetApprovalDetailsItem = {
  key: string;
  employeeId: string;
  employeeName: string;
  department: string;
  periodStart: string;
  periodEnd: string;
  status: TimesheetWeekRecord["status"];
  submittedAt: string;
  priority: ApprovalPriority;
  totalHours?: number;
  timesheet: TimesheetWeekRecord;
};

type ValidationItem = {
  code: string;
  title: string;
  status: ValidationStatus;
  severity: ValidationSeverity;
  message: string;
};

type FlattenedEntry = {
  id: string;
  date: string;
  dayLabel: string;
  projectId: string;
  projectName: string;
  projectType: "Billable" | "Non-Billable";
  taskName: string;
  subtaskName: string;
  workNote: string;
  hours: number;
  flags: string[];
  hasWarning: boolean;
};

type DaySummary = {
  date: string;
  dayLabel: string;
  hours: number;
  flags: string[];
  onApprovedLeave: boolean;
};

type ProjectBreakdown = {
  projectId: string;
  projectName: string;
  projectType: "Billable" | "Non-Billable";
  totalHours: number;
  percentOfWeek: number;
  tasks: Array<{
    taskName: string;
    totalHours: number;
    notes: string[];
    dates: string[];
  }>;
};

type TimelineEvent = {
  id: string;
  title: string;
  description: string;
  at: string;
  tone: "neutral" | "success" | "warning";
};

const tabOptions: Array<{ id: DetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "entries", label: "Daily Entries" },
  { id: "projects", label: "Project Breakdown" },
  { id: "validations", label: "Validations" },
  { id: "timeline", label: "Timeline" },
];

const validationToneClass: Record<ValidationStatus, string> = {
  Passed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200",
  Warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200",
  Failed: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200",
};

const summaryAccentClass = [
  "bg-zinc-500/15 text-zinc-700 dark:bg-zinc-500/10 dark:text-zinc-200",
  "bg-sky-500/15 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200",
  "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  "bg-amber-500/15 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  "bg-rose-500/15 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
  "bg-violet-500/15 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200",
] as const;

const timelineToneClass: Record<TimelineEvent["tone"], string> = {
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200",
};

const getDateOnly = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const toDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value: string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatShortDate = (value: string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });

const formatDateTimeLabel = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatHours = (value: number) => `${Number(value || 0).toFixed(1).replace(".0", "")}h`;

const formatHoursCompact = (value: number) => Number(value || 0).toFixed(1).replace(".0", "");

const getDayName = (value: string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    weekday: "short",
  });

const getRelativeAgeLabel = (value: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = getDateOnly(value);
  const diffInDays = Math.floor((today.getTime() - target.getTime()) / 86_400_000);

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

const buildWeekDates = (weekStart: string, weekEnd: string) => {
  const dates: string[] = [];
  const cursor = getDateOnly(weekStart);
  const finalDate = getDateOnly(weekEnd);

  while (cursor <= finalDate) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const getCurrentWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  return toDateKey(weekStart);
};

const isProjectRosterMatch = (project: Project | undefined, employeeId: string) => {
  if (!project) {
    return false;
  }

  if (project.managerId === employeeId || project.adminId === employeeId) {
    return true;
  }

  if (project.teamMemberIds.length === 0) {
    return true;
  }

  return project.teamMemberIds.includes(employeeId);
};

const getProjectWindowMatch = (project: Project | undefined, date: string) => {
  if (!project) {
    return false;
  }

  return project.startDate.slice(0, 10) <= date && project.endDate.slice(0, 10) >= date;
};

const getStatusChipClass = (status: TimesheetWeekRecord["status"]) => {
  switch (status) {
    case "Approved":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
    case "Rejected":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
    case "Manager Approved":
      return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
    case "Submitted":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
  }
};

const SummaryCard = ({
  label,
  value,
  helper,
  accentIndex,
}: {
  label: string;
  value: string;
  helper: string;
  accentIndex: number;
}) => (
  <article className="rounded-[1.6rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-black/80">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
      </div>
      <span className={`rounded-2xl px-3 py-2 text-xs font-semibold ${summaryAccentClass[accentIndex % summaryAccentClass.length]}`}>
        {label}
      </span>
    </div>
    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{helper}</p>
  </article>
);

export const TimesheetApprovalDetailsModal = ({
  item,
  employee,
  projects,
  leaves,
  decisionNote,
  acting,
  onClose,
  onApprove,
  onReject,
  onDecisionNoteChange,
}: {
  item: TimesheetApprovalDetailsItem;
  employee?: Employee;
  projects: Project[];
  leaves: LeaveRequest[];
  decisionNote?: string | null;
  acting: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDecisionNoteChange: (note: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [showWarningsOnly, setShowWarningsOnly] = useState(false);

  useEffect(() => {
    setActiveTab("overview");
    setShowWarningsOnly(false);
  }, [item.key]);

  const weekDates = useMemo(
    () => buildWeekDates(item.timesheet.weekStart, item.timesheet.weekEnd),
    [item.timesheet.weekEnd, item.timesheet.weekStart],
  );

  const projectLookup = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const employeeApprovedLeaves = useMemo(
    () =>
      leaves.filter(
        (leave) =>
          leave.employeeId === item.employeeId &&
          leave.status === "Approved" &&
          intersects(leave.startDate, leave.endDate, item.timesheet.weekStart, item.timesheet.weekEnd),
      ),
    [item.employeeId, item.timesheet.weekEnd, item.timesheet.weekStart, leaves],
  );

  const flattenedEntries = useMemo<FlattenedEntry[]>(() => {
    const entries: FlattenedEntry[] = [];

    item.timesheet.rows.forEach((row) => {
      weekDates.forEach((date) => {
        const hours = Number(row.hours[date] || 0);
        const workNote = (row.notesByDate?.[date] ?? row.notes ?? "").trim();
        if (hours <= 0 && !workNote) {
          return;
        }

        const project = projectLookup.get(row.projectId);
        const flags: string[] = [];
        const hasMissingNote = hours > 0 && !workNote;
        const hasProjectWindowIssue = !getProjectWindowMatch(project, date);
        const hasProjectRosterIssue = !isProjectRosterMatch(project, item.employeeId);
        const hasLeaveOverlap = employeeApprovedLeaves.some((leave) => date >= leave.startDate && date <= leave.endDate) && hours > 0;

        if (hasMissingNote) {
          flags.push("Missing work note");
        }

        if (hasProjectWindowIssue) {
          flags.push(project ? "Outside project date range" : "Project record not found");
        }

        if (hasProjectRosterIssue) {
          flags.push("Employee not found in current project roster");
        }

        if (hasLeaveOverlap) {
          flags.push("Hours logged on approved leave day");
        }

        entries.push({
          id: `${row.id}:${date}`,
          date,
          dayLabel: getDayName(date),
          projectId: row.projectId,
          projectName: row.projectName || project?.name || "Unassigned project",
          projectType: row.billable ? "Billable" : "Non-Billable",
          taskName: row.taskName || "No task label",
          subtaskName: "Not captured",
          workNote: workNote || "No work note provided.",
          hours,
          flags,
          hasWarning: flags.length > 0,
        });
      });
    });

    return entries.sort((left, right) => left.date.localeCompare(right.date) || left.projectName.localeCompare(right.projectName) || left.taskName.localeCompare(right.taskName));
  }, [employeeApprovedLeaves, item.employeeId, item.timesheet.rows, projectLookup, weekDates]);

  const daySummaries = useMemo<DaySummary[]>(() => {
    return weekDates.map((date) => {
      const entriesForDate = flattenedEntries.filter((entry) => entry.date === date);
      const hours = entriesForDate.reduce((sum, entry) => sum + entry.hours, 0);
      const onApprovedLeave = employeeApprovedLeaves.some((leave) => date >= leave.startDate && date <= leave.endDate);
      const flags: string[] = [];

      if (hours > DAILY_WORK_HOURS) {
        flags.push("Daily limit exceeded");
      }

      if (onApprovedLeave && hours > 0) {
        flags.push("Hours entered on approved leave");
      }

      if (!onApprovedLeave && hours === 0) {
        flags.push("No hours logged");
      }

      return {
        date,
        dayLabel: getDayName(date),
        hours,
        flags,
        onApprovedLeave,
      };
    });
  }, [employeeApprovedLeaves, flattenedEntries, weekDates]);

  const projectBreakdown = useMemo<ProjectBreakdown[]>(() => {
    const grouped = new Map<string, ProjectBreakdown>();
    const safeTotal = Number(item.totalHours ?? item.timesheet.totalHours ?? 0) || flattenedEntries.reduce((sum, entry) => sum + entry.hours, 0);

    flattenedEntries.forEach((entry) => {
      const projectKey = entry.projectId || entry.projectName;
      const existingProject =
        grouped.get(projectKey) ??
        {
          projectId: entry.projectId,
          projectName: entry.projectName,
          projectType: entry.projectType,
          totalHours: 0,
          percentOfWeek: 0,
          tasks: [],
        };

      existingProject.totalHours += entry.hours;

      const existingTask = existingProject.tasks.find((task) => task.taskName === entry.taskName);
      if (existingTask) {
        existingTask.totalHours += entry.hours;
        if (!existingTask.notes.includes(entry.workNote)) {
          existingTask.notes.push(entry.workNote);
        }
        if (!existingTask.dates.includes(entry.date)) {
          existingTask.dates.push(entry.date);
        }
      } else {
        existingProject.tasks.push({
          taskName: entry.taskName,
          totalHours: entry.hours,
          notes: [entry.workNote],
          dates: [entry.date],
        });
      }

      grouped.set(projectKey, existingProject);
    });

    return Array.from(grouped.values())
      .map((project) => ({
        ...project,
        percentOfWeek: safeTotal > 0 ? (project.totalHours / safeTotal) * 100 : 0,
        tasks: [...project.tasks].sort((left, right) => right.totalHours - left.totalHours),
      }))
      .sort((left, right) => right.totalHours - left.totalHours);
  }, [flattenedEntries, item.timesheet.totalHours, item.totalHours]);

  const totalHours = useMemo(
    () => flattenedEntries.reduce((sum, entry) => sum + entry.hours, 0),
    [flattenedEntries],
  );

  const billableHours = useMemo(
    () => flattenedEntries.filter((entry) => entry.projectType === "Billable").reduce((sum, entry) => sum + entry.hours, 0),
    [flattenedEntries],
  );

  const nonBillableHours = totalHours - billableHours;
  const overtimeHours = Math.max(0, totalHours - WEEKLY_WORK_HOURS);
  const distinctProjectCount = new Set(flattenedEntries.map((entry) => entry.projectId || entry.projectName)).size;
  const distinctTaskCount = new Set(item.timesheet.rows.map((row) => row.id)).size;
  const coveredWorkingDays = daySummaries.filter((day) => day.hours > 0).length;
  const currentWeekStart = getCurrentWeekStart();
  const isHistoricalSubmission = item.timesheet.weekStart < currentWeekStart;
  const historicalEntryCount = isHistoricalSubmission ? flattenedEntries.length : 0;

  const filledProjectCount = projectBreakdown.length;
  const activeProjectsDuringWeek = useMemo(
    () =>
      projects.filter((project) =>
        intersects(project.startDate, project.endDate, item.timesheet.weekStart, item.timesheet.weekEnd) &&
        isProjectRosterMatch(project, item.employeeId),
      ).length,
    [item.employeeId, item.timesheet.weekEnd, item.timesheet.weekStart, projects],
  );

  const validationItems = useMemo<ValidationItem[]>(() => {
    const missingNotes = flattenedEntries.filter((entry) => entry.flags.includes("Missing work note")).length;
    const projectWindowIssues = flattenedEntries.filter((entry) => entry.flags.includes("Outside project date range") || entry.flags.includes("Project record not found")).length;
    const rosterIssues = flattenedEntries.filter((entry) => entry.flags.includes("Employee not found in current project roster")).length;
    const leaveOverlapIssues = flattenedEntries.filter((entry) => entry.flags.includes("Hours logged on approved leave day")).length;
    const dailyLimitDays = daySummaries.filter((day) => day.hours > DAILY_WORK_HOURS).length;
    const missingWorkdays = daySummaries.filter((day) => !day.onApprovedLeave && day.hours === 0).length;
    const weeklyTotalMismatch = Math.abs(totalHours - Number(item.timesheet.totalHours || 0)) > 0.01;

    return [
      {
        code: "ENTRY_ROWS_PRESENT",
        title: "Submission rows present",
        status: flattenedEntries.length > 0 ? "Passed" : "Failed",
        severity: flattenedEntries.length > 0 ? "Info" : "Critical",
        message:
          flattenedEntries.length > 0
            ? `${flattenedEntries.length} submitted entry line(s) are available for review.`
            : "No submitted entry rows were found inside this weekly timesheet.",
      },
      {
        code: "DAILY_LIMIT_CHECK",
        title: "Daily hour limit",
        status: dailyLimitDays === 0 ? "Passed" : "Failed",
        severity: dailyLimitDays === 0 ? "Info" : "Critical",
        message:
          dailyLimitDays === 0
            ? "All reviewed days are within the configured daily hour limit."
            : `${dailyLimitDays} day(s) exceed the configured ${DAILY_WORK_HOURS}-hour daily limit.`,
      },
      {
        code: "WEEKLY_TOTAL_CHECK",
        title: "Weekly total consistency",
        status: weeklyTotalMismatch ? "Warning" : "Passed",
        severity: weeklyTotalMismatch ? "Warning" : "Info",
        message: weeklyTotalMismatch
          ? `Displayed weekly total ${formatHours(Number(item.timesheet.totalHours || 0))} does not match computed row total ${formatHours(totalHours)}.`
          : `Weekly total matches the computed row total of ${formatHours(totalHours)}.`,
      },
      {
        code: "WORK_NOTE_CHECK",
        title: "Work note completeness",
        status: missingNotes === 0 ? "Passed" : "Warning",
        severity: missingNotes === 0 ? "Info" : "Warning",
        message:
          missingNotes === 0
            ? "All logged hour entries include a work note."
            : `${missingNotes} entry line(s) are missing a manager-readable work note.`,
      },
      {
        code: "PROJECT_WINDOW_CHECK",
        title: "Project date alignment",
        status: projectWindowIssues === 0 ? "Passed" : "Failed",
        severity: projectWindowIssues === 0 ? "Info" : "Critical",
        message:
          projectWindowIssues === 0
            ? "All entry dates fall inside the currently stored project date windows."
            : `${projectWindowIssues} entry line(s) fall outside the current project date window or reference a missing project.`,
      },
      {
        code: "PROJECT_ROSTER_CHECK",
        title: "Project roster check",
        status: rosterIssues === 0 ? "Passed" : "Warning",
        severity: rosterIssues === 0 ? "Info" : "Warning",
        message:
          rosterIssues === 0
            ? "The employee appears in the current project roster snapshot for all logged projects."
            : `${rosterIssues} entry line(s) reference a project where the employee is not visible in the current roster snapshot.`,
      },
      {
        code: "LEAVE_OVERLAP_CHECK",
        title: "Leave overlap",
        status: leaveOverlapIssues === 0 ? "Passed" : "Warning",
        severity: leaveOverlapIssues === 0 ? "Info" : "Warning",
        message:
          leaveOverlapIssues === 0
            ? "No hours overlap with approved leave inside this week."
            : `${leaveOverlapIssues} entry line(s) overlap with an approved leave day.`,
      },
      {
        code: "WORKDAY_COVERAGE_CHECK",
        title: "Working day coverage",
        status: missingWorkdays === 0 ? "Passed" : "Warning",
        severity: missingWorkdays === 0 ? "Info" : "Warning",
        message:
          missingWorkdays === 0
            ? "Every working day in the review window has hours or approved leave coverage."
            : `${missingWorkdays} working day(s) show zero hours without approved leave coverage.`,
      },
      {
        code: "HISTORICAL_ENTRY_CHECK",
        title: "Historical / late entry context",
        status: historicalEntryCount === 0 ? "Passed" : "Warning",
        severity: historicalEntryCount === 0 ? "Info" : "Warning",
        message:
          historicalEntryCount === 0
            ? "This submission belongs to the current approval cycle."
            : `${historicalEntryCount} entry line(s) belong to a historical / late-entry submission window.`,
      },
    ];
  }, [daySummaries, flattenedEntries, historicalEntryCount, item.timesheet.totalHours, totalHours]);

  const autoValidationStatus: ValidationStatus = validationItems.some((item) => item.status === "Failed")
    ? "Failed"
    : validationItems.some((item) => item.status === "Warning")
    ? "Warning"
    : "Passed";

  const issueCount = useMemo(
    () => validationItems.filter((item) => item.status !== "Passed").length,
    [validationItems],
  );

  const dayEntryGroups = useMemo(
    () =>
      daySummaries
        .map((day) => ({
          ...day,
          entries: flattenedEntries.filter((entry) => entry.date === day.date),
        }))
        .filter((group) => (showWarningsOnly ? group.flags.length > 0 || group.entries.some((entry) => entry.hasWarning) : true)),
    [daySummaries, flattenedEntries, showWarningsOnly],
  );

  const dueReviewBy = useMemo(() => {
    const next = new Date(item.submittedAt);
    next.setDate(next.getDate() + 3);
    return next.toISOString();
  }, [item.submittedAt]);

  const managerVisibleNotes = useMemo(
    () => Array.from(new Set(flattenedEntries.map((entry) => entry.workNote).filter((note) => note && note !== "No work note provided."))),
    [flattenedEntries],
  );

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [
      {
        id: "period-start",
        title: "Week period started",
        description: `Review window begins on ${formatDateLabel(item.timesheet.weekStart)}.`,
        at: `${item.timesheet.weekStart}T00:00:00`,
        tone: "neutral",
      },
      {
        id: "period-end",
        title: "Week period closed",
        description: `The timesheet week closes on ${formatDateLabel(item.timesheet.weekEnd)}.`,
        at: `${item.timesheet.weekEnd}T23:59:00`,
        tone: "neutral",
      },
      {
        id: "submitted",
        title: "Submitted for manager review",
        description: `${item.employeeName} submitted this weekly timesheet for approval.`,
        at: item.submittedAt,
        tone: "warning",
      },
      {
        id: "sla",
        title: "Review SLA due",
        description: `Queue logic will treat this item as overdue after ${formatDateTimeLabel(dueReviewBy)}.`,
        at: dueReviewBy,
        tone: item.priority === "Overdue" ? "warning" : "neutral",
      },
      {
        id: "status",
        title: "Current queue status",
        description: `The timesheet is currently marked ${item.status}.`,
        at: item.timesheet.updatedAt,
        tone: item.status === "Approved" ? "success" : item.status === "Rejected" ? "warning" : "neutral",
      },
    ];

    return events.sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
  }, [dueReviewBy, item.employeeName, item.priority, item.status, item.submittedAt, item.timesheet.updatedAt, item.timesheet.weekEnd, item.timesheet.weekStart]);

  const overviewContextRows = [
    { label: "Expected weekly hours", value: formatHours(WEEKLY_WORK_HOURS) },
    { label: "Submitted weekly hours", value: formatHours(totalHours) },
    { label: "Approved leave in week", value: `${employeeApprovedLeaves.length} request(s)` },
    { label: "Active projects in roster", value: `${activeProjectsDuringWeek}` },
    { label: "Filled projects", value: `${filledProjectCount}` },
    { label: "Auto-validation result", value: autoValidationStatus },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl dark:border-zinc-800 dark:bg-black">
        <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Approval Details</p>
                <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{item.employeeName}</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Full weekly timesheet review before approval or rejection.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusChipClass(item.status)}`}>
                  {item.status}
                </span>
                {item.timesheet.approvalFlowType && (
                  <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-200">
                    Flow: {item.timesheet.approvalFlowType}
                  </span>
                )}
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  Priority: {item.priority}
                </span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  Due review by {formatDateTimeLabel(dueReviewBy)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-[1.4rem] border border-zinc-200 bg-zinc-50 px-4 py-3 text-right dark:border-zinc-700 dark:bg-zinc-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Submitted</p>
                <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{formatDateTimeLabel(item.submittedAt)}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{getRelativeAgeLabel(item.submittedAt)}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                aria-label="Close approval details"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <div className="rounded-[1.6rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Employee Context</p>
              <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <p><span className="font-semibold text-zinc-900 dark:text-white">Employee ID:</span> {employee?.employeeCode || employee?.id || item.employeeId}</p>
                <p><span className="font-semibold text-zinc-900 dark:text-white">Department:</span> {employee?.department || item.department}</p>
                <p><span className="font-semibold text-zinc-900 dark:text-white">Role:</span> {employee?.role || "Employee"}</p>
                <p><span className="font-semibold text-zinc-900 dark:text-white">Reporting Manager:</span> {employee?.reportingManagerName || "Not assigned"}</p>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Approval Context</p>
              <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <p><span className="font-semibold text-zinc-900 dark:text-white">Approval window:</span> {formatShortDate(item.periodStart)} to {formatShortDate(item.periodEnd)}</p>
                <p><span className="font-semibold text-zinc-900 dark:text-white">Current status:</span> {item.status}</p>
                <p><span className="font-semibold text-zinc-900 dark:text-white">Auto-validation:</span> {autoValidationStatus}</p>
                <p><span className="font-semibold text-zinc-900 dark:text-white">Priority:</span> {item.priority}</p>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Week Summary</p>
              <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <p><span className="font-semibold text-zinc-900 dark:text-white">Week period:</span> {formatDateLabel(item.timesheet.weekStart)} to {formatDateLabel(item.timesheet.weekEnd)}</p>
                <p><span className="font-semibold text-zinc-900 dark:text-white">Projects logged:</span> {distinctProjectCount}</p>
                <p><span className="font-semibold text-zinc-900 dark:text-white">Tasks logged:</span> {distinctTaskCount}</p>
                <p><span className="font-semibold text-zinc-900 dark:text-white">Issues detected:</span> {issueCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <div className="flex flex-wrap gap-2">
            {tabOptions.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === "overview" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Total Logged Hours" value={formatHours(totalHours)} helper="Computed directly from submitted entry rows." accentIndex={0} />
                <SummaryCard label="Working Days Covered" value={`${coveredWorkingDays}/${weekDates.length}`} helper="Days with one or more logged hours." accentIndex={1} />
                <SummaryCard label="Projects" value={`${distinctProjectCount}`} helper="Distinct projects captured in this week." accentIndex={2} />
                <SummaryCard label="Tasks" value={`${distinctTaskCount}`} helper="Distinct submitted row/task groups." accentIndex={3} />
                <SummaryCard label="Overtime Hours" value={formatHours(overtimeHours)} helper={`Hours above the expected ${WEEKLY_WORK_HOURS}-hour week.`} accentIndex={4} />
                <SummaryCard label="Issues" value={`${issueCount}`} helper="Warnings or failures found by the review checks." accentIndex={5} />
                <SummaryCard label="Billable Split" value={`${formatHoursCompact(billableHours)}h / ${formatHoursCompact(nonBillableHours)}h`} helper="Billable vs non-billable submitted hours." accentIndex={0} />
                <SummaryCard label="Historical Entries" value={`${historicalEntryCount}`} helper="Submitted lines tied to a historical / late-entry week." accentIndex={1} />
              </div>

              <section className="rounded-[1.8rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black/80">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-white">Employee Week Summary</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Daily hour totals, quick flags, and leave overlap indicators for the review window.
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${validationToneClass[autoValidationStatus]}`}>
                    Auto-validation: {autoValidationStatus}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-6">
                  {daySummaries.map((day) => (
                    <div key={day.date} className="rounded-[1.35rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{day.dayLabel}</p>
                          <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{formatShortDate(day.date)}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${day.flags.length > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"}`}>
                          {formatHours(day.hours)}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {day.flags.length > 0 ? (
                          day.flags.map((flag) => (
                            <p key={flag} className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-zinc-600 dark:bg-black dark:text-zinc-300">
                              {flag}
                            </p>
                          ))
                        ) : (
                          <p className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-black dark:text-emerald-200">
                            Review-ready
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.9fr)]">
                <section className="rounded-[1.8rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black/80">
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Notes & Remarks</p>
                  <div className="mt-4 space-y-3">
                    {managerVisibleNotes.length > 0 ? (
                      managerVisibleNotes.map((note) => (
                        <div key={note} className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200">
                          {note}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        No employee notes were captured in the current submission.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[1.8rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black/80">
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Supporting Context</p>
                  <div className="mt-4 grid gap-3">
                    {overviewContextRows.map((row) => (
                      <div key={row.label} className="rounded-[1.2rem] border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{row.label}</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="rounded-[1.8rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black/80">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-white">Validation Snapshot</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      The most important system checks surfaced before the final decision.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("validations")}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Open Full Validation List
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  {validationItems.slice(0, 4).map((validation) => (
                    <div key={validation.code} className={`rounded-[1.25rem] border px-4 py-3 ${validationToneClass[validation.status]}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold">{validation.title}</p>
                        <span className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold">{validation.status}</span>
                      </div>
                      <p className="mt-2 text-sm opacity-90">{validation.message}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "entries" ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Daily Entries</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Review every submitted row by day, including work notes, billable type, and warning flags.
                  </p>
                </div>

                <label className="inline-flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={showWarningsOnly}
                    onChange={(event) => setShowWarningsOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-brand-600"
                  />
                  Show warnings only
                </label>
              </div>

              <div className="space-y-4">
                {dayEntryGroups.map((group) => (
                  <section key={group.date} className="overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black/80">
                    <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                          {group.dayLabel}, {formatDateLabel(group.date)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          Daily total {formatHours(group.hours)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.flags.length > 0 ? (
                          group.flags.map((flag) => (
                            <span key={flag} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                              {flag}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                            Clean day
                          </span>
                        )}
                      </div>
                    </div>

                    {group.entries.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-zinc-50/90 dark:bg-zinc-900/80">
                            <tr className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                              <th className="px-5 py-3">Project</th>
                              <th className="px-5 py-3">Task</th>
                              <th className="px-5 py-3">Subtask</th>
                              <th className="px-5 py-3">Work Note</th>
                              <th className="px-5 py-3">Hours</th>
                              <th className="px-5 py-3">Type</th>
                              <th className="px-5 py-3">Flags</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {group.entries.map((entry) => (
                              <tr key={entry.id}>
                                <td className="px-5 py-4 align-top">
                                  <p className="font-semibold text-zinc-900 dark:text-white">{entry.projectName}</p>
                                </td>
                                <td className="px-5 py-4 align-top text-zinc-700 dark:text-zinc-200">{entry.taskName}</td>
                                <td className="px-5 py-4 align-top text-zinc-500 dark:text-zinc-400">{entry.subtaskName}</td>
                                <td className="px-5 py-4 align-top">
                                  <p className="max-w-xl leading-6 text-zinc-700 dark:text-zinc-200">{entry.workNote}</p>
                                </td>
                                <td className="px-5 py-4 align-top font-semibold text-zinc-900 dark:text-white">{formatHours(entry.hours)}</td>
                                <td className="px-5 py-4 align-top">
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.projectType === "Billable" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"}`}>
                                    {entry.projectType}
                                  </span>
                                </td>
                                <td className="px-5 py-4 align-top">
                                  <div className="flex flex-wrap gap-2">
                                    {entry.flags.length > 0 ? (
                                      entry.flags.map((flag) => (
                                        <span key={flag} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                                          {flag}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                                        OK
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="px-5 py-8 text-sm text-zinc-500 dark:text-zinc-400">
                        No submitted line items for this day.
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "projects" ? (
            <div className="space-y-6">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Project Breakdown</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Hours grouped by project and task so the manager can quickly verify where the week was spent.
                </p>
              </div>

              <div className="space-y-4">
                {projectBreakdown.map((project) => (
                  <details key={project.projectId || project.projectName} open className="overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black/80">
                    <summary className="cursor-pointer list-none px-5 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-zinc-900 dark:text-white">{project.projectName}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {project.projectType} project • {formatHours(project.totalHours)} • {project.percentOfWeek.toFixed(0)}% of submitted week
                          </p>
                        </div>
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                          {project.tasks.length} task(s)
                        </span>
                      </div>
                    </summary>

                    <div className="grid gap-3 border-t border-zinc-200 px-5 py-5 dark:border-zinc-800">
                      {project.tasks.map((task) => (
                        <div key={`${project.projectId}-${task.taskName}`} className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="font-semibold text-zinc-900 dark:text-white">{task.taskName}</p>
                              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                                Worked on {task.dates.map((date) => formatShortDate(date)).join(", ")}
                              </p>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                              {formatHours(task.totalHours)}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {task.notes.map((note) => (
                              <span key={`${task.taskName}-${note}`} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-black dark:text-zinc-300">
                                {note}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}

                {projectBreakdown.length === 0 ? (
                  <div className="rounded-[1.6rem] border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    No project rows are available for this submitted timesheet.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === "validations" ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Validation & Compliance</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    System-generated checks to help the Team Manager decide whether this timesheet looks normal or suspicious.
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${validationToneClass[autoValidationStatus]}`}>
                  Overall result: {autoValidationStatus}
                </span>
              </div>

              <div className="grid gap-4">
                {validationItems.map((validation) => (
                  <article key={validation.code} className={`rounded-[1.5rem] border px-5 py-4 ${validationToneClass[validation.status]}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">{validation.title}</p>
                          <span className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold">{validation.severity}</span>
                        </div>
                        <p className="mt-2 text-sm opacity-90">{validation.message}</p>
                      </div>
                      <span className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold">
                        {validation.status}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "timeline" ? (
            <div className="space-y-6">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Timeline / Audit Context</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Practical submission and queue events available from the current approval data.
                </p>
              </div>

              <div className="space-y-4">
                {timelineEvents.map((event) => (
                  <div key={event.id} className={`rounded-[1.5rem] border px-5 py-4 ${timelineToneClass[event.tone]}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-semibold">{event.title}</p>
                        <p className="mt-2 text-sm opacity-90">{event.description}</p>
                      </div>
                      <div className="text-sm font-medium opacity-90">{formatDateTimeLabel(event.at)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {decisionNote?.trim() ? (
                <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-black/80">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Current Review Note</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{decisionNote}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-t border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <label className="block flex-1 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Manager Remark</span>
              <textarea
                rows={3}
                value={decisionNote ?? ""}
                onChange={(event) => onDecisionNoteChange(event.target.value)}
                placeholder="Optional review note. Reject will use this as the initial correction remark."
                className="w-full rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:focus:ring-brand-500/30"
              />
            </label>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={acting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon name="approvals" className="h-4 w-4" />
                {acting ? "Saving..." : "Approve"}
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={acting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon name="close" className="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

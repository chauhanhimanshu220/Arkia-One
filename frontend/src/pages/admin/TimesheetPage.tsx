import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import type { AuthUser } from "../../types/auth";
import { consumeTimesheetNavigationTarget } from "../../config/timesheetNavigation";
import { DAILY_WORK_HOURS as DAILY_HOUR_LIMIT, WORKING_DAYS_PER_WEEK as WEEKLY_WORKING_DAYS } from "../../constants/timesheet";
import { lateTimesheetService } from "../../services/lateTimesheetService";
import { timesheetService } from "../../services/timesheetService";
import { projectService } from "../../services/projectService";
import { taskService } from "../../services/taskService";
import type {
  LateTimesheetAccessRecord,
  LateTimesheetDateOption,
  LateTimesheetEligibleDate,
  LateTimesheetRequestRecord,
} from "../../types/lateTimesheet";
import type { Project } from "../../types/project";
import type { TaskItem } from "../../types/task";
import type { TimesheetRow, TimesheetWeekRecord } from "../../types/timesheet";

type ViewMode = "daily" | "weekly";
type SheetStatus = "Draft" | "Submitted" | "Manager Approved" | "Approved" | "Rejected";

type TaskRow = {
  id: string;
  projectId: string;
  projectName: string;
  taskName: string;
  subTaskName: string;
  status: string;
  plannedHours: number;
  billable: boolean | null;
  startDate: string;
  endDate: string;
};

type EntryDraft = {
  hours: string;
  note: string;
};

type LateRequestScopeRow =
  | {
      kind: "item";
      key: string;
      date: string;
      projectName: string;
      managerName: string;
      taskTitle: string;
      taskStatus: string;
      taskRange: string;
    }
  | {
      kind: "empty";
      key: string;
      date: string;
      message: string;
    };

const initialDrafts: Record<string, EntryDraft> = {};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const statusCopy: Record<SheetStatus, { title: string; description: string; classes: string }> = {
  Draft: {
    title: "Draft saved",
    description: "This timesheet is still editable. Submit it when the entries are final.",
    classes: "bg-[#E6F1FB] text-[#185FA5] border-transparent dark:bg-[#0C447C] dark:text-[#B5D4F4]",
  },
  Submitted: {
    title: "Pending approval",
    description: "This timesheet is locked and sent to the Team Manager / HR Manager approval queue.",
    classes: "bg-[#E6F1FB] text-[#185FA5] border-transparent dark:bg-[#0C447C] dark:text-[#B5D4F4]",
  },
  "Manager Approved": {
    title: "Manager approved",
    description: "Your manager has approved this sheet. It is now waiting for final System Admin approval.",
    classes: "bg-[#E6F1FB] text-[#185FA5] border-transparent dark:bg-[#0C447C] dark:text-[#B5D4F4]",
  },
  Approved: {
    title: "Approved",
    description: "This timesheet is approved and locked for payroll/reporting.",
    classes: "bg-[#E1F5EE] text-[#0F6E56] border-transparent dark:bg-[#085041] dark:text-[#9FE1CB]",
  },
  Rejected: {
    title: "Rejected",
    description: "This timesheet can be corrected and submitted again.",
    classes: "bg-[#FCEBEB] text-[#A32D2D] border-transparent dark:bg-[#4A1C1C] dark:text-[#F5AAAA]",
  },
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseHours(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(":").map(Number);
    return hours + minutes / 60;
  }

  return Number(trimmed) || 0;
}

function formatHours(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const hours = Math.floor(safe);
  const minutes = Math.round((safe - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getWeekStart(date: string) {
  const value = new Date(`${date}T00:00:00`);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value;
}

function getWeekDates(date: string) {
  const start = getWeekStart(date);
  return Array.from({ length: WEEKLY_WORKING_DAYS }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return formatDateInput(next);
  });
}

function formatDayHeader(date: string) {
  const value = new Date(`${date}T00:00:00`);
  return `${value.getDate()} ${shortMonths[value.getMonth()]}, ${dayNames[value.getDay()]}`;
}

function formatDateLabel(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeDateValue(value: string) {
  return value.includes("T") ? value.slice(0, 10) : value;
}

function isTaskScheduledOnDate(task: { startDate: string; endDate: string }, date: string) {
  const taskStart = normalizeDateValue(task.startDate);
  const taskEnd = normalizeDateValue(task.endDate || task.startDate);
  const scopedDate = normalizeDateValue(date);

  if (!taskStart || !taskEnd || !scopedDate) {
    return true;
  }

  return taskStart <= scopedDate && taskEnd >= scopedDate;
}

function doesTaskOverlapDates(task: { startDate: string; endDate: string }, dates: string[]) {
  return dates.some((date) => isTaskScheduledOnDate(task, date));
}

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildLateRequestSelectionKeys(options: LateTimesheetDateOption[]) {
  return options.flatMap((dateOption) =>
    dateOption.projects.flatMap((projectOption) =>
      projectOption.tasks.map((taskOption) => `${dateOption.date}|${projectOption.projectId}|${taskOption.taskId}`),
    ),
  );
}

function getStatusClasses(status: SheetStatus) {
  switch (status) {
    case "Approved":
      return "bg-[#E1F5EE] text-[#0F6E56] border-transparent dark:bg-[#085041] dark:text-[#9FE1CB]";
    case "Rejected":
      return "bg-[#FCEBEB] text-[#A32D2D] border-transparent dark:bg-[#4A1C1C] dark:text-[#F5AAAA]";
    case "Submitted":
    case "Manager Approved":
    default:
      return "bg-[#E6F1FB] text-[#185FA5] border-transparent dark:bg-[#0C447C] dark:text-[#B5D4F4]";
  }
}

function getTaskStatusBadgeClasses(status: string) {
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case "in progress":
      return "bg-[#E6F1FB] text-[#185FA5] border-transparent dark:bg-[#0C447C] dark:text-[#B5D4F4]";
    case "review":
      return "bg-[#FCEBEB] text-[#A32D2D] border-transparent dark:bg-[#4A1C1C] dark:text-[#F5AAAA]";
    case "done":
    case "completed":
    case "approved":
      return "bg-[#E1F5EE] text-[#0F6E56] border-transparent dark:bg-[#085041] dark:text-[#9FE1CB]";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";
  }
}

function Card({
  title,
  value,
  subtitle,
  className,
  valueClassName,
}: {
  title: string;
  value: string;
  subtitle: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black border-l-[3px] rounded-r-2xl rounded-l-none ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">{title}</p>
      <p className={`mt-3 text-2xl font-bold ${valueClassName ?? "text-zinc-900 dark:text-white"}`}>{value}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
    </div>
  );
}

const mapTaskToRow = (task: TaskItem): TaskRow => ({
  id: task.id,
  projectId: task.projectId,
  projectName: task.projectName,
  taskName: task.title,
  subTaskName: task.description || "No sub-task description",
  status: task.status,
  plannedHours: Number(task.totalHours || 0),
  billable: null,
  startDate: task.startDate,
  endDate: task.endDate,
});

const mapSavedRowsToDrafts = (rows: TimesheetRow[]) => {
  const drafts: Record<string, EntryDraft> = {};

  rows.forEach((row) => {
    Object.entries(row.hours).forEach(([date, hours]) => {
      drafts[`${row.id}:${date}`] = {
        hours: Number(hours || 0) > 0 ? formatHours(Number(hours)) : "",
        note: row.notesByDate?.[date] ?? row.notes ?? "",
      };
    });
  });

  return drafts;
};

function EmployeeTimesheetWorkspace({ user }: { user: AuthUser }) {
  const [mode, setMode] = useState<ViewMode>("weekly");
  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()));
  const [sheetStatus, setSheetStatus] = useState<SheetStatus>("Draft");
  const [searchText, setSearchText] = useState("");
  const [entryDrafts, setEntryDrafts] = useState<Record<string, EntryDraft>>(initialDrafts);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingAction, setSavingAction] = useState<"draft" | "submit" | null>(null);
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [savedWeek, setSavedWeek] = useState<TimesheetWeekRecord | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{ taskId: string; date: string } | null>(null);
  const modalTaskSelectAllRef = useRef<HTMLInputElement | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [availableTasks, setAvailableTasks] = useState<TaskItem[]>([]);
  const [projectTaskHistory, setProjectTaskHistory] = useState<Record<string, TaskItem[]>>({});
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectLoading, setProjectLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [modalSelectedTaskIds, setModalSelectedTaskIds] = useState<string[]>([]);
  const [modalSearchText, setModalSearchText] = useState("");
  const [modalPreviewTaskId, setModalPreviewTaskId] = useState<string | null>(null);
  const [lateRequests, setLateRequests] = useState<LateTimesheetRequestRecord[]>([]);
  const [lateRequestsLoading, setLateRequestsLoading] = useState(true);
  const [lateAccess, setLateAccess] = useState<LateTimesheetAccessRecord | null>(null);
  const [lateAccessLoading, setLateAccessLoading] = useState(false);
  const [lateRequestModalOpen, setLateRequestModalOpen] = useState(false);
  useBodyScrollLock(historyOpen || lateRequestModalOpen || projectModalOpen);
  const [lateRequestEligibleDates, setLateRequestEligibleDates] = useState<LateTimesheetEligibleDate[]>([]);
  const [lateRequestEligibleDatesLoading, setLateRequestEligibleDatesLoading] = useState(false);
  const [lateRequestDates, setLateRequestDates] = useState<string[]>([]);
  const [lateRequestOptions, setLateRequestOptions] = useState<LateTimesheetDateOption[]>([]);
  const [lateRequestOptionsLoading, setLateRequestOptionsLoading] = useState(false);
  const [lateRequestReason, setLateRequestReason] = useState("Not filled on time");
  const [lateRequestRemarks, setLateRequestRemarks] = useState("");
  const [lateRequestSubmitting, setLateRequestSubmitting] = useState(false);

  const todayInput = formatDateInput(new Date());
  const currentWeekDates = useMemo(() => getWeekDates(todayInput), [todayInput]);
  const currentWeekStart = currentWeekDates[0] ?? formatDateInput(getWeekStart(todayInput));
  const currentWeekEnd = currentWeekDates[currentWeekDates.length - 1] ?? currentWeekStart;
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const weekStart = useMemo(() => formatDateInput(getWeekStart(selectedDate)), [selectedDate]);
  const visibleDates = useMemo(() => (mode === "daily" ? [selectedDate] : weekDates), [mode, selectedDate, weekDates]);
  const requiredHours = visibleDates.length * DAILY_HOUR_LIMIT;
  const saving = savingAction !== null;
  const weekEnd = weekDates[weekDates.length - 1] ?? weekStart;
  const liveWeekLabel = `${formatDateLabel(currentWeekStart)} - ${formatDateLabel(currentWeekEnd)}`;
  const isCurrentEntryWeek = weekStart === currentWeekStart;
  const isPastEntryWeek = weekStart < currentWeekStart;
  const isFutureEntryWeek = weekStart > currentWeekStart;
  const maxLateRequestDate = useMemo(() => {
    const previous = new Date(`${currentWeekStart}T00:00:00`);
    previous.setDate(previous.getDate() - 1);
    return formatDateInput(previous);
  }, [currentWeekStart]);
  const lateRequestEligibleDateKeys = useMemo(
    () => lateRequestEligibleDates.map((item) => item.date),
    [lateRequestEligibleDates],
  );
  const lateRequestEligibleDateKeySet = useMemo(
    () => new Set(lateRequestEligibleDateKeys),
    [lateRequestEligibleDateKeys],
  );
  const lateRequestAllDatesSelected =
    lateRequestEligibleDateKeys.length > 0 &&
    lateRequestEligibleDateKeys.every((date) => lateRequestDates.includes(date));
  const lateRequestSelectionKeys = useMemo(() => buildLateRequestSelectionKeys(lateRequestOptions), [lateRequestOptions]);
  const lateRequestScopeRows = useMemo<LateRequestScopeRow[]>(
    () =>
      lateRequestOptions.reduce<LateRequestScopeRow[]>((rows, dateOption) => {
        if (dateOption.projects.length === 0) {
          rows.push({
            kind: "empty",
            key: `${dateOption.date}-empty`,
            date: dateOption.date,
            message: "No historical task mapping was found for this date.",
          });
          return rows;
        }

        dateOption.projects.forEach((projectOption) => {
          projectOption.tasks.forEach((taskOption) => {
            rows.push({
              kind: "item",
              key: `${dateOption.date}|${projectOption.projectId}|${taskOption.taskId}`,
              date: dateOption.date,
              projectName: projectOption.projectName,
              managerName: projectOption.managerName || "Mapped Team Manager",
              taskTitle: taskOption.taskTitle,
              taskStatus: taskOption.status,
              taskRange: `${formatDateLabel(taskOption.startDate)} to ${formatDateLabel(taskOption.endDate)}`,
            });
          });
        });

        return rows;
      }, []),
    [lateRequestOptions],
  );
  const lateAccessItems = lateAccess?.items ?? [];
  const lateAccessKeySet = useMemo(
    () => new Set(lateAccessItems.map((item) => `${item.date}:${item.projectId}:${item.taskId}`)),
    [lateAccessItems],
  );
  const canAdvanceEditSubmittedWeek = sheetStatus === "Submitted" && isCurrentEntryWeek;
  const isDateAdvanceEditable = (date: string) => canAdvanceEditSubmittedWeek && date > todayInput;
  const isHistoricalDateUnlocked = (date: string) => lateAccessItems.some((item) => item.date === date);
  const hasHistoricalAccess = isPastEntryWeek && lateAccessItems.length > 0;
  const isCheckingHistoricalAccess = isPastEntryWeek && lateAccessLoading;
  const isHistoricalSubmitted = isPastEntryWeek && sheetStatus === "Submitted";
  const isHistoricalApproved = isPastEntryWeek && sheetStatus === "Approved";
  const isHistoricalRejected = isPastEntryWeek && sheetStatus === "Rejected";
  const canEditHistoricalWeek =
    isPastEntryWeek &&
    !timesheetLoading &&
    !lateAccessLoading &&
    lateAccessItems.length > 0 &&
    !isHistoricalSubmitted &&
    !isHistoricalApproved;
  const isDateReadOnly = (date: string) =>
    isCurrentEntryWeek
      ? timesheetLoading || sheetStatus === "Approved" || (sheetStatus === "Submitted" && !isDateAdvanceEditable(date))
      : timesheetLoading || lateAccessLoading || isHistoricalSubmitted || isHistoricalApproved || !isHistoricalDateUnlocked(date);
  const editableDates = visibleDates.filter((date) => !isDateReadOnly(date));
  const hasEditableDates = editableDates.length > 0;
  const isSheetReadOnly =
    isCurrentEntryWeek
      ? timesheetLoading || sheetStatus === "Approved" || sheetStatus === "Manager Approved" || (sheetStatus === "Submitted" && !hasEditableDates)
      : !canEditHistoricalWeek;
  const canManageTaskSelection = isCurrentEntryWeek
    ? !isSheetReadOnly
    : canEditHistoricalWeek;
  const canSaveDraft = isCurrentEntryWeek && !timesheetLoading && sheetStatus !== "Submitted" && sheetStatus !== "Approved";
  const canSaveHistoricalDraft = canEditHistoricalWeek;
  const canSubmitTimesheet =
    isCurrentEntryWeek && !timesheetLoading && sheetStatus !== "Approved" && (sheetStatus !== "Submitted" || hasEditableDates);
  const canApplyHistoricalWeek = canEditHistoricalWeek;
  const currentActionBusy = saving || timesheetLoading;
  const historicalActionBusy = saving || timesheetLoading || lateAccessLoading;
  const currentStatusCopy = statusCopy[sheetStatus];
  const isUnsavedDraft = sheetStatus === "Draft" && !savedWeek;
  const statusTitle = isFutureEntryWeek
    ? "Future Week"
    : isCheckingHistoricalAccess
    ? "Checking historical access"
    : isHistoricalSubmitted
    ? "Pending approval"
    : isHistoricalApproved
    ? "Approved"
    : isHistoricalRejected
    ? "Historical submission rejected"
    : hasHistoricalAccess
    ? "Historical entry unlocked"
    : !isCurrentEntryWeek
    ? "Historical week locked"
    : timesheetLoading
      ? "Checking timesheet status"
      : isUnsavedDraft
        ? "Draft not saved"
        : currentStatusCopy.title;
  const statusClasses =
    !isCurrentEntryWeek
      ? isHistoricalSubmitted
        ? statusCopy.Submitted.classes
        : isHistoricalApproved
        ? statusCopy.Approved.classes
        : isHistoricalRejected
        ? statusCopy.Rejected.classes
        : hasHistoricalAccess
        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
        : "border-brand-200 bg-brand-50 text-zinc-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-zinc-300"
      : timesheetLoading || isUnsavedDraft
      ? "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200"
      : currentStatusCopy.classes;
  const statusDescription = isFutureEntryWeek
    ? `Timesheet entry for ${formatDateLabel(weekStart)} - ${formatDateLabel(weekEnd)} will open once that week becomes active.`
    : isCheckingHistoricalAccess
    ? "Checking whether approved late-entry scope is active for this historical week."
    : isHistoricalSubmitted
    ? "This historical timesheet is submitted and waiting for Team Manager approval. Entries are locked until a decision is recorded."
    : isHistoricalApproved
    ? "This historical timesheet is approved and locked for payroll/reporting."
    : isHistoricalRejected
    ? hasHistoricalAccess
      ? "This historical timesheet was rejected. Review the feedback, update only the unlocked historical cells, and submit it again."
      : "This historical timesheet was rejected. Historical cells stay locked until approved late-entry access is active again."
    : hasHistoricalAccess
    ? "Approved late-entry scope is active. Fill only the unlocked historical cells, use Save Draft if needed, then submit the week for Team Manager approval."
    : !isCurrentEntryWeek
    ? `Entries for this historical week stay locked until a late-entry request is approved. The normal editable window is the Active Week (${liveWeekLabel}).`
    : timesheetLoading
      ? "Checking if a draft or submitted timesheet already exists for this period."
      : isUnsavedDraft
        ? "No draft has been saved yet. Enter hours, then click Save Draft or Submit Timesheet."
        : canAdvanceEditSubmittedWeek
          ? "Submitted entries up to today are locked. You can still fill future days in this Active Week in advance, then submit again."
          : currentStatusCopy.description;
  const recentLateRequests = useMemo(
    () =>
      lateRequests
        .filter((request) => request.items.some((item) => weekDates.includes(item.date)))
        .slice(0, 3),
    [lateRequests, weekDates],
  );
  const hasSavedEntriesInVisiblePeriod = useMemo(
    () =>
      Boolean(
        savedWeek?.rows.some((row) =>
          visibleDates.some((date) => {
            const hours = Number(row.hours?.[date] ?? 0);
            const note = row.notesByDate?.[date] ?? "";
            return hours > 0 || note.trim().length > 0;
          }),
        ),
      ),
    [savedWeek, visibleDates],
  );
  const canRaiseLateRequest = isPastEntryWeek && !hasSavedEntriesInVisiblePeriod;
  const shouldShowHistoricalControls =
    isPastEntryWeek &&
    (canRaiseLateRequest || lateAccessLoading || lateRequestsLoading || lateAccessItems.length > 0 || recentLateRequests.length > 0);

  useEffect(() => {
    const target = consumeTimesheetNavigationTarget();

    if (target.date) {
      setSelectedDate(target.date);
    }

    if (target.mode) {
      setMode(target.mode);
    }

    if (target.intent === "late-request") {
      setLateRequestDates(target.date ? [target.date] : []);
      setLateRequestReason("Not filled on time");
      setLateRequestRemarks("");
      setLateRequestModalOpen(true);
    }
  }, [currentWeekEnd, currentWeekStart]);

  useEffect(() => {
    let cancelled = false;

    const loadLateRequests = async () => {
      setLateRequestsLoading(true);
      try {
        const records = await lateTimesheetService.listByUser(user.id);
        if (!cancelled) {
          setLateRequests(records);
        }
      } finally {
        if (!cancelled) {
          setLateRequestsLoading(false);
        }
      }
    };

    void loadLateRequests();

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    if (!isPastEntryWeek) {
      setLateAccess({ weekStart, weekEnd, items: [] });
      setLateAccessLoading(false);
      return;
    }

    let cancelled = false;

    const loadLateAccess = async () => {
      setLateAccessLoading(true);
      try {
        const access = await lateTimesheetService.getApprovedAccess(user.id, weekStart);
        if (!cancelled) {
          setLateAccess(access);
        }
      } catch {
        if (!cancelled) {
          setLateAccess({ weekStart, weekEnd, items: [] });
        }
      } finally {
        if (!cancelled) {
          setLateAccessLoading(false);
        }
      }
    };

    void loadLateAccess();

    return () => {
      cancelled = true;
    };
  }, [isPastEntryWeek, user.id, weekEnd, weekStart]);

  useEffect(() => {
    if (!lateRequestModalOpen) {
      setLateRequestEligibleDates([]);
      setLateRequestEligibleDatesLoading(false);
      return;
    }

    let cancelled = false;

    const loadEligibleDates = async () => {
      setLateRequestEligibleDatesLoading(true);
      try {
        const eligibleDates = await lateTimesheetService.getEligibleDates(user.id);
        if (cancelled) {
          return;
        }

        setLateRequestEligibleDates(eligibleDates);
        setLateRequestDates((current) => {
          const nextDates = current.filter((date) => eligibleDates.some((item) => item.date === date));
          if (nextDates.length > 0) {
            return nextDates;
          }

          if (isPastEntryWeek && eligibleDates.some((item) => item.date === selectedDate)) {
            return [selectedDate];
          }

          return [];
        });
      } catch {
        if (!cancelled) {
          setLateRequestEligibleDates([]);
          setLateRequestDates([]);
        }
      } finally {
        if (!cancelled) {
          setLateRequestEligibleDatesLoading(false);
        }
      }
    };

    void loadEligibleDates();

    return () => {
      cancelled = true;
    };
  }, [isPastEntryWeek, lateRequestModalOpen, selectedDate, user.id]);

  useEffect(() => {
    if (!lateRequestModalOpen || lateRequestDates.length === 0) {
      setLateRequestOptions([]);
      setLateRequestOptionsLoading(false);
      return;
    }

    let cancelled = false;

    const loadLateRequestOptions = async () => {
      setLateRequestOptionsLoading(true);
      try {
        const options = await lateTimesheetService.getEligibleOptions(user.id, lateRequestDates);
        if (!cancelled) {
          setLateRequestOptions(options);
        }
      } catch {
        if (!cancelled) {
          setLateRequestOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLateRequestOptionsLoading(false);
        }
      }
    };

    void loadLateRequestOptions();

    return () => {
      cancelled = true;
    };
  }, [lateRequestDates, lateRequestModalOpen, user.id]);

  useEffect(() => {
    setLateRequestDates((current) => current.filter((date) => lateRequestEligibleDateKeySet.has(date)));
  }, [lateRequestEligibleDateKeySet]);

  useEffect(() => {
    let cancelled = false;

    const loadSavedWeek = async () => {
      setTimesheetLoading(true);
      setSubmitMessage("");

      try {
        const record = await timesheetService.getWeek(weekStart, user.id);
        if (cancelled) {
          return;
        }

        setSavedWeek(record);
        setSheetStatus(record?.status ?? "Draft");
        setEntryDrafts(record ? mapSavedRowsToDrafts(record.rows) : {});
        setErrors({});

        if (record?.rows.length) {
          setSelectedTaskIds(record.rows.map((row) => row.id));
        }
      } catch {
        if (!cancelled) {
          setSubmitMessage("Unable to load saved timesheet status right now.");
        }
      } finally {
        if (!cancelled) {
          setTimesheetLoading(false);
        }
      }
    };

    void loadSavedWeek();

    return () => {
      cancelled = true;
    };
  }, [user.id, weekStart]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      setProjectLoading(true);
      try {
        const [projectRecords, userTasks] = await Promise.all([
          projectService.getProjects(),
          taskService.getUserTasks(user.id, selectedDate),
        ]);

        if (cancelled) {
          return;
        }

        setProjects(projectRecords);
        setAvailableTasks(userTasks);
      } finally {
        if (!cancelled) {
          setProjectLoading(false);
        }
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, user.id]);

  const visibleProjectIds = useMemo(() => {
    const ids = new Set<string>();

    projects.forEach((project) => {
      if (project.managerId === user.id || project.teamMemberIds.includes(user.id)) {
        ids.add(project.id);
      }
    });

    availableTasks.forEach((task) => {
      if (task.projectId) {
        ids.add(task.projectId);
      }
    });

    Object.entries(projectTaskHistory).forEach(([projectId, tasks]) => {
      if (tasks.length > 0) {
        ids.add(projectId);
      }
    });

    savedWeek?.rows.forEach((row) => {
      if (row.projectId) {
        ids.add(row.projectId);
      }
    });

    lateAccessItems.forEach((item) => {
      ids.add(item.projectId);
    });

    return ids;
  }, [availableTasks, lateAccessItems, projectTaskHistory, projects, savedWeek?.rows, user.id]);

  const assignedProjects = useMemo(
    () => projects.filter((project) => visibleProjectIds.has(project.id)),
    [projects, visibleProjectIds],
  );

  useEffect(() => {
    if (!assignedProjects.length) {
      setSelectedProjectId((current) => (current ? "" : current));
      setSelectedTaskIds((current) => (current.length > 0 ? [] : current));
      return;
    }

    setSelectedProjectId((current) => {
      if (current && assignedProjects.some((project) => project.id === current)) {
        return current;
      }
      return assignedProjects[0].id;
    });
  }, [assignedProjects]);

  useEffect(() => {
    if (isCurrentEntryWeek || lateAccessItems.length === 0) {
      return;
    }

    const preferredProjectIds = Array.from(new Set(lateAccessItems.map((item) => item.projectId)));
    setSelectedProjectId((current) => (preferredProjectIds.includes(current) ? current : preferredProjectIds[0] ?? current));
  }, [isCurrentEntryWeek, lateAccessItems]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(projectTaskHistory, selectedProjectId)) {
      return;
    }

    let cancelled = false;

    const loadProjectTasks = async () => {
      try {
        const history = await taskService.getTaskHistory(selectedProjectId);
        if (cancelled) {
          return;
        }

        const scoped = history.filter((task) => task.assignedTo === user.id);
        setProjectTaskHistory((current) => ({ ...current, [selectedProjectId]: scoped }));
      } catch {
        if (!cancelled) {
          setProjectTaskHistory((current) => ({ ...current, [selectedProjectId]: [] }));
        }
      }
    };

    void loadProjectTasks();

    return () => {
      cancelled = true;
    };
  }, [projectTaskHistory, selectedProjectId, user.id]);

  const selectedProject = useMemo(
    () => assignedProjects.find((project) => project.id === selectedProjectId) ?? null,
    [assignedProjects, selectedProjectId],
  );

  const projectTasks = useMemo(() => {
    if (!selectedProjectId) {
      return [];
    }

    const merged = new Map<string, TaskItem>();
    availableTasks
      .filter((task) => task.projectId === selectedProjectId)
      .forEach((task) => merged.set(task.id, task));

    (projectTaskHistory[selectedProjectId] ?? []).forEach((task) => {
      if (!merged.has(task.id)) {
        merged.set(task.id, task);
      }
    });

    return Array.from(merged.values()).filter((task) => doesTaskOverlapDates(task, visibleDates));
  }, [availableTasks, projectTaskHistory, selectedProjectId, visibleDates]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedTaskIds((current) => (current.length > 0 ? [] : current));
      return;
    }

    setSelectedTaskIds((current) => {
      const approvedTaskIdsForProject = !isCurrentEntryWeek
        ? lateAccessItems
            .filter((item) => item.projectId === selectedProjectId)
            .map((item) => item.taskId)
        : [];

      if (projectTasks.length === 0) {
        return approvedTaskIdsForProject.length > 0 ? approvedTaskIdsForProject : current.length > 0 ? [] : current;
      }

      const validIds = current.filter((taskId) => projectTasks.some((task) => task.id === taskId));
      const pinnedIds = approvedTaskIdsForProject.filter((taskId) => projectTasks.some((task) => task.id === taskId));
      if (validIds.length > 0) {
        const mergedIds = Array.from(new Set([...validIds, ...pinnedIds]));
        return areStringArraysEqual(mergedIds, current) ? current : mergedIds;
      }

      const nextIds = Array.from(new Set([...(pinnedIds.length > 0 ? pinnedIds : projectTasks.map((task) => task.id))]));
      return areStringArraysEqual(nextIds, current) ? current : nextIds;
    });
  }, [isCurrentEntryWeek, lateAccessItems, projectTasks, selectedProjectId]);

  const selectedRows = useMemo(
    () => projectTasks.filter((task) => selectedTaskIds.includes(task.id)).map(mapTaskToRow),
    [projectTasks, selectedTaskIds],
  );

  const filteredTasks = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return selectedRows;

    return selectedRows.filter((task) =>
      [task.projectName, task.taskName, task.subTaskName, task.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchText, selectedRows]);

  const modalFilteredTasks = useMemo(() => {
    const query = modalSearchText.trim().toLowerCase();
    if (!query) {
      return projectTasks;
    }

    return projectTasks.filter((task) =>
      [task.projectName, task.title, task.description, task.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [modalSearchText, projectTasks]);

  const modalAllTasksSelected =
    projectTasks.length > 0 && projectTasks.every((task) => modalSelectedTaskIds.includes(task.id));
  const modalSomeTasksSelected = projectTasks.some((task) => modalSelectedTaskIds.includes(task.id));

  useEffect(() => {
    if (!modalTaskSelectAllRef.current) {
      return;
    }

    modalTaskSelectAllRef.current.indeterminate = !modalAllTasksSelected && modalSomeTasksSelected;
  }, [modalAllTasksSelected, modalSomeTasksSelected]);

  const previewTask =
    projectTasks.find((task) => task.id === modalPreviewTaskId) ??
    modalFilteredTasks[0] ??
    null;
  const modalSelectedCount = modalSelectedTaskIds.filter((taskId) => projectTasks.some((task) => task.id === taskId)).length;
  const projectDateRange = selectedProject ? `${formatDateLabel(selectedProject.startDate)} to ${formatDateLabel(selectedProject.endDate)}` : "Pick a project to review tasks and schedule details.";
  const lockedSavedTaskIds = [
    ...(canAdvanceEditSubmittedWeek && savedWeek ? savedWeek.rows.map((row) => row.id) : []),
    ...(!isCurrentEntryWeek ? lateAccessItems.map((item) => item.taskId) : []),
  ];
  const isLateCellUnlocked = (task: Pick<TaskRow, "id" | "projectId"> | null, date: string) =>
    !!task && lateAccessKeySet.has(`${date}:${task.projectId}:${task.id}`);
  const isCellReadOnly = (task: TaskRow, date: string) =>
    isCurrentEntryWeek
      ? isDateReadOnly(date)
      : timesheetLoading || lateAccessLoading || isHistoricalSubmitted || isHistoricalApproved || !isLateCellUnlocked(task, date);

  const openProjectModal = () => {
    if (!canManageTaskSelection) {
      return;
    }

    setModalSelectedTaskIds(selectedTaskIds);
    setModalSearchText("");
    setModalPreviewTaskId(selectedTaskIds[0] ?? projectTasks[0]?.id ?? null);
    setProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    setProjectModalOpen(false);
    setModalSearchText("");
  };

  const updateEntry = (taskId: string, date: string, next: Partial<EntryDraft>) => {
    const task = selectedRows.find((item) => item.id === taskId);
    if (!task || isCellReadOnly(task, date) || !isTaskScheduledOnDate(task, date)) {
      return;
    }

    const key = `${taskId}:${date}`;
    setEntryDrafts((current) => {
      const nextDrafts = {
        ...current,
        [key]: {
          hours: current[key]?.hours ?? "",
          note: current[key]?.note ?? "",
          ...next,
        },
      };

      const dayTotal = selectedRows.reduce(
        (sum, row) => sum + (isTaskScheduledOnDate(row, date) ? parseHours(nextDrafts[`${row.id}:${date}`]?.hours ?? "") : 0),
        0,
      );
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        selectedRows.forEach((row) => {
          const taskKey = `${row.id}:${date}`;
          if (nextErrors[taskKey] === `Daily total cannot exceed ${DAILY_HOUR_LIMIT} hours.`) {
            delete nextErrors[taskKey];
          }
        });

        const parsedHours = parseHours(nextDrafts[key]?.hours ?? "");
        const hasHours = parsedHours > 0;
        const hasNote = (nextDrafts[key]?.note ?? "").trim().length > 0;
        if ((nextDrafts[key]?.hours ?? "").trim() && parsedHours <= 0) {
          nextErrors[key] = "Enter valid hours.";
        } else if (parsedHours > DAILY_HOUR_LIMIT) {
          nextErrors[key] = `Single entry cannot exceed ${DAILY_HOUR_LIMIT} hours.`;
        } else if (dayTotal > DAILY_HOUR_LIMIT) {
          nextErrors[key] = `Daily total cannot exceed ${DAILY_HOUR_LIMIT} hours.`;
        } else if (hasHours && !hasNote) {
          nextErrors[key] = "Note is required when hours are entered.";
        } else {
          delete nextErrors[key];
        }

        return nextErrors;
      });

      return nextDrafts;
    });
  };

  const buildTimesheetRows = () => {
    const rowCatalog = new Map<string, TimesheetRow>();
    savedWeek?.rows.forEach((row) => rowCatalog.set(row.id, row));
    selectedRows.forEach((task) =>
      rowCatalog.set(task.id, {
        id: task.id,
        projectId: task.projectId,
        projectName: task.projectName,
        taskName: task.taskName,
        notes: "",
        notesByDate: {},
        billable: Boolean(task.billable),
        hours: {},
      }),
    );

    return Array.from(rowCatalog.values())
      .map<TimesheetRow>((row) => {
        const selectedTask = selectedRows.find((task) => task.id === row.id) ?? null;
        const scopedDates = selectedTask
          ? weekDates.filter((date) => isTaskScheduledOnDate(selectedTask, date))
          : weekDates;
        const hours: Record<string, number> = Object.fromEntries(
          scopedDates
            .map((date) => [date, parseHours(entryDrafts[`${row.id}:${date}`]?.hours ?? "")] as const)
            .filter(([, value]) => value > 0),
        );
        const notesByDate: Record<string, string> = Object.fromEntries(
          scopedDates
            .map((date) => [date, entryDrafts[`${row.id}:${date}`]?.note.trim() ?? ""] as const)
            .filter(([, value]) => value.length > 0),
        );

        return {
          id: row.id,
          projectId: row.projectId,
          projectName: row.projectName,
          taskName: row.taskName,
          notes: Object.values(notesByDate)[0] ?? "",
          notesByDate,
          billable: row.billable,
          hours,
        };
      })
      .filter((row) => Object.keys(row.hours).length > 0 || Object.keys(row.notesByDate ?? {}).length > 0);
  };
  const totalsByDate = useMemo(() => {
    return Object.fromEntries(
      visibleDates.map((date) => [
        date,
        selectedRows.reduce(
          (sum, task) => sum + (isTaskScheduledOnDate(task, date) ? parseHours(entryDrafts[`${task.id}:${date}`]?.hours ?? "") : 0),
          0,
        ),
      ]),
    );
  }, [visibleDates, selectedRows, entryDrafts]);

  const totalEnteredHours = useMemo(
    () => Object.values(totalsByDate).reduce((sum, value) => sum + value, 0),
    [totalsByDate],
  );

  const remainingHours = Math.max(0, requiredHours - totalEnteredHours);

  const rowTotal = (taskId: string) => {
    const task = selectedRows.find((item) => item.id === taskId);
    if (!task) return 0;
    return visibleDates.reduce(
      (sum, date) => sum + (isTaskScheduledOnDate(task, date) ? parseHours(entryDrafts[`${taskId}:${date}`]?.hours ?? "") : 0),
      0,
    );
  };

  const validateEntries = () => {
    const nextErrors: Record<string, string> = {};
    const datesToValidate = canAdvanceEditSubmittedWeek ? editableDates : visibleDates;

    datesToValidate.forEach((date) => {
      const dayTotal = selectedRows.reduce(
        (sum, task) => sum + (isTaskScheduledOnDate(task, date) ? parseHours(entryDrafts[`${task.id}:${date}`]?.hours ?? "") : 0),
        0,
      );
      if (dayTotal > DAILY_HOUR_LIMIT) {
        const firstEnteredTask = selectedRows.find(
          (task) => isTaskScheduledOnDate(task, date) && parseHours(entryDrafts[`${task.id}:${date}`]?.hours ?? "") > 0,
        );
        if (firstEnteredTask) {
          nextErrors[`${firstEnteredTask.id}:${date}`] = `Daily total cannot exceed ${DAILY_HOUR_LIMIT} hours.`;
        }
      }
    });

    selectedRows.forEach((task) => {
      datesToValidate.forEach((date) => {
        if (!isTaskScheduledOnDate(task, date)) {
          return;
        }
        const key = `${task.id}:${date}`;
        const entry = entryDrafts[key];
        if (!entry) return;

        const parsedHours = parseHours(entry.hours);
        const hasHours = parsedHours > 0;
        const hasNote = entry.note.trim().length > 0;

        if (entry.hours.trim() && parsedHours <= 0) {
          nextErrors[key] = "Enter valid hours.";
          return;
        }

        if (hasHours && !hasNote) {
          nextErrors[key] = "Note is required when hours are entered.";
          return;
        }

        if (parsedHours > DAILY_HOUR_LIMIT) {
          nextErrors[key] = `Single entry cannot exceed ${DAILY_HOUR_LIMIT} hours.`;
        }
      });
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveDraft = async () => {
    if (isPastEntryWeek) {
      if (lateAccessLoading) {
        setSubmitMessage("Checking whether approved late-entry access is active for this historical week.");
        return;
      }

      if (!canSaveHistoricalDraft) {
        setSubmitMessage("Approved late-entry access is required before saving a historical draft.");
        return;
      }

      setSubmitMessage("");

      if (!validateEntries()) {
        setSubmitMessage("Please fix validation errors before saving draft.");
        return;
      }

      const rows = buildTimesheetRows();
      if (rows.length === 0) {
        setSubmitMessage("Enter at least one unlocked late-entry row before saving draft.");
        return;
      }

      setSavingAction("draft");
      try {
        const saved = timesheetService.saveHistoricalDraft(weekStart, rows, user.id);
        setSavedWeek(saved);
        setSheetStatus(saved.status);
        setEntryDrafts(mapSavedRowsToDrafts(saved.rows));
        setSubmitMessage("Historical draft saved locally. You can reopen this week later and submit after reviewing the approved entries.");
      } catch (error) {
        setSubmitMessage(error instanceof Error ? error.message : "Unable to save historical draft right now.");
      } finally {
        setSavingAction(null);
      }

      return;
    }

    if (!isCurrentEntryWeek) {
      setSubmitMessage(`Timesheet entry is available only for the Active Week (${liveWeekLabel}).`);
      return;
    }

    if (!canSaveDraft) {
      setSubmitMessage(
        canAdvanceEditSubmittedWeek
          ? "This week is already submitted. Use Submit Timesheet to add future-day advance entries."
          : "Submitted or approved timesheets are locked and cannot be saved as draft.",
      );
      return;
    }

    setSubmitMessage("");

    if (!validateEntries()) {
      setSubmitMessage("Please fix validation errors before saving draft.");
      return;
    }

    setSavingAction("draft");
    try {
      const saved = await timesheetService.saveWeek(
        {
          weekStart,
          status: "Draft",
          rows: buildTimesheetRows(),
          managerApprovalStatus: "Pending",
          adminApprovalStatus: "Pending",
          approvedBy: "",
          approvalFlowType: "",
        },
        user.id,
      );

      setSavedWeek(saved);
      setSheetStatus(saved.status);
      setSubmitMessage("Draft saved successfully. You can still edit it before final submission.");
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Unable to save draft right now.");
    } finally {
      setSavingAction(null);
    }
  };

  const handleSubmit = async () => {
    if (!isCurrentEntryWeek) {
      setSubmitMessage(`Timesheet entry is available only for the Active Week (${liveWeekLabel}).`);
      return;
    }

    if (!canSubmitTimesheet) {
      setSubmitMessage("This timesheet is already locked for approval.");
      return;
    }

    setSubmitMessage("");
    const isValid = validateEntries();

    if (!isValid) {
      setSubmitMessage("Please fix validation errors before submitting.");
      return;
    }

    if (totalEnteredHours === 0) {
      setSubmitMessage("Please enter at least one timesheet row before submitting.");
      return;
    }

    setSavingAction("submit");
    try {
      const saved = await timesheetService.saveWeek(
        {
          weekStart,
          status: "Submitted",
          rows: buildTimesheetRows(),
          managerApprovalStatus: "Pending",
          adminApprovalStatus: "Pending",
          approvedBy: "",
          approvalFlowType: "",
        },
        user.id,
      );

      setSavedWeek(saved);
      setSheetStatus(saved.status);
      setSubmitMessage("Timesheet submitted permanently and sent to Team Manager / HR Manager for approval.");
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Unable to submit timesheet right now.");
    } finally {
      setSavingAction(null);
    }
  };

  const resetLateRequestForm = (seedDates?: string[]) => {
    const nextDates = Array.from(new Set((seedDates ?? []).filter((date) => date && date <= maxLateRequestDate))).sort();
    setLateRequestDates(nextDates);
    setLateRequestReason("Not filled on time");
    setLateRequestRemarks("");
  };

  const toggleLateRequestDate = (date: string) => {
    setLateRequestDates((current) =>
      current.includes(date)
        ? current.filter((item) => item !== date)
        : [...current, date].sort(),
    );
  };

  const handleSelectAllLateRequestDates = () => {
    setLateRequestDates([...lateRequestEligibleDateKeys].sort());
  };

  const handleClearLateRequestDates = () => {
    setLateRequestDates([]);
  };

  const handleOpenLateRequestModal = () => {
    if (!canRaiseLateRequest) {
      setSubmitMessage("Late entry requests can only be raised for past dates or weeks that are still unfilled.");
      return;
    }

    resetLateRequestForm(isPastEntryWeek ? [selectedDate] : []);
    setLateRequestModalOpen(true);
  };

  const handleApplyHistoricalWeek = async () => {
    if (!isPastEntryWeek) {
      setSubmitMessage("Approved late-entry access is available only for past weeks.");
      return;
    }

    if (lateAccessLoading) {
      setSubmitMessage("Checking whether approved late-entry access is active for this historical week.");
      return;
    }

    if (!canApplyHistoricalWeek) {
      setSubmitMessage("No approved late-entry scope is active for this historical week.");
      return;
    }

    if (!validateEntries()) {
      setSubmitMessage("Please fix validation errors before applying approved late entries.");
      return;
    }

    const rows = buildTimesheetRows();
    if (rows.length === 0) {
      setSubmitMessage("Enter at least one approved late-entry row before applying changes.");
      return;
    }

    setSavingAction("submit");
    try {
      const saved = await timesheetService.applyHistoricalWeek(weekStart, rows, user.id);
      setSavedWeek(saved);
      setSheetStatus(saved.status);
      setSubmitMessage("Historical timesheet submitted successfully and routed to Team Manager approval.");

      const [requests, access] = await Promise.all([
        lateTimesheetService.listByUser(user.id),
        lateTimesheetService.getApprovedAccess(user.id, weekStart),
      ]);
      setLateRequests(requests);
      setLateAccess(access);
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Unable to apply approved late-entry changes right now.");
    } finally {
      setSavingAction(null);
    }
  };

  const handleSubmitLateRequest = async () => {
    if (lateRequestSelectionKeys.length === 0) {
      setSubmitMessage("Select at least one historical date with an available project / task scope before submitting the request.");
      return;
    }

    setLateRequestSubmitting(true);
    try {
      const created = await lateTimesheetService.createRequest({
        userId: user.id,
        items: lateRequestSelectionKeys.map((key) => {
          const [date, projectId, taskId] = key.split("|");
          return { date, projectId, taskId };
        }),
        reason: lateRequestReason,
        additionalRemarks: lateRequestRemarks,
      });

      setLateRequests((current) => [created, ...current]);
      setLateRequestModalOpen(false);
      setSubmitMessage("Late timesheet request submitted successfully and routed to the mapped Team Manager(s).");
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Unable to submit the late timesheet request right now.");
    } finally {
      setLateRequestSubmitting(false);
    }
  };

  const handleCopyPreviousDay = () => {
    if (mode !== "daily" || isDateReadOnly(selectedDate)) return;

    const currentDate = new Date(`${selectedDate}T00:00:00`);
    currentDate.setDate(currentDate.getDate() - 1);
    const previousDate = formatDateInput(currentDate);

    const nextDrafts = { ...entryDrafts };
    filteredTasks.forEach((task) => {
      const previousKey = `${task.id}:${previousDate}`;
      const currentKey = `${task.id}:${selectedDate}`;
      if (entryDrafts[previousKey]) {
        nextDrafts[currentKey] = { ...entryDrafts[previousKey] };
      }
    });

    setEntryDrafts(nextDrafts);
    setSubmitMessage("Previous day entries copied.");
  };

  const shiftPeriod = (direction: number) => {
    const next = new Date(`${selectedDate}T00:00:00`);
    next.setDate(next.getDate() + (mode === "daily" ? direction : direction * 7));
    setSelectedDate(formatDateInput(next));
    setSubmitMessage("");
  };

  const historyEntries = Object.entries(entryDrafts)
    .filter(([, value]) => parseHours(value.hours) > 0 || value.note.trim())
    .map(([key, value]) => {
      const [taskId, date] = key.split(":");
      const task = selectedRows.find((item) => item.id === taskId);
      return {
        key,
        date,
        taskName: task?.taskName ?? "Task",
        subTaskName: task?.subTaskName ?? "Sub Task",
        projectName: task?.projectName ?? "Project",
        hours: value.hours,
        note: value.note,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const historicalAccessSummary = lateAccessLoading
    ? "Checking..."
    : lateAccessItems.length > 0
      ? `${lateAccessItems.length} unlocked`
      : "Locked";

  const historicalRequestSummary = lateRequestsLoading
    ? "Loading..."
    : `${recentLateRequests.length} request${recentLateRequests.length === 1 ? "" : "s"}`;

  return (
    <div className="text-zinc-800 dark:text-zinc-100">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">My Timesheet</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Employee timesheet entry page with daily and weekly logging.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Prev
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              aria-label="Selected timesheet date"
              title="Selected timesheet date"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
            />

            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Next
            </button>

            <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-black">
              <button
                type="button"
                onClick={() => setMode("weekly")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === "weekly" ? "bg-zinc-950 text-white dark:text-black dark:bg-white dark:text-black" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"}`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setMode("daily")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === "daily" ? "bg-zinc-950 text-white dark:text-black dark:bg-white dark:text-black" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"}`}
              >
                Daily
              </button>
            </div>

            <span className={`rounded-[20px] px-[10px] py-[3px] text-[11px] font-semibold border-transparent ${getStatusClasses(sheetStatus)}`}>
              {timesheetLoading ? "Loading status..." : sheetStatus}
            </span>
          </div>
        </div>

        {sheetStatus === "Rejected" && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            Your previous timesheet was rejected. Please correct entries and resubmit.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Entered Hours" value={formatHours(totalEnteredHours)} subtitle="Live calculated total" className="border-l-[#378ADD]" />
          <Card
            title="Required Hours"
            value={formatHours(requiredHours)}
            subtitle={mode === "daily" ? "Expected for selected day" : "Expected for selected week"}
            className="border-l-[#378ADD]"
          />
          <Card title="Remaining Hours" value={formatHours(remainingHours)} subtitle="Hours left to complete target" className="border-l-[#378ADD]" />
          <Card title="Rows in View" value={String(filteredTasks.length)} subtitle="Visible tasks for entry" className="border-l-[#185FA5]" />
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-col gap-3 md:flex-row md:items-center">
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search project, task or sub-task"
                className="w-full max-w-md rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-700 outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />

              {mode === "daily" && (
                <button
                  type="button"
                  onClick={handleCopyPreviousDay}
                  disabled={isDateReadOnly(selectedDate)}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                >
                  Copy Previous Day
                </button>
              )}

              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                View History
              </button>

              {canRaiseLateRequest && (
                <button
                  type="button"
                  onClick={handleOpenLateRequestModal}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                >
                  Request Late Entry
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isCurrentEntryWeek ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={currentActionBusy}
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  >
                    {savingAction === "draft" ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={currentActionBusy}
                    className="rounded-xl border border-[#378ADD] bg-white px-4 py-2.5 text-sm font-medium text-[#378ADD] transition hover:bg-[#E6F1FB] dark:border-[#378ADD] dark:bg-black dark:text-[#B5D4F4] dark:hover:bg-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingAction === "submit" ? "Submitting..." : "Submit Timesheet"}
                  </button>
                </>
              ) : isPastEntryWeek ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={historicalActionBusy}
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  >
                    {savingAction === "draft" ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyHistoricalWeek}
                    disabled={historicalActionBusy}
                    className="rounded-xl border border-[#378ADD] bg-white px-4 py-2.5 text-sm font-medium text-[#378ADD] transition hover:bg-[#E6F1FB] dark:border-[#378ADD] dark:bg-black dark:text-[#B5D4F4] dark:hover:bg-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCheckingHistoricalAccess
                      ? "Checking Access..."
                      : isHistoricalSubmitted
                      ? "Awaiting Approval"
                      : savingAction === "submit"
                      ? "Submitting..."
                      : "Submit Timesheet"}
                  </button>
                </>
              ) : null}
              
            </div>
          </div>

          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${statusClasses}`}>
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{statusTitle}</p>
                <p className="mt-1">{statusDescription}</p>
              </div>
              {savedWeek ? (
                <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
                  Updated {new Date(savedWeek.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>

          {submitMessage && (
            <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
              {submitMessage}
            </div>
          )}

          {shouldShowHistoricalControls && (
            <div className="mb-4 rounded-[1.6rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-black">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Historical Access</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        lateAccessItems.length > 0
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                          : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300"
                      }`}
                    >
                      {historicalAccessSummary}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
                      {historicalRequestSummary}
                    </span>
                  </div>
                </div>
                {canRaiseLateRequest ? (
                  <button
                    type="button"
                    onClick={handleOpenLateRequestModal}
                    className="rounded-full border border-zinc-200 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:border-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  >
                    Raise Request
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[1.35rem] border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Unlock Scope</p>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{lateAccessItems.length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {lateAccessItems.length > 0 ? (
                      lateAccessItems.map((item) => (
                        <div key={item.requestItemId} className="rounded-2xl border border-zinc-200/60 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-black">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatDateLabel(item.date)}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Expires {formatDateTimeLabel(item.unlockExpiresAtUtc)}</p>
                          </div>
                          <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">{item.projectName}</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.taskTitle}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-7 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        No access
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Recent Requests</p>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{lateRequestsLoading ? "..." : recentLateRequests.length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {lateRequestsLoading ? (
                      <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-7 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        Loading...
                      </div>
                    ) : recentLateRequests.length > 0 ? (
                      recentLateRequests.map((request) => (
                        <div key={request.id} className="rounded-2xl border border-zinc-200/60 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-black">
                          <div className="flex items-start justify-between gap-3">
                            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                              {request.overallStatus}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {request.items.length} item{request.items.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-sm text-zinc-700 dark:text-zinc-200">{request.reason}</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatDateTimeLabel(request.updatedAtUtc)}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-7 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        No requests
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-zinc-50 text-left text-sm font-semibold text-zinc-600 dark:bg-black dark:text-zinc-300">
                  <th className="sticky left-0 z-10 min-w-[320px] border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-black">
                    Project / Task / Sub-task
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={openProjectModal}
                        disabled={!canManageTaskSelection}
                        className="rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/30 dark:bg-black dark:text-zinc-400 dark:text-zinc-500"
                      >
                        Select task +
                      </button>
                    </div>
                  </th>
                  {visibleDates.map((date) => (
                    <th key={date} className="min-w-[220px] border border-zinc-100 px-4 py-3 text-center dark:border-zinc-800">
                      {formatDayHeader(date)}
                    </th>
                  ))}
                  <th className="min-w-[120px] border border-zinc-100 px-4 py-3 text-center dark:border-zinc-800">Row Total</th>
                  <th className="min-w-[120px] border border-zinc-100 px-4 py-3 text-center dark:border-zinc-800">Planned</th>
                  <th className="min-w-[120px] border border-zinc-100 px-4 py-3 text-center dark:border-zinc-800">Billable</th>
                </tr>
              </thead>

              <tbody>
                <tr className="bg-zinc-50 text-sm font-semibold text-zinc-700 dark:bg-black dark:text-zinc-200">
                  <td className="sticky left-0 z-10 border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-black">Summary</td>
                  {visibleDates.map((date) => (
                    <td key={date} className="border border-zinc-100 px-4 py-3 text-center dark:border-zinc-800">
                      {formatHours(totalsByDate[date] ?? 0)}
                    </td>
                  ))}
                  <td className="border border-zinc-100 px-4 py-3 text-center dark:border-zinc-800">{formatHours(totalEnteredHours)}</td>
                  <td className="border border-zinc-100 px-4 py-3 text-center dark:border-zinc-800">{formatHours(requiredHours)}</td>
                  <td className="border border-zinc-100 px-4 py-3 text-center dark:border-zinc-800">-</td>
                </tr>

                {filteredTasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleDates.length + 3}
                      className="border border-zinc-100 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
                    >
                      No timesheet tasks available right now.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr key={task.id} className="bg-white align-top dark:bg-black">
                      <td className="sticky left-0 z-10 border border-zinc-100 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-black">
                        <p className="font-semibold text-zinc-900 dark:text-white">{task.projectName}</p>
                        <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">{task.taskName}</p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{task.subTaskName}</p>
                        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{task.status}</p>
                      </td>

                      {visibleDates.map((date) => {
                        const key = `${task.id}:${date}`;
                        const draft = entryDrafts[key] ?? { hours: "", note: "" };
                        const isActive = activeCell?.taskId === task.id && activeCell?.date === date;
                        const cellError = errors[key];
                        const isOutsideTaskRange = !isTaskScheduledOnDate(task, date);
                        const readOnlyCell = isCellReadOnly(task, date) || isOutsideTaskRange;

                        if (isOutsideTaskRange) {
                          return (
                            <td key={date} className="border border-zinc-100 px-3 py-3 dark:border-zinc-800">
                              <div className="grid min-h-[116px] place-items-center rounded-xl bg-zinc-50 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300 dark:bg-black dark:text-zinc-600">
                                N/A
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={date} className="border border-zinc-100 px-3 py-3 dark:border-zinc-800">
                            <div className={`rounded-xl border bg-white p-3 dark:bg-black ${isActive ? "border-zinc-900 dark:border-brand-400" : "border-zinc-200 dark:border-zinc-700"}`}>
                              <input
                                value={draft.hours}
                                onFocus={() => setActiveCell({ taskId: task.id, date })}
                                onChange={(event) => updateEntry(task.id, date, { hours: event.target.value })}
                                placeholder="00:00"
                                disabled={readOnlyCell}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center text-sm font-medium text-zinc-800 outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-black dark:text-zinc-100 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                              />
                              <textarea
                                rows={3}
                                value={draft.note}
                                onFocus={() => setActiveCell({ taskId: task.id, date })}
                                onChange={(event) => updateEntry(task.id, date, { note: event.target.value })}
                                placeholder="Enter work note"
                                disabled={readOnlyCell}
                                className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-black dark:text-zinc-100 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                              />
                              {cellError && <p className="mt-2 text-xs font-medium text-rose-600">{cellError}</p>}
                            </div>
                          </td>
                        );
                      })}

                      <td className="border border-zinc-100 px-4 py-4 text-center text-sm font-semibold text-zinc-800 dark:border-zinc-800 dark:text-zinc-100">
                        {formatHours(rowTotal(task.id))}
                      </td>
                      <td className="border border-zinc-100 px-4 py-4 text-center text-sm font-semibold text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        {formatHours(task.plannedHours)}
                      </td>
                      <td className="border border-zinc-100 px-4 py-4 text-center text-sm font-semibold text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        {task.billable === null ? "-" : task.billable ? "Yes" : "No"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black">
          <h3 className="text-lg font-semibold text-[#185FA5] dark:text-[#B5D4F4]">Working Flow Overview</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              "Load assigned tasks",
              "Enter hours and note",
              isCurrentEntryWeek ? "Save draft or submit" : hasHistoricalAccess ? "Save draft or submit late entry" : "Request late entry access",
              "Review from history",
            ].map((item, index) => (
              <div key={item} className="rounded-xl border border-zinc-200/60 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-black dark:text-zinc-300">
                <span className="mr-2 font-semibold text-zinc-900 dark:text-white">{index + 1}.</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/35 p-4 backdrop-blur-sm">
          <div className="mx-auto max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-black">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
              <div>
                <h2 className="text-2xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">My Timesheet History</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Previously entered rows across days.</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                Close
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6">
              <div className="space-y-4">
                {historyEntries.map((entry) => (
                  <div key={entry.key} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-black">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white">{entry.projectName}</p>
                        <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                          {entry.taskName} · {entry.subTaskName}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{entry.date}</p>
                      </div>
                      <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                        {entry.hours}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{entry.note}</p>
                  </div>
                ))}

                {historyEntries.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    No history found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {lateRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl dark:border-zinc-800 dark:bg-black">
            <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Late Timesheet Entry</p>
                  <h2 className="mt-2 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">Request Historical Entry Access</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    Choose one or more previous dates, then review the exact project and task scope that will be routed to the mapped project Team Manager(s) for approval.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLateRequestModalOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
                  aria-label="Close late timesheet request"
                >
                  <Icon name="close" className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <div className="grid gap-6">
                <div className="space-y-5">
                  <section className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-black">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">1. Select Historical Dates</p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Past empty timesheet dates with available task scope.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllLateRequestDates}
                          disabled={lateRequestEligibleDatesLoading || lateRequestEligibleDateKeys.length === 0 || lateRequestAllDatesSelected}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={handleClearLateRequestDates}
                          disabled={lateRequestDates.length === 0}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1.5rem] border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-black">
                      {lateRequestEligibleDatesLoading ? (
                        <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          Loading available historical dates...
                        </div>
                      ) : lateRequestEligibleDates.length > 0 ? (
                        <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                          {lateRequestEligibleDates.map((dateOption) => {
                            const selected = lateRequestDates.includes(dateOption.date);

                            return (
                              <button
                                key={dateOption.date}
                                type="button"
                                aria-label={`${selected ? "Remove" : "Add"} ${formatDateLabel(dateOption.date)} from late timesheet request`}
                                title={`${selected ? "Remove" : "Add"} ${formatDateLabel(dateOption.date)} from late timesheet request`}
                                onClick={() => toggleLateRequestDate(dateOption.date)}
                                className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                                  selected
                                    ? "border-zinc-900 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-black"
                                    : "border-zinc-200 bg-zinc-50/80 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-black dark:text-white dark:hover:bg-zinc-900"
                                }`}
                              >
                                <span className="flex min-w-0 items-start gap-3">
                                  <span
                                    aria-hidden="true"
                                    className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                      selected
                                        ? "border-white bg-white text-zinc-950 dark:border-black dark:bg-black dark:text-white"
                                        : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-black"
                                    }`}
                                  >
                                    {selected ? <Icon name="approvals" className="h-3 w-3" /> : null}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold">{formatDateLabel(dateOption.date)}</span>
                                    <span className={`mt-1 block text-xs uppercase tracking-[0.16em] ${selected ? "text-white/75 dark:text-black/70" : "text-zinc-500 dark:text-zinc-400"}`}>
                                      {dateOption.projectCount} project(s) · {dateOption.taskCount} task line(s)
                                    </span>
                                  </span>
                                </span>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                  selected
                                    ? "bg-white/15 text-white dark:bg-black/10 dark:text-black"
                                    : "bg-white text-zinc-600 dark:bg-black dark:text-zinc-300"
                                }`}>
                                  {selected ? "Selected" : "Available"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          No empty historical dates are available for late-entry request.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {lateRequestDates.length > 0 ? (
                        lateRequestDates.map((date) => (
                          <button
                            key={date}
                            type="button"
                            onClick={() => toggleLateRequestDate(date)}
                            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                          >
                            {formatDateLabel(date)}
                            <Icon name="close" className="h-3.5 w-3.5" />
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">No historical date selected yet.</p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">2. Project / Task Scope</p>
                      {lateRequestOptionsLoading ? <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Loading...</p> : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                      Loaded scope is included automatically in the request. Review it below in table format.
                    </p>

                    <div className="mt-4">
                      {lateRequestOptions.length > 0 ? (
                        <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[780px] table-fixed border-collapse">
                              <thead className="bg-zinc-50/90 dark:bg-black text-zinc-300">
                                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                  <th className="w-[120px] px-4 py-3">Date</th>
                                  <th className="w-[220px] px-4 py-3">Project</th>
                                  <th className="w-[160px] px-4 py-3">Routed To</th>
                                  <th className="w-[200px] px-4 py-3">Task</th>
                                  <th className="w-[200px] px-4 py-3">Schedule</th>
                                  <th className="w-[96px] px-4 py-3 text-right">Scope</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-black">
                                {lateRequestScopeRows.map((row) =>
                                  row.kind === "empty" ? (
                                    <tr key={row.key} className="border-t border-zinc-200 dark:border-zinc-800">
                                      <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{formatDateLabel(row.date)}</td>
                                      <td colSpan={5} className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                                        {row.message}
                                      </td>
                                    </tr>
                                  ) : (
                                    <tr key={row.key} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">
                                        {formatDateLabel(row.date)}
                                      </td>
                                      <td className="break-words px-4 py-4 text-sm font-semibold leading-6 text-zinc-900 dark:text-white">{row.projectName}</td>
                                      <td className="break-words px-4 py-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{row.managerName}</td>
                                      <td className="break-words px-4 py-4 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{row.taskTitle}</td>
                                      <td className="px-4 py-4 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                                        <span className="block leading-5">{row.taskStatus}</span>
                                        <span className="mt-1 block text-[12px] normal-case leading-5 tracking-normal">{row.taskRange}</span>
                                      </td>
                                      <td className="px-4 py-4 text-right align-middle">
                                        <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
                                          Included
                                        </span>
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[1.5rem] border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          Select one or more previous dates to load the historical project and task scope.
                        </div>
                      )}
                    </div>

                    <div className="hidden">
                      {lateRequestOptions.length > 0 ? (
                        lateRequestOptions.map((dateOption) => (
                          <div key={dateOption.date} className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-black">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatDateLabel(dateOption.date)}</p>
                            <div className="mt-3 space-y-3">
                              {dateOption.projects.length > 0 ? (
                                dateOption.projects.map((projectOption) => (
                                  <div key={`${dateOption.date}-${projectOption.projectId}`} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <p className="font-semibold text-zinc-900 dark:text-white">{projectOption.projectName}</p>
                                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                                          Routed to {projectOption.managerName || "Mapped Team Manager"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                      {projectOption.tasks.map((taskOption) => {
                                        const selectionKey = `${dateOption.date}|${projectOption.projectId}|${taskOption.taskId}`;
                                        return (
                                          <div
                                            key={selectionKey}
                                            className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-black"
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <span className="min-w-0">
                                              <span className="block text-sm font-semibold text-zinc-900 dark:text-white">{taskOption.taskTitle}</span>
                                              <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                                                {taskOption.status} · {formatDateLabel(taskOption.startDate)} to {formatDateLabel(taskOption.endDate)}
                                              </span>
                                              </span>
                                              <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
                                                Included
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                                  No historical task mapping was found for this date.
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1.5rem] border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          Select one or more previous dates to load the historical project and task scope.
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-5">
                  <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">3. Request Details</p>
                    <label className="mt-4 block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Reason</span>
                      <textarea
                        rows={4}
                        value={lateRequestReason}
                        onChange={(event) => setLateRequestReason(event.target.value)}
                        placeholder="Example: not filled on time"
                        className="w-full rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                      />
                    </label>
                    <label className="mt-4 block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Additional Remarks</span>
                      <textarea
                        rows={5}
                        value={lateRequestRemarks}
                        onChange={(event) => setLateRequestRemarks(event.target.value)}
                        placeholder="Optional supporting context for the manager."
                        className="w-full rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                      />
                    </label>
                  </section>

                  <section className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-black">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Selection Summary</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-black">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Dates</p>
                        <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">{lateRequestDates.length}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-black">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Include Tasks</p>
                        <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">{lateRequestSelectionKeys.length}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      Each line shown in the scope is routed to the respective project manager. Approval unlocks only that exact historical date / project / task scope.
                    </p>
                  </section>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {lateRequestSelectionKeys.length} request line(s) ready to route for approval.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLateRequestModalOpen(false)}
                    className="rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitLateRequest}
                    disabled={lateRequestSubmitting || lateRequestSelectionKeys.length === 0 || !lateRequestReason.trim()}
                    className="rounded-2xl border border-[#378ADD] bg-white px-5 py-2.5 text-sm font-semibold text-[#378ADD] transition hover:bg-[#E6F1FB] dark:border-[#378ADD] dark:bg-black dark:text-[#B5D4F4] dark:hover:bg-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {lateRequestSubmitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {projectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,255,0.96))] shadow-2xl dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]">
            <div className="border-b border-zinc-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_38%),radial-gradient(circle_at_top_right,rgba(200,200,200,0.18),transparent_32%)] px-6 py-5 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_38%),radial-gradient(circle_at_top_right,rgba(200,200,200,0.14),transparent_32%)] sm:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-600 dark:text-zinc-400 dark:text-zinc-500">Task Picker</p>
                  <h3 className="mt-2 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">Select Project / Task</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    Choose a project, review the task window, and make only the tasks you need available inside your timesheet.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-right dark:border-zinc-800 dark:bg-black">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">Selected</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">{modalSelectedCount} task(s)</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeProjectModal}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white/90 text-zinc-500 transition hover:bg-white dark:border-zinc-700 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
                    aria-label="Close project and task picker"
                  >
                    <Icon name="close" className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <div>
                <section className="rounded-[1.75rem] border border-zinc-200 bg-white/90 p-5 shadow-sm dark:border-zinc-800 dark:bg-black">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Project</p>
                  <label className="mt-3 block">
                    <span className="mb-2 block text-sm font-medium text-zinc-600 dark:text-zinc-300">Choose a mapped project</span>
                    <select
                      value={selectedProjectId}
                      onChange={(event) => {
                        setSelectedProjectId(event.target.value);
                        setModalSelectedTaskIds([]);
                        setModalPreviewTaskId(null);
                      }}
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-700 outline-none transition focus:border-brand-400 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                    >
                      {assignedProjects.length === 0 && <option value="">--Select Project--</option>}
                      {assignedProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{projectDateRange}</p>
                </section>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.85fr)]">
                <section className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white/92 shadow-sm dark:border-zinc-800 dark:bg-black">
                  <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <label className="flex items-start gap-3">
                        <input
                          ref={modalTaskSelectAllRef}
                          type="checkbox"
                          checked={modalAllTasksSelected}
                          onChange={(event) => {
                            const projectTaskIds = projectTasks.map((task) => task.id);
                            const shouldSelect = event.target.checked;

                            setModalSelectedTaskIds((current) => {
                              if (shouldSelect) {
                                const next = new Set(current);
                                projectTaskIds.forEach((taskId) => next.add(taskId));
                                return Array.from(next);
                              }

                              const projectTaskIdSet = new Set(projectTaskIds);
                              return current.filter((taskId) => !projectTaskIdSet.has(taskId));
                            });
                          }}
                          className="mt-1 h-5 w-5 cursor-pointer rounded border-zinc-300 accent-brand-600"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-zinc-900 dark:text-white">Select All Tasks</span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400">Apply selection to the currently visible tasks in this project.</span>
                        </span>
                      </label>

                      <label className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-black">
                        <Icon name="search" className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                        <input
                          value={modalSearchText}
                          onChange={(event) => setModalSearchText(event.target.value)}
                          placeholder="Search tasks by title, note, or status"
                          className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200 dark:placeholder:text-zinc-500"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
                    {projectLoading ? (
                      <div className="grid min-h-[280px] place-items-center rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/70 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-400">
                        Loading projects and tasks...
                      </div>
                    ) : modalFilteredTasks.length === 0 ? (
                      <div className="grid min-h-[280px] place-items-center rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/70 px-6 text-center dark:border-zinc-700 dark:bg-black">
                        <div>
                          <p className="text-base font-semibold text-zinc-900 dark:text-white">No tasks found</p>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                            {selectedProjectId ? "This project does not have matching tasks right now." : "Choose a project first to load its task list."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      modalFilteredTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`rounded-2xl border p-4 transition ${
                            modalPreviewTaskId === task.id
                              ? "border-brand-300 bg-brand-50/70 shadow-sm dark:border-brand-500/40 dark:bg-brand-500/10"
                              : modalSelectedTaskIds.includes(task.id)
                                ? "border-zinc-200 bg-zinc-100 dark:border-sky-500/30 dark:bg-sky-500/10"
                                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={modalSelectedTaskIds.includes(task.id)}
                              aria-label={`Select task ${task.title}`}
                              title={`Select task ${task.title}`}
                              onChange={() =>
                                setModalSelectedTaskIds((current) =>
                                  current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id],
                                )
                              }
                              className="mt-1 h-5 w-5 cursor-pointer rounded border-zinc-300 accent-brand-600"
                            />
                            <button
                              type="button"
                              onClick={() => setModalPreviewTaskId(task.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{task.title}</p>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getTaskStatusBadgeClasses(task.status)}`}>
                                  {task.status}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {formatDateLabel(task.startDate)} to {formatDateLabel(task.endDate)}
                              </p>
                              <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
                                {task.description || "No task description added yet."}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalPreviewTaskId(task.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
                              aria-label={`Preview ${task.title}`}
                            >
                              <Icon name="eye" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,255,0.94))] p-5 shadow-sm dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.92),rgba(0,0,0,0.96))]">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">Task Snapshot</p>
                  {previewTask ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-[1.5rem] border border-zinc-200 bg-white/90 p-5 dark:border-zinc-800 dark:bg-black">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-lg font-semibold text-zinc-900 dark:text-white">{previewTask.title}</p>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{previewTask.projectName}</p>
                          </div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getTaskStatusBadgeClasses(previewTask.status)}`}>
                            {previewTask.status}
                          </span>
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {[
                            ["Start Date", formatDateLabel(previewTask.startDate)],
                            ["Due Date", formatDateLabel(previewTask.endDate)],
                            ["Planned Hours", formatHours(previewTask.totalHours)],
                            ["Task Window", `${formatDateLabel(previewTask.startDate)} - ${formatDateLabel(previewTask.endDate)}`],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl border border-zinc-200/60 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-black">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">{label}</p>
                              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-zinc-200 bg-white/90 p-5 dark:border-zinc-800 dark:bg-black">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Description</p>
                        <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                          {previewTask.description || "No task description available."}
                        </p>
                      </div>

                      <div className="rounded-[1.5rem] border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-zinc-400 dark:text-zinc-500">
                        This task will only be available in timesheet entry during its scheduled start and due date range.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid min-h-[420px] place-items-center rounded-[1.75rem] border border-dashed border-zinc-300 bg-zinc-50/70 px-6 text-center dark:border-zinc-700 dark:bg-black">
                      <div>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-zinc-400 shadow-sm dark:bg-black dark:text-zinc-500">
                          <Icon name="eye" className="h-6 w-6" />
                        </div>
                        <p className="mt-4 text-base font-semibold text-zinc-900 dark:text-white">Task preview will appear here</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                          Select a task from the left list to review its dates, workload, and description before adding it.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-white/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {modalSelectedCount} task(s) selected{selectedProject ? ` from ${selectedProject.name}` : ""}.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeProjectModal}
                    className="rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTaskIds(Array.from(new Set([...lockedSavedTaskIds, ...modalSelectedTaskIds])));
                      setProjectModalOpen(false);
                    }}
                    disabled={!selectedProjectId}
                    className="rounded-2xl border border-[#378ADD] bg-white px-5 py-2.5 text-sm font-semibold text-[#378ADD] transition hover:bg-[#E6F1FB] dark:border-[#378ADD] dark:bg-black dark:text-[#B5D4F4] dark:hover:bg-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Select Tasks
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const TimesheetPage = ({ user }: { user: AuthUser }) => {
  return <EmployeeTimesheetWorkspace user={user} />;
};

export default TimesheetPage;

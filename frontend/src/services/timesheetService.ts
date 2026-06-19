import type { TimesheetRow, TimesheetWeek, TimesheetWeekRecord } from "../types/timesheet";
import { getCurrentAdminContext } from "./adminContext";
import { apiRequest } from "./http";

const STORAGE_KEY = "timesheet-week-records";
const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

// ─── localStorage read-cache helpers ────────────────────────────────────────

const getStoredWeeks = (): TimesheetWeek[] => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TimesheetWeek[];
  } catch {
    return [];
  }
};

const setStoredWeeks = (weeks: TimesheetWeek[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(weeks));
};

// ─── API type mapping ────────────────────────────────────────────────────────

type ApiTimesheetWeek = {
  id: string;
  userId: string;
  adminId: string;
  adminName: string;
  status: TimesheetWeek["status"];
  managerApprovalStatus: TimesheetWeek["managerApprovalStatus"];
  adminApprovalStatus: TimesheetWeek["adminApprovalStatus"];
  approvedBy: string;
  approvalFlowType: string;
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  rowsJson: string;
  updatedAtUtc: string;
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekEnd = (weekStart: string) => {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return formatDateInput(end);
};

const getStoredWeekUserId = (week: TimesheetWeek | TimesheetWeekRecord, fallbackUserId = DEFAULT_USER_ID) =>
  "userId" in week && typeof week.userId === "string" && week.userId ? week.userId : fallbackUserId;

const isMatchingStoredWeek = (week: TimesheetWeek | TimesheetWeekRecord, weekStart: string, userId = DEFAULT_USER_ID) =>
  week.weekStart === weekStart && getStoredWeekUserId(week, userId) === userId;

const mapApiWeek = (week: ApiTimesheetWeek): TimesheetWeekRecord => ({
  id: week.id,
  userId: week.userId,
  weekStart: week.weekStart.slice(0, 10),
  weekEnd: week.weekEnd.slice(0, 10),
  adminId: week.adminId ?? DEFAULT_USER_ID,
  adminName: week.adminName ?? "",
  status: week.status,
  managerApprovalStatus: week.managerApprovalStatus ?? "Pending",
  adminApprovalStatus: week.adminApprovalStatus ?? "Pending",
  approvedBy: week.approvedBy ?? "",
  approvalFlowType: week.approvalFlowType ?? "Standard",
  totalHours: Number(week.totalHours ?? 0),
  rows: JSON.parse(week.rowsJson) as TimesheetRow[],
  updatedAt: week.updatedAtUtc,
});

const mapStoredWeek = (week: TimesheetWeek, userId = DEFAULT_USER_ID): TimesheetWeekRecord => {
  return {
    ...week,
    userId: getStoredWeekUserId(week, userId),
    weekEnd: getWeekEnd(week.weekStart),
    totalHours: week.rows.reduce(
      (sum, row) => sum + Object.values(row.hours).reduce((rowSum, hours) => rowSum + Number(hours || 0), 0),
      0,
    ),
  };
};

export const createEmptyTimesheetRow = (projectId = "", projectName = "Select Project"): TimesheetRow => ({
  id: crypto.randomUUID(),
  projectId,
  projectName,
  taskName: "",
  notes: "",
  billable: true,
  hours: {},
});

// ─── Timesheet Service ────────────────────────────────────────────────────────

export const timesheetService = {
  /**
   * Gets a specific week's timesheet from the backend.
   * Falls back to localStorage cache on failure.
   */
  async getWeek(weekStart: string, userId = DEFAULT_USER_ID) {
    try {
      const week = await apiRequest<ApiTimesheetWeek | undefined>(
        `/weekly-timesheets/by-user-week?weekStart=${encodeURIComponent(weekStart)}&userId=${userId}`,
      );
      if (!week) {
        const stored = getStoredWeeks().find((item) => isMatchingStoredWeek(item, weekStart, userId));
        return stored ? mapStoredWeek(stored, userId) : null;
      }
      const mapped = mapApiWeek(week);
      const weeks = getStoredWeeks().filter((item) => !isMatchingStoredWeek(item, mapped.weekStart, mapped.userId));
      setStoredWeeks([mapped, ...weeks]);
      return mapped;
    } catch {
      const weeks = getStoredWeeks();
      const stored = weeks.find((week) => isMatchingStoredWeek(week, weekStart, userId));
      return stored ? mapStoredWeek(stored, userId) : null;
    }
  },

  /**
   * Saves a weekly timesheet to the backend. Throws on failure — no silent local save.
   */
  async saveWeek(week: Omit<TimesheetWeek, "id" | "updatedAt" | "adminId" | "adminName">, userId = DEFAULT_USER_ID) {
    const totalHours = week.rows.reduce(
      (sum, row) => sum + Object.values(row.hours).reduce((rowSum, hours) => rowSum + Number(hours || 0), 0),
      0,
    );
    const adminContext = getCurrentAdminContext();
    const saved = await apiRequest<ApiTimesheetWeek>("/weekly-timesheets", {
      method: "POST",
      body: JSON.stringify({
        userId,
        ...adminContext,
        weekStart: week.weekStart,
        status: week.status,
        managerApprovalStatus: week.managerApprovalStatus,
        adminApprovalStatus: week.adminApprovalStatus,
        approvedBy: week.approvedBy,
        approvalFlowType: week.approvalFlowType,
        totalHours,
        rowsJson: JSON.stringify(week.rows),
      }),
    });
    const mapped = mapApiWeek(saved);
    const weeks = getStoredWeeks().filter((item) => !isMatchingStoredWeek(item, mapped.weekStart, mapped.userId));
    setStoredWeeks([mapped, ...weeks]);
    return mapped;
  },

  async applyHistoricalWeek(weekStart: string, rows: TimesheetRow[], userId = DEFAULT_USER_ID) {
    const saved = await apiRequest<ApiTimesheetWeek>("/weekly-timesheets/historical-apply", {
      method: "POST",
      body: JSON.stringify({
        userId,
        weekStart,
        rowsJson: JSON.stringify(rows),
      }),
    });
    const mapped = mapApiWeek(saved);
    const weeks = getStoredWeeks().filter((item) => !isMatchingStoredWeek(item, mapped.weekStart, mapped.userId));
    setStoredWeeks([mapped, ...weeks]);
    return mapped;
  },

  saveHistoricalDraft(weekStart: string, rows: TimesheetRow[], userId = DEFAULT_USER_ID) {
    const adminContext = getCurrentAdminContext();
    const totalHours = rows.reduce(
      (sum, row) => sum + Object.values(row.hours).reduce((rowSum, hours) => rowSum + Number(hours || 0), 0),
      0,
    );
    const draft: TimesheetWeekRecord = {
      id: `historical-draft-${userId}-${weekStart}`,
      userId,
      adminId: adminContext.adminId,
      adminName: adminContext.adminName,
      weekStart,
      weekEnd: getWeekEnd(weekStart),
      status: "Draft",
      managerApprovalStatus: "Pending",
      adminApprovalStatus: "Pending",
      approvedBy: "",
      approvalFlowType: "Standard",
      totalHours,
      rows,
      updatedAt: new Date().toISOString(),
    };
    const weeks = getStoredWeeks().filter((item) => !isMatchingStoredWeek(item, weekStart, userId));
    setStoredWeeks([draft, ...weeks]);
    return draft;
  },

  /**
   * Lists all weekly timesheets from the backend.
   * Falls back to localStorage cache on failure.
   */
  async listWeeks(userId?: string) {
    try {
      const weeks = await apiRequest<ApiTimesheetWeek[]>("/weekly-timesheets");
      const mapped = weeks.map(mapApiWeek);
      if (mapped.length === 0) {
        const cachedWeeks = getStoredWeeks().map((week) => mapStoredWeek(week, userId ?? DEFAULT_USER_ID));
        if (cachedWeeks.length > 0) {
          return userId ? cachedWeeks.filter((week) => week.userId === userId) : cachedWeeks;
        }
      }

      setStoredWeeks(mapped);
      return userId ? mapped.filter((week) => week.userId === userId) : mapped;
    } catch {
      return getStoredWeeks().map((week) => mapStoredWeek(week, userId ?? DEFAULT_USER_ID));
    }
  },

  /**
   * Deletes a weekly timesheet from the backend. Throws on failure — no silent local delete.
   */
  async deleteWeek(id: string) {
    await apiRequest<void>(`/weekly-timesheets/${id}`, { method: "DELETE" });
    setStoredWeeks(getStoredWeeks().filter((week) => (week as TimesheetWeekRecord).id !== id));
  },
};

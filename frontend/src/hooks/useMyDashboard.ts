import { useCallback, useEffect, useMemo, useState } from "react";
import { workspaceRoutes } from "../config/workspaceNavigation";
import { DAILY_WORK_HOURS as HOURS_PER_DAY, WEEKLY_WORK_HOURS } from "../constants/timesheet";
import { useEmployees } from "./useEmployees";
import { activityService } from "../services/activityService";
import { leaveService } from "../services/leaveService";
import { taskService } from "../services/taskService";
import { timesheetService } from "../services/timesheetService";
import type { DateRangeFilter } from "../types/dashboard";
import type { AuthUser } from "../types/auth";
import type {
  MyDashboardApprovalTask,
  MyDashboardData,
  MyDashboardHoursPoint,
  MyDashboardKpis,
  MyDashboardProjectHours,
  MyDashboardRecentActivity,
  MyDashboardTimesheetStatus,
} from "../types/myDashboard";
import type { ActivityLoginRow } from "../types/activity";
import type { LeaveRequest, LeaveTypeDefinition } from "../types/leave";
import type { DailyTimesheet } from "../types/task";
import type { TimesheetWeekRecord } from "../types/timesheet";

type ResolvedDateRange = {
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  label: string;
  previousStart: Date;
  previousEnd: Date;
};

const OVERDUE_DAYS = 2;
const LOGIN_PAGE_SIZE = 200;

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
};

const formatDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const parseDateTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? parseDateOnly(value) : parsed;
};

const getWeekStart = (value: Date) => {
  const normalized = startOfDay(value);
  const offset = (normalized.getDay() + 6) % 7;
  return addDays(normalized, -offset);
};

const getWeekEnd = (value: Date) => addDays(getWeekStart(value), 6);

const getMonthStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

const getMonthEnd = (value: Date) => new Date(value.getFullYear(), value.getMonth() + 1, 0);

const getDateDiffInDays = (start: Date, end: Date) =>
  Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000);

const dateFallsWithin = (value: string, start: Date, end: Date) => {
  const target = startOfDay(parseDateTime(value));
  return target >= start && target <= end;
};

const dateKeyFallsWithin = (value: string, startKey: string, endKey: string) => value >= startKey && value <= endKey;

const rangeOverlaps = (startKey: string, endKey: string, targetStartKey: string, targetEndKey: string) =>
  startKey <= targetEndKey && endKey >= targetStartKey;

const buildRangeLabel = (start: Date, end: Date) =>
  `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;

const resolveDateRange = (filter: DateRangeFilter): ResolvedDateRange => {
  const today = startOfDay(new Date());
  let start = getWeekStart(today);
  let end = getWeekEnd(today);

  if (filter.range === "today") {
    start = today;
    end = today;
  } else if (filter.range === "this_month") {
    start = getMonthStart(today);
    end = getMonthEnd(today);
  } else if (filter.range === "custom" && filter.startDate && filter.endDate) {
    const parsedStart = parseDateOnly(filter.startDate);
    const parsedEnd = parseDateOnly(filter.endDate);
    if (!Number.isNaN(parsedStart.getTime()) && !Number.isNaN(parsedEnd.getTime()) && parsedStart <= parsedEnd) {
      start = parsedStart;
      end = parsedEnd;
    }
  }

  const span = getDateDiffInDays(start, end) + 1;
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(span - 1));

  return {
    start,
    end,
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
    label: buildRangeLabel(start, end),
    previousStart,
    previousEnd,
  };
};

const normalizeDailyStatus = (status: string): keyof MyDashboardTimesheetStatus => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "submitted") return "submitted";
  if (normalized === "resubmitted") return "resubmitted";
  return "draft";
};

const getAgeInDays = (value: string) => Math.max(0, getDateDiffInDays(parseDateTime(value), startOfDay(new Date())));

const emptyKpis = (): MyDashboardKpis => ({
  hoursLogged: 0,
  draftEntries: 0,
  pendingApprovals: 0,
  rejectedEntries: 0,
  leaveBalance: 0,
  completedApprovalActions: 0,
});

const collectProjectHours = (timesheets: TimesheetWeekRecord[], startKey: string, endKey: string) => {
  const projectHours = new Map<string, MyDashboardProjectHours>();

  timesheets
    .filter((timesheet) => {
      const normalized = timesheet.status.trim().toLowerCase();
      return normalized === "submitted" || normalized === "approved" || normalized === "rejected";
    })
    .forEach((timesheet) => {
      timesheet.rows.forEach((row) => {
        const hours = Object.entries(row.hours).reduce(
          (sum, [dateKey, value]) => (dateKeyFallsWithin(dateKey, startKey, endKey) ? sum + Number(value || 0) : sum),
          0,
        );

        if (hours <= 0) {
          return;
        }

        const key = row.projectName?.trim() || "Admin Tasks";
        projectHours.set(key, {
          projectName: key,
          hours: Number(((projectHours.get(key)?.hours ?? 0) + hours).toFixed(1)),
        });
      });
    });

  return Array.from(projectHours.values()).sort((left, right) => right.hours - left.hours).slice(0, 6);
};

export const useMyDashboard = (user: AuthUser, filter: DateRangeFilter) => {
  const { employees, loading: employeesLoading, reload: reloadEmployees } = useEmployees();
  const [dailyTimesheets, setDailyTimesheets] = useState<DailyTimesheet[]>([]);
  const [weeklyTimesheets, setWeeklyTimesheets] = useState<TimesheetWeekRecord[]>([]);
  const [allWeeklyTimesheets, setAllWeeklyTimesheets] = useState<TimesheetWeekRecord[]>([]);
  const [personalLeaves, setPersonalLeaves] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDefinition[]>([]);
  const [activityLogins, setActivityLogins] = useState<ActivityLoginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const range = useMemo(() => resolveDateRange(filter), [filter]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [daily, personalWeeks, allWeeks, leaves, allLeaveRequests, types, logins] = await Promise.all([
        taskService.getDailyTimesheetHistory(user.id),
        timesheetService.listWeeks(user.id),
        timesheetService.listWeeks(),
        leaveService.getLeaves({ employeeId: user.id }),
        leaveService.getLeaves(),
        leaveService.getLeaveTypes(),
        activityService.getLogins({
          page: 1,
          pageSize: LOGIN_PAGE_SIZE,
          fromDate: range.startKey,
          toDate: range.endKey,
          search: user.email,
        }),
      ]);

      setDailyTimesheets(daily);
      setWeeklyTimesheets(personalWeeks);
      setAllWeeklyTimesheets(allWeeks);
      setPersonalLeaves(leaves);
      setAllLeaves(allLeaveRequests);
      setLeaveTypes(types.filter((item) => item.active));
      setActivityLogins(logins.items.filter((item) => item.userId === user.id || item.email.toLowerCase() === user.email.toLowerCase()));
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      setError("Some personal dashboard data could not be refreshed right now. Showing the latest available records.");
    } finally {
      setLoading(false);
    }
  }, [range.endKey, range.startKey, user.email, user.id]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const refresh = useCallback(async () => {
    await Promise.all([reloadEmployees(), loadDashboardData()]);
  }, [loadDashboardData, reloadEmployees]);

  const data = useMemo<MyDashboardData>(() => {
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee.fullName]));
    const personalDailyInRange = dailyTimesheets.filter((item) => dateFallsWithin(item.date, range.start, range.end));
    const personalDailyInPreviousRange = dailyTimesheets.filter((item) =>
      dateFallsWithin(item.date, range.previousStart, range.previousEnd),
    );
    const personalWeeksInRange = weeklyTimesheets.filter((item) =>
      rangeOverlaps(item.weekStart, item.weekEnd, range.startKey, range.endKey),
    );

    const weeklyHours: MyDashboardHoursPoint[] = [];
    for (let cursor = range.start; cursor <= range.end; cursor = addDays(cursor, 1)) {
      const dateKey = formatDateKey(cursor);
      const actualHours = personalDailyInRange
        .filter((item) => item.date === dateKey)
        .reduce((sum, item) => sum + Number(item.totalHours || 0), 0);
      weeklyHours.push({
        label:
          getDateDiffInDays(range.start, range.end) <= 7
            ? cursor.toLocaleDateString("en-GB", { weekday: "short" })
            : cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        expectedHours: cursor.getDay() === 0 ? 0 : HOURS_PER_DAY,
        actualHours: Number(actualHours.toFixed(1)),
      });
    }

    const timesheetStatus: MyDashboardTimesheetStatus = {
      draft: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      resubmitted: 0,
    };

    personalDailyInRange.forEach((item) => {
      timesheetStatus[normalizeDailyStatus(item.status)] += 1;
    });

    const pendingTimesheetApprovals = allWeeklyTimesheets.filter(
      (item) =>
        item.userId !== user.id &&
        item.status === "Submitted" &&
        rangeOverlaps(item.weekStart, item.weekEnd, range.startKey, range.endKey),
    );
    const pendingLeaveApprovals = allLeaves.filter(
      (item) =>
        item.employeeId !== user.id &&
        item.status === "Pending" &&
        rangeOverlaps(item.startDate, item.endDate, range.startKey, range.endKey),
    );
    const overdueApprovals = pendingTimesheetApprovals.filter((item) => getAgeInDays(item.updatedAt) >= OVERDUE_DAYS).length;
    const overdueLeaveApprovals = pendingLeaveApprovals.filter((item) => getAgeInDays(item.createdAt) >= OVERDUE_DAYS).length;
    const escalatedApprovals = pendingTimesheetApprovals.filter((item) => Number(item.totalHours || 0) > WEEKLY_WORK_HOURS).length;

    const completedApprovalActions = allWeeklyTimesheets.filter(
      (item) =>
        item.userId !== user.id &&
        item.adminId === user.id &&
        (item.status === "Approved" || item.status === "Rejected") &&
        dateFallsWithin(item.updatedAt, range.start, range.end),
    ).length;
    const completedApprovalActionsPrevious = allWeeklyTimesheets.filter(
      (item) =>
        item.userId !== user.id &&
        item.adminId === user.id &&
        (item.status === "Approved" || item.status === "Rejected") &&
        dateFallsWithin(item.updatedAt, range.previousStart, range.previousEnd),
    ).length;

    const currentYear = new Date().getFullYear();
    const personalLeavesThisYear = personalLeaves.filter((item) => {
      const startYear = parseDateOnly(item.startDate).getFullYear();
      const endYear = parseDateOnly(item.endDate).getFullYear();
      return startYear === currentYear || endYear === currentYear;
    });

    const leaveSummary = {
      totalBalance: 0,
      used: 0,
      pending: personalLeaves.filter((item) => item.status === "Pending").length,
      upcoming:
        personalLeaves
          .filter((item) => item.status === "Approved" && parseDateOnly(item.startDate) >= startOfDay(new Date()))
          .sort((left, right) => left.startDate.localeCompare(right.startDate))[0]?.startDate ?? null,
      byType: leaveTypes.map((leaveType) => {
        const relevant = personalLeavesThisYear.filter((item) => item.type === leaveType.name);
        const used = relevant
          .filter((item) => item.status === "Approved")
          .reduce((sum, item) => sum + item.days, 0);
        const balance = Math.max(leaveType.annualAllocation - used, 0);
        return {
          leaveType: leaveType.name,
          allocation: leaveType.annualAllocation,
          used,
          balance,
        };
      }),
    };

    leaveSummary.totalBalance = leaveSummary.byType.reduce((sum, item) => sum + item.balance, 0);
    leaveSummary.used = leaveSummary.byType.reduce((sum, item) => sum + item.used, 0);

    const kpis: MyDashboardKpis = {
      hoursLogged: Number(
        personalDailyInRange.reduce((sum, item) => sum + Number(item.totalHours || 0), 0).toFixed(1),
      ),
      draftEntries: personalDailyInRange.filter((item) => normalizeDailyStatus(item.status) === "draft").length,
      pendingApprovals: pendingTimesheetApprovals.length + pendingLeaveApprovals.length,
      rejectedEntries: personalDailyInRange.filter((item) => normalizeDailyStatus(item.status) === "rejected").length,
      leaveBalance: leaveSummary.totalBalance,
      completedApprovalActions,
    };

    const previousKpis: MyDashboardKpis = {
      hoursLogged: Number(
        personalDailyInPreviousRange.reduce((sum, item) => sum + Number(item.totalHours || 0), 0).toFixed(1),
      ),
      draftEntries: personalDailyInPreviousRange.filter((item) => normalizeDailyStatus(item.status) === "draft").length,
      pendingApprovals:
        allWeeklyTimesheets.filter(
          (item) =>
            item.userId !== user.id &&
            item.status === "Submitted" &&
            rangeOverlaps(
              item.weekStart,
              item.weekEnd,
              formatDateKey(range.previousStart),
              formatDateKey(range.previousEnd),
            ),
        ).length +
        allLeaves.filter(
          (item) =>
            item.employeeId !== user.id &&
            item.status === "Pending" &&
            rangeOverlaps(
              item.startDate,
              item.endDate,
              formatDateKey(range.previousStart),
              formatDateKey(range.previousEnd),
            ),
        ).length,
      rejectedEntries: personalDailyInPreviousRange.filter((item) => normalizeDailyStatus(item.status) === "rejected").length,
      leaveBalance: leaveSummary.totalBalance,
      completedApprovalActions: completedApprovalActionsPrevious,
    };

    const approvalTasks: MyDashboardApprovalTask[] = [
      {
        id: "timesheet-approvals",
        type: "timesheet",
        title: "Timesheet approvals",
        subtitle: "Awaiting review",
        count: pendingTimesheetApprovals.length,
        severity: pendingTimesheetApprovals.length > 0 ? "medium" : "low",
        actionUrl: workspaceRoutes["approval-inbox"].path,
      },
      {
        id: "leave-approvals",
        type: "leave",
        title: "Leave requests",
        subtitle: "Awaiting review",
        count: pendingLeaveApprovals.length,
        severity: pendingLeaveApprovals.length > 0 ? "medium" : "low",
        actionUrl: workspaceRoutes["leave-summary-report"].path,
      },
      {
        id: "overdue-approvals",
        type: "overdue",
        title: "Overdue approvals",
        subtitle: "Past SLA",
        count: overdueApprovals + overdueLeaveApprovals,
        severity: overdueApprovals + overdueLeaveApprovals > 0 ? "high" : "low",
        actionUrl: workspaceRoutes["approval-inbox"].path,
      },
      {
        id: "escalated-approvals",
        type: "escalated",
        title: "Heavy-week approvals",
        subtitle: "Large-hour submissions",
        count: escalatedApprovals,
        severity: escalatedApprovals > 0 ? "medium" : "low",
        actionUrl: workspaceRoutes["approval-inbox"].path,
      },
    ];

    const recentActivities: MyDashboardRecentActivity[] = [
      ...weeklyTimesheets
        .filter((item) => dateFallsWithin(item.updatedAt, range.start, range.end))
        .map((item) => ({
          id: `my-timesheet-${item.id}`,
          category: "timesheet" as const,
          title:
            item.status === "Approved"
              ? "Approved timesheet"
              : item.status === "Rejected"
                ? "Updated rejected timesheet"
                : item.status === "Submitted"
                  ? "Submitted timesheet"
                  : "Updated timesheet draft",
          description: `${item.weekStart} to ${item.weekEnd}`,
          timestamp: item.updatedAt,
          actionUrl: workspaceRoutes["timesheet-history"].path,
        })),
      ...allWeeklyTimesheets
        .filter(
          (item) =>
            item.userId !== user.id &&
            item.adminId === user.id &&
            (item.status === "Approved" || item.status === "Rejected") &&
            dateFallsWithin(item.updatedAt, range.start, range.end),
        )
        .map((item) => ({
          id: `approval-${item.id}`,
          category: "approval" as const,
          title: `${item.status === "Approved" ? "Approved" : "Rejected"} team timesheet`,
          description: `${employeeMap.get(item.userId) ?? "Employee"} | ${item.weekStart} to ${item.weekEnd}`,
          timestamp: item.updatedAt,
          actionUrl: workspaceRoutes["approval-inbox"].path,
        })),
      ...personalLeaves
        .filter((item) => dateFallsWithin(item.createdAt, range.start, range.end))
        .map((item) => ({
          id: `leave-${item.id}`,
          category: "leave" as const,
          title:
            item.status === "Pending"
              ? "Requested leave"
              : item.status === "Approved"
                ? "Leave approved"
                : "Leave request rejected",
          description: `${item.type} | ${item.startDate} to ${item.endDate}`,
          timestamp: item.createdAt,
          actionUrl: workspaceRoutes["leave-history"].path,
        })),
      ...activityLogins.map((item) => ({
        id: `activity-${item.id}`,
        category: "activity" as const,
        title: item.status.toLowerCase().includes("success") ? "Signed in" : "Sign-in attempt",
        description: `${item.city || item.location || "Unknown location"} | ${item.deviceType || item.browser || "Unknown device"}`,
        timestamp: item.loginTime,
        actionUrl: workspaceRoutes.activity.path,
      })),
    ]
      .sort((left, right) => parseDateTime(right.timestamp).getTime() - parseDateTime(left.timestamp).getTime())
      .slice(0, 8);

    return {
      kpis,
      previousKpis,
      weeklyHours,
      timesheetStatus,
      approvalTasks,
      recentActivities,
      projectHours: collectProjectHours(personalWeeksInRange, range.startKey, range.endKey),
      leaveSummary,
      meta: {
        rangeLabel: range.label,
        lastUpdatedAt,
        focusNote: "Personal dashboard built from your own time logs, leave records, assigned actions, and recent approvals.",
      },
    };
  }, [
    activityLogins,
    allLeaves,
    allWeeklyTimesheets,
    dailyTimesheets,
    employees,
    lastUpdatedAt,
    leaveTypes,
    personalLeaves,
    range,
    user.id,
    weeklyTimesheets,
  ]);

  return {
    data,
    loading: loading || employeesLoading,
    error,
    refresh,
  };
};

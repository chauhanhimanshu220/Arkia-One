import { useCallback, useEffect, useMemo, useState } from "react";
import { DAILY_WORK_HOURS as HOURS_PER_DAY } from "../constants/timesheet";
import { useEmployees } from "./useEmployees";
import { useProjects } from "./useProjects";
import { activityService } from "../services/activityService";
import { leaveService } from "../services/leaveService";
import { taskService } from "../services/taskService";
import { timesheetService } from "../services/timesheetService";
import { workspaceRoutes } from "../config/workspaceNavigation";
import type { ActivityLoginRow } from "../types/activity";
import type { DateRangeFilter, SystemDashboardActivityItem, SystemDashboardAlert, SystemDashboardData, SystemDashboardKpis, SystemDashboardProjectHours, SystemDashboardTrendPoint } from "../types/dashboard";
import type { Employee } from "../types/employee";
import type { LeaveRequest } from "../types/leave";
import type { Project } from "../types/project";
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

const SYSTEM_ACTIVITY_PAGE_SIZE = 500;
const OVERTIME_THRESHOLD = 10;
const STUCK_APPROVAL_DAYS = 3;

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

const getBusinessDayCount = (start: Date, end: Date) => {
  let count = 0;
  for (let cursor = startOfDay(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const day = cursor.getDay();
    if (day !== 0) {
      count += 1;
    }
  }
  return Math.max(count, 1);
};

const buildRangeLabel = (start: Date, end: Date) =>
  `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;

const resolveDateRange = (filter: DateRangeFilter): ResolvedDateRange => {
  const today = startOfDay(new Date());

  let start = getMonthStart(today);
  let end = getMonthEnd(today);

  if (filter.range === "today") {
    start = today;
    end = today;
  } else if (filter.range === "this_week") {
    start = getWeekStart(today);
    end = getWeekEnd(today);
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

const dateFallsWithin = (value: Date | string, start: Date, end: Date) => {
  const target = typeof value === "string" ? parseDateTime(value) : value;
  const normalized = startOfDay(target);
  return normalized >= start && normalized <= end;
};

const dateKeyFallsWithin = (value: string, startKey: string, endKey: string) => value >= startKey && value <= endKey;

const rangeOverlaps = (startKey: string, endKey: string, targetStartKey: string, targetEndKey: string) =>
  startKey <= targetEndKey && endKey >= targetStartKey;

const normalizeDailyStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "approved") {
    return "approved";
  }
  if (normalized === "rejected") {
    return "rejected";
  }
  if (normalized === "pending") {
    return "pending";
  }
  if (normalized === "resubmitted") {
    return "resubmitted";
  }
  if (normalized === "submitted") {
    return "submitted";
  }
  return "draft";
};

const normalizeWeeklyStatus = (status: string) => status.trim().toLowerCase();

const isWeeklySubmittedLike = (status: string) => {
  const normalized = normalizeWeeklyStatus(status);
  return normalized === "submitted" || normalized === "approved" || normalized === "rejected";
};

const isDailySubmittedLike = (status: string) => normalizeDailyStatus(status) !== "draft";

const getBucketKey = (date: Date, bucketSize: "day" | "week") =>
  bucketSize === "day" ? formatDateKey(date) : formatDateKey(getWeekStart(date));

const buildTimeBuckets = (start: Date, end: Date) => {
  const totalDays = getDateDiffInDays(start, end) + 1;
  const bucketSize: "day" | "week" = totalDays <= 14 ? "day" : "week";
  const buckets = new Map<string, SystemDashboardTrendPoint>();

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const bucketKey = getBucketKey(cursor, bucketSize);
    if (buckets.has(bucketKey)) {
      continue;
    }

    const label =
      bucketSize === "day"
        ? cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        : `${getWeekStart(cursor).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} - ${getWeekEnd(cursor).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;

    buckets.set(bucketKey, {
      label,
      draft: 0,
      submitted: 0,
      pendingApproval: 0,
      approved: 0,
      rejected: 0,
      resubmitted: 0,
    });
  }

  return { bucketSize, buckets };
};

const toEmployeeMap = (employees: Employee[]) => new Map(employees.map((employee) => [employee.id, employee]));

const collectProjectHours = (timesheets: TimesheetWeekRecord[], startKey: string, endKey: string) => {
  const projectHours = new Map<string, SystemDashboardProjectHours>();

  timesheets
    .filter((timesheet) => isWeeklySubmittedLike(timesheet.status))
    .forEach((timesheet) => {
      timesheet.rows.forEach((row) => {
        const hours = Object.entries(row.hours).reduce((sum, [dateKey, value]) => (
          dateKeyFallsWithin(dateKey, startKey, endKey) ? sum + Number(value || 0) : sum
        ), 0);

        if (hours <= 0) {
          return;
        }

        const label = row.projectName?.trim() || "Unassigned";
        const current = projectHours.get(label) ?? {
          project: label,
          hours: 0,
          billableHours: 0,
          nonBillableHours: 0,
        };

        current.hours += hours;
        if (row.billable) {
          current.billableHours += hours;
        } else {
          current.nonBillableHours += hours;
        }

        projectHours.set(label, current);
      });
    });

  return Array.from(projectHours.values()).sort((left, right) => right.hours - left.hours);
};

const getDepartmentMissingEmployees = (
  employees: Employee[],
  dailyTimesheets: DailyTimesheet[],
  start: Date,
  end: Date,
) => {
  const submittedUsers = new Set(
    dailyTimesheets
      .filter((timesheet) => dateFallsWithin(timesheet.date, start, end) && isDailySubmittedLike(timesheet.status))
      .map((timesheet) => timesheet.userId),
  );

  return employees.reduce<Record<string, number>>((summary, employee) => {
    if (submittedUsers.has(employee.id)) {
      return summary;
    }

    summary[employee.department] = (summary[employee.department] ?? 0) + 1;
    return summary;
  }, {});
};

const buildKpis = (
  employees: Employee[],
  dailyTimesheets: DailyTimesheet[],
  weeklyTimesheets: TimesheetWeekRecord[],
  leaves: LeaveRequest[],
  activityLogins: ActivityLoginRow[],
  start: Date,
  end: Date,
) => {
  const endBoundary = end;
  const activeEmployees = employees.filter((employee) => {
    if (employee.status === "Inactive") {
      return false;
    }
    return dateFallsWithin(employee.createdAt, new Date(2000, 0, 1), endBoundary);
  });

  const submittedDailyUserIds = new Set(
    dailyTimesheets
      .filter((timesheet) => dateFallsWithin(timesheet.date, start, end) && isDailySubmittedLike(timesheet.status))
      .map((timesheet) => timesheet.userId),
  );

  const activeUserIds = new Set<string>(submittedDailyUserIds);
  activityLogins
    .filter((item) => {
      const normalizedStatus = item.status.trim().toLowerCase();
      return normalizedStatus.includes("success") || normalizedStatus.includes("approved");
    })
    .forEach((item) => {
      activeUserIds.add(item.userId ?? item.email.toLowerCase());
    });

  const weeklyInRange = weeklyTimesheets.filter((timesheet) =>
    rangeOverlaps(timesheet.weekStart, timesheet.weekEnd, formatDateKey(start), formatDateKey(end)),
  );

  const missingTimesheets = activeEmployees.filter((employee) => !submittedDailyUserIds.has(employee.id)).length;
  const openLeaveRequests = leaves.filter((leave) => leave.status === "Pending" && rangeOverlaps(leave.startDate, leave.endDate, formatDateKey(start), formatDateKey(end))).length;

  return {
    totalEmployees: activeEmployees.length,
    activeUsers: activeUserIds.size,
    pendingApprovals: weeklyInRange.filter((timesheet) => normalizeWeeklyStatus(timesheet.status) === "submitted").length,
    missingTimesheets,
    openLeaveRequests,
    payrollReadyCount: weeklyInRange.filter((timesheet) => normalizeWeeklyStatus(timesheet.status) === "approved").length,
  } satisfies SystemDashboardKpis;
};

const getAgeInDays = (value: string) => Math.max(0, getDateDiffInDays(parseDateTime(value), startOfDay(new Date())));

const buildRecentActivities = (
  weeklyTimesheets: TimesheetWeekRecord[],
  leaves: LeaveRequest[],
  activityLogins: ActivityLoginRow[],
  projects: Project[],
  employeesById: Map<string, Employee>,
) => {
  const timesheetActivities: SystemDashboardActivityItem[] = weeklyTimesheets.map((timesheet) => {
    const employee = employeesById.get(timesheet.userId);
    const normalizedStatus = normalizeWeeklyStatus(timesheet.status);
    const actionLabel =
      normalizedStatus === "approved"
        ? "approved"
        : normalizedStatus === "rejected"
          ? "rejected"
          : normalizedStatus === "submitted"
            ? "submitted"
            : "updated";

    return {
      id: `timesheet-${timesheet.id}`,
      category: "timesheet",
      title: `${employee?.fullName ?? "A user"} ${actionLabel} a weekly timesheet`,
      description: `${timesheet.weekStart} to ${timesheet.weekEnd} • ${employee?.department ?? "Unknown department"}`,
      timestamp: timesheet.updatedAt,
      actionUrl: workspaceRoutes["all-timesheets"].path,
    };
  });

  const leaveActivities: SystemDashboardActivityItem[] = leaves.map((leave) => ({
    id: `leave-${leave.id}`,
    category: "leave",
    title: `${leave.employeeName} ${leave.status === "Pending" ? "requested" : leave.status.toLowerCase()} leave`,
    description: `${leave.type} • ${leave.startDate} to ${leave.endDate}`,
    timestamp: leave.createdAt,
    actionUrl: workspaceRoutes["leave-summary-report"].path,
  }));

  const loginActivities: SystemDashboardActivityItem[] = activityLogins.map((activity) => ({
    id: `activity-${activity.id}`,
    category: "activity",
    title: activity.isSuspicious
      ? `${activity.fullName || activity.email} triggered a suspicious login`
      : `${activity.fullName || activity.email} ${activity.status.toLowerCase().includes("success") ? "signed in" : "attempted login"}`,
    description: `${activity.city || activity.location || "Unknown location"} • ${activity.deviceType || activity.browser || "Unknown device"}`,
    timestamp: activity.loginTime,
    actionUrl: workspaceRoutes.activity.path,
  }));

  const projectActivities: SystemDashboardActivityItem[] = projects.map((project) => ({
    id: `project-${project.id}`,
    category: "project",
    title: `${project.name} entered the system`,
    description: `${project.department} • ${project.status}`,
    timestamp: project.createdAt,
    actionUrl: workspaceRoutes["project-management"].path,
  }));

  return [...timesheetActivities, ...leaveActivities, ...loginActivities, ...projectActivities]
    .sort((left, right) => parseDateTime(right.timestamp).getTime() - parseDateTime(left.timestamp).getTime())
    .slice(0, 12);
};

const buildAlerts = (
  employees: Employee[],
  projects: Project[],
  dailyTimesheets: DailyTimesheet[],
  weeklyTimesheets: TimesheetWeekRecord[],
  leaves: LeaveRequest[],
  activityLogins: ActivityLoginRow[],
  start: Date,
  end: Date,
) => {
  const alerts: SystemDashboardAlert[] = [];
  const activeEmployees = employees.filter((employee) => employee.status !== "Inactive");
  const missingEmployees = activeEmployees.filter((employee) =>
    !dailyTimesheets.some((timesheet) =>
      timesheet.userId === employee.id &&
      dateFallsWithin(timesheet.date, start, end) &&
      isDailySubmittedLike(timesheet.status),
    ));

  if (missingEmployees.length > 0) {
    alerts.push({
      id: "missing-timesheets",
      severity: "high",
      title: "Missing timesheets",
      description: `${missingEmployees.length} employees have no submitted time in the selected window.`,
      count: missingEmployees.length,
      actionUrl: workspaceRoutes["all-timesheets"].path,
      actionLabel: "Open all timesheets",
    });
  }

  const delayedApprovals = weeklyTimesheets.filter((timesheet) =>
    normalizeWeeklyStatus(timesheet.status) === "submitted" &&
    rangeOverlaps(timesheet.weekStart, timesheet.weekEnd, formatDateKey(start), formatDateKey(end)) &&
    getAgeInDays(timesheet.updatedAt) >= STUCK_APPROVAL_DAYS,
  );

  if (delayedApprovals.length > 0) {
    alerts.push({
      id: "delayed-approvals",
      severity: "high",
      title: "Delayed approvals",
      description: `${delayedApprovals.length} approval items have been waiting for more than ${STUCK_APPROVAL_DAYS} days.`,
      count: delayedApprovals.length,
      actionUrl: workspaceRoutes["approval-inbox"].path,
      actionLabel: "Review approval inbox",
    });
  }

  const repeatedRejections = Array.from(
    weeklyTimesheets
      .filter((timesheet) => normalizeWeeklyStatus(timesheet.status) === "rejected")
      .reduce((summary, timesheet) => {
        summary.set(timesheet.userId, (summary.get(timesheet.userId) ?? 0) + 1);
        return summary;
      }, new Map<string, number>())
      .values(),
  ).filter((count) => count >= 2).length;

  if (repeatedRejections > 0) {
    alerts.push({
      id: "repeat-rejections",
      severity: "medium",
      title: "Repeated rejections",
      description: `${repeatedRejections} employees have had multiple weekly timesheets rejected and may need intervention.`,
      count: repeatedRejections,
      actionUrl: `${workspaceRoutes["all-timesheets"].path}?status=rejected`,
      actionLabel: "Inspect rejected sheets",
    });
  }

  const overtimeUsers = new Set(
    dailyTimesheets
      .filter((timesheet) => dateFallsWithin(timesheet.date, start, end) && Number(timesheet.totalHours || 0) >= OVERTIME_THRESHOLD)
      .map((timesheet) => timesheet.userId),
  ).size;

  if (overtimeUsers > 0) {
    alerts.push({
      id: "overtime-spike",
      severity: "medium",
      title: "Overtime spike detected",
      description: `${overtimeUsers} users crossed the overtime threshold in the current range.`,
      count: overtimeUsers,
      actionUrl: workspaceRoutes["overtime-report"].path,
      actionLabel: "Open overtime summary",
    });
  }

  const recentWindowStart = addDays(end, -4);
  const recentProjectHours = collectProjectHours(weeklyTimesheets, formatDateKey(recentWindowStart), formatDateKey(end));
  const recentProjectNames = new Set(recentProjectHours.map((project) => project.project));
  const inactiveProjects = projects.filter((project) =>
    project.status === "Active" && !recentProjectNames.has(project.name),
  ).length;

  if (inactiveProjects > 0) {
    alerts.push({
      id: "inactive-projects",
      severity: "low",
      title: "Projects with no recent hours",
      description: `${inactiveProjects} active projects have logged no hours in the last 5 days.`,
      count: inactiveProjects,
      actionUrl: workspaceRoutes["project-management"].path,
      actionLabel: "Open project management",
    });
  }

  const suspiciousActivityCount = activityLogins.filter((activity) =>
    activity.isSuspicious || !activity.status.trim().toLowerCase().includes("success"),
  ).length;

  if (suspiciousActivityCount > 0) {
    alerts.push({
      id: "suspicious-activity",
      severity: "high",
      title: "Abnormal activity detected",
      description: `${suspiciousActivityCount} login events were flagged as suspicious or failed.`,
      count: suspiciousActivityCount,
      actionUrl: workspaceRoutes.activity.path,
      actionLabel: "Open activity logs",
    });
  }

  const currentLeaveRequests = leaves.filter((leave) => dateFallsWithin(leave.createdAt, start, end)).length;
  const previousStart = addDays(start, -(getDateDiffInDays(start, end) + 1));
  const previousEnd = addDays(start, -1);
  const previousLeaveRequests = leaves.filter((leave) => dateFallsWithin(leave.createdAt, previousStart, previousEnd)).length;

  if (currentLeaveRequests > previousLeaveRequests && currentLeaveRequests > 0) {
    alerts.push({
      id: "leave-pressure",
      severity: "low",
      title: "Leave requests are rising",
      description: `${currentLeaveRequests - previousLeaveRequests} more leave requests landed compared with the previous window.`,
      count: currentLeaveRequests - previousLeaveRequests,
      actionUrl: workspaceRoutes["leave-summary-report"].path,
      actionLabel: "Open leave report",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-clear",
      severity: "low",
      title: "System running clean",
      description: "No major operational blockers are visible in the current dashboard scope.",
      count: 0,
      actionUrl: workspaceRoutes["system-dashboard"].path,
      actionLabel: "Stay on system dashboard",
    });
  }

  const severityOrder = { high: 0, medium: 1, low: 2 } as const;
  return alerts.sort((left, right) => {
    const severityDelta = severityOrder[left.severity] - severityOrder[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return right.count - left.count;
  });
};

const buildSystemDashboardData = (
  employees: Employee[],
  projects: Project[],
  dailyTimesheets: DailyTimesheet[],
  weeklyTimesheets: TimesheetWeekRecord[],
  leaves: LeaveRequest[],
  activityLogins: ActivityLoginRow[],
  range: ResolvedDateRange,
  lastUpdatedAt: string | null,
): SystemDashboardData => {
  const employeesById = toEmployeeMap(employees);
  const currentKpis = buildKpis(employees, dailyTimesheets, weeklyTimesheets, leaves, activityLogins, range.start, range.end);
  const previousKpis = buildKpis(employees, dailyTimesheets, weeklyTimesheets, leaves, [], range.previousStart, range.previousEnd);

  const timeBuckets = buildTimeBuckets(range.start, range.end);
  dailyTimesheets
    .filter((timesheet) => dateFallsWithin(timesheet.date, range.start, range.end))
    .forEach((timesheet) => {
      const bucketKey = getBucketKey(parseDateOnly(timesheet.date), timeBuckets.bucketSize);
      const bucket = timeBuckets.buckets.get(bucketKey);
      if (!bucket) {
        return;
      }

      switch (normalizeDailyStatus(timesheet.status)) {
        case "draft":
          bucket.draft += 1;
          break;
        case "submitted":
          bucket.submitted += 1;
          break;
        case "pending":
          bucket.pendingApproval += 1;
          break;
        case "approved":
          bucket.approved += 1;
          break;
        case "rejected":
          bucket.rejected += 1;
          break;
        case "resubmitted":
          bucket.resubmitted += 1;
          break;
      }
    });

  const submittedApprovals = weeklyTimesheets.filter((timesheet) =>
    normalizeWeeklyStatus(timesheet.status) === "submitted" &&
    rangeOverlaps(timesheet.weekStart, timesheet.weekEnd, range.startKey, range.endKey),
  );

  const approvalAgingBuckets = [
    { bucket: "0-1 days", count: 0 },
    { bucket: "2-3 days", count: 0 },
    { bucket: "4-7 days", count: 0 },
    { bucket: "7+ days", count: 0 },
  ];

  submittedApprovals.forEach((timesheet) => {
    const age = getAgeInDays(timesheet.updatedAt);
    if (age <= 1) {
      approvalAgingBuckets[0].count += 1;
      return;
    }
    if (age <= 3) {
      approvalAgingBuckets[1].count += 1;
      return;
    }
    if (age <= 7) {
      approvalAgingBuckets[2].count += 1;
      return;
    }
    approvalAgingBuckets[3].count += 1;
  });

  const activeEmployees = employees.filter((employee) => employee.status !== "Inactive");
  const businessDays = getBusinessDayCount(range.start, range.end);
  const departmentLoggedHours = new Map<string, number>();
  const dailyHoursByUser = new Map<string, number>();

  dailyTimesheets
    .filter((timesheet) => dateFallsWithin(timesheet.date, range.start, range.end))
    .forEach((timesheet) => {
      const totalHours = Number(timesheet.totalHours || 0);
      const employee = employeesById.get(timesheet.userId);
      if (!employee) {
        return;
      }

      departmentLoggedHours.set(employee.department, (departmentLoggedHours.get(employee.department) ?? 0) + totalHours);
      dailyHoursByUser.set(timesheet.userId, (dailyHoursByUser.get(timesheet.userId) ?? 0) + totalHours);
    });

  const missingEmployeesByDepartment = getDepartmentMissingEmployees(activeEmployees, dailyTimesheets, range.start, range.end);
  const departmentUtilisation = Array.from(
    activeEmployees.reduce((summary, employee) => {
      summary.set(employee.department, (summary.get(employee.department) ?? 0) + 1);
      return summary;
    }, new Map<string, number>()),
  )
    .map(([department, totalEmployees]) => {
      const loggedHours = Number((departmentLoggedHours.get(department) ?? 0).toFixed(1));
      const expectedHours = totalEmployees * businessDays * HOURS_PER_DAY;
      const utilisation = expectedHours <= 0 ? 0 : Math.round((loggedHours / expectedHours) * 100);

      return {
        department,
        utilisation,
        loggedHours,
        expectedHours,
        missingEmployees: missingEmployeesByDepartment[department] ?? 0,
      };
    })
    .sort((left, right) => right.utilisation - left.utilisation);

  const projectHours = collectProjectHours(weeklyTimesheets, range.startKey, range.endKey).slice(0, 6);

  const leaveBuckets = buildTimeBuckets(range.start, range.end);
  leaves
    .filter((leave) => dateFallsWithin(leave.createdAt, range.start, range.end))
    .forEach((leave) => {
      const bucketKey = getBucketKey(parseDateTime(leave.createdAt), leaveBuckets.bucketSize);
      const bucket = leaveBuckets.buckets.get(bucketKey);
      if (!bucket) {
        return;
      }

      if (leave.status === "Pending") {
        bucket.submitted += 1;
      } else if (leave.status === "Approved") {
        bucket.approved += 1;
      } else {
        bucket.rejected += 1;
      }
    });

  const leaveTrend = Array.from(leaveBuckets.buckets.values()).map((bucket) => ({
    label: bucket.label,
    requested: bucket.submitted,
    approved: bucket.approved,
    rejected: bucket.rejected,
  }));

  const leaveRequestsCurrent = leaves.filter((leave) => dateFallsWithin(leave.createdAt, range.start, range.end)).length;
  const leaveRequestsPrevious = leaves.filter((leave) => dateFallsWithin(leave.createdAt, range.previousStart, range.previousEnd)).length;
  const peopleOnLeaveToday = leaves.filter((leave) => leave.status === "Approved" && rangeOverlaps(leave.startDate, leave.endDate, formatDateKey(startOfDay(new Date())), formatDateKey(startOfDay(new Date())))).length;
  const highestLeaveDepartmentEntry = Array.from(
    leaves
      .filter((leave) => rangeOverlaps(leave.startDate, leave.endDate, range.startKey, range.endKey))
      .reduce((summary, leave) => {
        summary.set(leave.department, (summary.get(leave.department) ?? 0) + 1);
        return summary;
      }, new Map<string, number>())
      .entries(),
  ).sort((left, right) => right[1] - left[1])[0];

  return {
    kpis: currentKpis,
    previousKpis,
    timesheetTrend: Array.from(timeBuckets.buckets.values()),
    approvalSummary: {
      stages: [
        {
          id: "submitted",
          label: "Submitted",
          count: submittedApprovals.length,
          subtitle: "Weekly timesheets waiting to move.",
        },
        {
          id: "fresh",
          label: "0-1 Day Queue",
          count: approvalAgingBuckets[0].count,
          subtitle: "Fresh items still moving normally.",
        },
        {
          id: "delayed",
          label: "2+ Day Queue",
          count: approvalAgingBuckets[1].count + approvalAgingBuckets[2].count + approvalAgingBuckets[3].count,
          subtitle: "Items starting to require intervention.",
        },
        {
          id: "approved",
          label: "Approved",
          count: weeklyTimesheets.filter((timesheet) =>
            normalizeWeeklyStatus(timesheet.status) === "approved" &&
            rangeOverlaps(timesheet.weekStart, timesheet.weekEnd, range.startKey, range.endKey),
          ).length,
          subtitle: "Weekly sheets ready for payroll and reporting.",
        },
      ],
      aging: approvalAgingBuckets,
      blockedApprovals: weeklyTimesheets.filter((timesheet) =>
        normalizeWeeklyStatus(timesheet.status) === "rejected" &&
        rangeOverlaps(timesheet.weekStart, timesheet.weekEnd, range.startKey, range.endKey),
      ).length,
      stuckApprovals: approvalAgingBuckets[2].count + approvalAgingBuckets[3].count,
    },
    departmentUtilisation,
    projectHours,
    leaveTrend,
    leaveSummary: {
      peopleOnLeaveToday,
      pendingRequests: leaves.filter((leave) => leave.status === "Pending" && rangeOverlaps(leave.startDate, leave.endDate, range.startKey, range.endKey)).length,
      highestDepartment: highestLeaveDepartmentEntry?.[0] ?? "No pressure",
      risingBy: leaveRequestsCurrent - leaveRequestsPrevious,
    },
    alerts: buildAlerts(employees, projects, dailyTimesheets, weeklyTimesheets, leaves, activityLogins, range.start, range.end),
    recentActivities: buildRecentActivities(weeklyTimesheets, leaves, activityLogins, projects, employeesById),
    meta: {
      rangeLabel: range.label,
      lastUpdatedAt,
      commandNote: "System-wide operational view built from employee records, time logs, approvals, leave requests, project setup, and activity monitoring.",
      dataSources: ["Employees", "Daily Timesheets", "Weekly Timesheets", "Leave Requests", "Projects", "Activity Logs"],
    },
  };
};

export const useSystemDashboard = (filter: DateRangeFilter) => {
  const { employees, loading: employeesLoading, reload: reloadEmployees } = useEmployees();
  const { projects, loading: projectsLoading, reload: reloadProjects } = useProjects();
  const [dailyTimesheets, setDailyTimesheets] = useState<DailyTimesheet[]>([]);
  const [weeklyTimesheets, setWeeklyTimesheets] = useState<TimesheetWeekRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [activityLogins, setActivityLogins] = useState<ActivityLoginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const range = useMemo(() => resolveDateRange(filter), [filter]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    const failures: string[] = [];

    const [dailyResult, weeklyResult, leaveResult, activityResult] = await Promise.allSettled([
      taskService.listDailyTimesheets(),
      timesheetService.listWeeks(),
      leaveService.getLeaves(),
      activityService.getLogins({
        page: 1,
        pageSize: SYSTEM_ACTIVITY_PAGE_SIZE,
        fromDate: range.startKey,
        toDate: range.endKey,
      }),
    ]);

    if (dailyResult.status === "fulfilled") {
      setDailyTimesheets(dailyResult.value);
    } else {
      failures.push("daily timesheets");
    }

    if (weeklyResult.status === "fulfilled") {
      setWeeklyTimesheets(weeklyResult.value);
    } else {
      failures.push("weekly timesheets");
    }

    if (leaveResult.status === "fulfilled") {
      setLeaves(leaveResult.value);
    } else {
      failures.push("leave requests");
    }

    if (activityResult.status === "fulfilled") {
      setActivityLogins(activityResult.value.items);
    } else {
      setActivityLogins([]);
      failures.push("activity logs");
    }

    setError(
      failures.length > 0
        ? `Some command-center sources could not be refreshed: ${failures.join(", ")}. Showing the latest available data for the rest.`
        : null,
    );
    setLastUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, [range.endKey, range.startKey]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const refresh = useCallback(async () => {
    await Promise.all([reloadEmployees(), reloadProjects(), loadDashboardData()]);
  }, [loadDashboardData, reloadEmployees, reloadProjects]);

  const data = useMemo(
    () =>
      buildSystemDashboardData(
        employees,
        projects,
        dailyTimesheets,
        weeklyTimesheets,
        leaves,
        activityLogins,
        range,
        lastUpdatedAt,
      ),
    [activityLogins, dailyTimesheets, employees, lastUpdatedAt, leaves, projects, range, weeklyTimesheets],
  );

  return {
    data,
    loading: loading || employeesLoading || projectsLoading,
    error,
    refresh,
  };
};

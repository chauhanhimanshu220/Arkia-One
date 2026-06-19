import { useMemo, useState, useEffect, type ComponentProps } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { canAccessWorkspaceRoute, workspaceRoutes } from "../../config/workspaceNavigation";
import { DAILY_WORK_HOURS as HOURS_PER_WORKING_DAY } from "../../constants/timesheet";
import type { AuthUser } from "../../types/auth";
import type { Employee, Department } from "../../types/employee";
import type { LeaveRequest } from "../../types/leave";
import type { Project } from "../../types/project";
import type { DailyTimesheet } from "../../types/task";
import type { TimesheetRow, TimesheetWeekRecord } from "../../types/timesheet";
import { normalizeUserRole } from "../../types/roles";
import { buildTeamScope } from "../../utils/teamScope";

interface DashboardPageProps {
  user: AuthUser;
  title?: string;
  employees: Employee[];
  projects: Project[];
  dailyTimesheets: DailyTimesheet[];
  weeklyTimesheets: TimesheetWeekRecord[];
  leaves: LeaveRequest[];
  loading: boolean;
  lastSyncedAt: string | null;
  onRefresh: () => void;
  onOpenEmployeeInsights: (employee: Employee) => void;
}

type DashboardRange = "today" | "this_week" | "this_month";
type AlertTone = "critical" | "warning" | "info" | "success";

type MetricCard = {
  title: string;
  value: string;
  subtitle: string;
  delta: string;
  icon: ComponentProps<typeof Icon>["name"];
  accentClass: string;
  href?: string;
};

type ActionQueueItem = {
  id: string;
  title: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  detail: string;
  ctaLabel: string;
  href?: string;
};

type AlertItem = {
  id: string;
  title: string;
  message: string;
  tone: AlertTone;
  href?: string;
};

type ActivityItem = {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  status: string;
};

type DepartmentCompliance = {
  department: Department;
  complianceRate: number;
  expectedEmployees: number;
  submittedEmployees: number;
};

const monochromeBadgeClass = "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-100";

const rangeOptions: Array<{ id: DashboardRange; label: string }> = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
];

const alertToneClasses: Record<AlertTone, string> = {
  critical: "border-zinc-200 bg-white/90 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200",
  warning: "border-zinc-200 bg-white/90 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200",
  info: "border-zinc-200 bg-white/90 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200",
  success: "border-zinc-200 bg-white/90 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200",
};

const statusClasses: Record<string, string> = {
  Draft: monochromeBadgeClass,
  Submitted: monochromeBadgeClass,
  Approved: monochromeBadgeClass,
  Rejected: monochromeBadgeClass,
  Pending: monochromeBadgeClass,
  Active: monochromeBadgeClass,
  Completed: monochromeBadgeClass,
};

const heroPanelClass = "text-zinc-900 dark:text-white";
const panelClass = "glass-panel rounded-[2rem] p-6";
const metricCardClass = "glass-card rounded-[1.75rem] p-5";
const queuePanelClass = "glass-subpanel rounded-[1.6rem] p-5";
const subPanelClass = "glass-subpanel rounded-[1.7rem] p-5";
const itemPanelClass = "glass-subpanel rounded-[1.5rem] p-4";
const chipClass = "glass-chip rounded-2xl px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300";
const heroChipClass = "glass-chip rounded-2xl px-4 py-3 text-sm text-zinc-600 shadow-sm dark:text-zinc-300";
const heroInfoClass = "glass-chip rounded-2xl px-4 py-4 text-sm shadow-sm";
const controlClass = "glass-button rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200";
const selectClass = "glass-input rounded-2xl px-4 py-3 text-sm text-zinc-700 outline-none dark:text-zinc-200";
const activeControlClass =
  "rounded-full border border-zinc-300 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,238,238,0.9))] text-zinc-900 shadow-lg shadow-zinc-300/20 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] dark:text-white";

const getDateOnly = (value: string | Date) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekStart = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getBusinessWeekEnd = (weekStart: Date) => addDays(weekStart, 5);

const isDateInRange = (value: string, start: Date, end: Date) => {
  const target = getDateOnly(value);
  return target >= start && target <= end;
};

const rangesOverlap = (leftStart: string, leftEnd: string, rightStart: Date, rightEnd: Date) => {
  const start = getDateOnly(leftStart);
  const end = getDateOnly(leftEnd);
  return start <= rightEnd && end >= rightStart;
};

const countWorkingDaysInRange = (start: Date, end: Date) => {
  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    if (cursor.getDay() !== 0) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
};

const getRelativeAgeLabel = (value: string) => {
  const now = new Date();
  const diffMs = now.getTime() - new Date(value).getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 1) return "Updated just now";
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  return `Updated ${Math.floor(diffHours / 24)}d ago`;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

const formatDisplayDate = (value: Date | string, options?: Intl.DateTimeFormatOptions) =>
  getDateOnly(value).toLocaleDateString(
    undefined,
    options ?? { day: "2-digit", month: "short", year: "numeric" },
  );

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatHours = (value: number) => `${Number(value || 0).toFixed(1).replace(".0", "")}h`;
const formatPercent = (value: number) => `${Math.round(value)}%`;

const getEmployeeScope = (
  role: ReturnType<typeof normalizeUserRole>,
  employees: Employee[],
  viewerEmployee: Employee | null,
) => {
  if (role === "System Admin" || role === "HR Manager" || role === "Finance Admin") {
    return employees.filter((employee) => employee.status === "Active");
  }

  if (role === "Team Manager" && viewerEmployee) {
    return employees.filter(
      (employee) => employee.status === "Active" && employee.department === viewerEmployee.department,
    );
  }

  return viewerEmployee ? [viewerEmployee] : [];
};

const getProjectScope = (
  role: ReturnType<typeof normalizeUserRole>,
  projects: Project[],
  viewerEmployee: Employee | null,
  userId: string,
) => {
  if (role === "System Admin" || role === "HR Manager" || role === "Finance Admin") {
    return projects;
  }

  if (role === "Team Manager" && viewerEmployee) {
    return projects.filter(
      (project) =>
        project.managerId === userId ||
        project.teamMemberIds.includes(userId) ||
        project.department === viewerEmployee.department,
    );
  }

  return projects.filter((project) => project.teamMemberIds.includes(userId) || project.managerId === userId);
};

const getRecordHours = (rows: TimesheetRow[], predicate: (row: TimesheetRow) => boolean) =>
  rows.reduce(
    (sum, row) =>
      predicate(row)
        ? sum + Object.values(row.hours).reduce((rowSum, hours) => rowSum + Number(hours || 0), 0)
        : sum,
    0,
  );

const SectionTitle = ({ title }: { title: string; subtitle?: string }) => (
  <div>
    <p className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</p>
  </div>
);

const MetricCardView = ({ card }: { card: MetricCard }) => {
  const content = (
    <div className={`${metricCardClass} group transition hover:-translate-y-0.5`}>
      <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white/40 blur-3xl dark:bg-white/10" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{card.title}</p>
          <p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">{card.value}</p>
        </div>
        <div className="glass-chip rounded-2xl p-3 text-zinc-600 dark:text-zinc-200">
          <Icon name={card.icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  return card.href ? <Link to={card.href} className="block">{content}</Link> : content;
};

const parseRange = (value: string | null): DashboardRange | null => {
  if (value === "today" || value === "this_week" || value === "this_month") {
    return value;
  }
  return null;
};

export const DashboardPage = ({
  user,
  title = "Personal Dashboard",
  employees,
  projects,
  dailyTimesheets,
  weeklyTimesheets,
  leaves,
  loading,
  lastSyncedAt,
  onRefresh,
  onOpenEmployeeInsights,
}: DashboardPageProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useState<DashboardRange>(parseRange(searchParams.get("range")) ?? "this_week");
  const [departmentFilter, setDepartmentFilter] = useState<Department | "All">("All");

  useEffect(() => {
    const urlRange = parseRange(searchParams.get("range"));
    if (urlRange && urlRange !== range) {
      setRange(urlRange);
    }
  }, [searchParams]);

  const handleRangeChange = (newRange: DashboardRange) => {
    setRange(newRange);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("range", newRange);
      return next;
    }, { replace: true });
  };
  const role = normalizeUserRole(user.role);

  const viewerEmployee = useMemo(
    () => employees.find((employee) => employee.id === user.id) ?? null,
    [employees, user.id],
  );

  const teamScope = useMemo(
    () => buildTeamScope({ role, employees, projects, userId: user.id }),
    [employees, projects, role, user.id],
  );

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);

  const rangeWindow = useMemo(() => {
    if (range === "today") {
      return {
        start: today,
        end: today,
        label: formatDisplayDate(today, { day: "2-digit", month: "short", year: "numeric" }),
      };
    }

    if (range === "this_month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        start,
        end: today,
        label: `${formatDisplayDate(start, { day: "2-digit", month: "short" })} - ${formatDisplayDate(today, {
          day: "2-digit",
          month: "short",
        })}`,
      };
    }

    const start = getWeekStart(today);
    const end = getBusinessWeekEnd(start);
    return {
      start,
      end,
      label: `${formatDisplayDate(start, { day: "2-digit", month: "short" })} - ${formatDisplayDate(end, {
        day: "2-digit",
        month: "short",
      })}`,
    };
  }, [range, today]);

  const scopedEmployees = useMemo(
    () => (role === "Team Manager" ? teamScope.employees : getEmployeeScope(role, employees, viewerEmployee)),
    [employees, role, teamScope.employees, viewerEmployee],
  );

  const scopedDepartments = useMemo(
    () => Array.from(new Set(scopedEmployees.map((employee) => employee.department))).sort(),
    [scopedEmployees],
  );

  const filteredEmployees = useMemo(
    () =>
      departmentFilter === "All"
        ? scopedEmployees
        : scopedEmployees.filter((employee) => employee.department === departmentFilter),
    [departmentFilter, scopedEmployees],
  );

  const employeeIds = useMemo(() => new Set(filteredEmployees.map((employee) => employee.id)), [filteredEmployees]);

  const scopedProjects = useMemo(() => {
    const visibleProjects = role === "Team Manager" ? teamScope.projects : getProjectScope(role, projects, viewerEmployee, user.id);
    if (departmentFilter === "All") {
      return visibleProjects;
    }
    return visibleProjects.filter((project) => project.department === departmentFilter);
  }, [departmentFilter, projects, role, teamScope.projects, user.id, viewerEmployee]);

  const dailyInView = useMemo(
    () =>
      dailyTimesheets.filter(
        (record) =>
          employeeIds.has(record.userId) && isDateInRange(record.date, rangeWindow.start, rangeWindow.end),
      ),
    [dailyTimesheets, employeeIds, rangeWindow.end, rangeWindow.start],
  );

  const weeklyInView = useMemo(
    () =>
      weeklyTimesheets.filter(
        (record) =>
          employeeIds.has(record.userId) &&
          rangesOverlap(record.weekStart, record.weekEnd, rangeWindow.start, rangeWindow.end),
      ),
    [employeeIds, rangeWindow.end, rangeWindow.start, weeklyTimesheets],
  );

  const leavesInView = useMemo(
    () =>
      leaves.filter(
        (leave) =>
          employeeIds.has(leave.employeeId) &&
          rangesOverlap(leave.startDate, leave.endDate, rangeWindow.start, rangeWindow.end),
      ),
    [employeeIds, leaves, rangeWindow.end, rangeWindow.start],
  );

  const employeeDirectory = useMemo(
    () => new Map(filteredEmployees.map((employee) => [employee.id, employee])),
    [filteredEmployees],
  );

  const expectedEmployees = useMemo(() => {
    const fullRangeLeaveEmployeeIds = new Set(
      leavesInView
        .filter(
          (leave) =>
            leave.status === "Approved" &&
            getDateOnly(leave.startDate) <= rangeWindow.start &&
            getDateOnly(leave.endDate) >= rangeWindow.end,
        )
        .map((leave) => leave.employeeId),
    );

    return filteredEmployees.filter((employee) => !fullRangeLeaveEmployeeIds.has(employee.id));
  }, [filteredEmployees, leavesInView, rangeWindow.end, rangeWindow.start]);

  const submittedEmployeeIds = useMemo(() => {
    if (range === "today") {
      return new Set(
        dailyInView
          .filter((record) => record.status === "Submitted" || record.status === "Approved")
          .map((record) => record.userId),
      );
    }

    return new Set(
      weeklyInView
        .filter((record) => record.status === "Submitted" || record.status === "Approved")
        .map((record) => record.userId),
    );
  }, [dailyInView, range, weeklyInView]);

  const missingEmployees = useMemo(
    () => expectedEmployees.filter((employee) => !submittedEmployeeIds.has(employee.id)),
    [expectedEmployees, submittedEmployeeIds],
  );

  const complianceRate = expectedEmployees.length === 0 ? 100 : (submittedEmployeeIds.size / expectedEmployees.length) * 100;
  const pendingTimesheetApprovals = canAccessWorkspaceRoute(user, "approval-inbox")
    ? weeklyInView.filter((record) => record.status === "Submitted").length
    : 0;
  const pendingLeaveApprovals = canAccessWorkspaceRoute(user, "leave-approval")
    ? leavesInView.filter((leave) => leave.status === "Pending").length
    : 0;
  const pendingApprovals = pendingTimesheetApprovals + pendingLeaveApprovals;

  const todayHours = dailyTimesheets
    .filter((record) => employeeIds.has(record.userId) && record.date === toIsoDate(today))
    .reduce((sum, record) => sum + Number(record.totalHours || 0), 0);

  const approvedHours = weeklyInView
    .filter((record) => record.status === "Approved")
    .reduce((sum, record) => sum + Number(record.totalHours || 0), 0);

  const payrollReadyEmployees = weeklyInView.filter((record) => record.status === "Approved").length;
  const billableHours = weeklyInView.reduce((sum, record) => sum + getRecordHours(record.rows, (row) => row.billable), 0);
  const nonBillableHours = weeklyInView.reduce((sum, record) => sum + getRecordHours(record.rows, (row) => !row.billable), 0);
  const activeProjects = scopedProjects.filter((project) => project.status === "Active");

  const employeesOnLeaveToday = leaves.filter(
    (leave) =>
      employeeIds.has(leave.employeeId) &&
      leave.status === "Approved" &&
      getDateOnly(leave.startDate) <= today &&
      getDateOnly(leave.endDate) >= today,
  ).length;

  const employeesWorkingToday = filteredEmployees.filter(
    (employee) =>
      employee.status === "Active" &&
      !leaves.some(
        (leave) =>
          leave.employeeId === employee.id &&
          leave.status === "Approved" &&
          getDateOnly(leave.startDate) <= today &&
          getDateOnly(leave.endDate) >= today,
      ),
  ).length;

  const expectedHoursPerEmployee = countWorkingDaysInRange(rangeWindow.start, rangeWindow.end) * HOURS_PER_WORKING_DAY;

  const incompleteEmployees = useMemo(
    () =>
      expectedEmployees.filter((employee) => {
        const actualHours =
          range === "today"
            ? dailyInView
                .filter((record) => record.userId === employee.id)
                .reduce((sum, record) => sum + Number(record.totalHours || 0), 0)
            : weeklyInView
                .filter((record) => record.userId === employee.id)
                .reduce((sum, record) => sum + Number(record.totalHours || 0), 0);

        return actualHours > 0 && actualHours < expectedHoursPerEmployee;
      }),
    [dailyInView, expectedEmployees, expectedHoursPerEmployee, range, weeklyInView],
  );

  const departmentsWithLowCompliance = useMemo<DepartmentCompliance[]>(() => {
    const grouped = new Map<Department, Employee[]>();

    filteredEmployees.forEach((employee) => {
      const current = grouped.get(employee.department) ?? [];
      current.push(employee);
      grouped.set(employee.department, current);
    });

    return Array.from(grouped.entries())
      .map(([department, departmentEmployees]) => {
        const expected = departmentEmployees.filter((employee) =>
          !leavesInView.some(
            (leave) =>
              leave.employeeId === employee.id &&
              leave.status === "Approved" &&
              getDateOnly(leave.startDate) <= rangeWindow.start &&
              getDateOnly(leave.endDate) >= rangeWindow.end,
          ),
        );

        const submitted = expected.filter((employee) => submittedEmployeeIds.has(employee.id));
        const compliance = expected.length === 0 ? 100 : (submitted.length / expected.length) * 100;

        return {
          department,
          complianceRate: compliance,
          expectedEmployees: expected.length,
          submittedEmployees: submitted.length,
        };
      })
      .sort((left, right) => left.complianceRate - right.complianceRate);
  }, [filteredEmployees, leavesInView, rangeWindow.end, rangeWindow.start, submittedEmployeeIds]);

  const overdueApprovals = useMemo(() => {
    const threshold = 48;

    const overdueTimesheets = weeklyInView.filter((record) => {
      if (record.status !== "Submitted") {
        return false;
      }
      const hours = (Date.now() - new Date(record.updatedAt).getTime()) / (1000 * 60 * 60);
      return hours >= threshold;
    }).length;

    const overdueLeaves = leavesInView.filter((leave) => {
      if (leave.status !== "Pending") {
        return false;
      }
      const hours = (Date.now() - new Date(leave.createdAt).getTime()) / (1000 * 60 * 60);
      return hours >= threshold;
    }).length;

    return overdueTimesheets + overdueLeaves;
  }, [leavesInView, weeklyInView]);

  const delayedProjects = useMemo(
    () =>
      scopedProjects.filter((project) => {
        if (project.status !== "Active") {
          return false;
        }

        const endDate = getDateOnly(project.endDate);
        return endDate < today || (endDate >= today && endDate <= addDays(today, 7) && project.priority !== "Low");
      }),
    [scopedProjects, today],
  );

  const metricCards = useMemo<MetricCard[]>(() => [
    {
      title: "Pending Approvals",
      value: `${pendingApprovals}`,
      subtitle: `${pendingTimesheetApprovals} timesheets / ${pendingLeaveApprovals} leave`,
      delta: overdueApprovals > 0 ? `${overdueApprovals} overdue` : "",
      icon: "approvals",
      accentClass: "bg-white/20",
      href: canAccessWorkspaceRoute(user, "approval-inbox")
        ? workspaceRoutes["approval-inbox"].path
        : canAccessWorkspaceRoute(user, "leave-approval")
          ? workspaceRoutes["leave-approval"].path
          : undefined,
    },
    {
      title: "Missing Timesheets",
      value: `${missingEmployees.length}`,
      subtitle: `${formatPercent(complianceRate)} compliance`,
      delta: `${expectedEmployees.length} expected`,
      icon: "timesheet",
      accentClass: "bg-white/20",
      href: canAccessWorkspaceRoute(user, "all-timesheets")
        ? workspaceRoutes["all-timesheets"].path
        : canAccessWorkspaceRoute(user, "team-timesheets")
          ? workspaceRoutes["team-timesheets"].path
          : undefined,
    },
    {
      title: range === "today" ? "Hours Logged Today" : "Approved Hours",
      value: range === "today" ? formatHours(todayHours) : formatHours(approvedHours),
      subtitle: `${formatHours(billableHours)} billable / ${formatHours(nonBillableHours)} non-billable`,
      delta: "",
      icon: "dashboard",
      accentClass: "bg-white/20",
      href: canAccessWorkspaceRoute(user, "project-hours-report")
        ? workspaceRoutes["project-hours-report"].path
        : undefined,
    },
    {
      title: "Payroll Ready",
      value: `${payrollReadyEmployees}`,
      subtitle: `${activeProjects.length} active projects`,
      delta: "",
      icon: "file-spreadsheet",
      accentClass: "bg-white/20",
      href: canAccessWorkspaceRoute(user, "timesheet-payroll")
        ? workspaceRoutes["timesheet-payroll"].path
        : canAccessWorkspaceRoute(user, "approved-timesheets")
          ? workspaceRoutes["approved-timesheets"].path
          : undefined,
    },
  ], [
    activeProjects.length,
    approvedHours,
    billableHours,
    complianceRate,
    expectedEmployees.length,
    missingEmployees.length,
    nonBillableHours,
    overdueApprovals,
    payrollReadyEmployees,
    pendingApprovals,
    pendingLeaveApprovals,
    pendingTimesheetApprovals,
    range,
    todayHours,
    user,
  ]);

  const actionQueue = useMemo<ActionQueueItem[]>(() => {
    const items: ActionQueueItem[] = [];

    if (pendingTimesheetApprovals > 0 && canAccessWorkspaceRoute(user, "approval-inbox")) {
      items.push({
        id: "timesheet-approvals",
        title: `Approve ${pendingTimesheetApprovals} submitted timesheet${pendingTimesheetApprovals === 1 ? "" : "s"}`,
        category: "Timesheet Approval",
        priority: pendingTimesheetApprovals >= 6 ? "High" : "Medium",
        detail: overdueApprovals > 0 ? `${overdueApprovals} overdue.` : "",
        ctaLabel: "Approve now",
        href: workspaceRoutes["approval-inbox"].path,
      });
    }

    if (pendingLeaveApprovals > 0 && canAccessWorkspaceRoute(user, "leave-approval")) {
      items.push({
        id: "leave-approvals",
        title: `Review ${pendingLeaveApprovals} pending leave request${pendingLeaveApprovals === 1 ? "" : "s"}`,
        category: "Leave Management",
        priority: pendingLeaveApprovals >= 4 ? "High" : "Medium",
        detail: "",
        ctaLabel: "Review leave",
        href: workspaceRoutes["leave-approval"].path,
      });
    }

    if (missingEmployees.length > 0) {
      items.push({
        id: "missing-timesheets",
        title: `${missingEmployees.length} employee${missingEmployees.length === 1 ? "" : "s"} missed submission`,
        category: "Compliance",
        priority: missingEmployees.length >= 4 ? "High" : "Medium",
        detail: "",
        ctaLabel: "View gaps",
        href: canAccessWorkspaceRoute(user, "all-timesheets")
          ? workspaceRoutes["all-timesheets"].path
          : canAccessWorkspaceRoute(user, "team-timesheets")
            ? workspaceRoutes["team-timesheets"].path
            : undefined,
      });
    }

    if (payrollReadyEmployees > 0 && canAccessWorkspaceRoute(user, "timesheet-payroll")) {
      items.push({
        id: "payroll-ready",
        title: `${payrollReadyEmployees} payroll-ready record${payrollReadyEmployees === 1 ? "" : "s"} available`,
        category: "Payroll",
        priority: payrollReadyEmployees >= 6 ? "High" : "Medium",
        detail: "",
        ctaLabel: "Open payroll",
        href: workspaceRoutes["timesheet-payroll"].path,
      });
    }

    if (delayedProjects.length > 0 && canAccessWorkspaceRoute(user, "project-management")) {
      items.push({
        id: "project-risk",
        title: `${delayedProjects.length} project${delayedProjects.length === 1 ? "" : "s"} need timeline attention`,
        category: "Project Delivery",
        priority: "Medium",
        detail: "",
        ctaLabel: "Review projects",
        href: workspaceRoutes["project-management"].path,
      });
    }

    if (items.length === 0) {
      items.push({
        id: "clear-queue",
        title: "No urgent actions in your queue",
        category: "Operational Health",
        priority: "Low",
        detail: "",
        ctaLabel: "Open dashboard",
      });
    }

    return items.slice(0, 5);
  }, [
    delayedProjects.length,
    missingEmployees.length,
    overdueApprovals,
    payrollReadyEmployees,
    pendingLeaveApprovals,
    pendingTimesheetApprovals,
    user,
  ]);

  const alerts = useMemo<AlertItem[]>(() => {
    const next: AlertItem[] = [];

    if (overdueApprovals > 0) {
      next.push({
        id: "overdue-approvals",
        title: "Overdue approvals detected",
        message: `${overdueApprovals} approval item${overdueApprovals === 1 ? "" : "s"} have been waiting more than 48 hours.`,
        tone: "critical",
        href: canAccessWorkspaceRoute(user, "approval-inbox")
          ? workspaceRoutes["approval-inbox"].path
          : undefined,
      });
    }

    if (missingEmployees.length > 0) {
      next.push({
        id: "submission-gaps",
        title: "Submission compliance needs attention",
        message: `${missingEmployees.length} employee${missingEmployees.length === 1 ? "" : "s"} are still missing a valid timesheet submission.`,
        tone: "warning",
        href: canAccessWorkspaceRoute(user, "all-timesheets")
          ? workspaceRoutes["all-timesheets"].path
          : undefined,
      });
    }

    if (delayedProjects.length > 0) {
      next.push({
        id: "project-risk",
        title: "Active projects are approaching delivery risk",
        message: `${delayedProjects.length} project${delayedProjects.length === 1 ? "" : "s"} are nearing or past planned end dates.`,
        tone: "critical",
        href: canAccessWorkspaceRoute(user, "project-management")
          ? workspaceRoutes["project-management"].path
          : undefined,
      });
    }

    if (payrollReadyEmployees > 0) {
      next.push({
        id: "payroll-ready",
        title: "Payroll-ready timesheets available",
        message: `${payrollReadyEmployees} approved record${payrollReadyEmployees === 1 ? "" : "s"} can move into payroll processing.`,
        tone: "info",
        href: canAccessWorkspaceRoute(user, "timesheet-payroll")
          ? workspaceRoutes["timesheet-payroll"].path
          : undefined,
      });
    }

    if (next.length === 0) {
      next.push({
        id: "stable-state",
        title: "No critical alerts right now",
        message: "Approvals, submissions, and delivery indicators are currently stable.",
        tone: "success",
      });
    }

    return next.slice(0, 4);
  }, [delayedProjects.length, missingEmployees.length, overdueApprovals, payrollReadyEmployees, user]);

  const timesheetHealth = useMemo(() => {
    if (range === "today") {
      const total = dailyInView.length || 1;
      return ["Submitted", "Approved", "Draft", "Rejected"].map((label) => {
        const count = dailyInView.filter((record) => record.status === label).length;
        const tone =
          label === "Approved" ? "bg-zinc-400 dark:bg-zinc-200" : label === "Submitted" ? "bg-zinc-500 dark:bg-zinc-300" : label === "Rejected" ? "bg-zinc-700 dark:bg-zinc-400" : "bg-zinc-500 dark:bg-zinc-300";
        return { label, count, share: (count / total) * 100, tone };
      });
    }

    const total = weeklyInView.length || 1;
    return ["Submitted", "Approved", "Draft", "Rejected"].map((label) => {
      const count = weeklyInView.filter((record) => record.status === label).length;
      const tone =
        label === "Approved" ? "bg-zinc-400 dark:bg-zinc-200" : label === "Submitted" ? "bg-zinc-500 dark:bg-zinc-300" : label === "Rejected" ? "bg-zinc-700 dark:bg-zinc-400" : "bg-zinc-500 dark:bg-zinc-300";
      return { label, count, share: (count / total) * 100, tone };
    });
  }, [dailyInView, range, weeklyInView]);

  const hoursTrend = useMemo(() => {
    const points = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);
      const isoDate = toIsoDate(date);
      const total = dailyTimesheets
        .filter((record) => employeeIds.has(record.userId) && record.date === isoDate)
        .reduce((sum, record) => sum + Number(record.totalHours || 0), 0);

      return {
        date: isoDate,
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        total,
      };
    });

    return { points, max: Math.max(...points.map((point) => point.total), 1) };
  }, [dailyTimesheets, employeeIds, today]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const weeklyActivity = weeklyInView.map((record) => ({
      id: `week-${record.id}`,
      actor: employeeDirectory.get(record.userId)?.fullName ?? "Unknown employee",
      action:
        record.status === "Approved"
          ? "approved weekly timesheet"
          : record.status === "Rejected"
            ? "received a rejected weekly timesheet"
            : record.status === "Submitted"
              ? "submitted weekly timesheet"
              : "saved weekly draft",
      target: `${formatDisplayDate(record.weekStart, { day: "2-digit", month: "short" })} to ${formatDisplayDate(record.weekEnd, {
        day: "2-digit",
        month: "short",
      })}`,
      timestamp: record.updatedAt,
      status: record.status,
    }));

    const leaveActivity = leavesInView.map((leave) => ({
      id: `leave-${leave.id}`,
      actor: leave.employeeName,
      action: leave.status === "Pending" ? "requested leave" : `${leave.status.toLowerCase()} leave`,
      target: leave.type,
      timestamp: leave.createdAt,
      status: leave.status,
    }));

    const projectActivity = scopedProjects.map((project) => ({
      id: `project-${project.id}`,
      actor: project.managerName || project.adminName,
      action: project.status === "Active" ? "is driving project delivery" : `marked project ${project.status.toLowerCase()}`,
      target: project.name,
      timestamp: project.createdAt,
      status: project.status,
    }));

    return [...weeklyActivity, ...leaveActivity, ...projectActivity]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 8);
  }, [employeeDirectory, leavesInView, scopedProjects, weeklyInView]);

  const employeesNeedingAttention = useMemo(() => {
    const atRiskIds = new Set<string>([
      ...missingEmployees.map((employee) => employee.id),
      ...incompleteEmployees.map((employee) => employee.id),
    ]);

    return filteredEmployees
      .filter((employee) => atRiskIds.has(employee.id))
      .slice(0, 5)
      .map((employee) => ({
        employee,
        reason: missingEmployees.some((item) => item.id === employee.id) ? "Missing submission" : "Incomplete logged hours",
      }));
  }, [filteredEmployees, incompleteEmployees, missingEmployees]);

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSpinner label={title === "System Dashboard" ? "Loading system dashboard..." : "Loading personal dashboard..."} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-[1.75rem] border border-white/70 bg-white/70 dark:border-zinc-800 dark:bg-black/80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className={heroPanelClass}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-6">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              {getGreeting()}, {user.fullName.split(" ")[0]}
            </h2>
            <div className="flex items-center gap-3">
              <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 hidden xl:block" />
              <div className="rounded-2xl border border-zinc-200 bg-white/85 px-4 py-2.5 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-300">
                {rangeWindow.label}
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl bg-zinc-100/50 p-1.5 dark:bg-white/5">
                {rangeOptions.map((option) => {
                  const active = option.id === range;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleRangeChange(option.id)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                        active
                          ? "bg-white text-zinc-900 shadow-sm dark:bg-white/10 dark:text-white"
                          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {scopedDepartments.length > 1 ? (
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value as Department | "All")}
                className={selectClass}
              >
                <option value="All">All departments</option>
                {scopedDepartments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <MetricCardView key={card.title} card={card} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <section className={panelClass}>
          <div className="flex items-start justify-between gap-4">
            <SectionTitle title="My Action Queue" />
            <div className={chipClass}>
              {actionQueue.length} queued item{actionQueue.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {actionQueue.map((item) => (
              <div key={item.id} className={queuePanelClass}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-zinc-900 dark:text-white">{item.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${monochromeBadgeClass}`}>
                        {item.priority}
                      </span>
                    </div>
                  </div>

                  {item.href ? (
                    <Link to={item.href} className="inline-flex items-center justify-center rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                      {item.ctaLabel}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">
                      {item.ctaLabel}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={panelClass}>
          <SectionTitle title="Critical Alerts" />
          <div className="mt-5 space-y-4">
            {alerts.map((alert) => {
              const content = (
                <div className={`rounded-[1.5rem] border p-4 ${alertToneClasses[alert.tone]}`}>
                  <p className="text-sm font-semibold">{alert.title}</p>
                </div>
              );

              return alert.href ? <Link key={alert.id} to={alert.href} className="block">{content}</Link> : <div key={alert.id}>{content}</div>;
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1.1fr]">
        <section className={panelClass}>
          <SectionTitle title="Team and Organisation Pulse" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="glass-subpanel rounded-[1.4rem] p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Employees working today</p>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{employeesWorkingToday}</p>
            </div>
            <div className="glass-subpanel rounded-[1.4rem] p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Employees on leave today</p>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{employeesOnLeaveToday}</p>
            </div>
            <div className="glass-subpanel rounded-[1.4rem] p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Incomplete logged hours</p>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{incompleteEmployees.length}</p>
            </div>
            <div className="glass-subpanel rounded-[1.4rem] p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Low-compliance departments</p>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{departmentsWithLowCompliance.filter((item) => item.complianceRate < 80).length}</p>
            </div>
          </div>

          {employeesNeedingAttention.length > 0 ? (
            <div className="glass-subpanel mt-5 rounded-[1.6rem] p-4">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">People needing attention</p>
              <div className="mt-4 space-y-3">
                {employeesNeedingAttention.map(({ employee, reason }) => (
                  <div key={employee.id} className="glass-chip flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{employee.fullName}</p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{employee.department} / {reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenEmployeeInsights(employee)}
                      className="glass-button rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className={panelClass}>
          <SectionTitle title="Timesheet Health" />
          <div className={`mt-5 ${subPanelClass}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Submission compliance</p>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{formatPercent(complianceRate)}</p>
              </div>
              <div className={`${activeControlClass} px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]`}>
                {rangeOptions.find((option) => option.id === range)?.label}
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {timesheetHealth.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
                    <span>{item.label}</span>
                    <span>{item.count} / {formatPercent(item.share)}</span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-900">
                    <div className={`h-full rounded-full ${item.tone}`} style={{ width: `${item.share}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={panelClass}>
          <SectionTitle title="Hours Trend" />
          <div className={`mt-5 flex h-[260px] items-end gap-3 ${subPanelClass}`}>
            {hoursTrend.points.map((point) => (
              <div key={point.date} className="flex flex-1 flex-col items-center gap-3">
                <div className="flex h-44 w-full items-end">
                  <div
                    className="w-full rounded-t-2xl bg-gradient-to-t from-zinc-900 via-zinc-500 to-zinc-200 dark:from-white dark:via-zinc-300 dark:to-zinc-600"
                    style={{ height: `${Math.max((point.total / hoursTrend.max) * 100, point.total > 0 ? 14 : 0)}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{point.label}</p>
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{formatHours(point.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className={panelClass}>
          <SectionTitle title="Billable Mix" />
          <div className={`mt-5 ${subPanelClass}`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.4rem] border border-zinc-200 bg-white/90 p-4 dark:border-white/10 dark:bg-white/10">
                <p className="text-sm text-zinc-700 dark:text-zinc-200">Billable Hours</p>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{formatHours(billableHours)}</p>
              </div>
              <div className="glass-subpanel rounded-[1.4rem] p-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">Non-Billable Hours</p>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{formatHours(nonBillableHours)}</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
                <span>Billable Share</span>
                <span>{formatPercent(billableHours + nonBillableHours === 0 ? 0 : (billableHours / (billableHours + nonBillableHours)) * 100)}</span>
              </div>
              <div className="mt-2 h-3 rounded-full bg-zinc-200 dark:bg-zinc-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-zinc-900 via-zinc-500 to-zinc-200 dark:from-white dark:via-zinc-300 dark:to-zinc-600"
                  style={{ width: `${billableHours + nonBillableHours === 0 ? 0 : (billableHours / (billableHours + nonBillableHours)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className={panelClass}>
          <SectionTitle title="Team Compliance Snapshot" />
          <div className="mt-5 space-y-4">
            {departmentsWithLowCompliance.slice(0, 5).map((item) => (
              <div key={item.department} className={itemPanelClass}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">{item.department}</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.submittedEmployees} of {item.expectedEmployees} employees submitted</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-zinc-900 dark:text-white">{formatPercent(item.complianceRate)}</p>
                  </div>
                </div>
                <div className="mt-3 h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-900">
                  <div
                    className={`h-full rounded-full ${item.complianceRate >= 85 ? "bg-zinc-400 dark:bg-zinc-200" : item.complianceRate >= 70 ? "bg-zinc-500 dark:bg-zinc-300" : "bg-zinc-700 dark:bg-zinc-400"}`}
                    style={{ width: `${item.complianceRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <section className={panelClass}>
          <SectionTitle title="Recent Activity" />
          <div className="mt-5 space-y-4">
            {recentActivity.length > 0 ? recentActivity.map((item) => (
              <div key={item.id} className={`${itemPanelClass} flex items-start justify-between gap-4`}>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.actor} {item.action}</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.target}</p>
                  <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{formatDateTime(item.timestamp)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[item.status] ?? statusClasses.Active}`}>{item.status}</span>
              </div>
            )) : (
              <div className="rounded-[1.5rem] border border-dashed border-zinc-300 px-6 py-14 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No recent actions found in this scope.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className={panelClass}>
            <SectionTitle title="Delivery Watchlist" />
            <div className="mt-5 space-y-4">
              {(delayedProjects.length > 0 ? delayedProjects : activeProjects.slice(0, 3)).slice(0, 3).map((project) => (
                <div key={project.id} className={itemPanelClass}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">{project.name}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{project.department} / {project.managerName || project.projectLead}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[project.status] ?? statusClasses.Active}`}>{project.status}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                    <span>{project.priority} priority</span>
                    <span>Ends {formatDisplayDate(project.endDate, { day: "2-digit", month: "short" })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};

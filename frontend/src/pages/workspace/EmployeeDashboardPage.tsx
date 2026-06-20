import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { DAILY_WORK_HOURS as DAY_HOURS, WEEKLY_WORK_HOURS as WEEK_HOURS } from "../../constants/timesheet";
import { useProjects } from "../../hooks/useProjects";
import { leaveService } from "../../services/leaveService";
import { taskService } from "../../services/taskService";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { LeaveRequest } from "../../types/leave";
import type { DailyTimesheet, TaskItem } from "../../types/task";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import "./EmployeeDashboardPage.css";

const colors = ["#818cf8", "#06b6d4", "#22c55e", "#f59e0b", "#f43f5e"];

const dateOnly = (value: string | Date) => {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const weekStartOf = (date: Date) => {
  const next = new Date(date);
  next.setDate(next.getDate() + (next.getDay() === 0 ? -6 : 1 - next.getDay()));
  next.setHours(0, 0, 0, 0);
  return next;
};

const formatDate = (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
  dateOnly(value).toLocaleDateString(undefined, options ?? { day: "2-digit", month: "short", year: "numeric" });

const formatHours = (value: number) => `${Number(value || 0).toFixed(1).replace(".0", "")}h`;

const taskStatus = (status?: string) => {
  const value = status?.trim().toLowerCase();
  if (value === "in progress") return "In Progress";
  if (value === "review") return "Review";
  if (value === "done" || value === "completed" || value === "approved") return "Done";
  return "To Do";
};

const pillClass = (status: string) => {
  const value = status.toLowerCase();
  if (value.includes("approved") || value.includes("done")) return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-500/20";
  if (value.includes("submitted") || value.includes("review")) return "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500 border border-amber-200/40 dark:border-amber-500/20";
  if (value.includes("rejected") || value.includes("missing") || value.includes("overdue")) return "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500 border border-rose-200/40 dark:border-rose-500/20";
  if (value.includes("progress")) return "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-200/40 dark:border-sky-500/20";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/30";
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

const donutGradient = (segments: Array<{ percentage: number; color: string }>) => {
  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    cursor += segment.percentage;
    return `${segment.color} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(", ") || "#e2e8f0 0% 100%"})`;
};

const heroClass = "text-zinc-900 dark:text-white";

const alertToneStyles = {
  danger: {
    border: "border-rose-500/25 bg-rose-500/5 hover:border-rose-500/35 hover:shadow-[0_0_20px_rgba(244,63,94,0.12)]",
    text: "text-rose-600 dark:text-rose-400",
  },
  warning: {
    border: "border-amber-500/25 bg-amber-500/5 hover:border-amber-500/35 hover:shadow-[0_0_20px_rgba(245,158,11,0.12)]",
    text: "text-amber-600 dark:text-amber-500",
  },
  info: {
    border: "border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  success: {
    border: "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]",
    text: "text-emerald-600 dark:text-emerald-500",
  },
} as const;

function ProgressBar({ value, tone }: { value: number; tone?: "sky" | "amber" | "emerald" | "rose" | string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  let fillClass = "progress-fill-premium";
  if (tone === "emerald") fillClass = "progress-fill-premium progress-fill-emerald";
  else if (tone === "rose") fillClass = "progress-fill-premium progress-fill-rose";
  else if (tone === "amber") fillClass = "progress-fill-premium progress-fill-amber";
  else if (tone === "sky") fillClass = "progress-fill-premium progress-fill-sky";
  else if (typeof tone === "string" && tone.includes("bg-")) fillClass = `progress-fill-premium ${tone}`;

  return (
    <div className="progress-bar-premium">
      <div className={fillClass} style={{ width: `${clamped}%` }} />
    </div>
  );
}

const KpiCard = ({
  title,
  value,
  note,
  icon,
  color,
  href,
}: {
  title: string;
  value: string;
  note: string;
  icon: IconName;
  color: "sky" | "amber" | "indigo" | "rose" | "emerald" | "zinc";
  href?: string;
}) => {
  const cardColors = {
    indigo: {
      border: "border-indigo-500/25 dark:border-indigo-500/10",
      iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
      value: "text-indigo-600 dark:text-indigo-400",
      glow: "hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)] hover:border-indigo-500/30",
    },
    emerald: {
      border: "border-emerald-500/25 dark:border-emerald-500/10",
      iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
      value: "text-emerald-600 dark:text-emerald-400",
      glow: "hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)] hover:border-emerald-500/30",
    },
    sky: {
      border: "border-sky-500/25 dark:border-sky-500/10",
      iconBg: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
      value: "text-sky-600 dark:text-sky-400",
      glow: "hover:shadow-[0_0_30px_-5px_rgba(56,189,248,0.15)] hover:border-sky-500/30",
    },
    rose: {
      border: "border-rose-500/25 dark:border-rose-500/10",
      iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
      value: "text-rose-600 dark:text-rose-400",
      glow: "hover:shadow-[0_0_30px_-5px_rgba(244,63,94,0.15)] hover:border-rose-500/30",
    },
    amber: {
      border: "border-amber-500/25 dark:border-amber-500/10",
      iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
      value: "text-amber-600 dark:text-amber-400",
      glow: "hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] hover:border-amber-500/30",
    },
    zinc: {
      border: "border-zinc-200/25 dark:border-zinc-800/10",
      iconBg: "bg-zinc-100 text-zinc-650 dark:bg-zinc-800/20 dark:text-zinc-400",
      value: "text-zinc-700 dark:text-zinc-300",
      glow: "hover:shadow-[0_0_30px_-5px_rgba(113,113,122,0.1)] hover:border-zinc-300/30",
    },
  };

  const selected = cardColors[color];

  const card = (
    <article className={`relative h-full overflow-hidden rounded-[2rem] border ${selected.border} bg-white/70 dark:bg-zinc-950/40 p-5 backdrop-blur-xl shadow-sm transition-all duration-300 hover:-translate-y-1 ${selected.glow}`}>
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{title}</p>
            <p className={`mt-3 text-3xl font-extrabold tracking-tight ${selected.value}`}>
              {value}
            </p>
          </div>
          <div className={`rounded-2xl border border-transparent ${selected.iconBg} p-3 shadow-sm`}>
            <Icon name={icon} className="h-5 w-5" />
          </div>
        </div>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-500 leading-normal">{note}</p>
      </div>
    </article>
  );

  return href ? <Link to={href} className="block h-full">{card}</Link> : card;
};

export const EmployeeDashboardPage = ({ user }: { user: AuthUser }) => {
  const { projects, loading: projectsLoading } = useProjects();
  const [dailySheets, setDailySheets] = useState<DailyTimesheet[]>([]);
  const [weeklySheets, setWeeklySheets] = useState<TimesheetWeekRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const todayIso = isoDate(today);
  const weekStart = useMemo(() => weekStartOf(today), [today]);
  const weekEnd = useMemo(() => addDays(weekStart, 5), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dailyRecords, weeklyRecords, taskRecords, leaveRecords] = await Promise.all([
          taskService.getDailyTimesheetHistory(user.id),
          timesheetService.listWeeks(user.id),
          taskService.getTaskHistory(),
          leaveService.getLeaves(),
        ]);
        setDailySheets(dailyRecords);
        setWeeklySheets(weeklyRecords);
        setTasks(taskRecords.filter((task) => task.assignedTo === user.id));
        setLeaves(leaveRecords.filter((leave) => leave.employeeId === user.id));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user.id]);

  const currentWeek = useMemo(() => weeklySheets.find((sheet) => sheet.weekStart === isoDate(weekStart)) ?? null, [weekStart, weeklySheets]);

  const hoursForDate = (date: string) => {
    const weekly = currentWeek?.rows.reduce((sum, row) => sum + Number(row.hours[date] || 0), 0) ?? 0;
    const daily = dailySheets.filter((sheet) => sheet.date === date).reduce((sum, sheet) => sum + Number(sheet.totalHours || 0), 0);
    return Math.max(weekly, daily);
  };

  const weeklyHours = weekDays.map((date) => {
    const dateKey = isoDate(date);
    return {
      date: dateKey,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      logged: hoursForDate(dateKey),
      isToday: dateKey === todayIso,
    };
  });
  const todayLogged = weeklyHours.find((day) => day.date === todayIso)?.logged ?? 0;
  const weekLogged = weeklyHours.reduce((sum, day) => sum + day.logged, 0);
  const completion = Math.min(100, Math.round((weekLogged / WEEK_HOURS) * 100));

  const leaveDates = new Set(
    leaves
      .filter((leave) => leave.status === "Approved")
      .flatMap((leave) => weekDays.filter((day) => dateOnly(leave.startDate) <= day && dateOnly(leave.endDate) >= day).map(isoDate)),
  );
  const missingDays = weeklyHours.filter((day) => dateOnly(day.date) <= today && day.logged === 0 && !leaveDates.has(day.date));
  const pendingApprovalHours =
    currentWeek?.status === "Submitted"
      ? currentWeek.totalHours
      : weeklySheets.filter((sheet) => sheet.status === "Submitted").reduce((sum, sheet) => sum + Number(sheet.totalHours || 0), 0);
  const rejectedEntries =
    (currentWeek?.status === "Rejected" ? Math.max(1, currentWeek.rows.length) : 0) +
    dailySheets.filter((sheet) => sheet.status === "Rejected").reduce((sum, sheet) => sum + Math.max(1, sheet.entries.length), 0);
  const activeProjects = projects.filter((project) => project.status === "Active" && (project.teamMemberIds.includes(user.id) || project.managerId === user.id));
  const activeTasks = tasks
    .filter((task) => taskStatus(task.status) !== "Done")
    .filter((task) => !task.endDate || dateOnly(task.endDate) >= addDays(today, -1))
    .sort((left, right) => left.endDate.localeCompare(right.endDate));

  const projectAllocation = useMemo(() => {
    const grouped = new Map<string, number>();
    currentWeek?.rows.forEach((row) => {
      const total = Object.values(row.hours).reduce((sum, value) => sum + Number(value || 0), 0);
      if (total > 0) grouped.set(row.projectName || "Unassigned", (grouped.get(row.projectName || "Unassigned") ?? 0) + total);
    });
    if (grouped.size === 0) {
      dailySheets
        .filter((sheet) => dateOnly(sheet.date) >= weekStart && dateOnly(sheet.date) <= weekEnd)
        .flatMap((sheet) => sheet.entries)
        .forEach((entry) => {
          const task = tasks.find((item) => item.id === entry.taskId);
          const projectName = task?.projectName || "Unassigned";
          grouped.set(projectName, (grouped.get(projectName) ?? 0) + Number(entry.hours || 0));
        });
    }
    const total = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0);
    return Array.from(grouped.entries()).map(([name, hours], index) => ({
      name,
      hours,
      percentage: total > 0 ? (hours / total) * 100 : 0,
      color: colors[index % colors.length],
    }));
  }, [currentWeek, dailySheets, tasks, weekEnd, weekStart]);

  const alerts = [
    ...missingDays.map((day) => ({ title: `${day.label} timesheet missing`, message: "Add hours before submitting this week.", tone: "danger" as const, href: workspaceRoutes["my-timesheet"].path })),
    ...(rejectedEntries > 0 ? [{ title: "Rejected entry needs correction", message: `${rejectedEntries} entry${rejectedEntries === 1 ? "" : "ies"} need review.`, tone: "danger" as const, href: workspaceRoutes["timesheet-history"].path }] : []),
    ...(pendingApprovalHours > 0 ? [{ title: "Submitted for approval", message: `${formatHours(pendingApprovalHours)} waiting with manager / HR.`, tone: "info" as const, href: workspaceRoutes["timesheet-history"].path }] : []),
    ...activeTasks
      .filter((task) => task.endDate && dateOnly(task.endDate) < today)
      .slice(0, 1)
      .map((task) => ({ title: "Task deadline passed", message: `${task.title} is overdue.`, tone: "warning" as const, href: workspaceRoutes["my-timesheet"].path })),
    ...(activeProjects.length === 0 ? [{ title: "No active project assigned", message: "Contact your manager if you need project access.", tone: "info" as const }] : []),
  ].slice(0, 5);
  const visibleAlerts = alerts.length > 0 ? alerts : [{ title: "All clear", message: "No missing entries or approval problems right now.", tone: "success" as const }];

  const recentActivity = [
    ...weeklySheets.map((sheet) => ({
      id: `week-${sheet.id}`,
      title: sheet.status === "Submitted" ? "Submitted weekly timesheet" : sheet.status === "Approved" ? "Weekly timesheet approved" : sheet.status === "Rejected" ? "Weekly timesheet rejected" : "Saved weekly draft",
      detail: `${formatDate(sheet.weekStart, { day: "2-digit", month: "short" })} to ${formatDate(sheet.weekEnd, { day: "2-digit", month: "short" })} · ${formatHours(sheet.totalHours)}`,
      timestamp: sheet.updatedAt,
      status: sheet.status,
    })),
    ...dailySheets.slice(0, 6).map((sheet) => ({
      id: `day-${sheet.id}`,
      title: `Logged ${formatHours(sheet.totalHours)}`,
      detail: `${formatDate(sheet.date, { day: "2-digit", month: "short" })} · ${sheet.entries.length} task entr${sheet.entries.length === 1 ? "y" : "ies"}`,
      timestamp: sheet.date,
      status: sheet.status,
    })),
  ].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()).slice(0, 6);

  if (loading || projectsLoading) {
    return <LoadingSpinner label="Loading employee dashboard..." />;
  }

  const weekStatus = currentWeek?.status ?? (weekLogged > 0 ? "Draft" : "Timesheet Incomplete");
  const workdayStatus = today.getDay() === 0 ? "Weekly Off" : leaveDates.has(todayIso) ? "On Leave Today" : "Working Day";

  return (
    <div className="dashboard-page space-y-6">
      <div className="dashboard-bg-glow-1" />
      <div className="dashboard-bg-glow-2" />

      <section className={heroClass}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">{greeting()}, {user.fullName.split(" ")[0]}</h2>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-2xl border border-zinc-200/80 bg-white/40 backdrop-blur-md px-4 py-2 text-zinc-650 shadow-sm dark:border-zinc-700/50 dark:bg-black/60 dark:text-zinc-300">{formatDate(today, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
              <span className="rounded-2xl bg-emerald-50 px-4 py-2 font-bold text-emerald-700 border border-emerald-200/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">{workdayStatus}</span>
              <span className={`rounded-2xl px-4 py-2 font-bold ${pillClass(weekStatus)}`}>{weekStatus}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={workspaceRoutes["my-timesheet"].path} className="inline-flex h-12 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-black hover:bg-black dark:hover:bg-zinc-100 px-5 text-sm font-bold transition hover:-translate-y-0.5 shadow-md">Fill Timesheet</Link>
            <button type="button" className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white/60 backdrop-blur-md px-5 text-sm font-semibold text-zinc-700 transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 hover:-translate-y-0.5 shadow-sm">Start Timer</button>
            <Link to={workspaceRoutes["timesheet-history"].path} className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white/60 backdrop-blur-md px-5 text-sm font-semibold text-zinc-700 transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 hover:-translate-y-0.5 shadow-sm">View History</Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Today Logged" value={formatHours(todayLogged)} note={`${Math.max(0, DAY_HOURS - todayLogged).toFixed(1).replace(".0", "")}h remaining`} icon="clock" href={workspaceRoutes["my-timesheet"].path} color="indigo" />
        <KpiCard title="Weekly Total" value={`${formatHours(weekLogged)} / ${WEEK_HOURS}h`} note={`${completion}% completed`} icon="dashboard" href={workspaceRoutes["timesheet-history"].path} color="emerald" />
        <KpiCard title="Missing Days" value={`${missingDays.length}`} note={missingDays.length > 0 ? missingDays.map((day) => day.label).join(", ") : "No missing day"} icon="timesheet" href={workspaceRoutes["my-timesheet"].path} color="rose" />
        <KpiCard title="Pending Approval" value={formatHours(pendingApprovalHours)} note={pendingApprovalHours > 0 ? "Waiting with manager / HR" : "Nothing pending"} icon="approvals" href={workspaceRoutes["timesheet-history"].path} color="sky" />
        <KpiCard title="Rejected Entries" value={`${rejectedEntries}`} note={rejectedEntries > 0 ? "Needs correction" : "No rejections"} icon="inbox" href={workspaceRoutes["timesheet-history"].path} color="amber" />
        <KpiCard title="Active Tasks" value={`${activeTasks.length}`} note={`${activeProjects.length} active project(s)`} icon="projects" href={workspaceRoutes["my-timesheet"].path} color="zinc" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="dashboard-panel-premium p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Icon name="clock" className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Mon to Sat effort</h3>
            </div>
            <span className="rounded-full border border-zinc-200 bg-white/40 backdrop-blur-md px-4 py-1.5 text-xs font-bold text-zinc-700 dark:border-white/5 dark:bg-zinc-950/40 dark:text-zinc-300">{formatHours(weekLogged)} logged</span>
          </div>
          <div className="chart-container-premium mt-6 flex h-[300px] items-end gap-4 p-5">
            {weeklyHours.map((day) => (
              <Link key={day.date} to={workspaceRoutes["my-timesheet"].path} className="group flex flex-1 flex-col items-center gap-3">
                <div className="relative flex h-52 w-full items-end rounded-2xl bg-white/40 dark:bg-black/40 border border-zinc-200/30 dark:border-zinc-800/30 px-2 py-2">
                  <div className="absolute left-2 right-2 top-2/4 border-t border-dashed border-zinc-300/40 dark:border-zinc-700/40" />
                  <div className={`w-full rounded-t-2xl transition group-hover:brightness-95 ${day.isToday ? "bg-indigo-500" : day.logged >= DAY_HOURS ? "bg-emerald-500" : day.logged > 0 ? "bg-indigo-400/60" : "bg-zinc-300/60 dark:bg-zinc-800/60"}`} style={{ height: `${Math.max(4, Math.min(100, (day.logged / DAY_HOURS) * 100))}%` }} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{day.label}</p>
                  <p className="mt-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{formatHours(day.logged)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="dashboard-panel-premium p-6">
          <div className="flex items-center gap-2">
            <Icon name="projects" className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Project split</h3>
          </div>
          {projectAllocation.length > 1 ? (
            <>
              <div className="mx-auto mt-6 flex h-52 w-52 items-center justify-center rounded-full shadow-lg" style={{ background: donutGradient(projectAllocation) }}>
                <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white/95 dark:bg-zinc-950/95 text-center shadow-inner backdrop-blur-md">
                  <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{formatHours(weekLogged)}</p>
                  <p className="text-[10px] uppercase font-black tracking-wider text-zinc-400">logged</p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {projectAllocation.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold">{item.name}</span>
                    </span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400">{Math.round(item.percentage)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="chart-container-premium mt-6 flex h-52 items-center justify-center text-center p-8">
              <div>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No project split yet</p>
                <p className="mt-1 text-xs text-zinc-400">Hours logged to project tasks will show split data.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="dashboard-panel-premium p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Icon name="approvals" className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">My Work</h3>
            </div>
            <Link to={workspaceRoutes["my-timesheet"].path} className="rounded-full bg-zinc-950 hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-zinc-100 px-4 py-1.5 text-xs font-bold transition hover:-translate-y-0.5 shadow-md">Log Time</Link>
          </div>
          <div className="mt-5 space-y-4">
            {activeTasks.length > 0 ? activeTasks.slice(0, 5).map((task) => {
              const spent = currentWeek?.rows.filter((row) => row.taskName === task.title || row.projectId === task.projectId).reduce((sum, row) => sum + Object.values(row.hours).reduce((rowSum, hours) => rowSum + Number(hours || 0), 0), 0) ?? 0;
              const progress = task.totalHours > 0 ? Math.min(100, Math.round((spent / task.totalHours) * 100)) : 0;
              const dueDate = task.endDate ? dateOnly(task.endDate) : null;
              const due = !dueDate ? "No due date" : dueDate < today ? "Overdue" : isoDate(dueDate) === todayIso ? "Due today" : `Due ${formatDate(dueDate, { day: "2-digit", month: "short" })}`;
              
              const statusName = taskStatus(task.status);
              const progressTone = statusName === "Done" ? "emerald" : statusName === "In Progress" ? "sky" : "amber";

              return (
                <div key={task.id} className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/40 bg-zinc-50/40 dark:bg-zinc-950/20 p-4 backdrop-blur-md transition-all duration-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.08)] hover:border-indigo-500/20">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white">{task.title}</p>
                      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{task.projectName || "Project"} · {due}</p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${pillClass(statusName)}`}>
                      {statusName}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    <span>Spent: <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatHours(spent)}</span></span>
                    <span>Planned: <span className="font-bold text-zinc-700 dark:text-zinc-300">{formatHours(task.totalHours)}</span></span>
                  </div>
                  <div className="mt-2.5">
                    <ProgressBar value={progress} tone={progressTone} />
                  </div>
                </div>
              );
            }) : (
              <div className="chart-container-premium p-10 text-center">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No active tasks</p>
                <p className="mt-1 text-xs text-zinc-400">All tasks completed or none assigned.</p>
              </div>
            )}
          </div>
        </section>

        <section className="dashboard-panel-premium p-6">
          <div className="flex items-center gap-2">
            <Icon name="shield" className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Needs Action</h3>
          </div>
          <div className="mt-5 space-y-4">
            {visibleAlerts.map((alert) => {
              const styles = alertToneStyles[alert.tone] ?? alertToneStyles.info;
              const content = (
                <div className={`rounded-2xl border ${styles.border} p-4 backdrop-blur-md transition-all duration-300`}>
                  <p className={`font-bold ${styles.text}`}>{alert.title}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{alert.message}</p>
                </div>
              );
              return "href" in alert && alert.href ? (
                <Link key={alert.title} to={alert.href} className="block transition-transform hover:-translate-y-0.5">
                  {content}
                </Link>
              ) : (
                <div key={alert.title} className="transition-transform hover:-translate-y-0.5">
                  {content}
                </div>
              );
            })}
          </div>
          <div className="chart-container-premium mt-6">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }, (_, index) => {
                const date = addDays(today, index - 6);
                const key = isoDate(date);
                const status = currentWeek?.status === "Rejected"
                  ? "Rejected"
                  : leaveDates.has(key)
                    ? "Leave"
                    : hoursForDate(key) === 0 && date <= today
                      ? "Missing"
                      : currentWeek?.status === "Approved"
                        ? "Approved"
                        : currentWeek?.status === "Submitted"
                          ? "Submitted"
                          : hoursForDate(key) > 0
                            ? "Draft"
                            : "Upcoming";
                
                return (
                  <div key={key} className="text-center flex flex-col items-center">
                    <div
                      className={`h-9 w-9 flex items-center justify-center rounded-xl font-black text-xs ${pillClass(status)} shadow-sm transition hover:scale-105`}
                      title={`${formatDate(date, { weekday: "short" })}: ${status}`}
                    >
                      {formatDate(date, { day: "numeric" })}
                    </div>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-550">
                      {formatDate(date, { weekday: "short" })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <section className="dashboard-panel-premium p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Icon name="history" className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Recent Activity</h3>
          </div>
          <Link to={workspaceRoutes["timesheet-history"].path} className="rounded-full border border-zinc-250 bg-white/40 dark:border-zinc-800 dark:bg-zinc-950/40 px-4 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition hover:-translate-y-0.5 shadow-sm">View All</Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recentActivity.length > 0 ? recentActivity.map((item) => {
            const isApproved = item.status === "Approved";
            const isRejected = item.status === "Rejected";
            const borderGlow = isApproved
              ? "hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] border-emerald-500/10 dark:border-emerald-500/5 bg-emerald-50/10 dark:bg-emerald-950/5"
              : isRejected
                ? "hover:border-rose-500/30 hover:shadow-[0_0_15px_rgba(244,63,94,0.15)] border-rose-500/10 dark:border-rose-500/5 bg-rose-50/10 dark:bg-rose-950/5"
                : "hover:border-indigo-500/25 hover:shadow-[0_0_15px_rgba(99,102,241,0.08)] border-zinc-200/60 dark:border-zinc-800/40 bg-zinc-50/40 dark:bg-zinc-950/20";
            return (
              <div key={item.id} className={`rounded-2xl border p-4 backdrop-blur-md transition-all duration-300 ${borderGlow}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-white">{item.title}</p>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</p>
                    <p className="mt-2.5 text-[10px] uppercase font-black tracking-wider text-zinc-400">{formatDate(item.timestamp)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${pillClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            );
          }) : (
            <div className="chart-container-premium p-10 text-center md:col-span-2 xl:col-span-3">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No dashboard activity yet</p>
              <p className="mt-1 text-xs text-zinc-400">Start by filling today’s timesheet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

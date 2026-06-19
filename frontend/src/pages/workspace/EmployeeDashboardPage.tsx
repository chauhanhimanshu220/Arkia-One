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

const colors = ["#09090b", "#06b6d4", "#22c55e", "#f59e0b", "#f43f5e"];

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
  if (value.includes("approved") || value.includes("done")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (value.includes("submitted") || value.includes("review")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (value.includes("rejected") || value.includes("missing") || value.includes("overdue")) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  if (value.includes("progress")) return "bg-sky-100 text-zinc-700 dark:bg-sky-500/15 dark:text-zinc-300";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
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

const heroClass =
  "text-zinc-900 dark:text-white";

const KpiCard = ({ title, value, icon, href }: { title: string; value: string; note: string; icon: IconName; href?: string }) => {
  const card = (
    <div className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-white/90 p-5 transition hover:-translate-y-0.5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/85">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
          <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{value}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:bg-black dark:text-zinc-400 dark:text-zinc-500">
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
  return href ? <Link to={href}>{card}</Link> : card;
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
    <section className="space-y-6">
      <div className={heroClass}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{greeting()}, {user.fullName.split(" ")[0]}</h2>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-2xl border border-zinc-200 bg-white/85 px-4 py-2 text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-300">{formatDate(today, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
              <span className="rounded-2xl bg-emerald-50 px-4 py-2 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">{workdayStatus}</span>
              <span className={`rounded-2xl px-4 py-2 font-semibold ${pillClass(weekStatus)}`}>{weekStatus}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={workspaceRoutes["my-timesheet"].path} className="inline-flex h-12 items-center justify-center rounded-2xl bg-black px-5 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">Fill Timesheet</Link>
            <button type="button" className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white/90 px-5 text-sm font-semibold text-zinc-700 transition hover:bg-white dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">Start Timer</button>
            <Link to={workspaceRoutes["timesheet-history"].path} className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white/90 px-5 text-sm font-semibold text-zinc-700 transition hover:bg-white dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">View History</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Today Logged" value={formatHours(todayLogged)} note={`${Math.max(0, DAY_HOURS - todayLogged).toFixed(1).replace(".0", "")}h remaining`} icon="clock" href={workspaceRoutes["my-timesheet"].path} />
        <KpiCard title="Weekly Total" value={`${formatHours(weekLogged)} / ${WEEK_HOURS}h`} note={`${completion}% completed`} icon="dashboard" href={workspaceRoutes["timesheet-history"].path} />
        <KpiCard title="Missing Days" value={`${missingDays.length}`} note={missingDays.length > 0 ? missingDays.map((day) => day.label).join(", ") : "No missing day"} icon="timesheet" href={workspaceRoutes["my-timesheet"].path} />
        <KpiCard title="Pending Approval" value={formatHours(pendingApprovalHours)} note={pendingApprovalHours > 0 ? "Waiting with manager / HR" : "Nothing pending"} icon="approvals" href={workspaceRoutes["timesheet-history"].path} />
        <KpiCard title="Rejected Entries" value={`${rejectedEntries}`} note={rejectedEntries > 0 ? "Needs correction" : "No rejections"} icon="inbox" href={workspaceRoutes["timesheet-history"].path} />
        <KpiCard title="Active Tasks" value={`${activeTasks.length}`} note={`${activeProjects.length} active project(s)`} icon="projects" href={workspaceRoutes["my-timesheet"].path} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h3 className="text-xl font-bold text-zinc-900 dark:text-white">Mon to Sat effort</h3></div>
            <span className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">{formatHours(weekLogged)} logged</span>
          </div>
          <div className="mt-6 flex h-[300px] items-end gap-4 rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70">
            {weeklyHours.map((day) => (
              <Link key={day.date} to={workspaceRoutes["my-timesheet"].path} className="group flex flex-1 flex-col items-center gap-3">
                <div className="relative flex h-52 w-full items-end rounded-2xl bg-white px-2 py-2 dark:bg-black">
                  <div className="absolute left-2 right-2 top-2/4 border-t border-dashed border-zinc-300" />
                  <div className={`w-full rounded-t-2xl transition group-hover:brightness-95 ${day.isToday ? "bg-zinc-950 dark:bg-white" : day.logged >= DAY_HOURS ? "bg-emerald-500" : day.logged > 0 ? "bg-zinc-100 dark:bg-white/10" : "bg-zinc-300"}`} style={{ height: `${Math.max(4, Math.min(100, (day.logged / DAY_HOURS) * 100))}%` }} />
                </div>
                <div className="text-center"><p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{day.label}</p><p className="mt-1 text-xs text-[#185FA5] dark:text-[#B5D4F4]">{formatHours(day.logged)}</p></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Project split</h3>
          {projectAllocation.length > 1 ? (
            <>
              <div className="mx-auto mt-6 flex h-52 w-52 items-center justify-center rounded-full" style={{ background: donutGradient(projectAllocation) }}>
                <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner dark:bg-black"><p className="text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatHours(weekLogged)}</p><p className="text-xs text-[#185FA5] dark:text-[#B5D4F4]">logged</p></div>
              </div>
              <div className="mt-6 space-y-3">{projectAllocation.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{Math.round(item.percentage)}%</span></div>)}</div>
            </>
          ) : (
            <div className="mt-6 rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70 dark:text-zinc-400">No split yet.</div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
          <div className="flex items-center justify-between gap-4"><div><h3 className="text-xl font-bold text-zinc-900 dark:text-white">My work</h3></div><Link to={workspaceRoutes["my-timesheet"].path} className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white dark:text-black dark:bg-white dark:text-black">Log Time</Link></div>
          <div className="mt-5 space-y-4">
            {activeTasks.length > 0 ? activeTasks.slice(0, 5).map((task) => {
              const spent = currentWeek?.rows.filter((row) => row.taskName === task.title || row.projectId === task.projectId).reduce((sum, row) => sum + Object.values(row.hours).reduce((rowSum, hours) => rowSum + Number(hours || 0), 0), 0) ?? 0;
              const progress = task.totalHours > 0 ? Math.min(100, Math.round((spent / task.totalHours) * 100)) : 0;
              const dueDate = task.endDate ? dateOnly(task.endDate) : null;
              const due = !dueDate ? "No due date" : dueDate < today ? "Overdue" : isoDate(dueDate) === todayIso ? "Due today" : `Due ${formatDate(dueDate, { day: "2-digit", month: "short" })}`;
              return <div key={task.id} className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="font-semibold text-zinc-900 dark:text-white">{task.title}</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{task.projectName || "Project"} · {due}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${pillClass(taskStatus(task.status))}`}>{taskStatus(task.status)}</span></div><div className="mt-4 flex items-center justify-between text-sm text-zinc-500"><span><span className="text-[#185FA5] dark:text-[#B5D4F4]">{formatHours(spent)}</span> spent</span><span><span className="text-[#185FA5] dark:text-[#B5D4F4]">{formatHours(task.totalHours)}</span> planned</span></div><div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-900"><div className="h-full rounded-full bg-zinc-950 dark:bg-white" style={{ width: `${progress}%` }} /></div></div>;
            }) : <div className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70 dark:text-zinc-400">No active tasks.</div>}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Needs action</h3>
          <div className="mt-5 space-y-4">{visibleAlerts.map((alert) => { const tone = alert.tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-700" : alert.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-700" : alert.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-black/70 text-zinc-700 dark:text-zinc-300"; const content = <div className={`rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] dark:border-zinc-800 dark:border-l-[#378ADD] p-4 ${tone}`}><p className="font-semibold">{alert.title}</p></div>; return "href" in alert && alert.href ? <Link key={alert.title} to={alert.href}>{content}</Link> : <div key={alert.title}>{content}</div>; })}</div>
          <div className="mt-6 rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70"><div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }, (_, index) => { const date = addDays(today, index - 6); const key = isoDate(date); const status = currentWeek?.status === "Rejected" ? "Rejected" : leaveDates.has(key) ? "Leave" : hoursForDate(key) === 0 && date <= today ? "Missing" : currentWeek?.status === "Approved" ? "Approved" : currentWeek?.status === "Submitted" ? "Submitted" : hoursForDate(key) > 0 ? "Draft" : "Upcoming"; return <div key={key} className="text-center"><div className={`mx-auto h-9 rounded-xl ${pillClass(status)}`} title={`${formatDate(date, { weekday: "short" })}: ${status}`} /><p className="mt-2 text-xs font-semibold text-zinc-500">{formatDate(date, { weekday: "short" })}</p></div>; })}</div></div>
        </section>
      </div>

      <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-xl font-bold text-zinc-900 dark:text-white">Recent activity</h3></div><Link to={workspaceRoutes["timesheet-history"].path} className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200">View All</Link></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recentActivity.length > 0 ? recentActivity.map((item) => <div key={item.id} className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-zinc-900 dark:text-white">{item.title}</p><p className="mt-3 text-xs text-zinc-400">{formatDate(item.timestamp)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${pillClass(item.status)}`}>{item.status}</span></div></div>) : <div className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70 dark:text-zinc-400 md:col-span-2 xl:col-span-3">No dashboard activity yet. Start by filling today’s timesheet.</div>}
        </div>
      </section>
    </section>
  );
};


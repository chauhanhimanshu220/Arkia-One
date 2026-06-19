import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, type IconName } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer } from "../../components/ToastContainer";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useMyDashboard } from "../../hooks/useMyDashboard";
import { useToast } from "../../hooks/useToast";
import type { AuthUser } from "../../types/auth";
import type { DateRange, DateRangeFilter } from "../../types/dashboard";

type PersonalDashboardRange = Extract<DateRange, "today" | "this_week" | "this_month" | "custom">;
type TrendSemantic = "positive" | "needs-action" | "neutral";
type IconTheme = "purple" | "teal";

const panelClass =
  "rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50";
const filterClass =
  "h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/10 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:focus:border-sky-500 dark:focus:ring-sky-500/10";
const chartCardClass =
  "rounded-xl border border-zinc-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-4 dark:border-zinc-800/60 dark:bg-[linear-gradient(180deg,rgba(10,10,10,0.8),rgba(0,0,0,0.7))] shadow-inner";
const heroClass =
  "text-zinc-900 dark:text-white";
const heroMetricCardBase =
  "rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50";

const rangeOptions: Array<{ value: PersonalDashboardRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
];

const isPersonalRange = (value: string | null): value is PersonalDashboardRange =>
  ["today", "this_week", "this_month", "custom"].includes(value ?? "");

const toInputDate = (value: Date) =>
  new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value);

const formatHours = (value: number) =>
  `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)}h`;

const formatLastUpdated = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Fetching live data";

const formatActivityTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const getTrendChip = (semantic: TrendSemantic): { label: string; className: string } => {
  if (semantic === "positive") {
    return {
      label: "↑ on track",
      className: "bg-[#E6F1FB] text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4]",
    };
  }

  if (semantic === "needs-action") {
    return {
      label: "↓ needs action",
      className: "bg-[#FEF0EC] text-[#D94F28] dark:bg-[#A83318]/30 dark:text-[#FFD2C6]",
    };
  }

  return {
    label: "— no change",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
};

const getIconThemeClass = () =>
  "bg-[#E6F1FB] text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4]";

const getSeverityToneClass = (severity: "high" | "medium" | "low") => {
  if (severity === "high") {
    return "border border-zinc-200/80 border-l-[4px] border-l-rose-500 bg-rose-50/40 hover:shadow-rose-500/5 dark:border-zinc-800 dark:border-l-rose-500 dark:bg-rose-950/10 dark:hover:shadow-rose-500/10";
  }
  if (severity === "medium") {
    return "border border-zinc-200/80 border-l-[4px] border-l-amber-500 bg-amber-50/40 hover:shadow-amber-500/5 dark:border-zinc-800 dark:border-l-amber-500 dark:bg-amber-950/10 dark:hover:shadow-amber-500/10";
  }
  return "border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/40 hover:shadow-[#378ADD]/5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/40 dark:hover:shadow-[#378ADD]/10";
};

const KpiCard = ({
  label,
  value,
  note,
  icon,
  to,
  iconTheme,
  trendSemantic,
  valueClassName,
  formatter,
}: {
  label: string;
  value: number;
  note: string;
  icon: IconName;
  to: string;
  iconTheme: IconTheme;
  trendSemantic: TrendSemantic;
  valueClassName?: string;
  formatter?: (value: number) => string;
}) => {
  const chip = getTrendChip(trendSemantic);

  return (
    <Link to={to} className="block h-full">
      <article className="relative h-full overflow-hidden rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-[#378ADD]/10 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:hover:shadow-[#378ADD]/20">
        <div className="relative flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className={`mt-3 text-3xl font-bold ${valueClassName ?? "text-[#185FA5] dark:text-[#B5D4F4]"}`}>
                {(formatter ?? formatCompactNumber)(value)}
              </p>
            </div>
            <div className="rounded-2xl border border-transparent bg-[#E6F1FB] p-3 text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4] shadow-sm">
              <Icon name={icon} className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-3">
            <span
              className={`inline-flex rounded-[20px] px-[10px] py-[3px] text-[11px] font-semibold tracking-wide ${chip.className}`}
            >
              {chip.label}
            </span>
            <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">{note}</p>
          </div>
        </div>
      </article>
    </Link>
  );
};

const QuickActionCard = ({
  title,
  description,
  to,
  icon,
}: {
  title: string;
  description: string;
  to: string;
  icon: IconName;
}) => (
  <Link
    to={to}
    className="group block rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-[#378ADD]/10 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:hover:shadow-[#378ADD]/20"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-base font-semibold text-zinc-900 transition group-hover:text-[#185FA5] dark:text-white dark:group-hover:text-[#B5D4F4]">{title}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <div className="rounded-2xl border border-transparent bg-[#E6F1FB] p-3 text-[#185FA5] transition group-hover:scale-110 dark:bg-[#0C447C]/30 dark:text-[#B5D4F4]">
        <Icon name={icon} className="h-5 w-5" />
      </div>
    </div>
  </Link>
);

const EmptyChartState = ({ title }: { title: string }) => (
  <div className={`${chartCardClass} flex h-[320px] items-center justify-center text-center`}>
    <div>
      <p className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Personal data will appear here once records are available for the selected range.
      </p>
    </div>
  </div>
);

export const MyDashboardPage = ({ user }: { user: AuthUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toasts, showToast, dismissToast } = useToast();
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const defaultEnd = useMemo(() => toInputDate(today), [today]);
  const initialRange = searchParams.get("range");
  const [selectedRange, setSelectedRange] = useState<PersonalDashboardRange>(
    isPersonalRange(initialRange) ? initialRange : "this_week",
  );
  const [customStart, setCustomStart] = useState(searchParams.get("startDate") ?? defaultStart);
  const [customEnd, setCustomEnd] = useState(searchParams.get("endDate") ?? defaultEnd);

  const customRangeValid = selectedRange !== "custom" || (Boolean(customStart) && Boolean(customEnd) && customStart <= customEnd);
  const activeFilter = useMemo<DateRangeFilter>(
    () =>
      selectedRange === "custom"
        ? customRangeValid
          ? { range: "custom", startDate: customStart, endDate: customEnd }
          : { range: "this_week" }
        : { range: selectedRange },
    [customEnd, customRangeValid, customStart, selectedRange],
  );
  const { data, loading, error, refresh } = useMyDashboard(user, activeFilter);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("range", selectedRange);
    if (selectedRange === "custom") {
      params.set("startDate", customStart);
      params.set("endDate", customEnd);
    }
    setSearchParams(params, { replace: true });
  }, [customEnd, customStart, selectedRange, setSearchParams]);

  const handleRefresh = useCallback(async () => {
    await refresh();
    showToast("My dashboard refreshed.", "success");
  }, [refresh, showToast]);

  const firstName = user.fullName.trim().split(/\s+/)[0] ?? user.fullName;
  const hoursLabel =
    selectedRange === "today" ? "Hours Today" : selectedRange === "this_month" ? "Hours This Month" : "Hours This Week";
  const completedActionsLabel =
    selectedRange === "today"
      ? "Completed Actions Today"
      : selectedRange === "this_month"
        ? "Completed Actions This Month"
        : "Completed Actions This Week";

  const chartOptions = useMemo(() => {
    const base: ApexOptions = {
      chart: { toolbar: { show: false }, fontFamily: "inherit", foreColor: "#71717a" },
      dataLabels: { enabled: false },
      grid: { borderColor: "rgba(161,161,170,0.12)", strokeDashArray: 4 },
      legend: { labels: { colors: "#71717a" } },
      tooltip: { theme: "dark" },
      xaxis: { axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { forceNiceScale: true },
    };

    return {
      weeklyHours: {
        ...base,
        stroke: { curve: "smooth", width: [0, 3.5] },
        colors: ["#378ADD", "#818CF8"],
        plotOptions: { bar: { borderRadius: 6, columnWidth: "42%" } },
      } satisfies ApexOptions,
      status: {
        ...base,
        labels: ["Draft", "Submitted", "Approved", "Rejected", "Resubmitted"],
        colors: ["#94A3B8", "#3B82F6", "#10B981", "#EF4444", "#F59E0B"],
        stroke: { width: 0 },
      } satisfies ApexOptions,
      projectHours: {
        ...base,
        labels: data.projectHours.map((item) => item.projectName),
        colors: ["#378ADD", "#6366F1", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B", "#EF4444"],
        stroke: { width: 0 },
      } satisfies ApexOptions,
    };
  }, [data.projectHours]);

  const kpiCards = [
    {
      label: hoursLabel,
      value: data.kpis.hoursLogged,
      note: "Logged working hours.",
      icon: "clock" as const,
      to: workspaceRoutes["my-timesheet"].path,
      iconTheme: "purple" as const,
      trendSemantic: "neutral" as TrendSemantic,
      formatter: formatHours,
    },
    {
      label: "Draft Entries",
      value: data.kpis.draftEntries,
      note: "Pending submissions.",
      icon: "timesheet" as const,
      to: workspaceRoutes["my-timesheet"].path,
      iconTheme: "purple" as const,
      trendSemantic: "neutral" as TrendSemantic,
    },
    {
      label: "Pending Approvals",
      value: data.kpis.pendingApprovals,
      note: "Tasks in queue.",
      icon: "approvals" as const,
      to: workspaceRoutes["approval-inbox"].path,
      iconTheme: "purple" as const,
      trendSemantic: "neutral" as TrendSemantic,
    },
    {
      label: "Rejected Entries",
      value: data.kpis.rejectedEntries,
      note: "Requires resubmission.",
      icon: "history" as const,
      to: workspaceRoutes["timesheet-history"].path,
      iconTheme: "purple" as const,
      trendSemantic: "needs-action" as TrendSemantic,
    },
    {
      label: "Leave Balance",
      value: data.kpis.leaveBalance,
      note: "Days remaining.",
      icon: "leave" as const,
      to: workspaceRoutes["leave-balance"].path,
      iconTheme: "teal" as const,
      trendSemantic: "positive" as TrendSemantic,
      valueClassName: "text-[#1D9E75] dark:text-[#9FE1CB]",
    },
    {
      label: completedActionsLabel,
      value: data.kpis.completedApprovalActions,
      note: "Decisions finalized.",
      icon: "inbox" as const,
      to: workspaceRoutes["approval-inbox"].path,
      iconTheme: "teal" as const,
      trendSemantic: "neutral" as TrendSemantic,
    },
  ];

  const quickActions = [
    { title: "My Timesheet", description: "Log daily or weekly work hours.", to: workspaceRoutes["my-timesheet"].path, icon: "timesheet" as const },
    { title: "Resume Draft", description: "Finish incomplete timesheets.", to: workspaceRoutes["my-timesheet"].path, icon: "edit" as const },
    { title: "Approval Inbox", description: "Approve pending requests.", to: workspaceRoutes["approval-inbox"].path, icon: "approvals" as const },
    { title: "Timesheet History", description: "View past submissions.", to: workspaceRoutes["timesheet-history"].path, icon: "history" as const },
    { title: "Apply Leave", description: "Submit time-off requests.", to: workspaceRoutes["leave-request"].path, icon: "leave" as const },
    { title: "System Dashboard", description: "View system metrics.", to: workspaceRoutes["system-dashboard"].path, icon: "dashboard" as const },
  ];

  if (loading && !data.meta.lastUpdatedAt) {
    return <LoadingSpinner label="Loading my dashboard..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <section className={heroClass}>
          <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">My Dashboard</h1>
              <p className="mt-4 text-lg leading-7 text-zinc-700 dark:text-zinc-300">
                Welcome back, {firstName}.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-zinc-200 bg-white/80 px-4 py-2 font-semibold text-zinc-900 dark:border-white/10 dark:bg-white/10 dark:text-white">{user.role}</span>
                <span className="rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300">{data.meta.rangeLabel}</span>
                {loading ? <span className="rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200">Refreshing...</span> : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={heroMetricCardBase}>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{hoursLabel}</p>
                <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatHours(data.kpis.hoursLogged)}</p>
              </div>
              <div className={heroMetricCardBase}>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Pending approvals</p>
                <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.kpis.pendingApprovals)}</p>
              </div>
              <div className={heroMetricCardBase}>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Leave balance</p>
                <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.leaveSummary.totalBalance)}</p>
              </div>
              <div className={heroMetricCardBase}>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Recent actions</p>
                <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.recentActivities.length)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${panelClass} sticky top-4 z-20 p-5`}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,240px)_auto_1fr]">
            <select value={selectedRange} onChange={(event) => setSelectedRange(event.target.value as PersonalDashboardRange)} className={filterClass}>
              {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" onClick={() => void handleRefresh()} className="h-12 rounded-2xl border border-transparent bg-[#378ADD] text-white px-6 text-sm font-semibold shadow-sm transition hover:bg-[#185FA5] hover:-translate-y-0.5 dark:bg-[#185FA5] dark:hover:bg-[#378ADD]">Refresh</button>
            <div className="flex h-12 items-center justify-start rounded-2xl border border-zinc-200/80 bg-zinc-100/50 px-4 text-sm font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 xl:justify-end">Updated: {formatLastUpdated(data.meta.lastUpdatedAt)}</div>
          </div>
          {selectedRange === "custom" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className={filterClass} />
              <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className={filterClass} />
            </div>
          ) : null}
        </section>

        {!customRangeValid ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">Invalid date range.</div> : null}
        {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {kpiCards.map((card) => <KpiCard key={card.label} {...card} />)}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#185FA5] dark:text-[#B5D4F4]">Weekly Hours</h2>
              </div>
              <Link to={workspaceRoutes["my-timesheet"].path} className="text-sm font-semibold text-[#378ADD] dark:text-[#B5D4F4] underline-offset-4 hover:underline">My Timesheet</Link>
            </div>
            {data.weeklyHours.length > 0 ? (
              <div className={`${chartCardClass} mt-6`}>
                <Chart
                  type="line"
                  height={320}
                  series={[
                    { name: "Actual Hours", type: "column", data: data.weeklyHours.map((item) => item.actualHours) },
                    { name: "Expected Hours", type: "line", data: data.weeklyHours.map((item) => item.expectedHours) },
                  ]}
                  options={{ ...chartOptions.weeklyHours, xaxis: { ...chartOptions.weeklyHours.xaxis, categories: data.weeklyHours.map((item) => item.label) } }}
                />
              </div>
            ) : <EmptyChartState title="No personal hours logged yet" />}
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#185FA5] dark:text-[#B5D4F4]">Timesheet Status</h2>
              </div>
              <Link to={workspaceRoutes["timesheet-history"].path} className="text-sm font-semibold text-[#378ADD] dark:text-[#B5D4F4] underline-offset-4 hover:underline">History</Link>
            </div>
            {(data.timesheetStatus.draft + data.timesheetStatus.submitted + data.timesheetStatus.approved + data.timesheetStatus.rejected + data.timesheetStatus.resubmitted) > 0 ? (
              <div className={`${chartCardClass} mt-6`}>
                <Chart type="donut" height={300} series={[data.timesheetStatus.draft, data.timesheetStatus.submitted, data.timesheetStatus.approved, data.timesheetStatus.rejected, data.timesheetStatus.resubmitted]} options={chartOptions.status} />
              </div>
            ) : <EmptyChartState title="No timesheet status data yet" />}
            <div className="mt-5 space-y-3">
              {[
                { label: "Draft", value: data.timesheetStatus.draft },
                { label: "Submitted", value: data.timesheetStatus.submitted },
                { label: "Approved", value: data.timesheetStatus.approved },
                { label: "Rejected", value: data.timesheetStatus.rejected },
                { label: "Resubmitted", value: data.timesheetStatus.resubmitted },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 rounded-r-[1.4rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <p className="font-medium text-zinc-700 dark:text-zinc-200">{item.label}</p>
                  <p className="text-lg font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(item.value)}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Pending Approvals</h2>
              </div>
              <Link to={workspaceRoutes["approval-inbox"].path} className="text-sm font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300">Inbox</Link>
            </div>
            <div className="mt-6 space-y-4">
              {data.approvalTasks.map((task) => {
                const textColor = "text-[#185FA5] dark:text-[#B5D4F4]";
                return (
                <Link key={task.id} to={task.actionUrl} className={`block rounded-r-[1.5rem] rounded-l-none p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${getSeverityToneClass(task.severity)}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full bg-white/85 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] dark:bg-black/60 ${textColor}`}>{task.severity}</span>
                        <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${textColor}`}>{task.type}</p>
                      </div>
                      <p className={`mt-3 text-base font-bold ${textColor}`}>{task.title}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{task.subtitle}</p>
                    </div>
                    <p className={`text-3xl font-bold ${textColor}`}>{formatNumber(task.count)}</p>
                  </div>
                </Link>
                );
              })}
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Recent Activity</h2>
              </div>
              <Link to={workspaceRoutes.activity.path} className="text-sm font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300">Logs</Link>
            </div>
            <div className="mt-6 space-y-4">
              {data.recentActivities.map((activity) => (
                <Link key={activity.id} to={activity.actionUrl} className="block rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-[#378ADD]/5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:hover:shadow-[#378ADD]/10">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-transparent bg-[#E6F1FB] p-3 text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4]">
                      <Icon name={activity.category === "leave" ? "leave" : activity.category === "approval" ? "approvals" : activity.category === "activity" ? "shield" : "timesheet"} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{formatActivityTime(activity.timestamp)}</p>
                      <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{activity.title}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{activity.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Project Hours</h2>
              </div>
              <Link to={workspaceRoutes["project-hours-report"].path} className="text-sm font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300">Report</Link>
            </div>
            {data.projectHours.some((item) => item.hours > 0) ? (
              <div className={`${chartCardClass} mt-6`}>
                <Chart type="donut" height={300} series={data.projectHours.map((item) => item.hours)} options={chartOptions.projectHours} />
              </div>
            ) : <EmptyChartState title="No personal project hour split yet" />}
            <div className="mt-5 space-y-3">
              {data.projectHours.map((project) => (
                <div key={project.projectName} className="flex items-center justify-between gap-4 rounded-r-[1.4rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <p className="font-medium text-zinc-700 dark:text-zinc-200">{project.projectName}</p>
                  <p className="text-lg font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatHours(project.hours)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Leave Summary</h2>
              </div>
              <Link to={workspaceRoutes["leave-balance"].path} className="text-sm font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300">Balance</Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50"><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Balance</p><p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.leaveSummary.totalBalance)}</p></div>
              <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50"><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Used</p><p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.leaveSummary.used)}</p></div>
              <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50"><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Pending</p><p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.leaveSummary.pending)}</p></div>
              <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50"><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Upcoming</p><p className="mt-3 text-xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{data.leaveSummary.upcoming ?? "None scheduled"}</p></div>
            </div>
            <div className="mt-5 space-y-4">
              {data.leaveSummary.byType.map((item) => {
                const percentage = item.allocation > 0 ? Math.min(100, Math.round((item.balance / item.allocation) * 100)) : 0;
                return (
                  <div key={item.leaveType} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-zinc-700 dark:text-zinc-200">{item.leaveType}</p>
                      <p className="text-sm text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(item.balance)} left</p>
                    </div>
                    <div className="mt-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-900">
                      <div className="h-3 rounded-full bg-[#378ADD] dark:bg-[#B5D4F4]" style={{ width: `${percentage}%` }} />
                    </div>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Used {formatNumber(item.used)} of {formatNumber(item.allocation)} days</p>
                  </div>
                );
              })}
            </div>
          </section>
        </section>

        <section className={`${panelClass} p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Quick Actions</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => <QuickActionCard key={action.title} {...action} />)}
          </div>
        </section>
      </div>
    </>
  );
};

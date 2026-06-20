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
import "./MyDashboardPage.css";

type PersonalDashboardRange = Extract<DateRange, "today" | "this_week" | "this_month" | "custom">;
type TrendSemantic = "positive" | "needs-action" | "neutral";
type IconTheme = "purple" | "teal";

const panelClass = "dashboard-panel-premium";
const filterClass =
  "h-12 rounded-2xl border border-zinc-200/80 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-700/60 dark:bg-black dark:text-zinc-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10";
const chartCardClass = "chart-container-premium";
const heroClass = "text-zinc-900 dark:text-white";

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
  "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400";

const getSeverityToneClass = (severity: "high" | "medium" | "low") => {
  if (severity === "high") {
    return "border border-rose-500/25 bg-rose-500/5 backdrop-blur-md rounded-2xl hover:shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:border-rose-500/30";
  }
  if (severity === "medium") {
    return "border border-amber-500/25 bg-amber-500/5 backdrop-blur-md rounded-2xl hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/30";
  }
  return "border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md rounded-2xl hover:shadow-[0_0_20px_rgba(99,102,241,0.12)] hover:border-indigo-500/25";
};

const statusToneColors = {
  Draft: {
    border: "border-zinc-200/60 dark:border-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700",
    bg: "bg-zinc-50/40 dark:bg-zinc-950/20",
    glow: "hover:shadow-[0_0_15px_rgba(148,163,184,0.1)]",
    indicator: "bg-zinc-400 dark:bg-zinc-500",
    text: "text-zinc-600 dark:text-zinc-400",
  },
  Submitted: {
    border: "border-sky-500/20 dark:border-sky-500/10 hover:border-sky-500/30",
    bg: "bg-sky-50/20 dark:bg-sky-950/10",
    glow: "hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]",
    indicator: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
  Approved: {
    border: "border-emerald-500/20 dark:border-emerald-500/10 hover:border-emerald-500/30",
    bg: "bg-emerald-50/20 dark:bg-emerald-950/10",
    glow: "hover:shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    indicator: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  Rejected: {
    border: "border-rose-500/20 dark:border-rose-500/10 hover:border-rose-500/30",
    bg: "bg-rose-50/20 dark:bg-rose-950/10",
    glow: "hover:shadow-[0_0_15px_rgba(244,63,94,0.15)]",
    indicator: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
  Resubmitted: {
    border: "border-amber-500/20 dark:border-amber-500/10 hover:border-amber-500/30",
    bg: "bg-amber-50/20 dark:bg-amber-950/10",
    glow: "hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    indicator: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
} as const;

const activityCategoryColors = {
  leave: {
    border: "border-emerald-500/20 dark:border-emerald-500/10 hover:border-emerald-500/30",
    bg: "bg-emerald-50/20 dark:bg-emerald-950/10",
    iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    glow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.12)]",
    icon: "leave" as const,
  },
  approval: {
    border: "border-sky-500/20 dark:border-sky-500/10 hover:border-sky-500/30",
    bg: "bg-sky-50/20 dark:bg-sky-950/10",
    iconBg: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
    glow: "hover:shadow-[0_0_20px_rgba(56,189,248,0.12)]",
    icon: "approvals" as const,
  },
  activity: {
    border: "border-indigo-500/20 dark:border-indigo-500/10 hover:border-indigo-500/30",
    bg: "bg-indigo-50/20 dark:bg-indigo-950/10",
    iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    glow: "hover:shadow-[0_0_20px_rgba(99,102,241,0.12)]",
    icon: "shield" as const,
  },
  timesheet: {
    border: "border-amber-500/20 dark:border-amber-500/10 hover:border-amber-500/30",
    bg: "bg-amber-50/20 dark:bg-amber-950/10",
    iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.12)]",
    icon: "timesheet" as const,
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
  label,
  value,
  note,
  icon,
  to,
  trendSemantic,
  color,
  formatter,
}: {
  label: string;
  value: number;
  note: string;
  icon: IconName;
  to: string;
  trendSemantic: TrendSemantic;
  color: "sky" | "amber" | "indigo" | "rose" | "emerald";
  formatter?: (value: number) => string;
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
  };

  const selected = cardColors[color];

  const pillClasses: Record<TrendSemantic, string> = {
    positive: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-500/20",
    "needs-action": "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/40 dark:border-rose-500/20",
    neutral: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/30",
  };

  const pillLabel = trendSemantic === "positive" ? "↑ on track" : trendSemantic === "needs-action" ? "↓ action req." : "— stable";

  return (
    <Link to={to} className="block h-full">
      <article className={`relative h-full overflow-hidden rounded-[2rem] border ${selected.border} bg-white/70 dark:bg-zinc-950/40 p-5 backdrop-blur-xl shadow-sm transition-all duration-300 hover:-translate-y-1 ${selected.glow}`}>
        <div className="relative flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className={`mt-3 text-3xl font-extrabold tracking-tight ${selected.value}`}>
                {(formatter ?? formatCompactNumber)(value)}
              </p>
            </div>
            <div className={`rounded-2xl border border-transparent ${selected.iconBg} p-3 shadow-sm`}>
              <Icon name={icon} className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${pillClasses[trendSemantic]}`}>
                {pillLabel}
              </span>
            </div>
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 leading-normal">{note}</p>
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
    className="group block action-card-premium"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-base font-semibold text-zinc-900 transition group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <div className="rounded-2xl border border-transparent bg-indigo-50 p-3 text-indigo-600 transition group-hover:scale-110 dark:bg-indigo-500/10 dark:text-indigo-400">
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, 10000); // live sync every 10 seconds

    return () => {
      window.clearInterval(interval);
    };
  }, [refresh]);

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
      color: "indigo" as const,
      trendSemantic: "neutral" as TrendSemantic,
      formatter: formatHours,
    },
    {
      label: "Draft Entries",
      value: data.kpis.draftEntries,
      note: "Pending submissions.",
      icon: "timesheet" as const,
      to: workspaceRoutes["my-timesheet"].path,
      color: "amber" as const,
      trendSemantic: "neutral" as TrendSemantic,
    },
    {
      label: "Pending Approvals",
      value: data.kpis.pendingApprovals,
      note: "Tasks in queue.",
      icon: "approvals" as const,
      to: workspaceRoutes["approval-inbox"].path,
      color: "sky" as const,
      trendSemantic: "neutral" as TrendSemantic,
    },
    {
      label: "Rejected Entries",
      value: data.kpis.rejectedEntries,
      note: "Requires resubmission.",
      icon: "history" as const,
      to: workspaceRoutes["timesheet-history"].path,
      color: "rose" as const,
      trendSemantic: "needs-action" as TrendSemantic,
    },
    {
      label: "Leave Balance",
      value: data.kpis.leaveBalance,
      note: "Days remaining.",
      icon: "leave" as const,
      to: workspaceRoutes["leave-balance"].path,
      color: "emerald" as const,
      trendSemantic: "positive" as TrendSemantic,
    },
    {
      label: completedActionsLabel,
      value: data.kpis.completedApprovalActions,
      note: "Decisions finalized.",
      icon: "inbox" as const,
      to: workspaceRoutes["approval-inbox"].path,
      color: "indigo" as const,
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
      <div className="dashboard-page space-y-6">
        <div className="dashboard-bg-glow-1" />
        <div className="dashboard-bg-glow-2" />

        <section className={heroClass}>
          <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">My Dashboard</h1>
              <p className="mt-4 text-lg leading-7 text-zinc-700 dark:text-zinc-300">
                Welcome back, <span className="font-bold text-zinc-900 dark:text-white">{firstName}</span>.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-zinc-200/80 bg-white/40 backdrop-blur-md px-4 py-2 font-semibold text-zinc-900 dark:border-white/5 dark:bg-zinc-950/40 dark:text-white">{user.role}</span>
                <span className="rounded-full border border-zinc-200/80 bg-white/40 backdrop-blur-md px-4 py-2 text-zinc-600 dark:border-white/5 dark:bg-zinc-950/40 dark:text-zinc-300">{data.meta.rangeLabel}</span>
                {loading ? <span className="rounded-full border border-zinc-200/80 bg-white/40 backdrop-blur-md px-4 py-2 text-zinc-600 dark:border-white/5 dark:bg-zinc-950/40 dark:text-zinc-200">Refreshing...</span> : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="hud-card-premium hud-hours">
                <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{hoursLabel}</p>
                <p className="mt-3 text-3xl font-black text-[#185FA5] dark:text-[#B5D4F4]">{formatHours(data.kpis.hoursLogged)}</p>
              </div>
              <div className="hud-card-premium hud-pending">
                <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pending approvals</p>
                <p className="mt-3 text-3xl font-black text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.kpis.pendingApprovals)}</p>
              </div>
              <div className="hud-card-premium hud-leave">
                <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Leave balance</p>
                <p className="mt-3 text-3xl font-black text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.leaveSummary.totalBalance)}</p>
              </div>
              <div className="hud-card-premium hud-actions">
                <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Recent actions</p>
                <p className="mt-3 text-3xl font-black text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.recentActivities.length)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${panelClass} sticky top-4 z-20 p-5`}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,240px)_1fr]">
            <select value={selectedRange} onChange={(event) => setSelectedRange(event.target.value as PersonalDashboardRange)} className={filterClass}>
              {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
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
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Icon name="clock" className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Weekly Hours</h2>
              </div>
              <Link to={workspaceRoutes["my-timesheet"].path} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">My Timesheet</Link>
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
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Icon name="timesheet" className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Timesheet Status</h2>
              </div>
              <Link to={workspaceRoutes["timesheet-history"].path} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">History</Link>
            </div>
            {(data.timesheetStatus.draft + data.timesheetStatus.submitted + data.timesheetStatus.approved + data.timesheetStatus.rejected + data.timesheetStatus.resubmitted) > 0 ? (
              <div className={`${chartCardClass} mt-6`}>
                <Chart type="donut" height={300} series={[data.timesheetStatus.draft, data.timesheetStatus.submitted, data.timesheetStatus.approved, data.timesheetStatus.rejected, data.timesheetStatus.resubmitted]} options={chartOptions.status} />
              </div>
            ) : <EmptyChartState title="No timesheet status data yet" />}
            <div className="mt-5 space-y-3">
              {[
                { label: "Draft" as const, value: data.timesheetStatus.draft },
                { label: "Submitted" as const, value: data.timesheetStatus.submitted },
                { label: "Approved" as const, value: data.timesheetStatus.approved },
                { label: "Rejected" as const, value: data.timesheetStatus.rejected },
                { label: "Resubmitted" as const, value: data.timesheetStatus.resubmitted },
              ].map((item) => {
                const config = statusToneColors[item.label];
                return (
                  <div key={item.label} className={`flex items-center justify-between gap-4 rounded-2xl border ${config.border} ${config.bg} px-4 py-3 backdrop-blur-md transition-all duration-300 ${config.glow}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${config.indicator}`} />
                      <p className="font-semibold text-zinc-700 dark:text-zinc-200">{item.label}</p>
                    </div>
                    <p className={`text-lg font-black ${config.text}`}>{formatNumber(item.value)}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Icon name="approvals" className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Pending Approvals</h2>
              </div>
              <Link to={workspaceRoutes["approval-inbox"].path} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Inbox</Link>
            </div>
            <div className="mt-6 space-y-4">
              {data.approvalTasks.map((task) => {
                const colors = {
                  high: {
                    text: "text-rose-600 dark:text-rose-500",
                    badge: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200/50 dark:border-rose-500/20",
                  },
                  medium: {
                    text: "text-amber-600 dark:text-amber-500",
                    badge: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/20",
                  },
                  low: {
                    text: "text-indigo-600 dark:text-indigo-400",
                    badge: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-500/20",
                  },
                }[task.severity];

                return (
                  <Link key={task.id} to={task.actionUrl} className={`block p-4 transition-all duration-300 hover:-translate-y-0.5 ${getSeverityToneClass(task.severity)}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] ${colors.badge}`}>{task.severity}</span>
                          <p className={`text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500`}>{task.type}</p>
                        </div>
                        <p className={`mt-3 text-base font-bold text-zinc-900 dark:text-white group-hover:text-indigo-500`}>{task.title}</p>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{task.subtitle}</p>
                      </div>
                      <p className={`text-3xl font-black tracking-tight ${colors.text}`}>{formatNumber(task.count)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Icon name="history" className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Recent Activity</h2>
              </div>
              <Link to={workspaceRoutes.activity.path} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Logs</Link>
            </div>
            <div className="mt-6 space-y-4">
              {data.recentActivities.map((activity) => {
                const config = activityCategoryColors[activity.category as keyof typeof activityCategoryColors] ?? activityCategoryColors.timesheet;
                return (
                  <Link key={activity.id} to={activity.actionUrl} className={`block rounded-2xl border ${config.border} ${config.bg} p-4 transition-all duration-300 hover:-translate-y-0.5 ${config.glow}`}>
                    <div className="flex items-start gap-4">
                      <div className={`rounded-2xl border border-transparent ${config.iconBg} p-3`}>
                        <Icon name={config.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">{formatActivityTime(activity.timestamp)}</p>
                        <p className="mt-2 text-base font-bold text-zinc-900 dark:text-white group-hover:text-indigo-500">{activity.title}</p>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{activity.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Icon name="projects" className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Project Hours</h2>
              </div>
              <Link to={workspaceRoutes["project-hours-report"].path} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Report</Link>
            </div>
            {data.projectHours.some((item) => item.hours > 0) ? (
              <div className={`${chartCardClass} mt-6`}>
                <Chart type="donut" height={300} series={data.projectHours.map((item) => item.hours)} options={chartOptions.projectHours} />
              </div>
            ) : <EmptyChartState title="No personal project hour split yet" />}
            <div className="mt-5 space-y-3">
              {data.projectHours.map((project) => (
                <div key={project.projectName} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/40 bg-zinc-50/40 dark:bg-zinc-950/20 px-4 py-3 backdrop-blur-md transition-all duration-300 hover:shadow-[0_0_15px_rgba(99,102,241,0.08)] hover:border-indigo-500/20">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    <p className="font-semibold text-zinc-700 dark:text-zinc-200">{project.projectName}</p>
                  </div>
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatHours(project.hours)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Icon name="leave" className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Leave Summary</h2>
              </div>
              <Link to={workspaceRoutes["leave-balance"].path} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Balance</Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { label: "Balance", value: formatNumber(data.leaveSummary.totalBalance), color: "hud-hours" },
                { label: "Used", value: formatNumber(data.leaveSummary.used), color: "hud-leave" },
                { label: "Pending", value: formatNumber(data.leaveSummary.pending), color: "hud-pending" },
                { label: "Upcoming", value: data.leaveSummary.upcoming ?? "None scheduled", color: "hud-actions", isLargeText: false },
              ].map((item) => (
                <div key={item.label} className={`hud-card-premium ${item.color}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{item.label}</p>
                  <p className={`mt-3 ${item.isLargeText ?? true ? "text-3xl font-black" : "text-lg font-bold"} text-[#185FA5] dark:text-[#B5D4F4]`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-4">
              {data.leaveSummary.byType.map((item) => {
                const percentage = item.allocation > 0 ? Math.min(100, Math.round((item.balance / item.allocation) * 100)) : 0;
                return (
                  <div key={item.leaveType} className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/40 bg-zinc-50/40 dark:bg-zinc-950/20 p-4 backdrop-blur-md transition-all duration-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.08)] hover:border-emerald-500/20">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold text-zinc-700 dark:text-zinc-200">{item.leaveType}</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(item.balance)} left</p>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={percentage} tone="emerald" />
                    </div>
                    <p className="mt-2.5 text-xs text-zinc-500 dark:text-zinc-400">Used {formatNumber(item.used)} of {formatNumber(item.allocation)} days</p>
                  </div>
                );
              })}
            </div>
          </section>
        </section>

        <section className={`${panelClass} p-6`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Icon name="dashboard" className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Quick Actions</h2>
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

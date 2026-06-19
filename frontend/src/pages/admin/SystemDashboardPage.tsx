import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, type IconName } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer } from "../../components/ToastContainer";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useSystemDashboard } from "../../hooks/useSystemDashboard";
import { useToast } from "../../hooks/useToast";
import type { AuthUser } from "../../types/auth";
import type { DateRange, DateRangeFilter, SystemDashboardData } from "../../types/dashboard";

type SystemDashboardRange = Extract<DateRange, "today" | "this_week" | "this_month" | "custom">;
type TrendPreference = "up" | "down" | "neutral";

const panelClass =
  "rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50";
const filterClass =
  "h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/10 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:focus:border-sky-500 dark:focus:ring-sky-500/10";
const chartCardClass =
  "rounded-xl border border-zinc-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-4 dark:border-zinc-800/60 dark:bg-[linear-gradient(180deg,rgba(10,10,10,0.8),rgba(0,0,0,0.7))] shadow-inner";
const heroClass =
  "text-zinc-900 dark:text-white";
const heroMetricCardClass =
  "rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50";

const rangeOptions: Array<{ value: SystemDashboardRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
];

const isSystemDashboardRange = (value: string | null): value is SystemDashboardRange =>
  ["today", "this_week", "this_month", "custom"].includes(value ?? "");

const toInputDate = (value: Date) =>
  new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);

const formatPercent = (value: number) => `${Math.round(value)}%`;

const formatHours = (value: number) =>
  `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)}h`;

const formatLastUpdated = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Fetching live data";

const formatActivityTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const csvEscape = (value: string | number | boolean) => `"${String(value).replace(/\"/g, "\"\"")}"`;

const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const sanitizeText = (value: string) => value.replace(/â€¢/g, "|");

const getTrendText = (current: number, previous: number) => {
  const delta = current - previous;
  if (delta === 0) {
    return "No change";
  }

  return `${delta > 0 ? "+" : ""}${formatNumber(delta)} vs last period`;
};

const getTrendToneClass = (current: number, previous: number, preference: TrendPreference) => {
  const delta = current - previous;
  if (delta === 0 || preference === "neutral") {
    return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  }

  const improved = preference === "up" ? delta > 0 : delta < 0;
  return improved
    ? "bg-[#E6F1FB] text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4]"
    : "bg-[#FEF0EC] text-[#D94F28] dark:bg-[#A83318]/30 dark:text-[#FFD2C6]";
};

const getTrendChipConfig = (current: number, previous: number, preference: TrendPreference) => {
  const delta = current - previous;
  
  if (delta === 0) {
    return { label: "— no change", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
  }

  if (preference === "neutral") {
    return {
      label: delta > 0 ? "↑ increased" : "↓ decreased",
      className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
    };
  }

  const improved = preference === "up" ? delta > 0 : delta < 0;
  return {
    label: improved ? "↑ on track" : "↓ needs action",
    className: improved
      ? "bg-[#E6F1FB] text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4]"
      : "bg-[#FEF0EC] text-[#D94F28] dark:bg-[#A83318]/30 dark:text-[#FFD2C6]"
  };
};

const getIconThemeClass = (theme?: "blue" | "coral") =>
  "bg-[#E6F1FB] text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4]";

const getThemeBorderClass = (theme?: "blue" | "coral") =>
  "border-[#378ADD]/30 hover:border-[#378ADD]";

const getAlertToneClass = (severity?: "high" | "medium" | "low") => {
  if (severity === "high") {
    return "border border-zinc-200/80 border-l-[4px] border-l-rose-500 bg-rose-50/40 hover:shadow-rose-500/5 dark:border-zinc-800 dark:border-l-rose-500 dark:bg-rose-950/10 dark:hover:shadow-rose-500/10";
  }
  if (severity === "medium") {
    return "border border-zinc-200/80 border-l-[4px] border-l-amber-500 bg-amber-50/40 hover:shadow-amber-500/5 dark:border-zinc-800 dark:border-l-amber-500 dark:bg-amber-950/10 dark:hover:shadow-amber-500/10";
  }
  return "border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/40 hover:shadow-[#378ADD]/5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/40 dark:hover:shadow-[#378ADD]/10";
};

const buildSnapshotCsv = (data: SystemDashboardData) => {
  const rows: Array<Array<string | number>> = [
    ["Section", "Metric", "Value"],
    ["Meta", "Range", data.meta.rangeLabel],
    ["Meta", "Last Updated", data.meta.lastUpdatedAt ?? ""],
    ["KPI", "Total Employees", data.kpis.totalEmployees],
    ["KPI", "Active Users", data.kpis.activeUsers],
    ["KPI", "Pending Approvals", data.kpis.pendingApprovals],
    ["KPI", "Missing Timesheets", data.kpis.missingTimesheets],
    ["KPI", "Open Leave Requests", data.kpis.openLeaveRequests],
    ["KPI", "Payroll Ready Count", data.kpis.payrollReadyCount],
    ["Approval", "Blocked Approvals", data.approvalSummary.blockedApprovals],
    ["Approval", "Stuck Approvals", data.approvalSummary.stuckApprovals],
    [],
    ["Alerts", "Severity", "Count", "Title", "Description"],
    ...data.alerts.map((alert) => [alert.severity, alert.count, alert.title, sanitizeText(alert.description)]),
    [],
    ["Activity", "Time", "Category", "Title", "Description"],
    ...data.recentActivities.map((item) => [item.timestamp, item.category, item.title, sanitizeText(item.description)]),
  ];

  return rows.map((row) => row.map((cell) => csvEscape((cell ?? "") as string | number | boolean)).join(",")).join("\n");
};

const KpiCard = ({
  label,
  value,
  previousValue,
  note,
  icon,
  to,
  preference,
  theme,
}: {
  label: string;
  value: number;
  previousValue: number;
  note: string;
  icon: IconName;
  to: string;
  preference: TrendPreference;
  theme: "blue" | "coral";
}) => {
  const chip = getTrendChipConfig(value, previousValue, preference);
  const themeBorderClass = getThemeBorderClass("blue");
  const valueColorClass = "text-[#185FA5] dark:text-[#B5D4F4]";

  return (
    <Link to={to} className="block h-full">
      <article className="relative h-full overflow-hidden rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-[#378ADD]/10 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:hover:shadow-[#378ADD]/20">
        <div className="relative flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className={`mt-3 text-3xl font-bold ${valueColorClass}`}>{formatCompactNumber(value)}</p>
            </div>
            <div className={`rounded-2xl border border-transparent p-3 shadow-sm ${getIconThemeClass("blue")}`}>
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
  theme = "blue",
}: {
  title: string;
  description: string;
  to: string;
  icon: IconName;
  theme?: "blue" | "coral";
}) => {
  const themeBorderClass = "border-[#378ADD]/30 hover:border-[#378ADD]";
  const iconThemeClass = "border-transparent bg-[#E6F1FB] text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4]";
  
  return (
  <Link
    to={to}
    className="group block rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-[#378ADD]/10 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:hover:shadow-[#378ADD]/20"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-base font-semibold text-zinc-900 transition group-hover:text-[#185FA5] dark:text-white dark:group-hover:text-[#B5D4F4]">{title}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <div className={`rounded-2xl border p-3 transition group-hover:scale-110 ${iconThemeClass}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
    </div>
  </Link>
  );
};

const EmptyChartState = ({ title }: { title: string }) => (
  <div className={`${chartCardClass} flex h-[320px] items-center justify-center text-center`}>
    <div>
      <p className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Live data will appear here once records are available for the selected range.
      </p>
    </div>
  </div>
);

export const SystemDashboardPage = ({ user }: { user: AuthUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toasts, showToast, dismissToast } = useToast();
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const defaultEnd = useMemo(() => toInputDate(today), [today]);
  const initialRange = searchParams.get("range");
  const [selectedRange, setSelectedRange] = useState<SystemDashboardRange>(
    isSystemDashboardRange(initialRange) ? initialRange : "this_week",
  );
  const [customStart, setCustomStart] = useState(searchParams.get("startDate") ?? defaultStart);
  const [customEnd, setCustomEnd] = useState(searchParams.get("endDate") ?? defaultEnd);

  const customRangeValid = selectedRange !== "custom" || (Boolean(customStart) && Boolean(customEnd) && customStart <= customEnd);
  const activeFilter = useMemo<DateRangeFilter>(
    () =>
      selectedRange === "custom"
        ? customRangeValid
          ? { range: "custom", startDate: customStart, endDate: customEnd }
          : { range: "this_month" }
        : { range: selectedRange },
    [customEnd, customRangeValid, customStart, selectedRange],
  );
  const { data, loading, error, refresh } = useSystemDashboard(activeFilter);

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
    showToast("System dashboard refreshed.", "success");
  }, [refresh, showToast]);

  const handleExport = useCallback(() => {
    const csv = buildSnapshotCsv(data);
    downloadBlob(
      `system-dashboard-${selectedRange}-${toInputDate(new Date())}.csv`,
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    showToast("System dashboard snapshot exported.", "success");
  }, [data, selectedRange, showToast]);

  const chartOptions = useMemo(() => {
    const base: ApexOptions = {
      chart: { toolbar: { show: false }, fontFamily: "inherit", foreColor: "#71717a" },
      dataLabels: { enabled: false },
      grid: { borderColor: "rgba(161,161,170,0.18)" },
      legend: { labels: { colors: "#71717a" } },
      tooltip: { theme: "dark" },
      xaxis: { axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { forceNiceScale: true },
    };

    return {
      timesheet: {
        ...base,
        chart: { ...base.chart, stacked: true },
        plotOptions: { bar: { borderRadius: 7, columnWidth: "52%" } },
        colors: ["#94A3B8", "#3B82F6", "#378ADD", "#F59E0B", "#EF4444", "#8B5CF6"],
        stroke: { width: 0 },
      } satisfies ApexOptions,
      approvalAging: {
        ...base,
        colors: ["#378ADD"],
        plotOptions: { bar: { borderRadius: 8, columnWidth: "48%" } },
      } satisfies ApexOptions,
      utilisation: {
        ...base,
        colors: ["#378ADD"],
        plotOptions: { bar: { horizontal: true, borderRadius: 8, barHeight: "56%" } },
      } satisfies ApexOptions,
      projectHours: {
        ...base,
        labels: data.projectHours.map((item) => item.project),
        colors: ["#378ADD", "#6366F1", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B", "#EF4444"],
        stroke: { width: 0 },
      } satisfies ApexOptions,
      leaveTrend: {
        ...base,
        colors: ["#378ADD", "#10B981", "#EF4444"],
        stroke: { curve: "smooth", width: 3 },
        fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0.04 } },
      } satisfies ApexOptions,
    };
  }, [data.projectHours]);

  const kpiCards = [
    {
      label: "Total Employees",
      value: data.kpis.totalEmployees,
      previousValue: data.previousKpis.totalEmployees,
      note: "Total headcount.",
      icon: "employees" as const,
      to: workspaceRoutes["employee-management"].path,
      theme: "blue" as const,
      preference: "up" as const,
    },
    {
      label: "Active Users",
      value: data.kpis.activeUsers,
      previousValue: data.previousKpis.activeUsers,
      note: "Active in this period.",
      icon: "monitor" as const,
      to: workspaceRoutes.activity.path,
      theme: "blue" as const,
      preference: "up" as const,
    },
    {
      label: "Pending Approvals",
      value: data.kpis.pendingApprovals,
      previousValue: data.previousKpis.pendingApprovals,
      note: "Awaiting decision.",
      icon: "approvals" as const,
      to: workspaceRoutes["approval-inbox"].path,
      theme: "coral" as const,
      preference: "down" as const,
    },
    {
      label: "Missing Timesheets",
      value: data.kpis.missingTimesheets,
      previousValue: data.previousKpis.missingTimesheets,
      note: "Unsubmitted timesheets.",
      icon: "timesheet" as const,
      to: workspaceRoutes["all-timesheets"].path,
      theme: "coral" as const,
      preference: "down" as const,
    },
    {
      label: "Open Leave Requests",
      value: data.kpis.openLeaveRequests,
      previousValue: data.previousKpis.openLeaveRequests,
      note: "Awaiting leave approval.",
      icon: "leave" as const,
      to: workspaceRoutes["leave-summary-report"].path,
      theme: "coral" as const,
      preference: "neutral" as const,
    },
    {
      label: "Payroll Ready Count",
      value: data.kpis.payrollReadyCount,
      previousValue: data.previousKpis.payrollReadyCount,
      note: "Approved for payroll.",
      icon: "file-spreadsheet" as const,
      to: workspaceRoutes["payroll-export"].path,
      theme: "blue" as const,
      preference: "up" as const,
    },
  ];

  const quickActions = [
    { title: "All Timesheets", description: "View all timesheets.", to: workspaceRoutes["all-timesheets"].path, icon: "timesheet" as const, theme: "blue" as const },
    { title: "Approval Inbox", description: "Manage approvals.", to: workspaceRoutes["approval-inbox"].path, icon: "inbox" as const, theme: "coral" as const },
    { title: "Export Payroll", description: "Export payroll records.", to: workspaceRoutes["payroll-export"].path, icon: "file-spreadsheet" as const, theme: "blue" as const },
    { title: "Audit Logs", description: "System activity logs.", to: workspaceRoutes.activity.path, icon: "shield" as const, theme: "blue" as const },
    { title: "Leave Requests", description: "View leave requests.", to: workspaceRoutes["leave-summary-report"].path, icon: "leave" as const, theme: "coral" as const },
    { title: "User Directory", description: "Manage employee profiles.", to: workspaceRoutes["employee-management"].path, icon: "employees" as const, theme: "blue" as const },
  ];

  const commandBadges = [
    {
      label: "Risk Alerts",
      value: formatNumber(data.alerts.filter((alert) => alert.severity === "high").length),
      theme: "coral",
    },
    {
      label: "Stuck Approvals",
      value: formatNumber(data.approvalSummary.stuckApprovals),
      theme: "coral",
    },
    {
      label: "On Leave Today",
      value: formatNumber(data.leaveSummary.peopleOnLeaveToday),
      theme: "coral",
    },
    {
      label: "Payroll Ready",
      value: formatNumber(data.kpis.payrollReadyCount),
      theme: "blue",
    },
  ];

  const activityIcons: Record<string, IconName> = {
    timesheet: "timesheet",
    leave: "leave",
    activity: "shield",
    project: "projects",
  };

  if (loading && !data.meta.lastUpdatedAt) {
    return <LoadingSpinner label="Loading system dashboard..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <section className={heroClass}>
          <div className="grid gap-8 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">System Dashboard</h1>
              <p className="mt-2 text-sm text-zinc-550 dark:text-zinc-400">
                System status and operational metrics.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-zinc-200 bg-white/80 px-4 py-2 font-semibold text-zinc-900 dark:border-white/10 dark:bg-white/10 dark:text-white">{user.role}</span>
                <span className="rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300">{data.meta.rangeLabel}</span>
                <span className="rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300">{data.meta.dataSources.length} Sources</span>
                {loading ? <span className="rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200">Refreshing...</span> : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {commandBadges.map((item) => (
                <div key={item.label} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 shadow-sm dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{item.label}</p>
                  <p className={`mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${panelClass} sticky top-4 z-20 p-5`}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,240px)_auto_auto_1fr]">
            <select value={selectedRange} onChange={(event) => setSelectedRange(event.target.value as SystemDashboardRange)} className={filterClass}>
              {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" onClick={() => void handleRefresh()} className="h-12 rounded-2xl border border-transparent bg-[#378ADD] text-white px-6 text-sm font-semibold shadow-sm transition hover:bg-[#185FA5] hover:-translate-y-0.5 dark:bg-[#185FA5] dark:hover:bg-[#378ADD]">Refresh</button>
            <button type="button" onClick={handleExport} className="h-12 rounded-2xl border border-transparent bg-[#378ADD] text-white px-6 text-sm font-semibold shadow-sm transition hover:bg-[#185FA5] hover:-translate-y-0.5 dark:bg-[#185FA5] dark:hover:bg-[#378ADD]">Export</button>
            <div className="flex h-12 items-center justify-start rounded-2xl border border-zinc-200/80 bg-zinc-100/50 px-4 text-sm font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 xl:justify-end">Updated: {formatLastUpdated(data.meta.lastUpdatedAt)}</div>
          </div>
          {selectedRange === "custom" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className={filterClass} />
              <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className={filterClass} />
            </div>
          ) : null}
        </section>

        {!customRangeValid ? <div className="rounded-2xl border border-[#FCEBEB] bg-[#FCEBEB] px-5 py-4 text-sm text-[#A83318] dark:border-[#4A1C1C]/40 dark:bg-[#4A1C1C]/20 dark:text-[#FFD2C6]">Invalid custom date range.</div> : null}
        {error ? <div className="rounded-2xl border border-[#FCEBEB] bg-[#FCEBEB] px-5 py-4 text-sm text-[#A83318] dark:border-[#4A1C1C]/40 dark:bg-[#4A1C1C]/20 dark:text-[#FFD2C6]">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {kpiCards.map((card) => <KpiCard key={card.label} {...card} />)}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className={`${panelClass} p-6`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#185FA5] dark:text-[#B5D4F4]">Timesheet Flow</p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Timesheet status trends</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Draft", to: `${workspaceRoutes["all-timesheets"].path}?status=draft`, theme: "blue" },
                  { label: "Pending", to: workspaceRoutes["approval-inbox"].path, theme: "blue" },
                  { label: "Approved", to: `${workspaceRoutes["all-timesheets"].path}?status=approved`, theme: "blue" },
                  { label: "Rejected", to: `${workspaceRoutes["all-timesheets"].path}?status=rejected`, theme: "blue" },
                ].map((item) => (
                  <Link key={item.label} to={item.to} className={`rounded-full border px-4 py-2 text-sm font-medium transition border-[#378ADD]/30 text-[#378ADD] hover:border-[#378ADD] hover:bg-[#E6F1FB] dark:border-[#378ADD]/40 dark:text-[#B5D4F4] dark:hover:bg-[#0C447C]`}>{item.label}</Link>
                ))}
              </div>
            </div>
            {data.timesheetTrend.length > 0 ? (
              <div className={`${chartCardClass} mt-6`}>
                <Chart
                  type="bar"
                  height={340}
                  series={[
                    { name: "Draft", data: data.timesheetTrend.map((item) => item.draft) },
                    { name: "Submitted", data: data.timesheetTrend.map((item) => item.submitted) },
                    { name: "Pending Approval", data: data.timesheetTrend.map((item) => item.pendingApproval) },
                    { name: "Approved", data: data.timesheetTrend.map((item) => item.approved) },
                    { name: "Rejected", data: data.timesheetTrend.map((item) => item.rejected) },
                    { name: "Resubmitted", data: data.timesheetTrend.map((item) => item.resubmitted) },
                  ]}
                  options={{ ...chartOptions.timesheet, xaxis: { ...chartOptions.timesheet.xaxis, categories: data.timesheetTrend.map((item) => item.label) } }}
                />
              </div>
            ) : <EmptyChartState title="No timesheet trend data yet" />}
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#D94F28] dark:text-[#FFD2C6]">Approval Control</p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Approval Funnel & Aging</h2>
              </div>
              <Link to={workspaceRoutes["approval-inbox"].path} className="text-sm font-semibold text-[#378ADD] underline-offset-4 hover:underline dark:text-[#B5D4F4]">View Inbox</Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {data.approvalSummary.stages.map((stage, index) => (
                <Link key={stage.id} to={index === data.approvalSummary.stages.length - 1 ? workspaceRoutes["payroll-export"].path : workspaceRoutes["approval-inbox"].path} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-[#378ADD]/5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:hover:shadow-[#378ADD]/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#185FA5] dark:text-[#B5D4F4]">{stage.label}</p>
                  <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(stage.count)}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{stage.subtitle}</p>
                </Link>
              ))}
            </div>
            <div className={`${chartCardClass} mt-6`}>
              <Chart
                type="bar"
                height={250}
                series={[{ name: "Pending Approvals", data: data.approvalSummary.aging.map((item) => item.count) }]}
                options={{ ...chartOptions.approvalAging, xaxis: { ...chartOptions.approvalAging.xaxis, categories: data.approvalSummary.aging.map((item) => item.bucket) } }}
              />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Stuck approvals</p>
                <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.approvalSummary.stuckApprovals)}</p>
              </div>
              <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Blocked approvals</p>
                <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.approvalSummary.blockedApprovals)}</p>
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#185FA5] dark:text-[#B5D4F4]">Utilisation</p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Team Utilisation</h2>
              </div>
              <Link to={workspaceRoutes["utilisation-report"].path} className="text-sm font-semibold text-[#378ADD] underline-offset-4 hover:underline dark:text-[#B5D4F4]">View Report</Link>
            </div>
            {data.departmentUtilisation.length > 0 ? (
              <div className={`${chartCardClass} mt-6`}>
                <Chart
                  type="bar"
                  height={320}
                  series={[{ name: "Utilisation", data: data.departmentUtilisation.map((item) => item.utilisation) }]}
                  options={{ ...chartOptions.utilisation, xaxis: { ...chartOptions.utilisation.xaxis, categories: data.departmentUtilisation.map((item) => item.department) } }}
                />
              </div>
            ) : <EmptyChartState title="No utilisation data yet" />}
            <div className="mt-5 rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Lowest utilisation</p>
              <p className="mt-3 text-xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{data.departmentUtilisation.length > 0 ? `${data.departmentUtilisation[data.departmentUtilisation.length - 1]?.department} - ${formatPercent(data.departmentUtilisation[data.departmentUtilisation.length - 1]?.utilisation ?? 0)}` : "No data"}</p>
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#D94F28] dark:text-[#FFD2C6]">Leave Trend</p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Leave Requests Trend</h2>
              </div>
              <Link to={workspaceRoutes["leave-summary-report"].path} className="text-sm font-semibold text-[#378ADD] underline-offset-4 hover:underline dark:text-[#B5D4F4]">View Report</Link>
            </div>
            {data.leaveTrend.length > 0 ? (
              <div className={`${chartCardClass} mt-6`}>
                <Chart
                  type="area"
                  height={320}
                  series={[
                    { name: "Requested", data: data.leaveTrend.map((item) => item.requested) },
                    { name: "Approved", data: data.leaveTrend.map((item) => item.approved) },
                    { name: "Rejected", data: data.leaveTrend.map((item) => item.rejected) },
                  ]}
                  options={{ ...chartOptions.leaveTrend, xaxis: { ...chartOptions.leaveTrend.xaxis, categories: data.leaveTrend.map((item) => item.label) } }}
                />
              </div>
            ) : <EmptyChartState title="No leave trend data yet" />}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50"><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Today on leave</p><p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatNumber(data.leaveSummary.peopleOnLeaveToday)}</p></div>
              <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50"><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Highest leave load</p><p className="mt-3 text-xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{data.leaveSummary.highestDepartment}</p></div>
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#185FA5] dark:text-[#B5D4F4]">Project Hours</p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Hours by Project</h2>
              </div>
              <Link to={workspaceRoutes["project-hours-report"].path} className="text-sm font-semibold text-[#378ADD] underline-offset-4 hover:underline dark:text-[#B5D4F4]">View Report</Link>
            </div>
            {data.projectHours.some((item) => item.hours > 0) ? (
              <div className={`${chartCardClass} mt-6`}>
                <Chart type="donut" height={320} series={data.projectHours.map((item) => item.hours)} options={chartOptions.projectHours} />
              </div>
            ) : <EmptyChartState title="No project hour distribution yet" />}
            <div className="mt-5 space-y-3">
              {data.projectHours.slice(0, 3).map((project) => (
                <div key={project.project} className="flex items-center justify-between gap-4 rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <div><p className="font-semibold text-zinc-900 dark:text-white">{project.project}</p><p className="mt-1 text-sm text-[#185FA5] dark:text-[#B5D4F4]">{formatHours(project.billableHours)} billable</p></div>
                  <p className="text-lg font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatHours(project.hours)}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#D94F28] dark:text-[#FFD2C6]">System Alerts</p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Exceptions and abnormal activity</h2>
              </div>
              <Link to={workspaceRoutes.activity.path} className="text-sm font-semibold text-[#378ADD] underline-offset-4 hover:underline dark:text-[#B5D4F4]">View Logs</Link>
            </div>
            <div className="mt-6 space-y-4">
              {data.alerts.map((alert) => {
                const textColor = "text-[#185FA5] dark:text-[#B5D4F4]";
                return (
                <Link key={alert.id} to={alert.actionUrl} className={`block rounded-r-[1.5rem] rounded-l-none p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${getAlertToneClass(alert.severity)}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] dark:bg-black/60 ${textColor}`}>{alert.severity}</span>
                        <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${textColor}`}>{alert.title}</p>
                      </div>
                      <p className={`mt-3 text-base font-bold ${textColor}`}>{formatNumber(alert.count)}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{sanitizeText(alert.description)}</p>
                    </div>
                    <Icon name="bell" className={`h-5 w-5 shrink-0 ${textColor}`} />
                  </div>
                </Link>
                );
              })}
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#185FA5] dark:text-[#B5D4F4]">Recent Activity</p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Live operational movement across the system</h2>
              </div>
              <Link to={workspaceRoutes.activity.path} className="text-sm font-semibold text-[#378ADD] underline-offset-4 hover:underline dark:text-[#B5D4F4]">View Logs</Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-1">
              {data.recentActivities.map((activity) => {
                const iconThemeClass = "border-transparent bg-[#E6F1FB] text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4]";
                return (
                  <Link key={activity.id} to={activity.actionUrl} className="block rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-[#378ADD]/5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:hover:shadow-[#378ADD]/10">
                    <div className="flex items-start gap-4">
                      <div className={`rounded-2xl border p-3 ${iconThemeClass}`}><Icon name={activityIcons[activity.category] ?? "dashboard"} className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{formatActivityTime(activity.timestamp)}</p>
                        <p className="mt-2 text-base font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{activity.title}</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{sanitizeText(activity.description)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </section>

        <section className={`${panelClass} p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#185FA5] dark:text-[#B5D4F4]">Quick Actions</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Act immediately from the command center</h2>
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

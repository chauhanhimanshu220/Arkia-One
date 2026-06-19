import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, type IconName } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer } from "../../components/ToastContainer";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useToast } from "../../hooks/useToast";
import { DashboardService } from "../../services/dashboardService";
import type { AuthUser } from "../../types/auth";
import type { DateRange, DateRangeFilter, FinanceAlert, PersonalDashboardActionItem, PersonalDashboardData } from "../../types/dashboard";

const panelClass = "rounded-[2rem] border border-white/70 bg-white/90 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/85";
const filterClass = "h-12 rounded-2xl border border-zinc-200 bg-white/90 px-4 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200";
const heroSectionClass = "text-zinc-950 dark:text-white";
const heroChipClass = "rounded-xl border border-zinc-200 bg-white px-4 py-2 text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-100";
const primaryActionClass = "inline-flex h-12 items-center justify-center rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const secondaryActionClass = "inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white/90 px-5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white";
const rangeOptions: Array<{ value: DateRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

const isDateRange = (value: string | null): value is DateRange => ["today", "this_week", "last_week", "this_month", "last_month", "custom"].includes(value ?? "");
const toInputDate = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const formatHours = (value: number) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)}h`;
const formatCount = (value: number) => new Intl.NumberFormat("en-IN").format(value);
const statusBadgeClass = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("approved") || normalized.includes("ready")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (normalized.includes("pending") || normalized.includes("submitted")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (normalized.includes("block") || normalized.includes("reject") || normalized.includes("missing")) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};
const priorityBadgeClass = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "high") return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  if (normalized === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};
const donutGradient = (segments: Array<{ value: number; color: string }>) => {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return "conic-gradient(#d4d4d8 0% 100%)";
  let cursor = 0;
  return `conic-gradient(${segments.map((segment) => {
    const start = cursor;
    cursor += (segment.value / total) * 100;
    return `${segment.color} ${start}% ${cursor}%`;
  }).join(", ")})`;
};

const buildFallbackPersonalDashboard = (rangeLabel: string): PersonalDashboardData => ({
  summary: { pendingFinanceApprovals: 27, readyForPayrollReview: 18, returnedForCorrection: 6, missingTimesheetCases: 4, completedActionsToday: 9, urgentExceptions: 11 },
  actionQueue: [
    { id: "queue-1", employeeName: "Ravi Sharma", department: "Engineering", period: "07 Apr - 12 Apr", issueType: "Finance Approval Pending", priority: "High", ageLabel: "3 days old", totalHours: 46, approvalStatus: "Finance Pending", payrollStatus: "Pending", actionUrl: workspaceRoutes["approved-timesheets"].path, actionLabel: "Review now" },
    { id: "queue-2", employeeName: "Neha Singh", department: "Operations", period: "07 Apr - 12 Apr", issueType: "Returned for Correction", priority: "Medium", ageLabel: "2 days old", totalHours: 41, approvalStatus: "Rejected", payrollStatus: "Blocked", actionUrl: workspaceRoutes["approved-timesheets"].path, actionLabel: "Follow up" },
    { id: "queue-3", employeeName: "Aman Verma", department: "Finance", period: "07 Apr - 12 Apr", issueType: "Ready for Payroll Review", priority: "High", ageLabel: "2 days old", totalHours: 44, approvalStatus: "Finance Approved", payrollStatus: "Ready", actionUrl: workspaceRoutes["timesheet-payroll"].path, actionLabel: "Open payroll" },
  ],
  alerts: [
    { id: "alert-1", type: "overdue_approvals", title: "Approvals waiting too long", description: "8 submitted timesheets have stayed in the finance queue for more than 48 hours.", count: 8, severity: "high", actionUrl: workspaceRoutes["approved-timesheets"].path, actionLabel: "Open approval queue" },
    { id: "alert-2", type: "missing_submissions", title: "Missing submissions to chase", description: "4 employees still have no submitted time in the selected period.", count: 4, severity: "high", actionUrl: workspaceRoutes["finance-dashboard"].path, actionLabel: "Review missing cases" },
    { id: "alert-3", type: "payroll_review", title: "Payroll review queue is building", description: "18 finance-approved timesheets are ready for payroll follow-up.", count: 18, severity: "medium", actionUrl: workspaceRoutes["payroll-export"].path, actionLabel: "Open payroll export" },
  ],
  charts: {
    queueStatus: { pendingApprovals: 27, readyForPayrollReview: 18, returnedForCorrection: 6, missingSubmissions: 4 },
    billableTrend: [
      { label: "Mon", billableHours: 42, nonBillableHours: 8 },
      { label: "Tue", billableHours: 38, nonBillableHours: 10 },
      { label: "Wed", billableHours: 46, nonBillableHours: 6 },
      { label: "Thu", billableHours: 34, nonBillableHours: 9 },
      { label: "Fri", billableHours: 40, nonBillableHours: 7 },
    ],
    payrollReadiness: [
      { label: "Mon", ready: 5, pending: 8, blocked: 1, exported: 0 },
      { label: "Tue", ready: 7, pending: 6, blocked: 2, exported: 0 },
      { label: "Wed", ready: 8, pending: 4, blocked: 2, exported: 0 },
      { label: "Thu", ready: 6, pending: 5, blocked: 1, exported: 0 },
      { label: "Fri", ready: 9, pending: 4, blocked: 0, exported: 0 },
    ],
    delayedDepartments: [
      { departmentName: "Engineering", openItems: 9 },
      { departmentName: "Operations", openItems: 5 },
      { departmentName: "Finance", openItems: 3 },
      { departmentName: "Support", openItems: 2 },
    ],
  },
  recentActivity: [
    { id: "act-1", employeeName: "Ravi Sharma", department: "Engineering", period: "07 Apr - 12 Apr", totalHours: 46, status: "Finance Pending", activityLabel: "Submitted for finance review", lastUpdated: "08 Apr 2026", actionUrl: workspaceRoutes["approved-timesheets"].path },
    { id: "act-2", employeeName: "Aman Verma", department: "Finance", period: "07 Apr - 12 Apr", totalHours: 44, status: "Finance Approved", activityLabel: "Moved into payroll review", lastUpdated: "08 Apr 2026", actionUrl: workspaceRoutes["timesheet-payroll"].path },
    { id: "act-3", employeeName: "Neha Singh", department: "Operations", period: "07 Apr - 12 Apr", totalHours: 41, status: "Rejected", activityLabel: "Returned for correction", lastUpdated: "07 Apr 2026", actionUrl: workspaceRoutes["approved-timesheets"].path },
  ],
  meta: { rangeLabel, workflowModel: "Demo snapshot: action queue uses weekly workflow status transitions.", costModel: "Demo snapshot: billable mix is inferred from timesheet row flags.", usesEstimatedCosts: false },
});

const SummaryCard = ({ title, value, icon, to }: { title: string; value: string; note: string; icon: IconName; to: string }) => (
  <Link to={to} className="block h-full rounded-[1.75rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-5 shadow-sm transition hover:-translate-y-1 hover:border-zinc-300 dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.96),rgba(0,0,0,0.92))]">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
        <p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">{value}</p>
      </div>
      <div className="rounded-2xl border border-white/70 bg-white/80 p-3 text-zinc-700 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">
        <Icon name={icon} className="h-5 w-5" />
      </div>
    </div>
  </Link>
);

export const FinancePersonalDashboardPage = ({ user }: { user: AuthUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toasts, showToast, dismissToast } = useToast();
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const defaultEnd = useMemo(() => toInputDate(today), [today]);
  const [selectedRange, setSelectedRange] = useState<DateRange>(isDateRange(searchParams.get("range")) ? (searchParams.get("range") as DateRange) : "this_week");
  const [customStart, setCustomStart] = useState(searchParams.get("startDate") ?? defaultStart);
  const [customEnd, setCustomEnd] = useState(searchParams.get("endDate") ?? defaultEnd);
  const [dashboardData, setDashboardData] = useState<PersonalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const customRangeValid = selectedRange !== "custom" || (Boolean(customStart) && Boolean(customEnd) && customStart <= customEnd);
  const activeFilter = useMemo<DateRangeFilter>(() => ({ range: selectedRange, ...(selectedRange === "custom" ? { startDate: customStart, endDate: customEnd } : {}), userId: user.id }), [customEnd, customStart, selectedRange, user.id]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("range", selectedRange);
    if (selectedRange === "custom") {
      params.set("startDate", customStart);
      params.set("endDate", customEnd);
    }
    setSearchParams(params, { replace: true });
  }, [customEnd, customStart, selectedRange, setSearchParams]);

  const loadDashboard = useCallback(async (announceSuccess = false) => {
    if (!customRangeValid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await DashboardService.getPersonalDashboardData(activeFilter);
      setDashboardData(data);
      if (announceSuccess) showToast("Personal finance dashboard refreshed.", "success");
    } catch {
      setDashboardData(buildFallbackPersonalDashboard(`${customStart} - ${customEnd}`));
      setLoadError("Live personal dashboard data is unavailable right now, so a demo finance-action snapshot is being shown.");
      if (announceSuccess) showToast("Loaded fallback personal dashboard snapshot.", "info");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, customEnd, customRangeValid, customStart, showToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading && !dashboardData) {
    return <LoadingSpinner label="Loading personal finance dashboard..." />;
  }

  if (!dashboardData) {
    return null;
  }

  const queueSegments = [
    { label: "Pending", value: dashboardData.charts.queueStatus.pendingApprovals, color: "#f59e0b" },
    { label: "Payroll Review", value: dashboardData.charts.queueStatus.readyForPayrollReview, color: "#10b981" },
    { label: "Returned", value: dashboardData.charts.queueStatus.returnedForCorrection, color: "#ef4444" },
    { label: "Missing", value: dashboardData.charts.queueStatus.missingSubmissions, color: "#8b5cf6" },
  ];
  const billableMax = Math.max(...dashboardData.charts.billableTrend.map((item) => item.billableHours + item.nonBillableHours), 1);
  const payrollMax = Math.max(...dashboardData.charts.payrollReadiness.map((item) => item.ready + item.pending + item.blocked), 1);
  const delayedDepartmentMax = Math.max(...dashboardData.charts.delayedDepartments.map((item) => item.openItems), 1);
  const quickActions = [
    { label: "Open Approval Inbox", to: workspaceRoutes["approved-timesheets"].path, tone: primaryActionClass },
    { label: "Open Payroll Export", to: workspaceRoutes["payroll-export"].path, tone: secondaryActionClass },
    { label: "View Returned Timesheets", to: `${workspaceRoutes["approved-timesheets"].path}?status=rejected`, tone: secondaryActionClass },
    { label: "View Missing Cases", to: workspaceRoutes["finance-dashboard"].path, tone: secondaryActionClass },
  ];

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <section className={heroSectionClass}>
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.34em] text-zinc-500 dark:text-zinc-200">Personal Dashboard</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">Track what needs your finance attention right now.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">Stay on top of pending approvals, payroll-ready follow-up, returned timesheets, missing submissions, and the finance exceptions that should move first.</p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className={`${heroChipClass} font-semibold`}>{user.role}</span>
                <span className={heroChipClass}>{dashboardData.meta.rangeLabel}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:max-w-[560px]">
              {quickActions.map((action) => (
                <Link key={action.label} to={action.to} className={`inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold transition hover:-translate-y-0.5 ${action.tone}`}>
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={`${panelClass} p-5`}>
          <div className="grid gap-3 xl:grid-cols-[1.2fr_auto_auto_auto]">
            <select value={selectedRange} onChange={(event) => setSelectedRange(event.target.value as DateRange)} className={filterClass}>
              {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" onClick={() => void loadDashboard(true)} className={secondaryActionClass}>Refresh</button>
            <Link to={workspaceRoutes["approved-timesheets"].path} className={secondaryActionClass}>Finance Queue</Link>
            <Link to={workspaceRoutes["finance-dashboard"].path} className={primaryActionClass}>Open Finance Dashboard</Link>
          </div>
          {selectedRange === "custom" ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className={filterClass} /><input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className={filterClass} /></div> : null}
        </section>

        {loadError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">{loadError}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <SummaryCard title="Pending Finance Approvals" value={formatCount(dashboardData.summary.pendingFinanceApprovals)} note="Submitted sheets waiting for your decision." icon="inbox" to={workspaceRoutes["approved-timesheets"].path} />
          <SummaryCard title="Ready for Payroll Review" value={formatCount(dashboardData.summary.readyForPayrollReview)} note="Finance-approved records needing payroll follow-up." icon="file-spreadsheet" to={workspaceRoutes["payroll-export"].path} />
          <SummaryCard title="Returned for Correction" value={formatCount(dashboardData.summary.returnedForCorrection)} note="Rejected or returned records still open." icon="history" to={workspaceRoutes["approved-timesheets"].path} />
          <SummaryCard title="Missing Timesheet Cases" value={formatCount(dashboardData.summary.missingTimesheetCases)} note="Employees still missing time in this window." icon="timesheet" to={workspaceRoutes["finance-dashboard"].path} />
          <SummaryCard title="Completed Actions Today" value={formatCount(dashboardData.summary.completedActionsToday)} note="Finance actions closed in today�s cycle." icon="approvals" to={workspaceRoutes["approved-timesheets"].path} />
          <SummaryCard title="Urgent Exceptions" value={formatCount(dashboardData.summary.urgentExceptions)} note="Items that deserve immediate attention first." icon="clock" to={workspaceRoutes["finance-dashboard"].path} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">My Action Queue</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Finance work that should move next</h2>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{dashboardData.actionQueue.length} items</span>
            </div>
            <div className="mt-6 space-y-4">
              {dashboardData.actionQueue.length === 0 ? <div className="rounded-[1.5rem] border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">No actions in this range.</div> : dashboardData.actionQueue.map((item: PersonalDashboardActionItem) => <div key={item.id} className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-lg font-semibold text-zinc-900 dark:text-white">{item.employeeName}</p><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${priorityBadgeClass(item.priority)}`}>{item.priority}</span><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.approvalStatus)}`}>{item.approvalStatus}</span></div><p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.department} - {item.period} - {item.issueType}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400"><span className="rounded-full bg-white px-3 py-1 dark:bg-black">{item.ageLabel}</span><span className="rounded-full bg-white px-3 py-1 dark:bg-black">{formatHours(item.totalHours)}</span><span className={`rounded-full px-3 py-1 ${statusBadgeClass(item.payrollStatus)}`}>{item.payrollStatus}</span></div></div><Link to={item.actionUrl} className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white dark:bg-white dark:text-black">{item.actionLabel}</Link></div></div>)}
            </div>
          </div>

          <div className={`${panelClass} p-6`}>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Attention Needed</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Alerts and blockers</h2>
            <div className="mt-6 space-y-4">
              {dashboardData.alerts.map((alert: FinanceAlert) => <Link key={alert.id} to={alert.actionUrl} className="block rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 transition hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-black/50"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{alert.title}</p><p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">{formatCount(alert.count)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityBadgeClass(alert.severity === "high" ? "High" : alert.severity === "medium" ? "Medium" : "Low")}`}>{alert.severity}</span></div></Link>)}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-4">
          <div className={`${panelClass} p-6`}>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Queue Status</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">What kind of work is waiting</h2>
            <div className="mx-auto mt-6 flex h-48 w-48 items-center justify-center rounded-full" style={{ background: donutGradient(queueSegments) }}>
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner dark:bg-black"><p className="text-3xl font-bold text-zinc-900 dark:text-white">{formatCount(queueSegments.reduce((sum, segment) => sum + segment.value, 0))}</p><p className="text-xs text-zinc-500">open items</p></div>
            </div>
            <div className="mt-6 space-y-3">{queueSegments.map((segment) => <div key={segment.label} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />{segment.label}</span><span className="font-semibold text-zinc-900 dark:text-white">{formatCount(segment.value)}</span></div>)}</div>
          </div>

          <div className={`${panelClass} p-6`}>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Mini Billable Trend</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Billable vs non-billable</h2>
            <div className="mt-6 flex h-56 items-end gap-3">{dashboardData.charts.billableTrend.map((item) => { const total = item.billableHours + item.nonBillableHours; const billableHeight = total > 0 ? (item.billableHours / billableMax) * 100 : 0; const nonBillableHeight = total > 0 ? (item.nonBillableHours / billableMax) * 100 : 0; return <div key={item.label} className="flex flex-1 flex-col items-center gap-3"><div className="flex h-44 w-full flex-col justify-end overflow-hidden rounded-2xl bg-zinc-100 p-1 dark:bg-black"><div className="rounded-b-xl bg-amber-400" style={{ height: `${nonBillableHeight <= 0 ? 0 : Math.max(6, nonBillableHeight)}%` }} /><div className="rounded-t-xl bg-zinc-200 dark:bg-zinc-900" style={{ height: `${billableHeight <= 0 ? 0 : Math.max(6, billableHeight)}%` }} /></div><div className="text-center"><p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{item.label}</p><p className="text-xs text-zinc-500">{formatHours(total)}</p></div></div>; })}</div>
          </div>

          <div className={`${panelClass} p-6`}>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Payroll Progress</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Ready vs pending vs blocked</h2>
            <div className="mt-6 space-y-4">{dashboardData.charts.payrollReadiness.map((item) => { const ready = (item.ready / payrollMax) * 100; const pending = (item.pending / payrollMax) * 100; const blocked = (item.blocked / payrollMax) * 100; return <div key={item.label}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-zinc-700 dark:text-zinc-200">{item.label}</span><span className="text-zinc-500 dark:text-zinc-400">{item.ready + item.pending + item.blocked} items</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-black"><div className="h-3 bg-emerald-500" style={{ width: `${ready}%` }} /><div className="-mt-3 h-3 bg-amber-400" style={{ width: `${ready + pending}%` }} /><div className="-mt-3 h-3 bg-rose-500" style={{ width: `${ready + pending + blocked}%` }} /></div></div>; })}</div>
          </div>

          <div className={`${panelClass} p-6`}>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Delayed Departments</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">Who is slowing closure</h2>
            <div className="mt-6 space-y-4">{dashboardData.charts.delayedDepartments.length === 0 ? <div className="rounded-[1.5rem] border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">No delayed departments are visible in the current scope.</div> : dashboardData.charts.delayedDepartments.map((item) => <div key={item.departmentName}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-zinc-700 dark:text-zinc-200">{item.departmentName}</span><span className="text-zinc-500 dark:text-zinc-400">{item.openItems} items</span></div><div className="mt-2 h-3 rounded-full bg-zinc-100 dark:bg-black"><div className="h-3 rounded-full bg-violet-500" style={{ width: `${(item.openItems / delayedDepartmentMax) * 100}%` }} /></div></div>)}</div>
          </div>
        </section>

        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Recent Finance Activity</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">What moved in your review scope</h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Use this to jump back into recently submitted, approved, and returned records without leaving your action flow.</p>
              </div>
              <p className="max-w-xl text-sm text-zinc-500 dark:text-zinc-400">{dashboardData.meta.rangeLabel}</p>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50/90 dark:bg-black/90"><tr>{["Employee", "Department", "Period", "Hours", "Activity", "Status", "Last Updated", "Action"].map((heading) => <th key={heading} className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{dashboardData.recentActivity.length === 0 ? <tr><td colSpan={8} className="px-6 py-16 text-center"><p className="text-base font-semibold text-zinc-900 dark:text-white">No recent finance activity in this window.</p></td></tr> : dashboardData.recentActivity.map((item) => <tr key={item.id} className="transition hover:bg-zinc-50/70 dark:hover:bg-black/50"><td className="px-4 py-4"><p className="font-semibold text-zinc-900 dark:text-white">{item.employeeName}</p></td><td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{item.department}</td><td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{item.period}</td><td className="px-4 py-4 text-sm font-medium text-zinc-900 dark:text-white">{formatHours(item.totalHours)}</td><td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{item.activityLabel}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>{item.status}</span></td><td className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">{item.lastUpdated}</td><td className="px-4 py-4"><Link to={item.actionUrl} className="inline-flex rounded-full border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Open</Link></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
};



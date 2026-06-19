import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, type IconName } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { ToastContainer } from "../../components/ToastContainer";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useToast } from "../../hooks/useToast";
import { DashboardService } from "../../services/dashboardService";
import type { AuthUser } from "../../types/auth";
import type { AlertSeverity, DashboardData, DateRange, DateRangeFilter, FinanceAlert, FinanceRecord } from "../../types/dashboard";

const panelClass = "rounded-[2rem] border border-white/70 bg-white/85 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/85";
const filterClass = "h-12 rounded-2xl border border-zinc-200 bg-white/90 px-4 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200";
const chartCardClass = "rounded-[1.75rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,244,245,0.92))] p-4 dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.96),rgba(0,0,0,0.92))]";
const heroSectionClass = "overflow-hidden rounded-[2rem] border border-white/80 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(212,212,216,0.58),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,244,245,0.94))] p-8 text-zinc-950 shadow-panel dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(161,161,170,0.10),transparent_40%),linear-gradient(180deg,rgba(0,0,0,0.98),rgba(0,0,0,0.96))] dark:text-white";
const heroChipClass = "rounded-full border border-zinc-200/80 bg-white/78 px-4 py-2 text-zinc-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-zinc-100";
const heroStatCardClass = "rounded-[1.5rem] border border-zinc-200/80 bg-white/72 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10";
const heroStatLabelClass = "text-sm text-zinc-500 dark:text-zinc-300";
const secondaryButtonClass = "h-12 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white";
const primaryButtonClass = "h-12 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const PAGE_SIZE = 10;
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
const formatCompact = (value: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const formatCurrency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const formatPercent = (value: number) => `${Math.round(value)}%`;
const clampPercent = (value: number) => Math.min(100, Math.max(value, 0));
const csvEscape = (value: string | number | boolean) => `"${String(value).replace(/"/g, '""')}"`;
const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};
const statusBadgeClass = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("approved") || normalized.includes("ready")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (normalized.includes("pending") || normalized.includes("submitted")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (normalized.includes("block") || normalized.includes("reject") || normalized.includes("missing")) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};
const buildFallbackDashboardData = (rangeLabel: string): DashboardData => ({
  summary: { pendingFinanceApprovals: 42, payrollReadyTimesheets: 186, approvedBillableHours: 3240, approvedNonBillableHours: 780, estimatedPayrollHours: 4020, overtimeHours: 116, estimatedPayrollCost: 842500, billingReadyHours: 3240, employeesNotSubmitted: 8, billableUtilizationPercent: 81, blockedTimesheets: 22 },
  approvalStatus: { submitted: 42, financePending: 0, financeApproved: 186, rejected: 22, returned: 0, payrollExported: 0 },
  billableTrend: [{ label: "Week 1", billableHours: 810, nonBillableHours: 170 }, { label: "Week 2", billableHours: 790, nonBillableHours: 210 }, { label: "Week 3", billableHours: 840, nonBillableHours: 190 }, { label: "Week 4", billableHours: 800, nonBillableHours: 210 }],
  payrollReadiness: [{ label: "Week 1", ready: 48, pending: 17, blocked: 6, exported: 0 }, { label: "Week 2", ready: 61, pending: 12, blocked: 4, exported: 0 }, { label: "Week 3", ready: 41, pending: 9, blocked: 5, exported: 0 }, { label: "Week 4", ready: 36, pending: 4, blocked: 7, exported: 0 }],
  costTrend: [{ label: "Week 1", estimatedPayrollCost: 198000 }, { label: "Week 2", estimatedPayrollCost: 215000 }, { label: "Week 3", estimatedPayrollCost: 228500 }, { label: "Week 4", estimatedPayrollCost: 201000 }],
  departmentHours: [{ departmentName: "Engineering", approvedHours: 1680 }, { departmentName: "Operations", approvedHours: 920 }, { departmentName: "Finance", approvedHours: 410 }, { departmentName: "Support", approvedHours: 360 }],
  projectBillable: [{ projectName: "Atlas Migration", approvedHours: 780, billableHours: 720, estimatedPayrollCost: 198000 }, { projectName: "Mercury Rollout", approvedHours: 640, billableHours: 590, estimatedPayrollCost: 174000 }, { projectName: "Nova Shared Services", approvedHours: 520, billableHours: 360, estimatedPayrollCost: 131000 }, { projectName: "Zenith Compliance", approvedHours: 460, billableHours: 430, estimatedPayrollCost: 118000 }],
  compliance: { totalEmployeesExpected: 94, submittedOnTime: 72, lateSubmitted: 14, missing: 8, rejectedForCorrection: 11 },
  alerts: [{ id: "a1", type: "overdue_approvals", title: "Overdue finance approvals", description: "14 submitted timesheets have been waiting more than 2 days in the finance queue.", count: 14, severity: "high", actionUrl: workspaceRoutes["approved-timesheets"].path, actionLabel: "Open approved timesheets" }, { id: "a2", type: "missing_submissions", title: "Missing submissions", description: "8 employees have not submitted time for the selected window.", count: 8, severity: "medium", actionUrl: workspaceRoutes["finance-dashboard"].path, actionLabel: "Review compliance" }],
  records: [{ id: "TS-2401", employeeName: "Amit Verma", department: "Engineering", project: "Atlas Migration", period: "01 Apr - 06 Apr", totalHours: 46, billableHours: 40, nonBillableHours: 6, approvalStatus: "Finance Pending", payrollStatus: "Pending", billingStatus: "Billable Pending", overtimeHours: 4, lastUpdated: "08 Apr 2026" }, { id: "TS-2402", employeeName: "Neha Sharma", department: "Operations", project: "Mercury Rollout", period: "01 Apr - 06 Apr", totalHours: 44, billableHours: 36, nonBillableHours: 8, approvalStatus: "Finance Approved", payrollStatus: "Ready", billingStatus: "Billing Ready", overtimeHours: 2, lastUpdated: "08 Apr 2026" }],
  filters: { departments: ["Engineering", "Finance", "Operations", "Support"], projects: ["Atlas Migration", "Mercury Rollout", "Nova Shared Services", "Zenith Compliance"], statuses: ["Submitted", "Approved", "Rejected"] },
  meta: { rangeLabel, workflowModel: "Demo snapshot: finance statuses are derived from the current weekly workflow.", costModel: "Demo snapshot: payroll cost uses estimated hourly rate cards.", usesEstimatedCosts: true },
});
const KpiCard = ({ label, value, icon, to, accent }: { label: string; value: string; subtitle: string; icon: IconName; to: string; accent: string }) => (
  <Link to={to} className="block h-full"><div className="relative h-full overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,244,245,0.92))] p-5 shadow-sm transition hover:-translate-y-1 hover:border-zinc-300 dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.96),rgba(0,0,0,0.9))]"><div className={`absolute right-0 top-0 h-24 w-24 rounded-full blur-2xl grayscale opacity-80 ${accent}`} /><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p><p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">{value}</p></div><div className="rounded-2xl border border-white/70 bg-white/80 p-3 text-zinc-700 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200"><Icon name={icon} className="h-5 w-5" /></div></div></div></Link>
);

export const FinanceDashboardPage = ({ user }: { user: AuthUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toasts, showToast, dismissToast } = useToast();
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const defaultEnd = useMemo(() => toInputDate(today), [today]);
  const [selectedRange, setSelectedRange] = useState<DateRange>(isDateRange(searchParams.get("range")) ? (searchParams.get("range") as DateRange) : "this_month");
  const [customStart, setCustomStart] = useState(searchParams.get("startDate") ?? defaultStart);
  const [customEnd, setCustomEnd] = useState(searchParams.get("endDate") ?? defaultEnd);
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get("department") ?? "");
  const [projectFilter, setProjectFilter] = useState(searchParams.get("project") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [tableSearch, setTableSearch] = useState("");
  const [payrollFilter, setPayrollFilter] = useState("All");
  const [billingFilter, setBillingFilter] = useState("All");
  const [overtimeOnly, setOvertimeOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const customRangeValid = selectedRange !== "custom" || (Boolean(customStart) && Boolean(customEnd) && customStart <= customEnd);
  const activeFilter = useMemo<DateRangeFilter>(() => ({ range: selectedRange, ...(selectedRange === "custom" ? { startDate: customStart, endDate: customEnd } : {}), ...(departmentFilter ? { department: departmentFilter } : {}), ...(projectFilter ? { project: projectFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}) }), [customEnd, customStart, departmentFilter, projectFilter, selectedRange, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("range", selectedRange);
    if (selectedRange === "custom") {
      params.set("startDate", customStart);
      params.set("endDate", customEnd);
    }
    if (departmentFilter) params.set("department", departmentFilter);
    if (projectFilter) params.set("project", projectFilter);
    if (statusFilter) params.set("status", statusFilter);
    setSearchParams(params, { replace: true });
  }, [customEnd, customStart, departmentFilter, projectFilter, selectedRange, setSearchParams, statusFilter]);

  const loadDashboardData = useCallback(async (announceSuccess = false) => {
    if (!customRangeValid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await DashboardService.getDashboardData(activeFilter);
      setDashboardData(data);
      if (announceSuccess) showToast("Finance dashboard refreshed.", "success");
    } catch {
      setDashboardData(buildFallbackDashboardData(`${customStart} - ${customEnd}`));
      setLoadError("Live finance data is unavailable right now, so this finance dashboard is showing a demo snapshot.");
      if (announceSuccess) showToast("Loaded fallback finance snapshot.", "info");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, customEnd, customRangeValid, customStart, showToast]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const handleExport = useCallback(() => {
    if (!dashboardData) return;
    const rows = [
      ["Metric", "Value"],
      ["Pending Finance Approvals", dashboardData.summary.pendingFinanceApprovals],
      ["Payroll Ready Timesheets", dashboardData.summary.payrollReadyTimesheets],
      ["Approved Billable Hours", dashboardData.summary.approvedBillableHours],
      ["Approved Non-Billable Hours", dashboardData.summary.approvedNonBillableHours],
      ["Estimated Payroll Hours", dashboardData.summary.estimatedPayrollHours],
      ["Overtime Hours", dashboardData.summary.overtimeHours],
      ["Estimated Payroll Cost", dashboardData.summary.estimatedPayrollCost],
      [],
      ["Employee", "Department", "Project", "Period", "Total Hours", "Billable Hours", "Approval Status", "Payroll Status", "Billing Status", "Last Updated"],
      ...dashboardData.records.map((record) => [record.employeeName, record.department, record.project, record.period, record.totalHours, record.billableHours, record.approvalStatus, record.payrollStatus, record.billingStatus, record.lastUpdated]),
    ];
    const csv = rows.map((row) => row.map((cell) => csvEscape((cell ?? "") as string | number | boolean)).join(",")).join("\n");
    downloadBlob(`finance-dashboard-${selectedRange}-${toInputDate(new Date())}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
    showToast("Finance dashboard exported.", "success");
  }, [dashboardData, selectedRange, showToast]);

  const filteredRecords = useMemo(() => {
    if (!dashboardData) return [];
    const query = tableSearch.trim().toLowerCase();
    return dashboardData.records.filter((record) => {
      if (payrollFilter !== "All" && record.payrollStatus !== payrollFilter) return false;
      if (billingFilter !== "All" && record.billingStatus !== billingFilter) return false;
      if (overtimeOnly && record.overtimeHours <= 0) return false;
      if (!query) return true;
      return [record.employeeName, record.department, record.project, record.approvalStatus, record.payrollStatus, record.billingStatus].join(" ").toLowerCase().includes(query);
    });
  }, [billingFilter, dashboardData, overtimeOnly, payrollFilter, tableSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRecords = useMemo(() => filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [currentPage, filteredRecords]);
  useEffect(() => {
    setCurrentPage(1);
  }, [billingFilter, overtimeOnly, payrollFilter, tableSearch]);

  const chartOptions = useMemo(() => {
    const textColor = "#a1a1aa";
    const base: ApexOptions = { chart: { toolbar: { show: false }, foreColor: textColor, fontFamily: "inherit" }, dataLabels: { enabled: false }, stroke: { curve: "smooth", width: 3 }, grid: { borderColor: "rgba(161,161,170,0.16)" }, legend: { labels: { colors: textColor } }, xaxis: { labels: { style: { colors: textColor } } }, yaxis: { labels: { style: { colors: textColor } } }, tooltip: { theme: "dark" } };
    return {
      approval: { ...base, labels: ["Submitted", "Finance Pending", "Finance Approved", "Rejected", "Returned", "Exported"], colors: ["#f59e0b", "#71717a", "#10b981", "#ef4444", "#f97316", "#18181b"], stroke: { width: 0 } } satisfies ApexOptions,
      billable: { ...base, chart: { ...base.chart, stacked: true, toolbar: { show: false } }, colors: ["#09090b", "#f59e0b"], plotOptions: { bar: { borderRadius: 8, columnWidth: "48%" } } } satisfies ApexOptions,
      payroll: { ...base, colors: ["#10b981", "#f59e0b", "#ef4444"] } satisfies ApexOptions,
      cost: { ...base, colors: ["#52525b"], fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.06 } } } satisfies ApexOptions,
      department: { ...base, colors: ["#27272a"], plotOptions: { bar: { horizontal: true, borderRadius: 8 } } } satisfies ApexOptions,
      project: { ...base, colors: ["#3f3f46"], plotOptions: { bar: { borderRadius: 8, columnWidth: "45%" } } } satisfies ApexOptions,
    };
  }, []);

  if (loading && !dashboardData) return <LoadingSpinner label="Loading finance dashboard..." />;
  if (!dashboardData) return null;

  const approvalValues = [dashboardData.approvalStatus.submitted, dashboardData.approvalStatus.financePending, dashboardData.approvalStatus.financeApproved, dashboardData.approvalStatus.rejected, dashboardData.approvalStatus.returned, dashboardData.approvalStatus.payrollExported];
  const visibleWorkflowTotal = approvalValues.reduce((sum, value) => sum + value, 0);
  const complianceRate = dashboardData.compliance.totalEmployeesExpected > 0 ? ((dashboardData.compliance.totalEmployeesExpected - dashboardData.compliance.missing) / dashboardData.compliance.totalEmployeesExpected) * 100 : 100;
  const derivedBillingReadyHours = Math.max(
    dashboardData.summary.billingReadyHours,
    dashboardData.records
      .filter((record) => record.billingStatus.toLowerCase().includes("ready"))
      .reduce((sum, record) => sum + record.billableHours, 0),
    dashboardData.projectBillable.reduce((sum, item) => sum + item.billableHours, 0),
  );
  const derivedBillingScopeHours = Math.max(
    dashboardData.summary.estimatedPayrollHours,
    dashboardData.summary.approvedBillableHours + dashboardData.summary.approvedNonBillableHours,
    dashboardData.records.reduce((sum, record) => sum + record.totalHours, 0),
    dashboardData.projectBillable.reduce((sum, item) => sum + item.approvedHours, 0),
  );
  const billingReadinessPercent = derivedBillingScopeHours > 0 ? (derivedBillingReadyHours / derivedBillingScopeHours) * 100 : 0;
  const healthMetrics = [
    { label: "Approval health", value: visibleWorkflowTotal > 0 ? (dashboardData.approvalStatus.financeApproved / visibleWorkflowTotal) * 100 : 0, detail: `${dashboardData.approvalStatus.financeApproved} approved vs ${dashboardData.approvalStatus.submitted} still waiting.` },
    { label: "Payroll readiness", value: visibleWorkflowTotal > 0 ? (dashboardData.summary.payrollReadyTimesheets / visibleWorkflowTotal) * 100 : 0, detail: `${dashboardData.summary.payrollReadyTimesheets} timesheets are ready for the next payroll step.` },
    { label: "Billing readiness", value: billingReadinessPercent, detail: `${formatHours(derivedBillingReadyHours)} can move into billing-ready reporting.` },
    { label: "Submission compliance", value: complianceRate, detail: `${dashboardData.compliance.missing} missing and ${dashboardData.compliance.lateSubmitted} late submissions still affect closure.` },
  ];
  const kpiCards = [
    { label: "Pending Finance Approvals", value: `${dashboardData.summary.pendingFinanceApprovals}`, subtitle: "Submitted sheets currently sitting in the finance queue.", icon: "inbox" as const, to: workspaceRoutes["approved-timesheets"].path, accent: "bg-amber-300/40" },
    { label: "Payroll Ready Timesheets", value: `${dashboardData.summary.payrollReadyTimesheets}`, subtitle: "Finance-cleared records ready to flow into payroll processing.", icon: "file-spreadsheet" as const, to: workspaceRoutes["timesheet-payroll"].path, accent: "bg-emerald-300/40" },
    { label: "Approved Billable Hours", value: formatCompact(dashboardData.summary.approvedBillableHours), subtitle: `${formatPercent(dashboardData.summary.billableUtilizationPercent)} of approved effort remains billable.`, icon: "reports" as const, to: workspaceRoutes["billing-reports"].path, accent: "bg-zinc-300/40" },
    { label: "Approved Non-Billable Hours", value: formatCompact(dashboardData.summary.approvedNonBillableHours), subtitle: "Track cost-side effort before it turns into billing leakage.", icon: "history" as const, to: workspaceRoutes["cost-billing-report"].path, accent: "bg-fuchsia-300/35" },
    { label: "Estimated Payroll Hours", value: formatCompact(dashboardData.summary.estimatedPayrollHours), subtitle: "Approved hours currently exposed to payroll cost this period.", icon: "dashboard" as const, to: workspaceRoutes["payroll-export"].path, accent: "bg-violet-300/35" },
    { label: "Overtime Hours", value: formatCompact(dashboardData.summary.overtimeHours), subtitle: `${dashboardData.summary.blockedTimesheets} blocked records also need finance attention.`, icon: "clock" as const, to: workspaceRoutes["timesheet-payroll"].path, accent: "bg-rose-300/35" },
  ];
  const payrollStatusOptions = ["All", ...Array.from(new Set(dashboardData.records.map((record) => record.payrollStatus))).sort((a, b) => a.localeCompare(b))];
  const billingStatusOptions = ["All", ...Array.from(new Set(dashboardData.records.map((record) => record.billingStatus))).sort((a, b) => a.localeCompare(b))];

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <section className={heroSectionClass}>
          <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.34em] text-zinc-500 dark:text-zinc-200">Finance Dashboard</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">Finance command center for payroll, billing, cost, and exceptions.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">Monitor payroll readiness, approved billable effort, submission compliance, cost exposure, and the exact finance records that need intervention next.</p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className={`${heroChipClass} font-semibold`}>{user.role}</span>
                <span className={heroChipClass}>{dashboardData.meta.rangeLabel}</span>
                {dashboardData.meta.usesEstimatedCosts ? <span className={heroChipClass}>Estimated cost model active</span> : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 xl:min-w-[480px]">
              <div className={heroStatCardClass}>
                <p className={heroStatLabelClass}>Estimated Payroll Cost</p>
                <p className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-white">{formatCurrency(dashboardData.summary.estimatedPayrollCost)}</p>
              </div>
              <div className={heroStatCardClass}>
                <p className={heroStatLabelClass}>Billing Ready Hours</p>
                <p className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-white">{formatHours(dashboardData.summary.billingReadyHours)}</p>
              </div>
              <div className={heroStatCardClass}>
                <p className={heroStatLabelClass}>Employees Not Submitted</p>
                <p className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-white">{dashboardData.summary.employeesNotSubmitted}</p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${panelClass} sticky top-4 z-20 p-5`}>
          <div className="grid gap-3 xl:grid-cols-[1.05fr_1fr_1fr_1fr_auto_auto]">
            <select aria-label="Finance dashboard date range" title="Finance dashboard date range" value={selectedRange} onChange={(event) => setSelectedRange(event.target.value as DateRange)} className={filterClass}>{rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <select aria-label="Department filter" title="Department filter" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className={filterClass}><option value="">All Departments</option>{dashboardData.filters.departments.map((department) => <option key={department} value={department}>{department}</option>)}</select>
            <select aria-label="Project filter" title="Project filter" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className={filterClass}><option value="">All Projects</option>{dashboardData.filters.projects.map((project) => <option key={project} value={project}>{project}</option>)}</select>
            <select aria-label="Approval status filter" title="Approval status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={filterClass}><option value="">All Statuses</option>{dashboardData.filters.statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            <button type="button" onClick={() => void loadDashboardData(true)} className={secondaryButtonClass}>Refresh</button>
            <button type="button" onClick={handleExport} className={primaryButtonClass}>Export Snapshot</button>
          </div>
          {selectedRange === "custom" ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><input aria-label="Custom range start date" title="Custom range start date" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className={filterClass} /><input aria-label="Custom range end date" title="Custom range end date" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className={filterClass} /></div> : null}
        </section>

        {loadError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">{loadError}</div> : null}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">{kpiCards.map((card) => <KpiCard key={card.label} {...card} />)}</section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className={`${panelClass} p-6`}><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Financial health</h2></div><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{visibleWorkflowTotal} workflow records</span></div><div className="mt-6 grid gap-4 lg:grid-cols-2">{healthMetrics.map((metric) => { const progress = clampPercent(metric.value); return <div key={metric.label} className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50"><div className="flex items-center justify-between gap-4"><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{metric.label}</p><span className="text-sm font-semibold text-zinc-900 dark:text-white">{formatPercent(progress)}</span></div><div role="progressbar" aria-label={`${metric.label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-900"><div className="h-full rounded-full bg-zinc-700 transition-all dark:bg-zinc-200" style={{ width: `${progress}%` }} /></div></div>; })}</div><div className={`${chartCardClass} mt-6`}><Chart type="donut" height={300} series={approvalValues} options={chartOptions.approval} /></div></div>
          <div className={`${panelClass} p-6`}><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Billing mix</h2></div><Link to={workspaceRoutes["billing-reports"].path} className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Open billing reports</Link></div><div className={`${chartCardClass} mt-6`}><Chart type="bar" height={320} series={[{ name: "Billable Hours", data: dashboardData.billableTrend.map((item) => item.billableHours) }, { name: "Non-Billable Hours", data: dashboardData.billableTrend.map((item) => item.nonBillableHours) }]} options={{ ...chartOptions.billable, xaxis: { categories: dashboardData.billableTrend.map((item) => item.label) } }} /></div></div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2"><div className={`${panelClass} p-6`}><p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Payroll Readiness</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Payroll pipeline movement</h2><div className={`${chartCardClass} mt-6`}><Chart type="line" height={320} series={[{ name: "Ready", data: dashboardData.payrollReadiness.map((item) => item.ready) }, { name: "Pending", data: dashboardData.payrollReadiness.map((item) => item.pending) }, { name: "Blocked", data: dashboardData.payrollReadiness.map((item) => item.blocked) }]} options={{ ...chartOptions.payroll, xaxis: { categories: dashboardData.payrollReadiness.map((item) => item.label) } }} /></div></div><div className={`${panelClass} p-6`}><p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Cost Trend</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Estimated payroll cost by period</h2><div className={`${chartCardClass} mt-6`}><Chart type="area" height={320} series={[{ name: "Estimated Cost", data: dashboardData.costTrend.map((item) => item.estimatedPayrollCost) }]} options={{ ...chartOptions.cost, xaxis: { categories: dashboardData.costTrend.map((item) => item.label) } }} /></div></div></section>
        <section className="grid gap-6 xl:grid-cols-2"><div className={`${panelClass} p-6`}><p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Department Exposure</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Department-wise approved hours</h2><div className={`${chartCardClass} mt-6`}><Chart type="bar" height={320} series={[{ name: "Approved Hours", data: dashboardData.departmentHours.map((item) => item.approvedHours) }]} options={{ ...chartOptions.department, xaxis: { categories: dashboardData.departmentHours.map((item) => item.departmentName) } }} /></div></div><div className={`${panelClass} p-6`}><p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Project Concentration</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Project-wise billable hours</h2><div className={`${chartCardClass} mt-6`}><Chart type="bar" height={320} series={[{ name: "Billable Hours", data: dashboardData.projectBillable.map((item) => item.billableHours) }]} options={{ ...chartOptions.project, xaxis: { categories: dashboardData.projectBillable.map((item) => item.projectName) } }} /></div></div></section>
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]"><div className={`${panelClass} p-6`}><p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Submission Compliance</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Closure readiness and exception load</h2><div className="mt-6 grid gap-4 sm:grid-cols-2">{[{ label: "Expected", value: dashboardData.compliance.totalEmployeesExpected }, { label: "On Time", value: dashboardData.compliance.submittedOnTime }, { label: "Late", value: dashboardData.compliance.lateSubmitted }, { label: "Missing", value: dashboardData.compliance.missing }, { label: "Rejected", value: dashboardData.compliance.rejectedForCorrection }].map((item) => <div key={item.label} className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50"><p className="text-sm text-zinc-500 dark:text-zinc-400">{item.label}</p><p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">{item.value}</p></div>)}</div><div className="mt-6 rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50"><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{dashboardData.meta.rangeLabel}</p></div></div><div className={`${panelClass} p-6`}><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Alerts</h2></div><span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">Monitor</span></div><div className="mt-6 grid gap-4 md:grid-cols-2">{dashboardData.alerts.map((alert: FinanceAlert) => { const tone: Record<AlertSeverity, string> = { high: "border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10", medium: "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10", low: "border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/70" }; return <Link key={alert.id} to={alert.actionUrl} className={`block rounded-[1.5rem] border p-4 transition hover:-translate-y-0.5 ${tone[alert.severity]}`}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{alert.title}</p><p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">{alert.count}</p></div><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-700 dark:bg-black/60 dark:text-zinc-200">{alert.severity}</span></div></Link>; })}</div></div></section>
        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Finance records</h2></div><div className="flex flex-wrap gap-3"><Link to={workspaceRoutes["approved-timesheets"].path} className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">Approved Timesheets</Link><Link to={workspaceRoutes["timesheet-payroll"].path} className="rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-black">Payroll Queue</Link></div></div>
            <div className="mt-5 grid gap-3 lg:grid-cols-[1.3fr_repeat(2,minmax(0,1fr))_auto]">
              <input aria-label="Search finance records" title="Search finance records" value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} placeholder="Search employee, department, project, or status" className={filterClass} />
              <select aria-label="Payroll status filter" title="Payroll status filter" value={payrollFilter} onChange={(event) => setPayrollFilter(event.target.value)} className={filterClass}>{payrollStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              <select aria-label="Billing status filter" title="Billing status filter" value={billingFilter} onChange={(event) => setBillingFilter(event.target.value)} className={filterClass}>{billingStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              <label className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200"><input type="checkbox" checked={overtimeOnly} onChange={(event) => setOvertimeOnly(event.target.checked)} />Overtime Only</label>
            </div>
          </div>
          <div className="overflow-auto"><table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800"><thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-black/95"><tr>{["Employee", "Department", "Project", "Period", "Total", "Billable", "Approval", "Payroll", "Billing", "Overtime", "Last Updated", "Actions"].map((heading) => <th key={heading} className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{heading}</th>)}</tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{paginatedRecords.length === 0 ? <tr><td colSpan={12} className="px-6 py-16 text-center"><p className="text-base font-semibold text-zinc-900 dark:text-white">No finance records match the current filters.</p></td></tr> : paginatedRecords.map((record: FinanceRecord) => <tr key={record.id} className="align-top transition hover:bg-zinc-50/70 dark:hover:bg-black/50"><td className="px-4 py-4"><p className="font-semibold text-zinc-900 dark:text-white">{record.employeeName}</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{record.id}</p></td><td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{record.department}</td><td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{record.project}</td><td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{record.period}</td><td className="px-4 py-4 text-sm font-medium text-zinc-900 dark:text-white">{formatHours(record.totalHours)}</td><td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatHours(record.billableHours)}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(record.approvalStatus)}`}>{record.approvalStatus}</span></td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(record.payrollStatus)}`}>{record.payrollStatus}</span></td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(record.billingStatus)}`}>{record.billingStatus}</span></td><td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatHours(record.overtimeHours)}</td><td className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">{record.lastUpdated}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Link to={workspaceRoutes["approved-timesheets"].path} className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">View</Link><Link to={workspaceRoutes["timesheet-payroll"].path} className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Payroll</Link><Link to={workspaceRoutes["billing-reports"].path} className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Billing</Link></div></td></tr>)}</tbody></table></div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </section>
      </div>
    </>
  );
};


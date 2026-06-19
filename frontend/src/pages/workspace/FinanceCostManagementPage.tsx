import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer } from "../../components/ToastContainer";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useToast } from "../../hooks/useToast";
import { FinancialReportService } from "../../services/financialReportService";
import type { DateRange } from "../../types/dashboard";
import type { FinancialReportBreakdown, FinancialReportData, FinancialReportQuery, FinancialReportRow, FinancialReportType } from "../../types/financialReport";

type CostManagementView = "projects" | "resources" | "expenses";

const panelClass = "rounded-[2rem] border border-zinc-200/80 bg-white/90 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/85";
const compactPanelClass = "rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/80";
const filterClass = "h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200";
const buttonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white";
const primaryButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200";

const rangeOptions: Array<{ value: DateRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

const viewConfig: Record<CostManagementView, { routeId: "project-costing" | "resource-cost" | "expense-tracking"; reportType: FinancialReportType; eyebrow: string; title: string; description: string; breakdownTitle: string; tableTitle: string; primaryColumn: string; primaryKey: keyof FinancialReportRow; }> = {
  projects: {
    routeId: "project-costing",
    reportType: "project-cost-analysis",
    eyebrow: "Cost Management / Projects",
    title: "Project Costing",
    description: "Track project-wise estimated cost, billable recovery, margin exposure, and approved effort from backend timesheet data.",
    breakdownTitle: "Project Cost Exposure",
    tableTitle: "Project Cost Rows",
    primaryColumn: "Project",
    primaryKey: "project",
  },
  resources: {
    routeId: "resource-cost",
    reportType: "employee-cost",
    eyebrow: "Cost Management / Resources",
    title: "Resource Cost",
    description: "Review employee-wise cost, billable contribution, utilization mix, and margin impact for the selected finance window.",
    breakdownTitle: "Resource Cost Ranking",
    tableTitle: "Resource Cost Rows",
    primaryColumn: "Employee",
    primaryKey: "employeeName",
  },
  expenses: {
    routeId: "expense-tracking",
    reportType: "expenses",
    eyebrow: "Cost Management / Expenses",
    title: "Expense Tracking",
    description: "Monitor expense movement, department spend, project allocation, and pending finance cost signals from backend reports.",
    breakdownTitle: "Department Expense Split",
    tableTitle: "Expense Rows",
    primaryColumn: "Department",
    primaryKey: "department",
  },
};

const isDateRange = (value: string | null): value is DateRange => rangeOptions.some((item) => item.value === value);
const toInputDate = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const formatCurrency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const formatHours = (value: number) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)}h`;
const formatPercent = (value: number) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)}%`;
const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const getRowsForBreakdown = (view: CostManagementView, report: FinancialReportData): FinancialReportBreakdown[] => {
  if (view === "projects") return report.projectBreakdown;
  if (view === "resources") return report.employeeBreakdown;
  return report.departmentBreakdown;
};

const downloadCostCsv = (filename: string, rows: FinancialReportRow[]) => {
  const headers = ["Employee", "Department", "Project", "Period", "Status", "Total Hours", "Billable Hours", "Non-Billable Hours", "Estimated Cost", "Revenue", "Margin", "Last Updated"];
  const body = rows.map((row) => [
    row.employeeName,
    row.department,
    row.project,
    row.period,
    row.status,
    row.totalHours,
    row.billableHours,
    row.nonBillableHours,
    row.expense,
    row.revenue,
    row.marginPercent,
    row.lastUpdated,
  ].map(csvEscape).join(","));
  const blob = new Blob([[headers.map(csvEscape).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const statusBadgeClass = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes("approved")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (normalized.includes("pending") || normalized.includes("submitted")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (normalized.includes("reject")) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};

const KpiCard = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <div className={`${panelClass} p-5`}>
    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
    <p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{value}</p>
    <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{note}</p>
  </div>
);

export const FinanceCostManagementPage = ({ view }: { view: CostManagementView }) => {
  const config = viewConfig[view];
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
  const [searchTerm, setSearchTerm] = useState("");
  const [report, setReport] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const customRangeValid = selectedRange !== "custom" || (Boolean(customStart) && Boolean(customEnd) && customStart <= customEnd);

  const activeFilter = useMemo<FinancialReportQuery>(() => ({
    range: selectedRange,
    ...(selectedRange === "custom" ? { startDate: customStart, endDate: customEnd } : {}),
    ...(departmentFilter ? { department: departmentFilter } : {}),
    ...(projectFilter ? { project: projectFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  }), [customEnd, customStart, departmentFilter, projectFilter, selectedRange, statusFilter]);

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

  const loadCostData = useCallback(async (announceSuccess = false) => {
    if (!customRangeValid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await FinancialReportService.getReport(config.reportType, activeFilter);
      setReport(data);
      if (announceSuccess) showToast("Cost management data refreshed.", "success");
    } catch {
      setLoadError("Unable to fetch cost management data from the backend right now.");
      showToast("Backend cost data could not be loaded.", "error");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, config.reportType, customRangeValid, showToast]);

  useEffect(() => {
    void loadCostData(false);
  }, [loadCostData]);

  const filteredRows = useMemo(() => {
    const rows = report?.rows ?? [];
    const query = searchTerm.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => [row.employeeName, row.department, row.project, row.period, row.status].some((value) => value.toLowerCase().includes(query)));
  }, [report?.rows, searchTerm]);

  const breakdownRows = report ? getRowsForBreakdown(view, report) : [];
  const averageCostPerHour = report && report.summary.billableHours + report.summary.nonBillableHours > 0
    ? report.summary.totalExpense / (report.summary.billableHours + report.summary.nonBillableHours)
    : 0;
  const recoveryPercent = report && report.summary.totalExpense > 0 ? (report.summary.totalRevenue / report.summary.totalExpense) * 100 : 0;

  const chartOptions = useMemo<Record<string, ApexOptions>>(() => ({
    trend: {
      chart: { toolbar: { show: false }, foreColor: "#71717a" },
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 3 },
      grid: { borderColor: "#e4e4e7" },
      xaxis: { categories: report?.trend.map((item) => item.label) ?? [] },
      yaxis: { labels: { formatter: (value) => formatCurrency(value) } },
      tooltip: { y: { formatter: (value) => formatCurrency(value) } },
      colors: ["#18181b", "#71717a", "#16a34a"],
      legend: { position: "top" },
    },
    breakdown: {
      chart: { toolbar: { show: false }, foreColor: "#71717a" },
      dataLabels: { enabled: false },
      plotOptions: { bar: { borderRadius: 6, horizontal: true } },
      xaxis: { categories: breakdownRows.slice(0, 8).map((item) => item.label), labels: { formatter: (value) => formatCurrency(Number(value)) } },
      tooltip: { y: { formatter: (value) => formatCurrency(value) } },
      colors: ["#18181b"],
    },
  }), [breakdownRows, report?.trend]);

  if (loading && !report) {
    return <LoadingSpinner label="Loading cost management data..." />;
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),transparent_34%),linear-gradient(180deg,rgba(250,250,250,0.98),rgba(244,244,245,0.94))] p-6 shadow-panel dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.98),rgba(0,0,0,0.94))]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">{config.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-white">{config.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{config.description}</p>
            {report?.meta.usesEstimatedFinancials ? <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-200">{report.meta.expenseModel}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={workspaceRoutes["finance-dashboard"].path} className={buttonClass}><Icon name="dashboard" className="h-4 w-4" /> Dashboard</Link>
            <button type="button" onClick={() => void loadCostData(true)} className={buttonClass}><Icon name="refresh-cw" className="h-4 w-4" /> Refresh</button>
            <button type="button" onClick={() => downloadCostCsv(`${view}-cost-management.csv`, filteredRows)} className={primaryButtonClass} disabled={filteredRows.length === 0}><Icon name="download" className="h-4 w-4" /> Export CSV</button>
          </div>
        </div>
      </section>

      <section className={`${panelClass} p-4`}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select aria-label="Date range" value={selectedRange} onChange={(event) => setSelectedRange(event.target.value as DateRange)} className={filterClass}>
            {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input aria-label="Start date" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} disabled={selectedRange !== "custom"} className={filterClass} />
          <input aria-label="End date" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} disabled={selectedRange !== "custom"} className={filterClass} />
          <select aria-label="Department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className={filterClass}>
            <option value="">All Departments</option>
            {(report?.filters.departments ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select aria-label="Project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className={filterClass}>
            <option value="">All Projects</option>
            {(report?.filters.projects ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={filterClass}>
            <option value="">All Statuses</option>
            {(report?.filters.statuses ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {!customRangeValid ? <p className="mt-3 text-sm font-medium text-rose-600">Choose a valid custom date range.</p> : null}
      </section>

      {loadError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{loadError}</div> : null}

      {report ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Estimated Cost" value={formatCurrency(report.summary.totalExpense)} note={`${formatHours(report.summary.billableHours + report.summary.nonBillableHours)} approved effort costed.`} />
            <KpiCard label="Cost Recovery" value={formatPercent(recoveryPercent)} note={`${formatCurrency(report.summary.totalRevenue)} estimated recoverable revenue.`} />
            <KpiCard label="Gross Margin" value={formatCurrency(report.summary.grossProfit)} note={`${formatPercent(report.summary.marginPercent)} margin across selected rows.`} />
            <KpiCard label="Avg Cost / Hour" value={formatCurrency(averageCostPerHour)} note={`${report.summary.recordCount} backend records included.`} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className={`${panelClass} p-5`}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">Cost Trend</h2>
                <span className="text-sm text-zinc-500">{report.meta.rangeLabel}</span>
              </div>
              <Chart type="area" height={320} series={[{ name: "Cost", data: report.trend.map((item) => item.expense) }, { name: "Revenue", data: report.trend.map((item) => item.revenue) }, { name: "Margin", data: report.trend.map((item) => item.profit) }]} options={chartOptions.trend} />
            </div>
            <div className={`${panelClass} p-5`}>
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">{config.breakdownTitle}</h2>
              <Chart type="bar" height={320} series={[{ name: "Estimated Cost", data: breakdownRows.slice(0, 8).map((item) => item.expense) }]} options={chartOptions.breakdown} />
            </div>
          </section>

          <section className={`${panelClass} overflow-hidden`}>
            <div className="flex flex-col gap-3 border-b border-zinc-200 p-5 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">{config.tableTitle}</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Fetched from backend finance report calculations.</p>
              </div>
              <input aria-label="Search cost rows" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search employee, department, project, status" className={`${filterClass} md:w-96`} />
            </div>

            <div className="grid gap-4 border-b border-zinc-200 p-5 dark:border-zinc-800 md:grid-cols-2 xl:grid-cols-4">
              {breakdownRows.slice(0, 4).map((item) => (
                <div key={item.label} className={compactPanelClass}>
                  <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{item.label}</p>
                  <p className="mt-2 text-xl font-bold text-zinc-950 dark:text-white">{formatCurrency(item.expense)}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatHours(item.hours)} / {formatPercent(item.marginPercent)}</p>
                </div>
              ))}
            </div>

            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50/90 dark:bg-zinc-950/90">
                  <tr>{[config.primaryColumn, "Department", "Project", "Period", "Status", "Hours", "Cost", "Revenue", "Margin"].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{heading}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan={9} className="px-6 py-12 text-center text-sm font-semibold text-zinc-500">No backend cost rows match the current filters.</td></tr>
                  ) : filteredRows.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-zinc-50/80 dark:hover:bg-zinc-950">
                      <td className="px-4 py-4"><p className="font-semibold text-zinc-900 dark:text-white">{String(row[config.primaryKey])}</p><p className="mt-1 text-xs text-zinc-500">{row.id}</p></td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{row.department}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{row.project}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{row.period}</td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>{row.status}</span></td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatHours(row.totalHours)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(row.expense)}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatPercent(row.marginPercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

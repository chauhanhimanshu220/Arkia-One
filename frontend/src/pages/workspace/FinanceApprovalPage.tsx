import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, type IconName } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { ToastContainer } from "../../components/ToastContainer";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useToast } from "../../hooks/useToast";
import { FinanceApprovalService } from "../../services/financeApprovalService";
import type { AuthUser } from "../../types/auth";
import type { DateRange } from "../../types/dashboard";
import type { FinanceApprovalItem, FinanceApprovalQuery, FinanceApprovalQueue, FinanceApprovalType } from "../../types/financeApproval";

const PAGE_SIZE = 10;
const panelClass = "rounded-[2rem] border border-white/70 bg-white/85 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/85";
const filterClass = "h-12 rounded-2xl border border-zinc-200 bg-white/90 px-4 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200";
const secondaryButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200";
const primaryButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black";
const rangeOptions: Array<{ value: DateRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

const moduleConfig: Record<
  FinanceApprovalType,
  {
    title: string;
    metricLabel: string;
    amountLabel: string;
    emptyLabel: string;
    sourceRoute: string;
    sourceLabel: string;
    icon: IconName;
  }
> = {
  payroll: {
    title: "Payroll Approval",
    metricLabel: "Payroll Queue",
    amountLabel: "Payroll Amount",
    emptyLabel: "No payroll approval records found.",
    sourceRoute: workspaceRoutes["timesheet-payroll"].path,
    sourceLabel: "Payroll Queue",
    icon: "file-spreadsheet",
  },
  expenses: {
    title: "Expense Approval",
    metricLabel: "Expense Queue",
    amountLabel: "Expense Amount",
    emptyLabel: "No expense approval records found.",
    sourceRoute: workspaceRoutes["expense-tracking"].path,
    sourceLabel: "Expense Tracking",
    icon: "reports",
  },
  billing: {
    title: "Billing Approval",
    metricLabel: "Billing Queue",
    amountLabel: "Billing Amount",
    emptyLabel: "No billing approval records found.",
    sourceRoute: workspaceRoutes["billing-reports"].path,
    sourceLabel: "Billing Reports",
    icon: "approvals",
  },
};

const isDateRange = (value: string | null): value is DateRange =>
  ["today", "this_week", "last_week", "this_month", "last_month", "custom"].includes(value ?? "");

const toInputDate = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const formatHours = (value: number) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)}h`;
const formatCurrency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const csvEscape = (value: string | number | boolean) => `"${String(value).replace(/"/g, '""')}"`;

const statusBadgeClass = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("approved") || normalized.includes("ready")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (normalized.includes("blocked") || normalized.includes("reject") || normalized.includes("return")) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  if (normalized.includes("pending") || normalized.includes("submitted") || normalized.includes("draft")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};

const priorityBadgeClass = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "high") return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  if (normalized === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};

const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: IconName }) => (
  <div className="rounded-[1.5rem] border border-zinc-200/80 bg-white/80 p-5 shadow-sm dark:border-zinc-800 dark:bg-black/60">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="mt-3 text-2xl font-bold text-zinc-950 dark:text-white">{value}</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
        <Icon name={icon} className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const DetailLine = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/50">
    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{value}</p>
  </div>
);

export const FinanceApprovalPage = ({ approvalType, user }: { approvalType: FinanceApprovalType; user: AuthUser }) => {
  const config = moduleConfig[approvalType];
  const [searchParams, setSearchParams] = useSearchParams();
  const { toasts, showToast, dismissToast } = useToast();
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const defaultEnd = useMemo(() => toInputDate(today), [today]);
  const [selectedRange, setSelectedRange] = useState<DateRange>(isDateRange(searchParams.get("range")) ? (searchParams.get("range") as DateRange) : "last_month");
  const [customStart, setCustomStart] = useState(searchParams.get("startDate") ?? defaultStart);
  const [customEnd, setCustomEnd] = useState(searchParams.get("endDate") ?? defaultEnd);
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get("department") ?? "");
  const [projectFilter, setProjectFilter] = useState(searchParams.get("project") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [searchText, setSearchText] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [queue, setQueue] = useState<FinanceApprovalQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const customRangeValid = selectedRange !== "custom" || (Boolean(customStart) && Boolean(customEnd) && customStart <= customEnd);
  const activeFilter = useMemo<FinanceApprovalQuery>(() => ({
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

  const loadQueue = useCallback(async (announceSuccess = false) => {
    if (!customRangeValid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await FinanceApprovalService.getQueue(approvalType, activeFilter);
      setQueue(data);
      setSelectedItemId((current) => (current && data.items.some((item) => item.id === current) ? current : data.items[0]?.id ?? null));
      if (announceSuccess) showToast(`${config.title} refreshed.`, "success");
    } catch {
      setLoadError("Unable to load approval data right now.");
      setQueue(null);
      if (announceSuccess) showToast("Unable to refresh approval data.", "error");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, approvalType, config.title, customRangeValid, showToast]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const filteredItems = useMemo(() => {
    const items = queue?.items ?? [];
    const query = searchText.trim().toLowerCase();
    return items.filter((item) => {
      if (priorityFilter !== "All" && item.priority !== priorityFilter) return false;
      if (!query) return true;
      return [
        item.referenceNo,
        item.employeeName,
        item.employeeCode,
        item.department,
        item.project,
        item.period,
        item.status,
        item.payrollStatus,
        item.billingStatus,
      ].join(" ").toLowerCase().includes(query);
    });
  }, [priorityFilter, queue?.items, searchText]);

  useEffect(() => {
    setCurrentPage(1);
  }, [priorityFilter, searchText, departmentFilter, projectFilter, statusFilter, selectedRange]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [currentPage, filteredItems]);
  const selectedItem = useMemo<FinanceApprovalItem | null>(() => {
    if (!queue) return null;
    return queue.items.find((item) => item.id === selectedItemId) ?? filteredItems[0] ?? null;
  }, [filteredItems, queue, selectedItemId]);

  const handleExport = useCallback(() => {
    if (!queue) return;
    const rows = [
      ["Reference", "Employee", "Employee Code", "Department", "Project", "Period", "Status", "Payroll", "Billing", "Hours", "Billable", "Amount", "Priority", "Age", "Last Updated"],
      ...filteredItems.map((item) => [
        item.referenceNo,
        item.employeeName,
        item.employeeCode,
        item.department,
        item.project,
        item.period,
        item.status,
        item.payrollStatus,
        item.billingStatus,
        item.totalHours,
        item.billableHours,
        item.amount,
        item.priority,
        item.ageLabel,
        item.lastUpdated,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => csvEscape((cell ?? "") as string | number | boolean)).join(",")).join("\n");
    downloadBlob(`${approvalType}-approval-${selectedRange}-${toInputDate(new Date())}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
    showToast(`${config.title} exported.`, "success");
  }, [approvalType, config.title, filteredItems, queue, selectedRange, showToast]);

  if (loading && !queue) {
    return <LoadingSpinner label={`Loading ${config.title.toLowerCase()}...`} />;
  }

  const summary = queue?.summary;

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <WorkspacePageHero
          title={config.title}
          belowTitle={<p className="text-sm text-zinc-500 dark:text-zinc-400">{queue?.meta.rangeLabel ?? "Approval queue"}</p>}
        >
          <WorkspaceHeroMeta primary={user.role} secondary="Active role" />
          <WorkspaceHeroMeta primary={`${filteredItems.length} visible`} secondary={config.metricLabel} />
        </WorkspacePageHero>

        <section className={`${panelClass} p-5`}>
          <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
            <select aria-label="Date range" value={selectedRange} onChange={(event) => setSelectedRange(event.target.value as DateRange)} className={filterClass}>
              {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select aria-label="Department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className={filterClass}>
              <option value="">All Departments</option>
              {(queue?.filters.departments ?? []).map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            <select aria-label="Project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className={filterClass}>
              <option value="">All Projects</option>
              {(queue?.filters.projects ?? []).map((project) => <option key={project} value={project}>{project}</option>)}
            </select>
            <select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={filterClass}>
              <option value="">All Statuses</option>
              {(queue?.filters.statuses ?? []).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <button type="button" onClick={() => void loadQueue(true)} disabled={!customRangeValid || loading} className={secondaryButtonClass}>
              <Icon name="refresh-cw" className="h-4 w-4" />
              Refresh
            </button>
            <button type="button" onClick={handleExport} disabled={!queue || filteredItems.length === 0} className={primaryButtonClass}>
              <Icon name="download" className="h-4 w-4" />
              Export
            </button>
          </div>
          {selectedRange === "custom" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input aria-label="Start date" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className={filterClass} />
              <input aria-label="End date" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className={filterClass} />
            </div>
          ) : null}
          {!customRangeValid ? <p className="mt-3 text-sm font-semibold text-rose-600">Start date must be on or before end date.</p> : null}
        </section>

        {loadError ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
            {loadError}
          </section>
        ) : null}

        {summary ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total Items" value={String(summary.totalItems)} icon={config.icon} />
            <StatCard label="Pending" value={String(summary.pendingItems)} icon="inbox" />
            <StatCard label="Approved / Ready" value={String(summary.approvedItems)} icon="check" />
            <StatCard label={config.amountLabel} value={formatCurrency(summary.totalAmount)} icon="file-spreadsheet" />
            <StatCard label="High Priority" value={String(summary.highPriorityItems)} icon="clock" />
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className={`${panelClass} overflow-hidden`}>
            <div className="border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-800">
              <div className="grid gap-3 lg:grid-cols-[1.4fr_220px]">
                <input
                  aria-label="Search approvals"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search reference, employee, project, status"
                  className={filterClass}
                />
                <select aria-label="Priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className={filterClass}>
                  <option value="All">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Normal">Normal</option>
                </select>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-black/95">
                  <tr>
                    {["Reference", "Employee", "Project", "Status", "Hours", "Amount", "Priority", "Age", "Action"].map((heading) => (
                      <th key={heading} className="px-4 py-4 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-14 text-center text-sm font-semibold text-zinc-500">{config.emptyLabel}</td>
                    </tr>
                  ) : paginatedItems.map((item) => (
                    <tr key={item.id} className="align-top transition hover:bg-zinc-50/70 dark:hover:bg-black/50">
                      <td className="px-4 py-4">
                        <button type="button" onClick={() => setSelectedItemId(item.id)} className="text-left font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-white">
                          {item.referenceNo}
                        </button>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.period}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.employeeName || "Unknown employee"}</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.employeeCode || item.department}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{item.project}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>{item.status}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatHours(item.totalHours)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(item.amount)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${priorityBadgeClass(item.priority)}`}>{item.priority}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">{item.ageLabel}</td>
                      <td className="px-4 py-4">
                        <button type="button" onClick={() => setSelectedItemId(item.id)} className={secondaryButtonClass}>Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>

          <aside className={`${panelClass} p-5`}>
            {selectedItem ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{selectedItem.referenceNo}</p>
                    <h2 className="mt-2 text-xl font-bold text-zinc-950 dark:text-white">{selectedItem.employeeName || selectedItem.project}</h2>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${priorityBadgeClass(selectedItem.priority)}`}>{selectedItem.priority}</span>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(selectedItem.status)}`}>{selectedItem.status}</span>
                <div className="grid gap-3">
                  <DetailLine label="Project" value={selectedItem.project} />
                  <DetailLine label="Period" value={selectedItem.period} />
                  <DetailLine label="Department" value={selectedItem.department || "-"} />
                  <DetailLine label="Total Hours" value={formatHours(selectedItem.totalHours)} />
                  <DetailLine label="Billable Hours" value={formatHours(selectedItem.billableHours)} />
                  <DetailLine label={config.amountLabel} value={formatCurrency(selectedItem.amount)} />
                  <DetailLine label="Payroll Status" value={selectedItem.payrollStatus} />
                  <DetailLine label="Billing Status" value={selectedItem.billingStatus} />
                  <DetailLine label="Last Updated" value={selectedItem.lastUpdated} />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Link to={config.sourceRoute} className={primaryButtonClass}>
                    <Icon name="external-link" className="h-4 w-4" />
                    {config.sourceLabel}
                  </Link>
                  <button type="button" onClick={() => showToast(`${selectedItem.referenceNo} selected for review.`, "info")} className={secondaryButtonClass}>
                    <Icon name="eye" className="h-4 w-4" />
                    Review
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-sm font-semibold text-zinc-500">{config.emptyLabel}</div>
            )}
          </aside>
        </section>
      </div>
    </>
  );
};

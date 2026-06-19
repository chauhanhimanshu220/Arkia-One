import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { ToastContainer } from "../../components/ToastContainer";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useToast } from "../../hooks/useToast";
import { FinancialReportService } from "../../services/financialReportService";
import type { DateRange } from "../../types/dashboard";
import type { FinancialReportBreakdown, FinancialReportData, FinancialReportQuery, FinancialReportRow, FinancialReportType } from "../../types/financialReport";

const panelClass = "rounded-[1.75rem] border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-black/80";
const filterClass = "h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200";
const buttonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white";
const primaryButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const pageSize = 10;
const expenseLedgerStorageKey = "tms.finance.expenseLedger.v1";

const rangeOptions: Array<{ value: DateRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

const reportCopy: Record<FinancialReportType, { eyebrow: string; title: string; description: string; focus: "revenue" | "expense" | "profit" }> = {
  revenue: {
    eyebrow: "Financial Reports / Revenue",
    title: "Revenue Report",
    description: "Track approved billable effort, estimated revenue, project concentration, and period revenue movement.",
    focus: "revenue",
  },
  expenses: {
    eyebrow: "Financial Reports / Expense",
    title: "Expense Report",
    description: "Review estimated payroll cost, non-billable exposure, department spend, and cost movement over time.",
    focus: "expense",
  },
  "profit-loss": {
    eyebrow: "Financial Reports / P&L",
    title: "Profit & Loss Report",
    description: "Compare derived revenue and cost to understand gross profit, margin, and project-level contribution.",
    focus: "profit",
  },
  "project-cost-analysis": {
    eyebrow: "Financial Reports / Project Cost",
    title: "Project Cost Analysis",
    description: "Analyze project-wise cost, approved effort, billable mix, and contribution across the selected period.",
    focus: "expense",
  },
  "employee-cost": {
    eyebrow: "Financial Reports / Employee Cost",
    title: "Employee Cost Report",
    description: "See employee-wise estimated cost, approved hours, billable contribution, and margin impact.",
    focus: "expense",
  },
};

const buildBreakdown = (rows: FinancialReportRow[], key: "project" | "employeeName" | "department"): FinancialReportBreakdown[] => {
  const grouped = rows.reduce<Record<string, FinancialReportBreakdown>>((acc, row) => {
    const label = row[key];
    const current = acc[label] ?? { label, revenue: 0, expense: 0, profit: 0, hours: 0, marginPercent: 0 };
    current.revenue += row.revenue;
    current.expense += row.expense;
    current.profit += row.profit;
    current.hours += row.totalHours;
    current.marginPercent = current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0;
    acc[label] = current;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit));
};

const buildFallbackFinancialReport = (reportType: FinancialReportType, filter: FinancialReportQuery): FinancialReportData => {
  const baseRows: FinancialReportRow[] = [
    { id: "FIN-2401", employeeName: "Amit Verma", department: "Engineering", project: "Atlas Migration", period: "01 Apr - 06 Apr", status: "Finance Approved", totalHours: 46, billableHours: 40, nonBillableHours: 6, revenue: 176000, expense: 74500, profit: 101500, marginPercent: 57.7, lastUpdated: "08 Apr 2026" },
    { id: "FIN-2402", employeeName: "Neha Sharma", department: "Operations", project: "Mercury Rollout", period: "01 Apr - 06 Apr", status: "Finance Pending", totalHours: 44, billableHours: 36, nonBillableHours: 8, revenue: 136800, expense: 68200, profit: 68600, marginPercent: 50.1, lastUpdated: "08 Apr 2026" },
    { id: "FIN-2403", employeeName: "Ravi Mehta", department: "Finance", project: "Zenith Compliance", period: "07 Apr - 12 Apr", status: "Finance Approved", totalHours: 42, billableHours: 38, nonBillableHours: 4, revenue: 152000, expense: 72100, profit: 79900, marginPercent: 52.6, lastUpdated: "13 Apr 2026" },
    { id: "FIN-2404", employeeName: "Priya Nair", department: "Support", project: "Nova Shared Services", period: "07 Apr - 12 Apr", status: "Submitted", totalHours: 40, billableHours: 29, nonBillableHours: 11, revenue: 92800, expense: 59600, profit: 33200, marginPercent: 35.8, lastUpdated: "13 Apr 2026" },
    { id: "FIN-2405", employeeName: "Karan Singh", department: "Engineering", project: "Atlas Migration", period: "14 Apr - 19 Apr", status: "Finance Approved", totalHours: 48, billableHours: 45, nonBillableHours: 3, revenue: 198000, expense: 81200, profit: 116800, marginPercent: 59, lastUpdated: "20 Apr 2026" },
    { id: "FIN-2406", employeeName: "Sara Khan", department: "Operations", project: "Mercury Rollout", period: "14 Apr - 19 Apr", status: "Rejected", totalHours: 39, billableHours: 26, nonBillableHours: 13, revenue: 98800, expense: 57400, profit: 41400, marginPercent: 41.9, lastUpdated: "20 Apr 2026" },
  ];
  const rows = baseRows.filter((row) =>
    (!filter.department || row.department === filter.department) &&
    (!filter.project || row.project === filter.project) &&
    (!filter.status || row.status === filter.status),
  );
  const totals = rows.reduce((acc, row) => {
    acc.totalRevenue += row.revenue;
    acc.totalExpense += row.expense;
    acc.grossProfit += row.profit;
    acc.billableHours += row.billableHours;
    acc.nonBillableHours += row.nonBillableHours;
    return acc;
  }, { totalRevenue: 0, totalExpense: 0, grossProfit: 0, billableHours: 0, nonBillableHours: 0 });
  const trend = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"].map((label, index) => {
    const multiplier = [0.78, 0.92, 1.08, 0.96, 1.14][index];
    const revenue = Math.round((totals.totalRevenue || 520000) * multiplier / 4);
    const expense = Math.round((totals.totalExpense || 228000) * (multiplier - 0.08) / 4);
    return { label, revenue, expense, profit: revenue - expense, hours: Math.round((totals.billableHours + totals.nonBillableHours || 220) * multiplier / 4) };
  });

  return {
    summary: {
      ...totals,
      marginPercent: totals.totalRevenue > 0 ? (totals.grossProfit / totals.totalRevenue) * 100 : 0,
      recordCount: rows.length,
    },
    trend,
    projectBreakdown: buildBreakdown(rows, "project"),
    employeeBreakdown: buildBreakdown(rows, "employeeName"),
    departmentBreakdown: buildBreakdown(rows, "department"),
    rows,
    filters: {
      departments: Array.from(new Set(baseRows.map((row) => row.department))),
      projects: Array.from(new Set(baseRows.map((row) => row.project))),
      statuses: Array.from(new Set(baseRows.map((row) => row.status))),
    },
    meta: {
      reportType,
      title: reportCopy[reportType].title,
      rangeLabel: filter.range === "custom" ? `${filter.startDate ?? ""} - ${filter.endDate ?? ""}` : rangeOptions.find((item) => item.value === filter.range)?.label ?? "Selected range",
      revenueModel: "Demo revenue uses billable hours and project rate cards.",
      expenseModel: "Demo expense uses estimated payroll and operating cost.",
      usesEstimatedFinancials: true,
    },
  };
};

const isDateRange = (value: string | null): value is DateRange => ["today", "this_week", "last_week", "this_month", "last_month", "custom"].includes(value ?? "");
const toInputDate = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const formatCurrency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const formatHours = (value: number) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)}h`;
const formatPercent = (value: number) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)}%`;
const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

type ExpensePaymentStatus = "Paid" | "Partial" | "Pending";

interface ExpenseLedgerEntry {
  id: string;
  expenseDate: string;
  category: string;
  vendor: string;
  department: string;
  project: string;
  description: string;
  quantity: number;
  unitCost: number;
  taxPercent: number;
  discount: number;
  paidAmount: number;
  paymentMode: string;
}

type ExpenseLedgerForm = Omit<ExpenseLedgerEntry, "id">;

const expenseCategories = ["Payroll", "Software", "Travel", "Office", "Hardware", "Vendor", "Utilities", "Other"];
const paymentModes = ["Bank Transfer", "UPI", "Card", "Cash", "Cheque"];
const expenseFormInputClass = `${filterClass} w-full`;
const numberInputClass = `${filterClass} w-full text-right`;

const createExpenseForm = (dateValue = toInputDate(new Date())): ExpenseLedgerForm => ({
  expenseDate: dateValue,
  category: "Payroll",
  vendor: "",
  department: "",
  project: "",
  description: "",
  quantity: 1,
  unitCost: 0,
  taxPercent: 18,
  discount: 0,
  paidAmount: 0,
  paymentMode: "Bank Transfer",
});

const safeNumber = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

const calculateExpenseAmount = (entry: Pick<ExpenseLedgerEntry, "quantity" | "unitCost" | "taxPercent" | "discount" | "paidAmount">) => {
  const subtotal = safeNumber(entry.quantity) * safeNumber(entry.unitCost);
  const taxAmount = subtotal * (safeNumber(entry.taxPercent) / 100);
  const total = Math.max(0, subtotal + taxAmount - safeNumber(entry.discount));
  const paid = Math.min(safeNumber(entry.paidAmount), total);
  const balance = Math.max(0, total - paid);
  const status: ExpensePaymentStatus = balance <= 0 && total > 0 ? "Paid" : paid > 0 ? "Partial" : "Pending";

  return { subtotal, taxAmount, total, paid, balance, status };
};

const loadExpenseLedgerEntries = () => {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(expenseLedgerStorageKey);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed as ExpenseLedgerEntry[] : [];
  } catch {
    return [];
  }
};

const expenseStatusBadgeClass = (status: ExpensePaymentStatus) => {
  if (status === "Paid") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (status === "Partial") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
};

const statusBadgeClass = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes("approved")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (normalized.includes("pending")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (normalized.includes("reject")) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};

const downloadCsv = (filename: string, rows: FinancialReportRow[]) => {
  const headers = ["Employee", "Department", "Project", "Period", "Status", "Total Hours", "Billable Hours", "Non-Billable Hours", "Revenue", "Expense", "Profit", "Margin", "Last Updated"];
  const body = rows.map((row) =>
    [
      row.employeeName,
      row.department,
      row.project,
      row.period,
      row.status,
      row.totalHours,
      row.billableHours,
      row.nonBillableHours,
      row.revenue,
      row.expense,
      row.profit,
      row.marginPercent,
      row.lastUpdated,
    ].map(csvEscape).join(","),
  );
  const blob = new Blob([[headers.map(csvEscape).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const getBreakdownForReport = (reportType: FinancialReportType, report: FinancialReportData) => {
  if (reportType === "employee-cost") return { title: "Employee Cost Ranking", rows: report.employeeBreakdown };
  if (reportType === "project-cost-analysis" || reportType === "revenue") return { title: "Project Breakdown", rows: report.projectBreakdown };
  return { title: "Department Breakdown", rows: report.departmentBreakdown };
};

const BreakdownTable = ({ rows, focus }: { rows: FinancialReportBreakdown[]; focus: "revenue" | "expense" | "profit" }) => (
  <div className="overflow-auto">
    <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
      <thead className="bg-zinc-50/90 dark:bg-zinc-950/90">
        <tr>
          {["Name", "Revenue", "Expense", "Profit", "Hours", "Margin"].map((heading) => (
            <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.length === 0 ? (
          <tr><td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-zinc-500">No breakdown rows available for this filter.</td></tr>
        ) : rows.map((row) => (
          <tr key={row.label} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-950">
            <td className="px-4 py-4 font-semibold text-zinc-900 dark:text-white">{row.label}</td>
            <td className={`px-4 py-4 text-sm ${focus === "revenue" ? "font-semibold text-zinc-950 dark:text-white" : "text-zinc-600 dark:text-zinc-300"}`}>{formatCurrency(row.revenue)}</td>
            <td className={`px-4 py-4 text-sm ${focus === "expense" ? "font-semibold text-zinc-950 dark:text-white" : "text-zinc-600 dark:text-zinc-300"}`}>{formatCurrency(row.expense)}</td>
            <td className={`px-4 py-4 text-sm ${focus === "profit" ? "font-semibold text-zinc-950 dark:text-white" : "text-zinc-600 dark:text-zinc-300"}`}>{formatCurrency(row.profit)}</td>
            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatHours(row.hours)}</td>
            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatPercent(row.marginPercent)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const FinancialReportPage = ({ reportType }: { reportType: FinancialReportType }) => {
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
  const [currentPage, setCurrentPage] = useState(1);
  const [report, setReport] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseLedgerEntry[]>(() => loadExpenseLedgerEntries());
  const [expenseForm, setExpenseForm] = useState<ExpenseLedgerForm>(() => createExpenseForm(defaultEnd));
  const copy = reportCopy[reportType];
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

  const loadReport = useCallback(async (announceSuccess = false) => {
    if (!customRangeValid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await FinancialReportService.getReport(reportType, activeFilter);
      setReport(data);
      setCurrentPage(1);
      if (announceSuccess) showToast("Financial report refreshed.", "success");
    } catch {
      setReport(buildFallbackFinancialReport(reportType, activeFilter));
      setCurrentPage(1);
      setLoadError("Live financial report data is unavailable right now, so this report is showing a demo finance snapshot.");
      if (announceSuccess) showToast("Loaded fallback financial report snapshot.", "info");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, customRangeValid, reportType, showToast]);

  useEffect(() => {
    void loadReport(false);
  }, [loadReport]);

  useEffect(() => {
    if (reportType !== "expenses" || typeof window === "undefined") return;
    window.localStorage.setItem(expenseLedgerStorageKey, JSON.stringify(expenseEntries));
  }, [expenseEntries, reportType]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = report?.rows ?? [];
    if (!query) return rows;
    return rows.filter((row) =>
      [row.employeeName, row.department, row.project, row.period, row.status, row.lastUpdated].some((value) => value.toLowerCase().includes(query)),
    );
  }, [report?.rows, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const breakdown = report ? getBreakdownForReport(reportType, report) : { title: "Breakdown", rows: [] };
  const expensePreview = useMemo(() => calculateExpenseAmount(expenseForm), [expenseForm]);
  const expenseLedgerSummary = useMemo(() => {
    const totals = expenseEntries.reduce((acc, entry) => {
      const calculated = calculateExpenseAmount(entry);
      acc.subtotal += calculated.subtotal;
      acc.tax += calculated.taxAmount;
      acc.discount += safeNumber(entry.discount);
      acc.total += calculated.total;
      acc.paid += calculated.paid;
      acc.balance += calculated.balance;
      acc.pendingCount += calculated.status === "Paid" ? 0 : 1;
      acc.byCategory[entry.category] = (acc.byCategory[entry.category] ?? 0) + calculated.total;
      return acc;
    }, { subtotal: 0, tax: 0, discount: 0, total: 0, paid: 0, balance: 0, pendingCount: 0, byCategory: {} as Record<string, number> });

    return {
      ...totals,
      topCategories: Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4),
    };
  }, [expenseEntries]);

  const handleExpenseFieldChange = (field: keyof ExpenseLedgerForm) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const numericFields: Array<keyof ExpenseLedgerForm> = ["quantity", "unitCost", "taxPercent", "discount", "paidAmount"];
    const value = numericFields.includes(field) ? Number(event.target.value) : event.target.value;
    setExpenseForm((current) => ({ ...current, [field]: value }));
  };

  const handleExpenseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const calculated = calculateExpenseAmount(expenseForm);
    if (!expenseForm.vendor.trim() || calculated.total <= 0) {
      showToast("Vendor and expense amount are required.", "error");
      return;
    }

    const entry: ExpenseLedgerEntry = {
      ...expenseForm,
      id: `EXP-${Date.now()}`,
      vendor: expenseForm.vendor.trim(),
      department: expenseForm.department.trim() || "General",
      project: expenseForm.project.trim() || "Unassigned",
      description: expenseForm.description.trim() || "Expense entry",
    };

    setExpenseEntries((current) => [entry, ...current]);
    setExpenseForm(createExpenseForm(expenseForm.expenseDate));
    showToast("Expense entry added to local ledger.", "success");
  };

  const handleRemoveExpense = (entryId: string) => {
    setExpenseEntries((current) => current.filter((entry) => entry.id !== entryId));
  };

  const exportExpenseLedgerCsv = () => {
    const headers = ["Date", "Category", "Vendor", "Department", "Project", "Description", "Qty", "Unit Cost", "Subtotal", "Tax", "Discount", "Total", "Paid", "Balance", "Status", "Payment Mode"];
    const body = expenseEntries.map((entry) => {
      const calculated = calculateExpenseAmount(entry);
      return [
        entry.expenseDate,
        entry.category,
        entry.vendor,
        entry.department,
        entry.project,
        entry.description,
        entry.quantity,
        entry.unitCost,
        calculated.subtotal,
        calculated.taxAmount,
        entry.discount,
        calculated.total,
        calculated.paid,
        calculated.balance,
        calculated.status,
        entry.paymentMode,
      ].map(csvEscape).join(",");
    });
    const blob = new Blob([[headers.map(csvEscape).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "expense-ledger.csv";
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

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
      xaxis: { categories: breakdown.rows.slice(0, 8).map((item) => item.label), labels: { formatter: (value) => formatCurrency(Number(value)) } },
      tooltip: { y: { formatter: (value) => formatCurrency(value) } },
      colors: ["#18181b"],
    },
  }), [breakdown.rows, report?.trend]);

  if (loading && !report) {
    return <LoadingSpinner label="Loading financial report..." />;
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,244,245,0.92))] p-6 shadow-panel dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.96),rgba(0,0,0,0.9))]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">{copy.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-white">{copy.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{copy.description}</p>
            {report?.meta.usesEstimatedFinancials ? <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-200">Derived from backend timesheet data until dedicated finance ledger rows are available.</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={workspaceRoutes["finance-dashboard"].path} className={buttonClass}><Icon name="dashboard" className="h-4 w-4" /> Dashboard</Link>
            <button type="button" onClick={() => void loadReport(true)} className={buttonClass}><Icon name="refresh-cw" className="h-4 w-4" /> Refresh</button>
            <button type="button" onClick={() => downloadCsv(`${reportType}-report.csv`, filteredRows)} className={primaryButtonClass} disabled={filteredRows.length === 0}><Icon name="download" className="h-4 w-4" /> Export CSV</button>
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
            <div className={`${panelClass} p-5`}><p className="text-sm text-zinc-500">Revenue</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{formatCurrency(report.summary.totalRevenue)}</p></div>
            <div className={`${panelClass} p-5`}><p className="text-sm text-zinc-500">Expense</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{formatCurrency(report.summary.totalExpense)}</p></div>
            <div className={`${panelClass} p-5`}><p className="text-sm text-zinc-500">Gross Profit</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{formatCurrency(report.summary.grossProfit)}</p></div>
            <div className={`${panelClass} p-5`}><p className="text-sm text-zinc-500">Margin / Rows</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{formatPercent(report.summary.marginPercent)} <span className="text-base font-semibold text-zinc-500">/ {report.summary.recordCount}</span></p></div>
          </section>

          {reportType === "expenses" ? (
            <section className={`${panelClass} overflow-hidden`}>
              <div className="flex flex-col gap-4 border-b border-zinc-200 p-5 dark:border-zinc-800 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Manual Expense Ledger</p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-white">Expense Recording Calculator</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setExpenseEntries([])} className={buttonClass} disabled={expenseEntries.length === 0}><Icon name="trash" className="h-4 w-4" /> Clear</button>
                  <button type="button" onClick={exportExpenseLedgerCsv} className={primaryButtonClass} disabled={expenseEntries.length === 0}><Icon name="download" className="h-4 w-4" /> Export Ledger</button>
                </div>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Recorded</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{formatCurrency(expenseLedgerSummary.total)}</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Paid</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{formatCurrency(expenseLedgerSummary.paid)}</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Balance</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{formatCurrency(expenseLedgerSummary.balance)}</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Tax</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{formatCurrency(expenseLedgerSummary.tax)}</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Pending Bills</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{expenseLedgerSummary.pendingCount}</p></div>
              </div>

              <form onSubmit={handleExpenseSubmit} className="border-t border-zinc-200 p-5 dark:border-zinc-800">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <input aria-label="Expense date" type="date" value={expenseForm.expenseDate} onChange={handleExpenseFieldChange("expenseDate")} className={expenseFormInputClass} />
                  <select aria-label="Category" value={expenseForm.category} onChange={handleExpenseFieldChange("category")} className={expenseFormInputClass}>{expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                  <input aria-label="Vendor" value={expenseForm.vendor} onChange={handleExpenseFieldChange("vendor")} placeholder="Vendor / paid to" className={expenseFormInputClass} />
                  <select aria-label="Payment mode" value={expenseForm.paymentMode} onChange={handleExpenseFieldChange("paymentMode")} className={expenseFormInputClass}>{paymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select>
                  <input aria-label="Department" value={expenseForm.department} onChange={handleExpenseFieldChange("department")} placeholder="Department" className={expenseFormInputClass} />
                  <input aria-label="Project" value={expenseForm.project} onChange={handleExpenseFieldChange("project")} placeholder="Project" className={expenseFormInputClass} />
                  <input aria-label="Description" value={expenseForm.description} onChange={handleExpenseFieldChange("description")} placeholder="Expense description" className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 md:col-span-2" />
                  <input aria-label="Quantity" type="number" min="0" step="0.01" value={expenseForm.quantity} onChange={handleExpenseFieldChange("quantity")} className={numberInputClass} />
                  <input aria-label="Unit cost" type="number" min="0" step="0.01" value={expenseForm.unitCost} onChange={handleExpenseFieldChange("unitCost")} className={numberInputClass} placeholder="Unit cost" />
                  <input aria-label="Tax percent" type="number" min="0" step="0.01" value={expenseForm.taxPercent} onChange={handleExpenseFieldChange("taxPercent")} className={numberInputClass} />
                  <input aria-label="Discount" type="number" min="0" step="0.01" value={expenseForm.discount} onChange={handleExpenseFieldChange("discount")} className={numberInputClass} placeholder="Discount" />
                  <input aria-label="Paid amount" type="number" min="0" step="0.01" value={expenseForm.paidAmount} onChange={handleExpenseFieldChange("paidAmount")} className={numberInputClass} placeholder="Paid amount" />
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"><p className="text-xs text-zinc-500">Current Total</p><p className="text-lg font-bold text-zinc-950 dark:text-white">{formatCurrency(expensePreview.total)}</p></div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"><p className="text-xs text-zinc-500">Balance</p><p className="text-lg font-bold text-zinc-950 dark:text-white">{formatCurrency(expensePreview.balance)}</p></div>
                  <button type="submit" className={`${primaryButtonClass} xl:col-span-1`}><Icon name="plus" className="h-4 w-4" /> Add Expense</button>
                </div>
              </form>

              <div className="grid gap-5 border-t border-zinc-200 p-5 dark:border-zinc-800 xl:grid-cols-[0.35fr_0.65fr]">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Category Spend</h3>
                  {expenseLedgerSummary.topCategories.length === 0 ? <p className="text-sm text-zinc-500">No manual expense entries yet.</p> : expenseLedgerSummary.topCategories.map(([category, amount]) => (
                    <div key={category}>
                      <div className="mb-1 flex items-center justify-between text-sm"><span className="font-semibold text-zinc-800 dark:text-zinc-100">{category}</span><span className="text-zinc-500">{formatCurrency(amount)}</span></div>
                      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-900"><div className="h-2 rounded-full bg-zinc-950 dark:bg-white" style={{ width: `${Math.max(6, (amount / Math.max(expenseLedgerSummary.total, 1)) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="overflow-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50/90 dark:bg-zinc-950/90">
                      <tr>{["Date", "Vendor", "Category", "Project", "Total", "Paid", "Balance", "Status", ""].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{heading}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {expenseEntries.length === 0 ? (
                        <tr><td colSpan={9} className="px-6 py-10 text-center text-sm font-semibold text-zinc-500">Add an expense to start recording actual cost.</td></tr>
                      ) : expenseEntries.map((entry) => {
                        const calculated = calculateExpenseAmount(entry);
                        return (
                          <tr key={entry.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-950">
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{entry.expenseDate}</td>
                            <td className="px-4 py-4"><p className="font-semibold text-zinc-900 dark:text-white">{entry.vendor}</p><p className="mt-1 text-xs text-zinc-500">{entry.description}</p></td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{entry.category}</td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{entry.project}</td>
                            <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(calculated.total)}</td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(calculated.paid)}</td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(calculated.balance)}</td>
                            <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${expenseStatusBadgeClass(calculated.status)}`}>{calculated.status}</span></td>
                            <td className="px-4 py-4 text-right"><button type="button" onClick={() => handleRemoveExpense(entry.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:border-rose-200 hover:text-rose-600 dark:border-zinc-800 dark:hover:border-rose-500/40" aria-label="Remove expense"><Icon name="trash" className="h-4 w-4" /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className={`${panelClass} p-5`}>
              <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-zinc-950 dark:text-white">Report Trend</h2><span className="text-sm text-zinc-500">{report.meta.rangeLabel}</span></div>
              <Chart type="area" height={320} series={[{ name: "Revenue", data: report.trend.map((item) => item.revenue) }, { name: "Expense", data: report.trend.map((item) => item.expense) }, { name: "Profit", data: report.trend.map((item) => item.profit) }]} options={chartOptions.trend} />
            </div>
            <div className={`${panelClass} p-5`}>
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">{breakdown.title}</h2>
              <Chart type="bar" height={320} series={[{ name: copy.focus === "revenue" ? "Revenue" : copy.focus === "profit" ? "Profit" : "Expense", data: breakdown.rows.slice(0, 8).map((item) => copy.focus === "revenue" ? item.revenue : copy.focus === "profit" ? item.profit : item.expense) }]} options={chartOptions.breakdown} />
            </div>
          </section>

          <section className={`${panelClass} overflow-hidden`}>
            <div className="flex flex-col gap-3 border-b border-zinc-200 p-5 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">{breakdown.title}</h2>
              <input aria-label="Search report rows" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }} placeholder="Search employee, department, project, status" className={`${filterClass} md:w-96`} />
            </div>
            <BreakdownTable rows={breakdown.rows} focus={copy.focus} />
          </section>

          <section className={`${panelClass} overflow-hidden`}>
            <div className="border-b border-zinc-200 p-5 dark:border-zinc-800"><h2 className="text-xl font-semibold text-zinc-950 dark:text-white">Backend Report Rows</h2></div>
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50/90 dark:bg-zinc-950/90">
                  <tr>{["Employee", "Department", "Project", "Period", "Status", "Hours", "Revenue", "Expense", "Profit", "Margin"].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{heading}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {paginatedRows.length === 0 ? (
                    <tr><td colSpan={10} className="px-6 py-12 text-center text-sm font-semibold text-zinc-500">No report rows match the current filters.</td></tr>
                  ) : paginatedRows.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-zinc-50/80 dark:hover:bg-zinc-950">
                      <td className="px-4 py-4"><p className="font-semibold text-zinc-900 dark:text-white">{row.employeeName}</p><p className="mt-1 text-xs text-zinc-500">{row.id}</p></td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{row.department}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{row.project}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{row.period}</td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>{row.status}</span></td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatHours(row.totalHours)}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(row.expense)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(row.profit)}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatPercent(row.marginPercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setCurrentPage} />
          </section>
        </>
      ) : null}
    </div>
  );
};

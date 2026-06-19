import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";
import { clientBillingService } from "../../services/clientBillingService";
import type { AuthUser } from "../../types/auth";
import type { ClientBillingType, GeneratedClientBillingInvoice } from "../../types/clientBilling";
import { formatBillingPeriod } from "../../utils/clientBilling";

type BillingTab = "unbilled" | "invoices" | "payments";
type InvoiceStatus = "Draft" | "Finalized" | "Sent" | "Cancelled";
type BillType = "Time & Material" | "Fixed Cost" | "Retainer" | "Milestone Based";
type UnbilledRow = { id: string; client: string; project: string; manager: string; period: string; approved: number; billable: number; rate: number; amount: number; type: BillType };
type InvoiceRow = { id: string; invoiceNo: string; client: string; project: string; manager: string; period: string; approved: number; billable: number; rate: number; subtotal: number; tax: number; discount: number; total: number; paid: number; dueDate: string; status: InvoiceStatus; type: BillType };
type PaymentRow = { id: string; invoiceNo: string; client: string; amount: number; received: number; date: string; mode: string };

const panelClass = "rounded-[2rem] border border-white/70 bg-white/85 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/85";
const filterClass = "h-12 rounded-2xl border border-zinc-200 bg-white/90 px-4 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200";
const chartCardClass = "rounded-[1.75rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,244,245,0.92))] p-4 dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.96),rgba(0,0,0,0.92))]";
const tableHeaderClass = "px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400";
const tableCellClass = "px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200";
const formatCurrency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const formatCompactCurrency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(value);
const formatHours = (value: number) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)}h`;
const todayKey = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const createFileNameDate = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const paymentStatus = (invoice: InvoiceRow) => (invoice.total - invoice.paid <= 0 ? "Paid" : invoice.dueDate < todayKey ? "Overdue" : invoice.paid > 0 ? "Partially Paid" : "Unpaid");
const badgeClass = (value: string) => value === "Paid" || value === "Sent" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : value === "Draft" || value === "Partially Paid" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200" : value === "Overdue" || value === "Cancelled" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
const baseUnbilled: UnbilledRow[] = [
  { id: "ub-1", client: "Sonata Software", project: "Microsoft D365 CRM", manager: "Yogendar Kumar", period: "May 2026", approved: 182, billable: 168, rate: 1400, amount: 235200, type: "Time & Material" },
  { id: "ub-2", client: "Aster Retail", project: "StoreFlow Retainer", manager: "Priya Malhotra", period: "Apr 2026", approved: 124, billable: 120, rate: 1650, amount: 198000, type: "Retainer" },
  { id: "ub-3", client: "Pine Labs", project: "Revenue Insight", manager: "Mehul Arora", period: "Apr 2026", approved: 86, billable: 80, rate: 1800, amount: 144000, type: "Milestone Based" },
  { id: "ub-4", client: "BlueOrbit Systems", project: "Portal Revamp", manager: "Ananya Sen", period: "May 2026", approved: 76, billable: 72, rate: 1550, amount: 111600, type: "Fixed Cost" },
];
const baseInvoices: InvoiceRow[] = [
  { id: "inv-1", invoiceNo: "INV-2026-1042", client: "Sonata Software", project: "Microsoft D365 CRM", manager: "Yogendar Kumar", period: "Apr 2026", approved: 162, billable: 156, rate: 1450, subtotal: 226200, tax: 40716, discount: 7200, total: 259716, paid: 259716, dueDate: "2026-04-12", status: "Sent", type: "Time & Material" },
  { id: "inv-2", invoiceNo: "INV-2026-1043", client: "Northwind Mobility", project: "Fleet Pulse", manager: "Ritika Bansal", period: "Apr 2026", approved: 126, billable: 120, rate: 1325, subtotal: 159000, tax: 28620, discount: 0, total: 187620, paid: 94000, dueDate: "2026-04-10", status: "Sent", type: "Time & Material" },
  { id: "inv-3", invoiceNo: "DRAFT-2026-1044", client: "Pine Labs", project: "Revenue Insight", manager: "Mehul Arora", period: "Apr 2026", approved: 86, billable: 80, rate: 1800, subtotal: 144000, tax: 25920, discount: 5000, total: 164920, paid: 0, dueDate: "2026-04-18", status: "Draft", type: "Milestone Based" },
  { id: "inv-4", invoiceNo: "INV-2026-1038", client: "Aster Retail", project: "StoreFlow Retainer", manager: "Priya Malhotra", period: "Mar 2026", approved: 194, billable: 186, rate: 1500, subtotal: 279000, tax: 50220, discount: 9700, total: 319520, paid: 0, dueDate: "2026-04-05", status: "Sent", type: "Retainer" },
];
const basePayments: PaymentRow[] = [
  { id: "pay-1", invoiceNo: "INV-2026-1042", client: "Sonata Software", amount: 259716, received: 259716, date: "2026-04-08", mode: "Bank Transfer" },
  { id: "pay-2", invoiceNo: "INV-2026-1043", client: "Northwind Mobility", amount: 187620, received: 94000, date: "2026-04-07", mode: "Wire" },
];
const trendData = [
  { month: "Nov 2025", draft: 86000, sent: 210000, paid: 132000 },
  { month: "Dec 2025", draft: 112000, sent: 248000, paid: 194000 },
  { month: "Jan 2026", draft: 98000, sent: 286000, paid: 236000 },
  { month: "Feb 2026", draft: 124000, sent: 324000, paid: 268000 },
  { month: "Mar 2026", draft: 142000, sent: 376000, paid: 304000 },
  { month: "Apr 2026", draft: 168000, sent: 412000, paid: 356000 },
];

const toBillType = (value: ClientBillingType): BillType => {
  switch (value) {
    case "Fixed Project":
      return "Fixed Cost";
    case "Milestone":
      return "Milestone Based";
    case "Retainer":
      return "Retainer";
    case "Hourly":
    default:
      return "Time & Material";
  }
};

const mapGeneratedInvoiceToRow = (invoice: GeneratedClientBillingInvoice): InvoiceRow => ({
  id: invoice.id,
  invoiceNo: invoice.invoiceNo,
  client: invoice.client,
  project: invoice.project,
  manager: invoice.manager,
  period: formatBillingPeriod(invoice.periodStart, invoice.periodEnd),
  approved: invoice.approvedHours,
  billable: invoice.billableHours,
  rate: invoice.rate,
  subtotal: invoice.subtotal,
  tax: invoice.tax,
  discount: invoice.discount,
  total: invoice.total,
  paid: invoice.paidAmount,
  dueDate: invoice.dueDate,
  status: invoice.status === "Cancelled" ? "Cancelled" : invoice.status === "Sent" ? "Sent" : "Draft",
  type: toBillType(invoice.billingType),
});

const mapGeneratedInvoicesToPayments = (invoices: GeneratedClientBillingInvoice[]): PaymentRow[] =>
  invoices
    .filter((invoice) => invoice.paidAmount > 0)
    .map((invoice) => ({
      id: `payment-${invoice.id}`,
      invoiceNo: invoice.invoiceNo,
      client: invoice.client,
      amount: invoice.total,
      received: invoice.paidAmount,
      date: invoice.lastPaymentDate ?? invoice.updatedAt.slice(0, 10),
      mode: invoice.paymentMode ?? "Bank Transfer",
    }));

const mergeInvoiceRows = (current: InvoiceRow[], generated: GeneratedClientBillingInvoice[]) => {
  const rows = new Map<string, InvoiceRow>();
  current.forEach((invoice) => rows.set(invoice.id, invoice));
  generated.map(mapGeneratedInvoiceToRow).forEach((invoice) => rows.set(invoice.id, invoice));
  return Array.from(rows.values()).sort((left, right) => right.dueDate.localeCompare(left.dueDate));
};

const mergePaymentRows = (current: PaymentRow[], generated: GeneratedClientBillingInvoice[]) => {
  const rows = new Map<string, PaymentRow>();
  current.forEach((payment) => rows.set(payment.invoiceNo, payment));
  mapGeneratedInvoicesToPayments(generated).forEach((payment) => rows.set(payment.invoiceNo, payment));
  return Array.from(rows.values()).sort((left, right) => right.date.localeCompare(left.date));
};

export const BillingInvoicesPage = ({ user, initialTab = "unbilled" }: { user: AuthUser; initialTab?: BillingTab }) => {
  const { toasts, showToast, dismissToast } = useToast();
  const [tab, setTab] = useState<BillingTab>(initialTab);
  const [unbilled, setUnbilled] = useState(baseUnbilled);
  const [invoices, setInvoices] = useState(baseInvoices);
  const [payments, setPayments] = useState(basePayments);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState("All clients");
  const [projectFilter, setProjectFilter] = useState("All projects");
  const [periodFilter, setPeriodFilter] = useState("All periods");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [search, setSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(invoices[0]?.id ?? null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let active = true;

    const hydrateGeneratedInvoices = async () => {
      const generated = await clientBillingService.getGeneratedInvoices();
      if (!active) {
        return;
      }

      setInvoices((current) => mergeInvoiceRows(current, generated));
      setPayments((current) => mergePaymentRows(current, generated));
      setSelectedInvoiceId((current) => current ?? mergeInvoiceRows(baseInvoices, generated)[0]?.id ?? null);
    };

    void hydrateGeneratedInvoices();

    return () => {
      active = false;
    };
  }, []);

  const chartOptions = useMemo<ApexOptions>(() => ({
    chart: { toolbar: { show: false }, foreColor: "#a1a1aa", fontFamily: "inherit" },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 3 },
    grid: { borderColor: "rgba(161,161,170,0.16)" },
    legend: { labels: { colors: "#a1a1aa" } },
    xaxis: { labels: { style: { colors: "#a1a1aa" } } },
    yaxis: { labels: { style: { colors: "#a1a1aa" }, formatter: (value) => formatCompactCurrency(Number(value)) } },
    tooltip: { theme: "dark", y: { formatter: (value) => formatCurrency(Number(value)) } },
  }), []);

  const clients = useMemo(() => ["All clients", ...Array.from(new Set([...unbilled.map((row) => row.client), ...invoices.map((row) => row.client)])).sort()], [invoices, unbilled]);
  const projects = useMemo(() => ["All projects", ...Array.from(new Set([...unbilled.map((row) => row.project), ...invoices.map((row) => row.project)])).sort()], [invoices, unbilled]);
  const periods = useMemo(() => ["All periods", ...Array.from(new Set([...unbilled.map((row) => row.period), ...invoices.map((row) => row.period)])).sort()], [invoices, unbilled]);
  const visibleUnbilled = useMemo(() => unbilled.filter((row) => (clientFilter === "All clients" || row.client === clientFilter) && (projectFilter === "All projects" || row.project === projectFilter) && (periodFilter === "All periods" || row.period === periodFilter) && [row.client, row.project, row.manager, row.type].join(" ").toLowerCase().includes(search.trim().toLowerCase())), [clientFilter, periodFilter, projectFilter, search, unbilled]);
  const visibleInvoices = useMemo(() => invoices.filter((row) => (clientFilter === "All clients" || row.client === clientFilter) && (projectFilter === "All projects" || row.project === projectFilter) && (periodFilter === "All periods" || row.period === periodFilter) && (statusFilter === "All statuses" || row.status === statusFilter || paymentStatus(row) === statusFilter) && [row.invoiceNo, row.client, row.project, row.manager, row.type, paymentStatus(row)].join(" ").toLowerCase().includes(search.trim().toLowerCase())), [clientFilter, invoices, periodFilter, projectFilter, search, statusFilter]);
  const visiblePayments = useMemo(() => visibleInvoices.map((invoice) => ({ invoice, lastPayment: payments.find((payment) => payment.invoiceNo === invoice.invoiceNo) ?? null })), [payments, visibleInvoices]);
  const selectedInvoice = useMemo(() => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? visibleInvoices[0] ?? null, [invoices, selectedInvoiceId, visibleInvoices]);
  const summary = useMemo(() => ({ unbilledAmount: unbilled.reduce((sum, row) => sum + row.amount, 0), draftAmount: invoices.filter((invoice) => invoice.status === "Draft").reduce((sum, invoice) => sum + invoice.total, 0), draftCount: invoices.filter((invoice) => invoice.status === "Draft").length, sentAmount: invoices.filter((invoice) => invoice.status === "Sent" && paymentStatus(invoice) !== "Paid").reduce((sum, invoice) => sum + Math.max(invoice.total - invoice.paid, 0), 0), overdueAmount: invoices.filter((invoice) => paymentStatus(invoice) === "Overdue").reduce((sum, invoice) => sum + Math.max(invoice.total - invoice.paid, 0), 0), paidThisMonth: payments.filter((payment) => payment.date.startsWith(todayKey.slice(0, 7))).reduce((sum, payment) => sum + payment.received, 0) }), [invoices, payments, unbilled]);

  const exportCurrentView = () => {
    const workbook = XLSX.utils.book_new();
    const rows = tab === "unbilled"
      ? visibleUnbilled.map((row) => ({ Client: row.client, Project: row.project, Manager: row.manager, Period: row.period, Approved: row.approved, Billable: row.billable, Rate: row.rate, Amount: row.amount, Type: row.type }))
      : tab === "invoices"
        ? visibleInvoices.map((row) => ({ Invoice: row.invoiceNo, Client: row.client, Project: row.project, Period: row.period, Approved: row.approved, Billable: row.billable, Rate: row.rate, Subtotal: row.subtotal, Tax: row.tax, Discount: row.discount, Total: row.total, Status: row.status, Payment: paymentStatus(row), DueDate: row.dueDate }))
        : visiblePayments.map(({ invoice, lastPayment }) => ({ Invoice: invoice.invoiceNo, Client: invoice.client, InvoiceAmount: invoice.total, Received: invoice.paid, Pending: Math.max(invoice.total - invoice.paid, 0), LastPayment: lastPayment?.date ?? "N/A", Status: paymentStatus(invoice) }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), tab === "unbilled" ? "Unbilled" : tab === "invoices" ? "Invoices" : "Payments");
    XLSX.writeFile(workbook, `billing-invoices-${tab}-${createFileNameDate()}.xlsx`);
    showToast("Current billing view exported.", "success");
  };

  const createInvoice = () => {
    const rows = unbilled.filter((row) => selectedRows.includes(row.id));
    if (rows.length === 0) { showToast("Select billable work rows first.", "info"); return; }
    if (new Set(rows.map((row) => row.client)).size > 1) { showToast("Create one invoice per client.", "error"); return; }
    const subtotal = rows.reduce((sum, row) => sum + row.amount, 0);
    const billable = rows.reduce((sum, row) => sum + row.billable, 0);
    const approved = rows.reduce((sum, row) => sum + row.approved, 0);
    const next: InvoiceRow = { id: crypto.randomUUID(), invoiceNo: `DRAFT-2026-${String(1045 + invoices.length).padStart(4, "0")}`, client: rows[0].client, project: rows.length === 1 ? rows[0].project : `${rows[0].project} +${rows.length - 1} more`, manager: rows[0].manager, period: rows[0].period, approved, billable, rate: Math.round(subtotal / billable), subtotal, tax: Math.round(subtotal * 0.18), discount: 0, total: subtotal + Math.round(subtotal * 0.18), paid: 0, dueDate: "2026-04-20", status: "Draft", type: rows[0].type };
    setInvoices((current) => [next, ...current]); setUnbilled((current) => current.filter((row) => !selectedRows.includes(row.id))); setSelectedRows([]); setTab("invoices"); setSelectedInvoiceId(next.id); showToast("Draft invoice created.", "success");
  };

  const markInvoicePaid = (invoiceId: string) => {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) {
      return;
    }

    const nextPayment: PaymentRow = {
      id: crypto.randomUUID(),
      invoiceNo: invoice.invoiceNo,
      client: invoice.client,
      amount: invoice.total,
      received: Math.max(invoice.total - invoice.paid, 0),
      date: todayKey,
      mode: "Bank Transfer",
    };
    setInvoices((current) => current.map((item) => (item.id === invoiceId ? { ...item, paid: item.total } : item)));
    setPayments((current) => [nextPayment, ...current]);
    void clientBillingService.updateGeneratedInvoice(invoiceId, {
      paidAmount: invoice.total,
      lastPaymentDate: todayKey,
      paymentMode: "Bank Transfer",
      status: invoice.status === "Cancelled" ? "Cancelled" : "Sent",
    });
    showToast("Invoice marked as paid.", "success");
  };

  const sendInvoice = (invoiceId: string) => {
    setInvoices((current) =>
      current.map((item) =>
        item.id === invoiceId
          ? {
              ...item,
              invoiceNo: item.invoiceNo.startsWith("DRAFT") ? item.invoiceNo.replace("DRAFT", "INV") : item.invoiceNo,
              status: "Sent",
            }
          : item,
      ),
    );
    void clientBillingService.updateGeneratedInvoice(invoiceId, { status: "Sent" });
    showToast("Invoice sent to client workflow.", "success");
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(200,200,200,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.28),_transparent_38%),rgba(0,0,0,0.96)] p-8 text-white dark:text-white shadow-panel">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl"><h1 className="text-4xl font-bold tracking-tight">Billing & Invoices</h1><p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">Generate and manage client invoices from approved billable timesheets, then track collections and overdue exposure from one finance workspace.</p><div className="mt-5 flex flex-wrap gap-3 text-sm"><span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold">{user.role}</span><span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">{visibleUnbilled.length} billable rows ready</span></div></div>
            <div className="flex flex-wrap gap-3"><button type="button" onClick={createInvoice} className="rounded-2xl bg-zinc-950 dark:bg-white px-5 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100">+ Create Invoice</button><button type="button" onClick={exportCurrentView} className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 dark:text-white dark:hover:bg-white/20">Export</button><Link to={workspaceRoutes["invoice-history"].path} className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 dark:text-white dark:hover:bg-white/20">Invoice History</Link></div>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[{ label: "Unbilled Amount", value: formatCompactCurrency(summary.unbilledAmount), note: formatCurrency(summary.unbilledAmount) }, { label: "Draft Invoices", value: `${summary.draftCount}`, note: formatCurrency(summary.draftAmount) }, { label: "Sent Invoices", value: formatCompactCurrency(summary.sentAmount), note: "Outstanding from sent invoices" }, { label: "Overdue Amount", value: formatCompactCurrency(summary.overdueAmount), note: formatCurrency(summary.overdueAmount) }, { label: "Paid This Month", value: formatCompactCurrency(summary.paidThisMonth), note: formatCurrency(summary.paidThisMonth) }].map((card) => <div key={card.label} className={`${panelClass} p-5`}><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{card.label}</p><p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">{card.value}</p><p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{card.note}</p></div>)}
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className={`${panelClass} p-6`}><p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Monthly Billing Trend</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Draft, sent, and paid movement</h2><div className={`${chartCardClass} mt-6`}><Chart type="area" height={320} series={[{ name: "Draft", data: trendData.map((item) => item.draft) }, { name: "Sent", data: trendData.map((item) => item.sent) }, { name: "Paid", data: trendData.map((item) => item.paid) }]} options={{ ...chartOptions, colors: ["#a1a1aa", "#09090b", "#10b981"], fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.04 } }, xaxis: { categories: trendData.map((item) => item.month) } }} /></div></div>
          <div className={`${panelClass} p-6`}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Invoice Status Distribution</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Draft to overdue spread</h2></div><Link to={workspaceRoutes["billing-reports"].path} className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 dark:hover:text-white">Open billing reports</Link></div><div className={`${chartCardClass} mt-6`}><Chart type="donut" height={320} series={[invoices.filter((item) => item.status === "Draft").length, invoices.filter((item) => item.status === "Sent" && paymentStatus(item) !== "Paid" && paymentStatus(item) !== "Overdue").length, invoices.filter((item) => paymentStatus(item) === "Paid").length, invoices.filter((item) => paymentStatus(item) === "Overdue").length]} options={{ ...chartOptions, labels: ["Draft", "Sent", "Paid", "Overdue"], colors: ["#a1a1aa", "#18181b", "#10b981", "#ef4444"], stroke: { width: 0 } }} /></div></div>
        </section>
        <section className={`${panelClass} sticky top-4 z-20 p-5`}>
          <div className="grid gap-3 xl:grid-cols-3">
            {[{ id: "unbilled", label: "Unbilled Work", count: `${visibleUnbilled.length} rows` }, { id: "invoices", label: "Invoices", count: `${visibleInvoices.length} invoices` }, { id: "payments", label: "Payments", count: `${visiblePayments.length} tracked` }].map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id as BillingTab)} className={`rounded-2xl border px-4 py-3 text-left transition ${tab === item.id ? "border-brand-500 bg-zinc-950 dark:bg-white text-white dark:text-black shadow-sm" : "border-zinc-200 bg-white/85 text-zinc-700 hover:border-brand-300 hover:text-zinc-700 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 dark:hover:border-brand-400 dark:hover:text-white"}`}><p className={`text-xs font-semibold uppercase tracking-[0.24em] ${tab === item.id ? "text-brand-100" : "text-zinc-400 dark:text-zinc-500"}`}>{item.label}</p><p className="mt-2 text-base font-semibold">{item.count}</p></button>)}
          </div>
          <div className="mt-5 grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_1.2fr]">
            <select aria-label="Filter by client" title="Filter by client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className={filterClass}>{clients.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select aria-label="Filter by project" title="Filter by project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className={filterClass}>{projects.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select aria-label="Filter by billing period" title="Filter by billing period" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} className={filterClass}>{periods.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select aria-label="Filter by invoice status" title="Filter by invoice status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={filterClass}>{["All statuses", "Draft", "Sent", "Paid", "Partially Paid", "Overdue"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <input aria-label="Search invoices" title="Search invoices" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice no, client, project, manager, or status" className={filterClass} />
          </div>
        </section>
        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">{tab === "unbilled" ? "Unbilled Work" : tab === "invoices" ? "Invoices" : "Payments"}</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{tab === "unbilled" ? "Approved billable work ready for invoice conversion" : tab === "invoices" ? "Invoice lifecycle and collection follow-up" : "Payment history, pending balance, and collections"}</h2></div><div className="flex flex-wrap gap-3">{tab === "unbilled" ? <button type="button" onClick={createInvoice} className="rounded-full bg-black px-4 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">Generate Invoice</button> : <button type="button" onClick={exportCurrentView} className="rounded-full bg-black px-4 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">Export View</button>}</div></div></div>
          <div className="overflow-auto">
            {tab === "unbilled" ? (
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-black/95"><tr><th className={tableHeaderClass}><input type="checkbox" aria-label="Select all unbilled rows" title="Select all unbilled rows" checked={visibleUnbilled.length > 0 && visibleUnbilled.every((row) => selectedRows.includes(row.id))} onChange={(event) => setSelectedRows(event.target.checked ? visibleUnbilled.map((row) => row.id) : [])} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" /></th>{["Client", "Project", "Manager", "Period", "Approved", "Billable", "Rate", "Amount", "Type"].map((heading) => <th key={heading} className={tableHeaderClass}>{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{visibleUnbilled.length === 0 ? <tr><td colSpan={10} className="px-6 py-16 text-center"><p className="text-base font-semibold text-zinc-900 dark:text-white">No billable work matches the current filters.</p></td></tr> : visibleUnbilled.map((row) => <tr key={row.id} className="transition hover:bg-zinc-50/70 dark:hover:bg-black/50"><td className={tableCellClass}><input type="checkbox" aria-label={`Select billable row for ${row.client} ${row.project}`} title={`Select billable row for ${row.client} ${row.project}`} checked={selectedRows.includes(row.id)} onChange={(event) => setSelectedRows((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} className="mt-1 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" /></td><td className={tableCellClass}><p className="font-semibold text-zinc-900 dark:text-white">{row.client}</p></td><td className={tableCellClass}>{row.project}</td><td className={tableCellClass}>{row.manager}</td><td className={tableCellClass}>{row.period}</td><td className={tableCellClass}>{formatHours(row.approved)}</td><td className={tableCellClass}>{formatHours(row.billable)}</td><td className={tableCellClass}>{formatCurrency(row.rate)}</td><td className={`${tableCellClass} font-semibold text-zinc-900 dark:text-white`}>{formatCurrency(row.amount)}</td><td className={tableCellClass}>{row.type}</td></tr>)}</tbody>
              </table>
            ) : tab === "invoices" ? (
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-black/95"><tr>{["Invoice No", "Client", "Project", "Period", "Subtotal", "Total", "Status", "Payment", "Due", "Actions"].map((heading) => <th key={heading} className={tableHeaderClass}>{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{visibleInvoices.length === 0 ? <tr><td colSpan={10} className="px-6 py-16 text-center"><p className="text-base font-semibold text-zinc-900 dark:text-white">No invoices match the current filters.</p></td></tr> : visibleInvoices.map((row) => <tr key={row.id} className="transition hover:bg-zinc-50/70 dark:hover:bg-black/50"><td className={tableCellClass}><button type="button" onClick={() => setSelectedInvoiceId(row.id)} className="font-semibold text-zinc-700 dark:text-zinc-200 hover:text-brand-600 dark:hover:text-brand-300">{row.invoiceNo}</button></td><td className={tableCellClass}>{row.client}</td><td className={tableCellClass}>{row.project}</td><td className={tableCellClass}>{row.period}</td><td className={tableCellClass}>{formatCurrency(row.subtotal)}</td><td className={`${tableCellClass} font-semibold text-zinc-900 dark:text-white`}>{formatCurrency(row.total)}</td><td className={tableCellClass}><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(row.status)}`}>{row.status}</span></td><td className={tableCellClass}><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(paymentStatus(row))}`}>{paymentStatus(row)}</span></td><td className={tableCellClass}>{row.dueDate}</td><td className={tableCellClass}><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedInvoiceId(row.id)} className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">View</button>{row.status !== "Sent" ? <button type="button" onClick={() => sendInvoice(row.id)} className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Send</button> : null}{paymentStatus(row) !== "Paid" ? <button type="button" onClick={() => markInvoicePaid(row.id)} className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Mark Paid</button> : null}</div></td></tr>)}</tbody>
              </table>
            ) : (
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-black/95"><tr>{["Invoice No", "Client", "Invoice Amount", "Received", "Pending", "Last Payment", "Mode", "Status"].map((heading) => <th key={heading} className={tableHeaderClass}>{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{visiblePayments.length === 0 ? <tr><td colSpan={8} className="px-6 py-16 text-center"><p className="text-base font-semibold text-zinc-900 dark:text-white">No payment rows match the current filters.</p></td></tr> : visiblePayments.map(({ invoice, lastPayment }) => <tr key={invoice.id} className="transition hover:bg-zinc-50/70 dark:hover:bg-black/50"><td className={tableCellClass}><button type="button" onClick={() => setSelectedInvoiceId(invoice.id)} className="font-semibold text-zinc-700 dark:text-zinc-200 hover:text-brand-600 dark:hover:text-brand-300">{invoice.invoiceNo}</button></td><td className={tableCellClass}>{invoice.client}</td><td className={tableCellClass}>{formatCurrency(invoice.total)}</td><td className={tableCellClass}>{formatCurrency(invoice.paid)}</td><td className={`${tableCellClass} font-semibold text-zinc-900 dark:text-white`}>{formatCurrency(Math.max(invoice.total - invoice.paid, 0))}</td><td className={tableCellClass}>{lastPayment?.date ?? "No payment yet"}</td><td className={tableCellClass}>{lastPayment?.mode ?? "Pending"}</td><td className={tableCellClass}><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(paymentStatus(invoice))}`}>{paymentStatus(invoice)}</span></td></tr>)}</tbody>
              </table>
            )}
          </div>
        </section>
        {selectedInvoice ? <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><div className={`${panelClass} p-6`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Invoice Workspace</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{selectedInvoice.invoiceNo}</h2><p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{selectedInvoice.client} · {selectedInvoice.project}</p></div><div className="flex flex-wrap gap-2"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(selectedInvoice.status)}`}>{selectedInvoice.status}</span><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(paymentStatus(selectedInvoice))}`}>{paymentStatus(selectedInvoice)}</span></div></div><div className="mt-6 grid gap-4 md:grid-cols-2">{[{ label: "Billing Period", value: selectedInvoice.period }, { label: "Project Manager", value: selectedInvoice.manager }, { label: "Billable Hours", value: formatHours(selectedInvoice.billable) }, { label: "Rate", value: formatCurrency(selectedInvoice.rate) }].map((item) => <div key={item.label} className={`${chartCardClass}`}><p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{item.label}</p><p className="mt-3 text-lg font-semibold text-zinc-900 dark:text-white">{item.value}</p></div>)}</div></div><div className={`${panelClass} p-6`}><p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Amount Summary</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Totals and collection position</h2><div className="mt-6 space-y-4">{[{ label: "Subtotal", value: formatCurrency(selectedInvoice.subtotal) }, { label: "Tax", value: formatCurrency(selectedInvoice.tax) }, { label: "Discount", value: formatCurrency(selectedInvoice.discount) }, { label: "Invoice Total", value: formatCurrency(selectedInvoice.total) }, { label: "Amount Paid", value: formatCurrency(selectedInvoice.paid) }, { label: "Amount Due", value: formatCurrency(Math.max(selectedInvoice.total - selectedInvoice.paid, 0)) }].map((item) => <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-black/50"><span className="text-sm text-zinc-500 dark:text-zinc-400">{item.label}</span><span className="text-sm font-semibold text-zinc-900 dark:text-white">{item.value}</span></div>)}</div></div></section> : null}
      </div>
    </>
  );
};

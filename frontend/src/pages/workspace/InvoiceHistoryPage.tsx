import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer } from "../../components/ToastContainer";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useToast } from "../../hooks/useToast";
import { clientBillingService } from "../../services/clientBillingService";
import type { AuthUser } from "../../types/auth";
import type { ClientBillingInvoiceStatus, ClientBillingType, GeneratedClientBillingInvoice } from "../../types/clientBilling";
import { formatBillingPeriod, formatCompactCurrency, formatCurrency, formatDateLabel, formatHours } from "../../utils/clientBilling";

type PaymentFilter = "All payments" | "Paid" | "Partially Paid" | "Unpaid" | "Overdue";

const panelClass = "rounded-[1.75rem] border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-black/85";
const filterClass = "h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200";
const buttonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white";
const primaryButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const tableHeaderClass = "px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400";
const tableCellClass = "px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200";
const todayKey = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const getPaymentStatus = (invoice: GeneratedClientBillingInvoice): Exclude<PaymentFilter, "All payments"> => {
  const due = Math.max(invoice.total - invoice.paidAmount, 0);

  if (due <= 0) {
    return "Paid";
  }

  if (invoice.dueDate < todayKey && invoice.status !== "Cancelled") {
    return "Overdue";
  }

  return invoice.paidAmount > 0 ? "Partially Paid" : "Unpaid";
};

const badgeClass = (value: string) =>
  value === "Paid" || value === "Sent"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
    : value === "Draft" || value === "Partially Paid" || value === "Unpaid"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
      : value === "Overdue" || value === "Cancelled"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";

const typeLabel = (value: ClientBillingType) => (value === "Hourly" ? "Time & Material" : value);

const exportFileName = () => `invoice-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;

export const InvoiceHistoryPage = ({ user }: { user: AuthUser }) => {
  const { toasts, showToast, dismissToast } = useToast();
  const [invoices, setInvoices] = useState<GeneratedClientBillingInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState("All clients");
  const [statusFilter, setStatusFilter] = useState<ClientBillingInvoiceStatus | "All statuses">("All statuses");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("All payments");
  const [typeFilter, setTypeFilter] = useState<ClientBillingType | "All types">("All types");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    const loadInvoices = async () => {
      setIsLoading(true);
      const rows = await clientBillingService.getGeneratedInvoices();

      if (!active) {
        return;
      }

      setInvoices(rows);
      setSelectedInvoiceId((current) => current ?? rows[0]?.id ?? null);
      setIsLoading(false);
    };

    void loadInvoices();

    return () => {
      active = false;
    };
  }, []);

  const chartOptions = useMemo<ApexOptions>(() => ({
    chart: { toolbar: { show: false }, foreColor: "#a1a1aa", fontFamily: "inherit" },
    dataLabels: { enabled: false },
    grid: { borderColor: "rgba(161,161,170,0.16)" },
    legend: { labels: { colors: "#a1a1aa" } },
    stroke: { curve: "smooth", width: 3 },
    tooltip: { theme: "dark", y: { formatter: (value) => formatCurrency(Number(value)) } },
    xaxis: { labels: { style: { colors: "#a1a1aa" } } },
    yaxis: { labels: { style: { colors: "#a1a1aa" }, formatter: (value) => formatCompactCurrency(Number(value)) } },
  }), []);

  const clients = useMemo(() => ["All clients", ...Array.from(new Set(invoices.map((invoice) => invoice.client))).sort()], [invoices]);
  const invoiceTypes = useMemo(() => ["All types" as const, ...Array.from(new Set(invoices.map((invoice) => invoice.billingType))).sort()], [invoices]);

  const visibleInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const paymentStatus = getPaymentStatus(invoice);
      const haystack = [
        invoice.invoiceNo,
        invoice.sourceBillingNumber,
        invoice.client,
        invoice.project,
        invoice.manager,
        invoice.status,
        paymentStatus,
        invoice.billingType,
      ].join(" ").toLowerCase();

      return (
        (clientFilter === "All clients" || invoice.client === clientFilter) &&
        (statusFilter === "All statuses" || invoice.status === statusFilter) &&
        (paymentFilter === "All payments" || paymentStatus === paymentFilter) &&
        (typeFilter === "All types" || invoice.billingType === typeFilter) &&
        haystack.includes(normalizedSearch)
      );
    });
  }, [clientFilter, invoices, paymentFilter, search, statusFilter, typeFilter]);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? visibleInvoices[0] ?? null,
    [invoices, selectedInvoiceId, visibleInvoices],
  );

  const summary = useMemo(() => {
    const total = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const collected = invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
    const outstanding = invoices.reduce((sum, invoice) => sum + Math.max(invoice.total - invoice.paidAmount, 0), 0);
    const overdue = invoices
      .filter((invoice) => getPaymentStatus(invoice) === "Overdue")
      .reduce((sum, invoice) => sum + Math.max(invoice.total - invoice.paidAmount, 0), 0);

    return {
      total,
      collected,
      outstanding,
      overdue,
      collectionRate: total > 0 ? Math.round((collected / total) * 100) : 0,
    };
  }, [invoices]);

  const monthlySeries = useMemo(() => {
    const rows = new Map<string, { month: string; invoiced: number; collected: number; outstanding: number }>();

    invoices.forEach((invoice) => {
      const key = invoice.createdAt.slice(0, 7);
      const current = rows.get(key) ?? { month: key, invoiced: 0, collected: 0, outstanding: 0 };
      current.invoiced += invoice.total;
      current.collected += invoice.paidAmount;
      current.outstanding += Math.max(invoice.total - invoice.paidAmount, 0);
      rows.set(key, current);
    });

    return Array.from(rows.values()).sort((left, right) => left.month.localeCompare(right.month));
  }, [invoices]);

  const exportHistory = () => {
    const workbook = XLSX.utils.book_new();
    const rows = visibleInvoices.map((invoice) => ({
      Invoice: invoice.invoiceNo,
      BillingRecord: invoice.sourceBillingNumber,
      Client: invoice.client,
      Project: invoice.project,
      Manager: invoice.manager,
      BillingType: typeLabel(invoice.billingType),
      Period: formatBillingPeriod(invoice.periodStart, invoice.periodEnd),
      Subtotal: invoice.subtotal,
      Tax: invoice.tax,
      Discount: invoice.discount,
      Total: invoice.total,
      Paid: invoice.paidAmount,
      Outstanding: Math.max(invoice.total - invoice.paidAmount, 0),
      InvoiceStatus: invoice.status,
      PaymentStatus: getPaymentStatus(invoice),
      DueDate: invoice.dueDate,
      LastPayment: invoice.lastPaymentDate ?? "",
      UpdatedAt: invoice.updatedAt,
    }));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Invoice History");
    XLSX.writeFile(workbook, exportFileName());
    showToast("Invoice history exported.", "success");
  };

  const refreshInvoices = async () => {
    setIsLoading(true);
    const rows = await clientBillingService.getGeneratedInvoices();
    setInvoices(rows);
    setSelectedInvoiceId(rows[0]?.id ?? null);
    setIsLoading(false);
    showToast("Invoice history refreshed.", "success");
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_28%),linear-gradient(135deg,#050505,#171717_56%,#052e2b)] p-7 text-white shadow-panel">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-200">
                <Icon name="history" className="h-4 w-4" />
                Invoice Ledger
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight">Invoice History</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                Generated invoices, customer collections, overdue exposure, and billing source traceability in one finance view.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 font-semibold">{user.role}</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">{invoices.length} fetched invoices</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">{summary.collectionRate}% collected</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={refreshInvoices} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15">
                <Icon name="refresh-cw" className="h-4 w-4" />
                Refresh
              </button>
              <button type="button" onClick={exportHistory} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-100">
                <Icon name="download" className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total Invoiced", value: formatCompactCurrency(summary.total), note: formatCurrency(summary.total) },
            { label: "Collected", value: formatCompactCurrency(summary.collected), note: `${summary.collectionRate}% collection rate` },
            { label: "Outstanding", value: formatCompactCurrency(summary.outstanding), note: formatCurrency(summary.outstanding) },
            { label: "Overdue", value: formatCompactCurrency(summary.overdue), note: "Needs collection follow-up" },
            { label: "Visible Rows", value: `${visibleInvoices.length}`, note: `${invoices.length} fetched total` },
          ].map((item) => (
            <div key={item.label} className={`${panelClass} p-5`}>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{item.label}</p>
              <p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">{item.value}</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.note}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div className={`${panelClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">History Trend</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Invoiced vs collected movement</h2>
              </div>
              <Link to={workspaceRoutes["invoice-management"].path} className={buttonClass}>
                <Icon name="file-spreadsheet" className="h-4 w-4" />
                Manage
              </Link>
            </div>
            <div className="mt-6 rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
              <Chart
                type="area"
                height={310}
                series={[
                  { name: "Invoiced", data: monthlySeries.map((item) => item.invoiced) },
                  { name: "Collected", data: monthlySeries.map((item) => item.collected) },
                  { name: "Outstanding", data: monthlySeries.map((item) => item.outstanding) },
                ]}
                options={{
                  ...chartOptions,
                  colors: ["#2563eb", "#10b981", "#f59e0b"],
                  fill: { type: "gradient", gradient: { opacityFrom: 0.32, opacityTo: 0.04 } },
                  xaxis: { categories: monthlySeries.map((item) => item.month) },
                }}
              />
            </div>
          </div>

          <div className={`${panelClass} p-6`}>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Payment Mix</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Collection health</h2>
            <div className="mt-6 rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
              <Chart
                type="donut"
                height={310}
                series={[
                  invoices.filter((invoice) => getPaymentStatus(invoice) === "Paid").length,
                  invoices.filter((invoice) => getPaymentStatus(invoice) === "Partially Paid").length,
                  invoices.filter((invoice) => getPaymentStatus(invoice) === "Unpaid").length,
                  invoices.filter((invoice) => getPaymentStatus(invoice) === "Overdue").length,
                ]}
                options={{
                  ...chartOptions,
                  colors: ["#10b981", "#f59e0b", "#71717a", "#ef4444"],
                  labels: ["Paid", "Partial", "Unpaid", "Overdue"],
                  stroke: { width: 0 },
                }}
              />
            </div>
          </div>
        </section>

        <section className={`${panelClass} p-5`}>
          <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_1.2fr_auto]">
            <select aria-label="Filter by client" title="Filter by client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className={filterClass}>
              {clients.map((client) => <option key={client} value={client}>{client}</option>)}
            </select>
            <select aria-label="Filter by invoice status" title="Filter by invoice status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ClientBillingInvoiceStatus | "All statuses")} className={filterClass}>
              {["All statuses", "Draft", "Sent", "Cancelled"].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select aria-label="Filter by payment status" title="Filter by payment status" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)} className={filterClass}>
              {["All payments", "Paid", "Partially Paid", "Unpaid", "Overdue"].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select aria-label="Filter by billing type" title="Filter by billing type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ClientBillingType | "All types")} className={filterClass}>
              {invoiceTypes.map((type) => <option key={type} value={type}>{type === "All types" ? type : typeLabel(type)}</option>)}
            </select>
            <input aria-label="Search invoice history" title="Search invoice history" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, billing no, client, project, manager" className={filterClass} />
            <button type="button" onClick={() => { setClientFilter("All clients"); setStatusFilter("All statuses"); setPaymentFilter("All payments"); setTypeFilter("All types"); setSearch(""); }} className={buttonClass}>
              Clear
            </button>
          </div>
        </section>

        <section className="grid gap-6 2xl:grid-cols-[1.5fr_0.8fr]">
          <div className={`${panelClass} overflow-hidden`}>
            <div className="flex flex-col gap-3 border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Fetched Invoice Rows</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">History ledger</h2>
              </div>
              <button type="button" onClick={exportHistory} className={primaryButtonClass}>
                <Icon name="download" className="h-4 w-4" />
                Export View
              </button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-black/95">
                  <tr>{["Invoice", "Client", "Project", "Type", "Total", "Paid", "Due", "Status", "Updated"].map((heading) => <th key={heading} className={tableHeaderClass}>{heading}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {isLoading ? (
                    <tr><td colSpan={9} className="px-6 py-16"><LoadingSpinner label="Fetching invoice history..." /></td></tr>
                  ) : visibleInvoices.length === 0 ? (
                    <tr><td colSpan={9} className="px-6 py-16 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">No invoices match the current filters.</td></tr>
                  ) : visibleInvoices.map((invoice) => {
                    const paymentStatus = getPaymentStatus(invoice);
                    return (
                      <tr key={invoice.id} className={`transition hover:bg-zinc-50/80 dark:hover:bg-black/50 ${selectedInvoice?.id === invoice.id ? "bg-zinc-50 dark:bg-white/5" : ""}`}>
                        <td className={tableCellClass}>
                          <button type="button" onClick={() => setSelectedInvoiceId(invoice.id)} className="text-left font-semibold text-zinc-900 transition hover:text-brand-600 dark:text-white dark:hover:text-brand-300">
                            {invoice.invoiceNo}
                          </button>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{invoice.sourceBillingNumber}</p>
                        </td>
                        <td className={tableCellClass}>{invoice.client}</td>
                        <td className={tableCellClass}>{invoice.project}</td>
                        <td className={tableCellClass}>{typeLabel(invoice.billingType)}</td>
                        <td className={`${tableCellClass} font-semibold text-zinc-900 dark:text-white`}>{formatCurrency(invoice.total, invoice.currencyCode)}</td>
                        <td className={tableCellClass}>{formatCurrency(invoice.paidAmount, invoice.currencyCode)}</td>
                        <td className={tableCellClass}>{formatDateLabel(invoice.dueDate)}</td>
                        <td className={tableCellClass}>
                          <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(invoice.status)}`}>{invoice.status}</span>
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(paymentStatus)}`}>{paymentStatus}</span>
                          </div>
                        </td>
                        <td className={tableCellClass}>{formatDateLabel(invoice.updatedAt.slice(0, 10))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className={`${panelClass} p-6`}>
            {selectedInvoice ? (
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Selected Invoice</p>
                <h2 className="mt-2 break-words text-2xl font-semibold text-zinc-900 dark:text-white">{selectedInvoice.invoiceNo}</h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{selectedInvoice.client} · {selectedInvoice.project}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(selectedInvoice.status)}`}>{selectedInvoice.status}</span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(getPaymentStatus(selectedInvoice))}`}>{getPaymentStatus(selectedInvoice)}</span>
                </div>
                <div className="mt-6 space-y-3">
                  {[
                    { label: "Billing record", value: selectedInvoice.sourceBillingNumber },
                    { label: "Billing period", value: formatBillingPeriod(selectedInvoice.periodStart, selectedInvoice.periodEnd) },
                    { label: "Manager", value: selectedInvoice.manager },
                    { label: "Billable hours", value: formatHours(selectedInvoice.billableHours) },
                    { label: "Rate", value: formatCurrency(selectedInvoice.rate, selectedInvoice.currencyCode) },
                    { label: "Subtotal", value: formatCurrency(selectedInvoice.subtotal, selectedInvoice.currencyCode) },
                    { label: "Tax", value: formatCurrency(selectedInvoice.tax, selectedInvoice.currencyCode) },
                    { label: "Discount", value: formatCurrency(selectedInvoice.discount, selectedInvoice.currencyCode) },
                    { label: "Invoice total", value: formatCurrency(selectedInvoice.total, selectedInvoice.currencyCode) },
                    { label: "Amount paid", value: formatCurrency(selectedInvoice.paidAmount, selectedInvoice.currencyCode) },
                    { label: "Outstanding", value: formatCurrency(Math.max(selectedInvoice.total - selectedInvoice.paidAmount, 0), selectedInvoice.currencyCode) },
                    { label: "Due date", value: formatDateLabel(selectedInvoice.dueDate) },
                    { label: "Last payment", value: formatDateLabel(selectedInvoice.lastPaymentDate) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/50">
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">{item.label}</span>
                      <span className="text-right text-sm font-semibold text-zinc-900 dark:text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link to={workspaceRoutes["invoice-management"].path} className={primaryButtonClass}>
                    Open Invoice
                  </Link>
                  <Link to={workspaceRoutes["client-billing"].path} className={buttonClass}>
                    Billing Source
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <Icon name="history" className="mx-auto h-10 w-10 text-zinc-400" />
                <p className="mt-4 text-sm font-semibold text-zinc-900 dark:text-white">No invoice selected</p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </>
  );
};

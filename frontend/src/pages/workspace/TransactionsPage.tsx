import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";
import type { AuthUser } from "../../types/auth";

type TransactionView = "incoming" | "outgoing" | "logs";
type TransactionStatus = "Cleared" | "Pending" | "Failed" | "Reconciled" | "Scheduled";

interface TransactionRow {
  id: string;
  date: string;
  reference: string;
  party: string;
  category: string;
  project: string;
  method: string;
  account: string;
  amount: number;
  status: TransactionStatus;
  owner: string;
  notes: string;
}

interface LogRow {
  id: string;
  timestamp: string;
  action: string;
  reference: string;
  user: string;
  module: string;
  status: TransactionStatus;
  details: string;
}

const panelClass = "rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black";
const filterClass = "h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-100";
const buttonClass = "h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900";
const primaryButtonClass = "h-11 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const tableHeaderClass = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400";
const tableCellClass = "px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200";

const formatCurrency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const formatCompactCurrency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(value);
const createFileNameDate = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

const incomingRows: TransactionRow[] = [
  { id: "in-1", date: "2026-05-03", reference: "RCPT-2026-1182", party: "Sonata Software", category: "Invoice collection", project: "Microsoft D365 CRM", method: "Bank Transfer", account: "HDFC Current 0412", amount: 259716, status: "Cleared", owner: "Finance Ops", notes: "Full settlement for INV-2026-1042" },
  { id: "in-2", date: "2026-05-02", reference: "RCPT-2026-1181", party: "Northwind Mobility", category: "Partial collection", project: "Fleet Pulse", method: "Wire", account: "ICICI Current 2201", amount: 94000, status: "Reconciled", owner: "Yogendar Kumar", notes: "Part payment mapped to INV-2026-1043" },
  { id: "in-3", date: "2026-04-29", reference: "RCPT-2026-1178", party: "Aster Retail", category: "Retainer advance", project: "StoreFlow Retainer", method: "UPI", account: "HDFC Current 0412", amount: 125000, status: "Pending", owner: "Priya Malhotra", notes: "Awaiting bank statement match" },
  { id: "in-4", date: "2026-04-25", reference: "RCPT-2026-1171", party: "Pine Labs", category: "Milestone payment", project: "Revenue Insight", method: "Bank Transfer", account: "SBI Payroll 3008", amount: 164920, status: "Cleared", owner: "Finance Ops", notes: "Milestone 2 invoice collected" },
  { id: "in-5", date: "2026-04-22", reference: "RCPT-2026-1166", party: "BlueOrbit Systems", category: "Fixed cost billing", project: "Portal Revamp", method: "Cheque", account: "ICICI Current 2201", amount: 111600, status: "Pending", owner: "Ananya Sen", notes: "Cheque deposited, clearing expected next cycle" },
];

const outgoingRows: TransactionRow[] = [
  { id: "out-1", date: "2026-05-04", reference: "PAY-2026-0844", party: "CloudDesk Hosting", category: "Infrastructure", project: "Shared Services", method: "Bank Transfer", account: "HDFC Current 0412", amount: 78000, status: "Cleared", owner: "Finance Ops", notes: "Monthly cloud hosting invoice" },
  { id: "out-2", date: "2026-05-03", reference: "PAY-2026-0841", party: "Employee Reimbursements", category: "Reimbursements", project: "All Projects", method: "Payroll Batch", account: "SBI Payroll 3008", amount: 52600, status: "Scheduled", owner: "HR Payroll", notes: "Approved travel and meal reimbursements" },
  { id: "out-3", date: "2026-04-30", reference: "PAY-2026-0833", party: "Design Partner Studio", category: "Vendor payment", project: "Portal Revamp", method: "Wire", account: "ICICI Current 2201", amount: 118500, status: "Reconciled", owner: "Ananya Sen", notes: "UI design milestone payment" },
  { id: "out-4", date: "2026-04-28", reference: "PAY-2026-0829", party: "Office Lease", category: "Facilities", project: "Operations", method: "Auto Debit", account: "HDFC Current 0412", amount: 210000, status: "Cleared", owner: "Finance Ops", notes: "May office rent" },
  { id: "out-5", date: "2026-04-26", reference: "PAY-2026-0823", party: "Tax Authority", category: "Statutory", project: "Compliance", method: "Bank Transfer", account: "SBI Payroll 3008", amount: 143200, status: "Pending", owner: "Finance Ops", notes: "TDS challan queued for approval" },
];

const logRows: LogRow[] = [
  { id: "log-1", timestamp: "2026-05-04 17:35", action: "Payment reconciled", reference: "PAY-2026-0844", user: "Finance Ops", module: "Outgoing Payments", status: "Reconciled", details: "Matched vendor payment with bank statement line HDFC-88312." },
  { id: "log-2", timestamp: "2026-05-04 15:12", action: "Receipt imported", reference: "RCPT-2026-1182", user: "Yogendar Kumar", module: "Incoming Payments", status: "Cleared", details: "Receipt created from bank upload and mapped to invoice INV-2026-1042." },
  { id: "log-3", timestamp: "2026-05-03 18:02", action: "Payment scheduled", reference: "PAY-2026-0841", user: "HR Payroll", module: "Outgoing Payments", status: "Scheduled", details: "Batch created for approved reimbursement payouts." },
  { id: "log-4", timestamp: "2026-05-02 11:28", action: "Partial collection posted", reference: "RCPT-2026-1181", user: "Finance Ops", module: "Incoming Payments", status: "Reconciled", details: "Partial invoice collection posted and customer ledger updated." },
  { id: "log-5", timestamp: "2026-04-29 09:44", action: "Bank match pending", reference: "RCPT-2026-1178", user: "Priya Malhotra", module: "Incoming Payments", status: "Pending", details: "Receipt needs bank statement confirmation before close." },
  { id: "log-6", timestamp: "2026-04-26 16:20", action: "Approval requested", reference: "PAY-2026-0823", user: "Finance Ops", module: "Outgoing Payments", status: "Pending", details: "Statutory payment submitted to finance lead approval queue." },
];

const viewMeta: Record<TransactionView, { title: string; description: string }> = {
  incoming: {
    title: "Incoming Payments",
    description: "Track customer receipts, invoice collections, bank matches, and reconciliation status from one finance workspace.",
  },
  outgoing: {
    title: "Outgoing Payments",
    description: "Review vendor payouts, reimbursements, facilities payments, statutory transfers, and approval-ready outgoing cash flow.",
  },
  logs: {
    title: "Transaction Logs",
    description: "Audit every transaction event with reference numbers, users, modules, statuses, and operational details.",
  },
};

const badgeClass = (status: TransactionStatus) => {
  switch (status) {
    case "Cleared":
    case "Reconciled":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
    case "Pending":
    case "Scheduled":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
    case "Failed":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
  }
};

export const TransactionsPage = ({ user, view }: { user: AuthUser; view: TransactionView }) => {
  const { toasts, showToast, dismissToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [accountFilter, setAccountFilter] = useState("All accounts");
  const [categoryFilter, setCategoryFilter] = useState("All categories");

  const transactions = view === "outgoing" ? outgoingRows : incomingRows;
  const isLogs = view === "logs";
  const meta = viewMeta[view];

  const accounts = useMemo(() => ["All accounts", ...Array.from(new Set([...incomingRows, ...outgoingRows].map((row) => row.account))).sort()], []);
  const categories = useMemo(() => ["All categories", ...Array.from(new Set([...incomingRows, ...outgoingRows].map((row) => row.category))).sort()], []);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((row) => {
      if (statusFilter !== "All statuses" && row.status !== statusFilter) {
        return false;
      }

      if (accountFilter !== "All accounts" && row.account !== accountFilter) {
        return false;
      }

      if (categoryFilter !== "All categories" && row.category !== categoryFilter) {
        return false;
      }

      return [row.reference, row.party, row.category, row.project, row.method, row.account, row.owner, row.notes].join(" ").toLowerCase().includes(query);
    });
  }, [accountFilter, categoryFilter, search, statusFilter, transactions]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logRows.filter((row) => {
      if (statusFilter !== "All statuses" && row.status !== statusFilter) {
        return false;
      }

      return [row.action, row.reference, row.user, row.module, row.details].join(" ").toLowerCase().includes(query);
    });
  }, [search, statusFilter]);

  const summary = useMemo(() => {
    const incomingTotal = incomingRows.reduce((sum, row) => sum + row.amount, 0);
    const outgoingTotal = outgoingRows.reduce((sum, row) => sum + row.amount, 0);
    const visibleTotal = filteredTransactions.reduce((sum, row) => sum + row.amount, 0);
    const pending = transactions.filter((row) => row.status === "Pending" || row.status === "Scheduled").reduce((sum, row) => sum + row.amount, 0);

    return {
      incomingTotal,
      outgoingTotal,
      netCash: incomingTotal - outgoingTotal,
      visibleTotal,
      pending,
      reconciledCount: transactions.filter((row) => row.status === "Cleared" || row.status === "Reconciled").length,
    };
  }, [filteredTransactions, transactions]);

  const exportView = () => {
    const workbook = XLSX.utils.book_new();
    const rows = isLogs
      ? filteredLogs.map((row) => ({ Timestamp: row.timestamp, Action: row.action, Reference: row.reference, User: row.user, Module: row.module, Status: row.status, Details: row.details }))
      : filteredTransactions.map((row) => ({ Date: row.date, Reference: row.reference, Party: row.party, Category: row.category, Project: row.project, Method: row.method, Account: row.account, Amount: row.amount, Status: row.status, Owner: row.owner, Notes: row.notes }));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), isLogs ? "Transaction Logs" : meta.title);
    XLSX.writeFile(workbook, `transactions-${view}-${createFileNameDate()}.xlsx`);
    showToast("Transaction view exported.", "success");
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <section className={panelClass}>
          <div className="flex flex-col gap-5 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">{meta.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{meta.description}</p>
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Prepared for {user.fullName || user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportView} className={primaryButtonClass}>Export View</button>
              <button type="button" onClick={() => showToast("Reconciliation queue refreshed.", "success")} className={buttonClass}>Refresh</button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Incoming", formatCompactCurrency(summary.incomingTotal), formatCurrency(summary.incomingTotal)],
            ["Outgoing", formatCompactCurrency(summary.outgoingTotal), formatCurrency(summary.outgoingTotal)],
            ["Net Cash", formatCompactCurrency(summary.netCash), formatCurrency(summary.netCash)],
            [isLogs ? "Visible Logs" : "Visible Total", isLogs ? String(filteredLogs.length) : formatCompactCurrency(summary.visibleTotal), isLogs ? "Events after filters" : formatCurrency(summary.visibleTotal)],
            ["Pending", isLogs ? String(filteredLogs.filter((row) => row.status === "Pending").length) : formatCompactCurrency(summary.pending), isLogs ? "Pending log events" : formatCurrency(summary.pending)],
          ].map(([label, value, note]) => (
            <div key={label} className={`${panelClass} p-5`}>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className="mt-3 text-3xl font-bold text-zinc-950 dark:text-white">{value}</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{note}</p>
            </div>
          ))}
        </section>

        <section className={`${panelClass} p-5`}>
          <div className={`grid gap-3 ${isLogs ? "xl:grid-cols-[1fr_1fr]" : "xl:grid-cols-[1fr_1fr_1fr_1.4fr]"}`}>
            <select aria-label="Filter by status" title="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={filterClass}>
              {["All statuses", "Cleared", "Pending", "Failed", "Reconciled", "Scheduled"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {!isLogs ? (
              <>
                <select aria-label="Filter by account" title="Filter by account" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className={filterClass}>
                  {accounts.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select aria-label="Filter by category" title="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={filterClass}>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </>
            ) : null}
            <input aria-label="Search transactions" title="Search transactions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isLogs ? "Search action, reference, user, module, or details" : "Search reference, party, project, method, owner, or notes"} className={filterClass} />
          </div>
        </section>

        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">{meta.title}</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">{isLogs ? "Audit trail and transaction events" : "Transaction register and reconciliation details"}</h2>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{isLogs ? filteredLogs.length : filteredTransactions.length} rows visible</p>
            </div>
          </div>

          <div className="overflow-auto">
            {isLogs ? (
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-950">
                  <tr>{["Timestamp", "Action", "Reference", "User", "Module", "Status", "Details"].map((heading) => <th key={heading} className={tableHeaderClass}>{heading}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredLogs.map((row) => (
                    <tr key={row.id} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-950">
                      <td className={tableCellClass}>{row.timestamp}</td>
                      <td className={`${tableCellClass} font-semibold text-zinc-950 dark:text-white`}>{row.action}</td>
                      <td className={tableCellClass}>{row.reference}</td>
                      <td className={tableCellClass}>{row.user}</td>
                      <td className={tableCellClass}>{row.module}</td>
                      <td className={tableCellClass}><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(row.status)}`}>{row.status}</span></td>
                      <td className={`${tableCellClass} min-w-[280px]`}>{row.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-950">
                  <tr>{["Date", "Reference", "Party", "Category", "Project", "Method", "Account", "Amount", "Status", "Owner", "Notes"].map((heading) => <th key={heading} className={tableHeaderClass}>{heading}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredTransactions.map((row) => (
                    <tr key={row.id} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-950">
                      <td className={tableCellClass}>{row.date}</td>
                      <td className={`${tableCellClass} font-semibold text-zinc-950 dark:text-white`}>{row.reference}</td>
                      <td className={tableCellClass}>{row.party}</td>
                      <td className={tableCellClass}>{row.category}</td>
                      <td className={tableCellClass}>{row.project}</td>
                      <td className={tableCellClass}>{row.method}</td>
                      <td className={tableCellClass}>{row.account}</td>
                      <td className={`${tableCellClass} font-semibold text-zinc-950 dark:text-white`}>{formatCurrency(row.amount)}</td>
                      <td className={tableCellClass}><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(row.status)}`}>{row.status}</span></td>
                      <td className={tableCellClass}>{row.owner}</td>
                      <td className={`${tableCellClass} min-w-[260px]`}>{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

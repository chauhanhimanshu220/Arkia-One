import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";
import { WorkspacePageHero, WorkspaceHeroMeta } from "../../components/WorkspacePageHero";
import type { AuthUser } from "../../types/auth";

type AuditView = "activity-logs" | "changes-history" | "audit-trail";

type ActivityLogRow = {
  id: string;
  timestamp: string;
  action: string;
  reference: string;
  module: string;
  user: string;
  status: string;
  details: string;
};

type ChangeHistoryRow = {
  id: string;
  timestamp: string;
  recordType: string;
  field: string;
  changedBy: string;
  before: string;
  after: string;
  source: string;
  comment: string;
};

type AuditTrailRow = {
  id: string;
  timestamp: string;
  stage: string;
  performedBy: string;
  status: string;
  context: string;
  note: string;
};

const panelClass = "rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black";
const filterClass = "h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-100";
const buttonClass = "h-11 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900";
const primaryButtonClass = "h-11 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const tableHeaderClass = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400";
const tableCellClass = "px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200";

const activityRows: ActivityLogRow[] = [
  {
    id: "act-1",
    timestamp: "2026-05-05 09:18",
    action: "Invoice received",
    reference: "INV-2026-1108",
    module: "Billing",
    user: "Priya Malhotra",
    status: "Completed",
    details: "Invoice recorded and matched against customer purchase order PO-7832.",
  },
  {
    id: "act-2",
    timestamp: "2026-05-05 08:42",
    action: "Bank feed imported",
    reference: "BANK-0426",
    module: "Banking",
    user: "Finance Ops",
    status: "Pending",
    details: "Daily bank import queued for reconciliation after rule refresh.",
  },
  {
    id: "act-3",
    timestamp: "2026-05-04 16:03",
    action: "Payment approval requested",
    reference: "PAY-2026-0844",
    module: "Payments",
    user: "Ananya Sen",
    status: "Review",
    details: "Vendor payout submitted for final approval by finance lead.",
  },
  {
    id: "act-4",
    timestamp: "2026-05-04 12:56",
    action: "Maintenance configuration changed",
    reference: "SYS-0019",
    module: "Settings",
    user: "System Admin",
    status: "Suspicious",
    details: "Audit settings toggled outside regular maintenance window.",
  },
  {
    id: "act-5",
    timestamp: "2026-05-03 18:25",
    action: "Expense ledger reconciled",
    reference: "EXP-2026-0913",
    module: "Expenses",
    user: "Finance Ops",
    status: "Completed",
    details: "Employee reimbursement line matched with submitted receipts.",
  },
];

const changeHistoryRows: ChangeHistoryRow[] = [
  {
    id: "chg-1",
    timestamp: "2026-05-05 09:14",
    recordType: "Invoice",
    field: "Amount",
    changedBy: "Priya Malhotra",
    before: "₹259,716",
    after: "₹265,420",
    source: "Billing module",
    comment: "Corrected service tax rounding after customer confirmation.",
  },
  {
    id: "chg-2",
    timestamp: "2026-05-05 08:50",
    recordType: "Expense",
    field: "Category",
    changedBy: "Finance Ops",
    before: "Travel",
    after: "Client Entertainment",
    source: "Expense claims",
    comment: "Updated classification for project-specific hospitality expense.",
  },
  {
    id: "chg-3",
    timestamp: "2026-05-04 16:30",
    recordType: "Payroll",
    field: "Approval Status",
    changedBy: "HR Payroll",
    before: "Pending",
    after: "Approved",
    source: "Payroll approval queue",
    comment: "Payroll batch approved after checks completed.",
  },
  {
    id: "chg-4",
    timestamp: "2026-05-04 13:18",
    recordType: "System Setting",
    field: "Audit Retention",
    changedBy: "System Admin",
    before: "30 days",
    after: "90 days",
    source: "Settings",
    comment: "Extended retention while migrating audit reports.",
  },
  {
    id: "chg-5",
    timestamp: "2026-05-03 17:00",
    recordType: "Vendor",
    field: "Bank Account",
    changedBy: "Ananya Sen",
    before: "HDFC Current 0412",
    after: "ICICI Current 2201",
    source: "Vendor master data",
    comment: "Updated vendor payout account for vendor approval.",
  },
];

const auditTrailRows: AuditTrailRow[] = [
  {
    id: "trail-1",
    timestamp: "2026-05-05 09:24",
    stage: "GL posting",
    performedBy: "Finance Ops",
    status: "Completed",
    context: "Journal entry posted for invoice collection.",
    note: "Verified account mapping and tax treatment before posting.",
  },
  {
    id: "trail-2",
    timestamp: "2026-05-05 08:55",
    stage: "Approval handoff",
    performedBy: "Priya Malhotra",
    status: "Pending",
    context: "Payment request routed for final review.",
    note: "Awaiting approval from finance controller.",
  },
  {
    id: "trail-3",
    timestamp: "2026-05-04 16:08",
    stage: "Data import",
    performedBy: "System Integration",
    status: "Completed",
    context: "Bank feed imported for reconciliation.",
    note: "Import matched 98% of statement lines automatically.",
  },
  {
    id: "trail-4",
    timestamp: "2026-05-04 13:22",
    stage: "Review escalation",
    performedBy: "Finance Ops",
    status: "Escalated",
    context: "Exception in vendor payment validation.",
    note: "Marked for review by senior finance lead.",
  },
  {
    id: "trail-5",
    timestamp: "2026-05-03 17:05",
    stage: "Retention audit",
    performedBy: "System Admin",
    status: "Completed",
    context: "Audit retention policy updated.",
    note: "Change recorded for compliance review.",
  },
];

const viewMeta: Record<AuditView, { title: string; description: string; badgeTag: string }> = {
  "activity-logs": {
    title: "Financial Activity Logs",
    description: "Track every finance event, workflow change, and system interaction with full audit context.",
    badgeTag: "Activity",
  },
  "changes-history": {
    title: "Changes History",
    description: "Inspect edits to invoices, payroll records, expense lines, and financial master data.",
    badgeTag: "Changes",
  },
  "audit-trail": {
    title: "Audit Trail",
    description: "Follow the finance process path from request to completion with a clear operational timeline.",
    badgeTag: "Trail",
  },
};

const statusBadgeClass = (status: string) => {
  if (status === "Completed" || status === "Approved") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (status === "Pending" || status === "Review") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (status === "Suspicious" || status === "Escalated" || status === "Failed") return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};

const createExportFileName = (view: AuditView) => `finance-audit-${view}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;

const formatAuditTimestamp = (value: string) => value;

export const FinanceAuditPage = ({ user, view }: { user: AuthUser; view: AuditView }) => {
  const { toasts, showToast, dismissToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [userFilter, setUserFilter] = useState("All users");
  const [sourceFilter, setSourceFilter] = useState("All sources");

  const rows = view === "activity-logs" ? activityRows : view === "changes-history" ? changeHistoryRows : auditTrailRows;

  const users = useMemo(() => ["All users", ...Array.from(new Set(rows.map((row) => ("changedBy" in row ? row.changedBy : "performedBy" in row ? row.performedBy : row.user))))], [rows]);
  const sources = useMemo(() => {
    if (view === "activity-logs") return ["All sources", "Billing", "Banking", "Payments", "Settings", "Expenses"];
    if (view === "changes-history") return ["All sources", "Billing module", "Expense claims", "Payroll approval queue", "Settings", "Vendor master data"];
    return ["All sources", "Finance Ops", "System Integration", "System Admin"];
  }, [view]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const rowStatus = "status" in row ? row.status : "";
      const rowUser = "user" in row ? row.user : "changedBy" in row ? row.changedBy : "performedBy" in row ? row.performedBy : "";
      const rowSource =
        view === "activity-logs"
          ? (row as ActivityLogRow).module
          : view === "changes-history"
          ? (row as ChangeHistoryRow).source
          : (row as AuditTrailRow).context;

      if (statusFilter !== "All statuses" && rowStatus !== statusFilter) {
        return false;
      }

      if (userFilter !== "All users" && rowUser !== userFilter) {
        return false;
      }

      if (sourceFilter !== "All sources" && !rowSource.toLowerCase().includes(sourceFilter.toLowerCase())) {
        return false;
      }

      const searchable = [
        "action" in row ? row.action : "",
        "reference" in row ? row.reference : "",
        "recordType" in row ? row.recordType : "",
        "field" in row ? row.field : "",
        "before" in row ? row.before : "",
        "after" in row ? row.after : "",
        "stage" in row ? row.stage : "",
        "context" in row ? row.context : "",
        "note" in row ? row.note : "",
        rowUser,
        rowSource,
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });
  }, [rows, search, statusFilter, userFilter, sourceFilter, view]);

  const summary = useMemo(() => {
    const totalEvents = rows.length;
    const activeUsers = new Set(rows.map((row) => ("user" in row ? row.user : "changedBy" in row ? row.changedBy : row.performedBy))).size;
    const flagged = rows.filter((row) => ["Suspicious", "Escalated", "Failed"].includes(("status" in row ? row.status : ""))).length;

    return {
      totalEvents,
      activeUsers,
      flagged,
      visibleItems: filteredRows.length,
    };
  }, [filteredRows.length, rows]);

  const exportView = () => {
    const workbook = XLSX.utils.book_new();
    const sheetData = filteredRows.map((row) => {
      if (view === "activity-logs") {
        const log = row as ActivityLogRow;
        return {
          Timestamp: log.timestamp,
          Action: log.action,
          Reference: log.reference,
          Module: log.module,
          User: log.user,
          Status: log.status,
          Details: log.details,
        };
      }

      if (view === "changes-history") {
        const change = row as ChangeHistoryRow;
        return {
          Timestamp: change.timestamp,
          Record: change.recordType,
          Field: change.field,
          "Changed By": change.changedBy,
          Before: change.before,
          After: change.after,
          Source: change.source,
          Comment: change.comment,
        };
      }

      const trail = row as AuditTrailRow;
      return {
        Timestamp: trail.timestamp,
        Stage: trail.stage,
        "Performed By": trail.performedBy,
        Status: trail.status,
        Context: trail.context,
        Note: trail.note,
      };
    });

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetData), viewMeta[view].title);
    XLSX.writeFile(workbook, createExportFileName(view));
    showToast("Audit view exported.", "success");
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <section className={panelClass}>
          <div className="p-6">
            <WorkspacePageHero
              title={viewMeta[view].title}
              belowTitle={<p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{viewMeta[view].description}</p>}
            >
              <WorkspaceHeroMeta primary={`${summary.visibleItems}`} secondary="Filtered results" />
              <WorkspaceHeroMeta primary={`${summary.activeUsers}`} secondary="Active reviewers" />
              <WorkspaceHeroMeta primary={`${summary.flagged}`} secondary="Flagged items" />
            </WorkspacePageHero>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={exportView} className={primaryButtonClass}>Export view</button>
              <button type="button" onClick={() => showToast("Audit workspace refreshed.", "success")} className={buttonClass}>Refresh</button>
            </div>
          </div>
        </section>

        <section className={`${panelClass} p-5`}>
          <div className="grid gap-3 lg:grid-cols-4">
            <input
              aria-label="Search audit records"
              title="Search audit records"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reference, user, module, or notes"
              className={filterClass}
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={filterClass}>
              {['All statuses', 'Completed', 'Approved', 'Pending', 'Review', 'Suspicious', 'Escalated', 'Failed'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)} className={filterClass}>
              {users.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className={filterClass}>
              {sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </section>

        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">{viewMeta[view].badgeTag}</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">{view === "activity-logs" ? "Recent finance activity" : view === "changes-history" ? "Record change history" : "End-to-end audit trail"}</h2>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{filteredRows.length} rows visible</p>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-950">
                <tr>
                  {view === "activity-logs" && ["Timestamp", "Action", "Reference", "Module", "User", "Status", "Details"].map((heading) => <th key={heading} className={tableHeaderClass}>{heading}</th>)}
                  {view === "changes-history" && ["Timestamp", "Record", "Field", "Before", "After", "Changed By", "Source", "Comment"].map((heading) => <th key={heading} className={tableHeaderClass}>{heading}</th>)}
                  {view === "audit-trail" && ["Timestamp", "Stage", "Performed By", "Status", "Context", "Note"].map((heading) => <th key={heading} className={tableHeaderClass}>{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={view === "activity-logs" ? 7 : view === "changes-history" ? 8 : 6} className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No records match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-950">
                      {view === "activity-logs" && (
                        <>
                          <td className={tableCellClass}>{formatAuditTimestamp(row.timestamp)}</td>
                          <td className={`${tableCellClass} font-semibold text-zinc-950 dark:text-white`}>{(row as ActivityLogRow).action}</td>
                          <td className={tableCellClass}>{(row as ActivityLogRow).reference}</td>
                          <td className={tableCellClass}>{(row as ActivityLogRow).module}</td>
                          <td className={tableCellClass}>{(row as ActivityLogRow).user}</td>
                          <td className={tableCellClass}><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass((row as ActivityLogRow).status)}`}>{(row as ActivityLogRow).status}</span></td>
                          <td className={`${tableCellClass} min-w-[280px]`}>{(row as ActivityLogRow).details}</td>
                        </>
                      )}

                      {view === "changes-history" && (
                        <>
                          <td className={tableCellClass}>{formatAuditTimestamp(row.timestamp)}</td>
                          <td className={`${tableCellClass} font-semibold text-zinc-950 dark:text-white`}>{(row as ChangeHistoryRow).recordType}</td>
                          <td className={tableCellClass}>{(row as ChangeHistoryRow).field}</td>
                          <td className={tableCellClass}>{(row as ChangeHistoryRow).before}</td>
                          <td className={tableCellClass}>{(row as ChangeHistoryRow).after}</td>
                          <td className={tableCellClass}>{(row as ChangeHistoryRow).changedBy}</td>
                          <td className={tableCellClass}>{(row as ChangeHistoryRow).source}</td>
                          <td className={`${tableCellClass} min-w-[280px]`}>{(row as ChangeHistoryRow).comment}</td>
                        </>
                      )}

                      {view === "audit-trail" && (
                        <>
                          <td className={tableCellClass}>{formatAuditTimestamp(row.timestamp)}</td>
                          <td className={`${tableCellClass} font-semibold text-zinc-950 dark:text-white`}>{(row as AuditTrailRow).stage}</td>
                          <td className={tableCellClass}>{(row as AuditTrailRow).performedBy}</td>
                          <td className={tableCellClass}><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass((row as AuditTrailRow).status)}`}>{(row as AuditTrailRow).status}</span></td>
                          <td className={tableCellClass}>{(row as AuditTrailRow).context}</td>
                          <td className={`${tableCellClass} min-w-[280px]`}>{(row as AuditTrailRow).note}</td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
};

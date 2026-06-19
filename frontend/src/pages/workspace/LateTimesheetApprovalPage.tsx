import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { lateTimesheetService } from "../../services/lateTimesheetService";
import type { AuthUser } from "../../types/auth";
import type { LateTimesheetRequestLine, LateTimesheetRequestRecord } from "../../types/lateTimesheet";
import { normalizeUserRole } from "../../types/roles";

type StatusFilter = "All" | "Pending" | "Approved" | "Rejected";

type ApprovalRow = {
  requestId: string;
  item: LateTimesheetRequestLine;
  employeeName: string;
  reason: string;
  additionalRemarks: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  overallStatus: LateTimesheetRequestRecord["overallStatus"];
};

const formatDateLabel = (value: string) =>
  new Date(value.includes("T") ? value : `${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatDateTimeLabel = (value: string | null) => {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusBadgeClass: Record<LateTimesheetRequestLine["status"], string> = {
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

export const LateTimesheetApprovalPage = ({ user }: { user: AuthUser }) => {
  const { toasts, showToast, dismissToast } = useToast();
  const { employees } = useEmployees();
  const role = normalizeUserRole(user.role);
  const [requests, setRequests] = useState<LateTimesheetRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Pending");
  const [actingItemId, setActingItemId] = useState<string | null>(null);
  const [rejectingRow, setRejectingRow] = useState<ApprovalRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  useBodyScrollLock(Boolean(rejectingRow));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const items = await lateTimesheetService.listInbox(role === "System Admin" ? undefined : user.id);
        if (!cancelled) {
          setRequests(items);
        }
      } catch {
        if (!cancelled) {
          showToast("Unable to load late timesheet approvals right now.", "error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [role, showToast, user.id]);

  const employeeDirectory = useMemo(() => new Set(employees.map((employee) => employee.id)), [employees]);

  const rows = useMemo<ApprovalRow[]>(
    () =>
      requests
        .filter((request) => employeeDirectory.has(request.userId))
        .flatMap((request) =>
          request.items.map((item) => ({
            requestId: request.id,
            item,
            employeeName: request.userName,
            reason: request.reason,
            additionalRemarks: request.additionalRemarks,
            createdAtUtc: request.createdAtUtc,
            updatedAtUtc: request.updatedAtUtc,
            overallStatus: request.overallStatus,
          })),
        ),
    [requests, employeeDirectory],
  );

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter !== "All" && row.item.status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        row.employeeName,
        row.item.projectName,
        row.item.taskTitle,
        row.reason,
        row.additionalRemarks,
        row.item.managerName,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [rows, searchText, statusFilter]);

  const summary = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((row) => row.item.status === "Pending").length,
      approved: rows.filter((row) => row.item.status === "Approved").length,
      rejected: rows.filter((row) => row.item.status === "Rejected").length,
    }),
    [rows],
  );

  const applyUpdatedRequest = (updated: LateTimesheetRequestRecord) => {
    setRequests((current) => current.map((request) => (request.id === updated.id ? updated : request)));
  };

  const handleApprove = async (row: ApprovalRow) => {
    setActingItemId(row.item.id);
    try {
      const updated = await lateTimesheetService.decideItem(row.item.id, "Approved");
      applyUpdatedRequest(updated);
      showToast("Late entry request approved successfully.", "success");
    } catch {
      showToast("Unable to approve this late entry request right now.", "error");
    } finally {
      setActingItemId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingRow) {
      return;
    }

    if (!rejectReason.trim()) {
      showToast("A rejection note is required.", "info");
      return;
    }

    setActingItemId(rejectingRow.item.id);
    try {
      const updated = await lateTimesheetService.decideItem(rejectingRow.item.id, "Rejected", rejectReason);
      applyUpdatedRequest(updated);
      setRejectingRow(null);
      setRejectReason("");
      showToast("Late entry request rejected.", "success");
    } catch {
      showToast("Unable to reject this late entry request right now.", "error");
    } finally {
      setActingItemId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading late timesheet approvals..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Late Timesheet Approvals" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Lines" value={summary.total} subtitle="Late-entry approval lines" accent="bg-zinc-500/20" />
          <StatCard label="Pending" value={summary.pending} subtitle="Waiting for your decision" accent="bg-amber-500/20" />
          <StatCard label="Approved" value={summary.approved} subtitle="Historical unlocks granted" accent="bg-emerald-500/20" />
          <StatCard label="Rejected" value={summary.rejected} subtitle="Sent back with review note" accent="bg-rose-500/20" />
        </div>

        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Search</span>
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-black">
                <Icon name="search" className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Employee, project, task, or reason"
                  className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200 dark:placeholder:text-zinc-500"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-[52px] rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="Pending">Pending</option>
                <option value="All">All statuses</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Approval Queue</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {filteredRows.length} line(s) match the current approval filters.
            </p>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => (
                <article key={row.item.id} className="px-6 py-5">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-semibold text-zinc-900 dark:text-white">{row.employeeName}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass[row.item.status]}`}>
                          {row.item.status}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {[
                          ["Date", formatDateLabel(row.item.date)],
                          ["Project", row.item.projectName],
                          ["Task", row.item.taskTitle],
                          ["Manager", row.item.managerName || "Mapped manager"],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{label}</p>
                            <p className="mt-2 text-sm font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Reason</p>
                          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{row.reason}</p>
                        </div>
                        <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Remarks</p>
                          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{row.additionalRemarks || "No additional remarks."}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        <span>Requested {formatDateTimeLabel(row.createdAtUtc)}</span>
                        <span>Updated {formatDateTimeLabel(row.updatedAtUtc)}</span>
                        <span>Overall request status: {row.overallStatus}</span>
                        {row.item.unlockExpiresAtUtc ? <span>Unlock expires {formatDateTimeLabel(row.item.unlockExpiresAtUtc)}</span> : null}
                      </div>

                      {row.item.decisionNote ? (
                        <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:text-zinc-300">
                          Review note: {row.item.decisionNote}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-3">
                      {row.item.status === "Pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleApprove(row)}
                            disabled={actingItemId === row.item.id}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Icon name="approvals" className="h-4 w-4" />
                            {actingItemId === row.item.id ? "Saving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingRow(row);
                              setRejectReason(row.item.decisionNote);
                            }}
                            disabled={actingItemId === row.item.id}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Icon name="close" className="h-4 w-4" />
                            Reject
                          </button>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-black dark:text-zinc-300">
                          Decision captured on {formatDateTimeLabel(row.item.decisionAtUtc)}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="text-base font-semibold text-zinc-900 dark:text-white">No late timesheet approvals match the current filters.</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Try widening the search or switching the status filter back to pending.
                </p>
              </div>
            )}
          </div>
        </section>
      </section>

      {rejectingRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Reject Late Entry Request</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Add a clear note so the employee knows what needs correction before resubmitting.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectingRow(null);
                  setRejectReason("");
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-6 block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Rejection Note</span>
              <textarea
                rows={5}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Explain what needs to be corrected or clarified."
                className="w-full rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectingRow(null);
                  setRejectReason("");
                }}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleReject()}
                disabled={actingItemId === rejectingRow.item.id}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actingItemId === rejectingRow.item.id ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { ToastContainer } from "../../components/ToastContainer";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { useToast } from "../../hooks/useToast";
import { leaveService } from "../../services/leaveService";
import type { AuthUser } from "../../types/auth";
import type { LeaveRequest, LeaveStatus, LeaveTypeDefinition } from "../../types/leave";

const PAGE_SIZE = 6;
const currentYear = new Date().getFullYear();

const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);

const formatDisplayDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatAppliedDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const statusBadgeClassNames: Record<LeaveStatus, string> = {
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  "Manager Approved": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  "HR Approved": "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const summaryCardStyles = [
  "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.95),rgba(239,246,255,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_45%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
  "bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.95),rgba(236,253,245,0.92))] dark:bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_45%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
  "bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.95),rgba(255,251,235,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_45%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
  "bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.14),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.95),rgba(255,241,242,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_45%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
];

const getReasonPreview = (reason: string) => (reason.length > 56 ? `${reason.slice(0, 56)}...` : reason);

export const MyLeaveHistoryPage = ({ user }: { user: AuthUser }) => {
  const { toasts, showToast, dismissToast } = useToast();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDefinition[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<LeaveStatus | "All">("All");
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);

      try {
        const [types, requests] = await Promise.all([
          leaveService.getLeaveTypes(),
          leaveService.getLeaves({ employeeId: user.id, year: selectedYear }),
        ]);

        if (!active) {
          return;
        }

        const sortedRequests = [...requests].sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        );

        setLeaveTypes(types);
        setLeaveRequests(sortedRequests);
      } catch {
        if (active) {
          showToast("Unable to load leave history right now.", "error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [selectedYear, showToast, user.id]);

  const leaveTypeOptions = useMemo(() => {
    const catalogTypes = leaveTypes.filter((leaveType) => leaveType.active).map((leaveType) => leaveType.name);
    const historyTypes = leaveRequests.map((leaveRequest) => leaveRequest.type);
    return Array.from(new Set([...catalogTypes, ...historyTypes])).sort((left, right) => left.localeCompare(right));
  }, [leaveRequests, leaveTypes]);

  const leaveRequestsByType = useMemo(() => {
    return leaveRequests.filter((leaveRequest) => {
      if (selectedLeaveType !== "All" && leaveRequest.type !== selectedLeaveType) {
        return false;
      }

      return true;
    });
  }, [leaveRequests, selectedLeaveType]);

  const filteredLeaveRequests = useMemo(() => {
    return leaveRequestsByType.filter((leaveRequest) => {
      if (selectedStatus !== "All" && leaveRequest.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [leaveRequestsByType, selectedStatus]);

  const summary = useMemo(
    () => ({
      total: leaveRequestsByType.length,
      approved: leaveRequestsByType.filter((leaveRequest) => leaveRequest.status === "Approved").length,
      pending: leaveRequestsByType.filter((leaveRequest) => leaveRequest.status === "Pending").length,
      rejected: leaveRequestsByType.filter((leaveRequest) => leaveRequest.status === "Rejected").length,
    }),
    [leaveRequestsByType],
  );

  const daysTaken = useMemo(
    () => leaveRequestsByType.filter((leaveRequest) => leaveRequest.status !== "Rejected").reduce((sum, leaveRequest) => sum + leaveRequest.days, 0),
    [leaveRequestsByType],
  );

  const totalPages = Math.max(1, Math.ceil(filteredLeaveRequests.length / PAGE_SIZE));
  const paginatedLeaveRequests = filteredLeaveRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedLeave =
    filteredLeaveRequests.find((leaveRequest) => leaveRequest.id === selectedLeaveId) ?? filteredLeaveRequests[0] ?? null;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLeaveType, selectedStatus, selectedYear]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!selectedLeave) {
      setSelectedLeaveId(null);
      return;
    }

    if (selectedLeave.id !== selectedLeaveId) {
      setSelectedLeaveId(selectedLeave.id);
    }
  }, [selectedLeave, selectedLeaveId]);

  const handleResetFilters = () => {
    setSelectedLeaveType("All");
    setSelectedStatus("All");
  };

  if (loading) {
    return <LoadingSpinner label="Loading leave history..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="My leave history">
          <WorkspaceHeroMeta primary={`${daysTaken} day(s) in ${selectedYear}`} secondary={`${summary.pending} pending`} />
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Requests", value: summary.total, helper: "Leave requests in current view", icon: "history" as const },
            { label: "Approved", value: summary.approved, helper: "Requests approved successfully", icon: "approvals" as const },
            { label: "Pending", value: summary.pending, helper: "Still waiting for review", icon: "inbox" as const },
            { label: "Rejected", value: summary.rejected, helper: "Requests declined or sent back", icon: "close" as const },
          ].map((card, index) => (
            <article
              key={card.label}
              className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{card.label}</p>
                  <p className="mt-3 text-4xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{card.value}</p>
                </div>
                <span className="rounded-2xl border border-zinc-200/70 bg-white/80 p-3 text-zinc-600 dark:border-zinc-700 dark:bg-black/70 dark:text-zinc-300">
                  <Icon name={card.icon} className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{card.helper}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Filters</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Narrow your leave history by year, leave type, and approval status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Reset Filters
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <span>Year</span>
                  <select
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-zinc-700 dark:bg-black dark:text-zinc-100 dark:focus:ring-brand-500/40"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <span>Leave Type</span>
                  <select
                    value={selectedLeaveType}
                    onChange={(event) => setSelectedLeaveType(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-zinc-700 dark:bg-black dark:text-zinc-100 dark:focus:ring-brand-500/40"
                  >
                    <option value="All">All leave types</option>
                    {leaveTypeOptions.map((leaveType) => (
                      <option key={leaveType} value={leaveType}>
                        {leaveType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <span>Status</span>
                  <select
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value as LeaveStatus | "All")}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-zinc-700 dark:bg-black dark:text-zinc-100 dark:focus:ring-brand-500/40"
                  >
                    <option value="All">All statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-800 dark:bg-black/50">
              <div className="flex flex-col gap-2 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Leave Requests</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {filteredLeaveRequests.length} record(s) found for the current filter set.
                  </p>
                </div>
                <Link
                  to="/admin/leave/request"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
                >
                  New Leave Request
                </Link>
              </div>

              {filteredLeaveRequests.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                      <thead className="bg-zinc-50/90 dark:bg-black/70">
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                          <th className="px-6 py-4">Leave Type</th>
                          <th className="px-6 py-4">From</th>
                          <th className="px-6 py-4">To</th>
                          <th className="px-6 py-4">Days</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Applied On</th>
                          <th className="px-6 py-4">Reason</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {paginatedLeaveRequests.map((leaveRequest) => (
                          <tr
                            key={leaveRequest.id}
                            className={`transition ${
                              selectedLeave?.id === leaveRequest.id
                                ? "bg-brand-50/70 dark:bg-brand-500/10"
                                : "bg-transparent hover:bg-zinc-50/80 dark:hover:bg-black/70"
                            }`}
                          >
                            <td className="px-6 py-4 align-top">
                              <div>
                                <p className="font-semibold text-zinc-900 dark:text-white">{leaveRequest.type}</p>
                                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Ref {leaveRequest.id.slice(0, 8)}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDisplayDate(leaveRequest.startDate)}</td>
                            <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDisplayDate(leaveRequest.endDate)}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{leaveRequest.days}</td>
                            <td className="px-6 py-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClassNames[leaveRequest.status]}`}>
                                {leaveRequest.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatAppliedDate(leaveRequest.createdAt)}</td>
                            <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{getReasonPreview(leaveRequest.reason)}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedLeaveId(leaveRequest.id)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                              >
                                <Icon name="eye" className="h-4 w-4" />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </>
              ) : (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-zinc-400 dark:text-zinc-500">
                    <Icon name="history" className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-zinc-900 dark:text-white">No leave history found</h3>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    Try another filter combination, or start a new request if you have not submitted leave for this period yet.
                  </p>
                  <Link
                    to="/admin/leave/request"
                    className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white px-5 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
                  >
                    Request Leave
                  </Link>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Request Details</p>
              {selectedLeave ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold text-zinc-900 dark:text-white">{selectedLeave.type}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Submitted on {formatAppliedDate(selectedLeave.createdAt)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClassNames[selectedLeave.status]}`}>
                      {selectedLeave.status}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-white/90 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/85">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">From Date</p>
                      <p className="mt-2 text-sm font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{formatDisplayDate(selectedLeave.startDate)}</p>
                    </div>
                    <div className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-white/90 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/85">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">To Date</p>
                      <p className="mt-2 text-sm font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{formatDisplayDate(selectedLeave.endDate)}</p>
                    </div>
                    <div className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-white/90 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/85">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Days Taken</p>
                      <p className="mt-2 text-sm font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{selectedLeave.days} day(s)</p>
                    </div>
                    <div className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-white/90 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/85">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Department</p>
                      <p className="mt-2 text-sm font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{selectedLeave.department}</p>
                    </div>
                  </div>

                  <div className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-white/90 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/85">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Reason</p>
                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{selectedLeave.reason}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Select a request from the table to review its dates, status, and reason in more detail.
                </p>
              )}
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Archive Guidance</p>
              <div className="mt-4 space-y-3">
                {[
                  "Pending requests stay visible here until an approver marks them approved or rejected.",
                  "Rejected requests are kept in history so you can revisit the original reason and dates.",
                  "Use the Request Leave screen whenever you need to create a fresh request for a new period.",
                ].map((note) => (
                  <div key={note} className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-white/90 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/85 dark:text-zinc-300">
                    {note}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/admin/leave/request"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
                >
                  Request Leave
                </Link>
                <Link
                  to="/admin/leave/balance"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  View Balance
                </Link>
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  );
};

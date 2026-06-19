import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { ToastContainer } from "../../components/ToastContainer";
import { setTimesheetNavigationTarget } from "../../config/timesheetNavigation";
import { useToast } from "../../hooks/useToast";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { TimesheetWeekRecord } from "../../types/timesheet";

const PAGE_SIZE = 8;
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);
const monthOptions = [
  { value: "All", label: "All months" },
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const statusThemes: Record<
  TimesheetWeekRecord["status"],
  {
    badge: string;
    summaryCard: string;
    label: string;
  }
> = {
  Draft: {
    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
    summaryCard:
      "bg-[radial-gradient(circle_at_top_right,rgba(161,161,170,0.16),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(161,161,170,0.18),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
    label: "Draft",
  },
  Submitted: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    summaryCard:
      "bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,251,235,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
    label: "Pending Approval",
  },
  Approved: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    summaryCard:
      "bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
    label: "Approved",
  },
  Rejected: {
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    summaryCard:
      "bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,241,242,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.18),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
    label: "Rejected",
  },
  "Manager Approved": {
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    summaryCard:
      "bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,249,255,0.94))] dark:bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_48%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))]",
    label: "Manager Approved",
  },
};

const formatDisplayDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatUpdatedAt = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatWeekRange = (record: TimesheetWeekRecord) => `${formatDisplayDate(record.weekStart)} - ${formatDisplayDate(record.weekEnd)}`;
const formatHours = (value: number) => `${Number(value || 0).toFixed(1).replace(".0", "")}h`;
const summarizeProjects = (record: TimesheetWeekRecord) => Array.from(new Set(record.rows.map((row) => row.projectName).filter(Boolean))).slice(0, 3);

export const TimesheetHistoryPage = ({ user }: { user: AuthUser }) => {
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToast();
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<"All" | TimesheetWeekRecord["status"]>("All");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const items = await timesheetService.listWeeks(user.id);
      setRecords([...items].sort((left, right) => right.weekStart.localeCompare(left.weekStart)));
    } catch {
      showToast("Unable to load timesheet history right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, [user.id]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const startDate = new Date(`${record.weekStart}T00:00:00`);

      if (startDate.getFullYear() !== selectedYear) {
        return false;
      }

      if (selectedMonth !== "All" && startDate.getMonth() !== Number(selectedMonth)) {
        return false;
      }

      if (selectedStatus !== "All" && record.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [records, selectedMonth, selectedStatus, selectedYear]);

  const summary = useMemo(() => {
    const totalHours = filteredRecords.reduce((sum, record) => sum + Number(record.totalHours || 0), 0);
    return {
      totalWeeks: filteredRecords.length,
      totalHours,
      submitted: filteredRecords.filter((record) => record.status === "Submitted").length,
      approved: filteredRecords.filter((record) => record.status === "Approved").length,
      rejected: filteredRecords.filter((record) => record.status === "Rejected").length,
    };
  }, [filteredRecords]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedRecordId) ?? paginatedRecords[0] ?? filteredRecords[0] ?? null;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, selectedStatus, selectedYear]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!selectedRecord) {
      setSelectedRecordId(null);
      return;
    }

    if (selectedRecord.id !== selectedRecordId) {
      setSelectedRecordId(selectedRecord.id);
    }
  }, [selectedRecord, selectedRecordId]);

  const handleOpenWeek = (record: TimesheetWeekRecord) => {
    setTimesheetNavigationTarget(record.weekStart, "weekly");
    navigate("/admin/timesheet");
  };

  const handleRequestLateAccess = (record: TimesheetWeekRecord) => {
    setTimesheetNavigationTarget(record.weekStart, "weekly", "late-request");
    navigate("/admin/timesheet");
  };

  if (loading) {
    return <LoadingSpinner label="Loading timesheet history..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Timesheet History" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
          { label: "Saved Weeks", value: summary.totalWeeks, helper: "Weekly timesheets in current view", icon: "history" as const, style: statusThemes.Draft.summaryCard },
            { label: "Pending Approval", value: summary.submitted, helper: "Already sent for review", icon: "inbox" as const, style: statusThemes.Submitted.summaryCard },
            { label: "Approved", value: summary.approved, helper: "Finalized approval records", icon: "approvals" as const, style: statusThemes.Approved.summaryCard },
            { label: "Rejected", value: summary.rejected, helper: "Needs corrections or resubmission", icon: "close" as const, style: statusThemes.Rejected.summaryCard },
          ].map((card) => (
            <article key={card.label} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm transition hover:-translate-y-1 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{card.label}</p>
                  <p className="mt-3 text-4xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{card.value}</p>
                </div>
                <span className="rounded-2xl border border-transparent bg-[#E6F1FB] p-3 text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4]">
                  <Icon name={card.icon} className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{card.helper}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Filters</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Refine timesheet history by year, month, and current workflow status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth("All");
                    setSelectedStatus("All");
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Reset Filters
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
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
                  <span>Month</span>
                  <select
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-zinc-700 dark:bg-black dark:text-zinc-100 dark:focus:ring-brand-500/40"
                  >
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <span>Status</span>
                  <select
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value as "All" | TimesheetWeekRecord["status"])}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-zinc-700 dark:bg-black dark:text-zinc-100 dark:focus:ring-brand-500/40"
                  >
                    <option value="All">All statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Submitted">Pending Approval</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-panel dark:border-zinc-800 dark:bg-black/85">
              <div className="flex flex-col gap-2 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Weekly Archive</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {filteredRecords.length} history record(s) match the current filters.
                  </p>
                </div>
              </div>

              {filteredRecords.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                      <thead className="bg-zinc-50/90 dark:bg-black/70">
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                          <th className="px-6 py-4">Week Range</th>
                          <th className="px-6 py-4">Hours</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Submitted / Updated</th>
                          <th className="px-6 py-4">Projects</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {paginatedRecords.map((record) => (
                          <tr
                            key={record.id}
                            className={`transition ${
                              selectedRecord?.id === record.id
                                ? "bg-brand-50/70 dark:bg-brand-500/10"
                                : "bg-transparent hover:bg-zinc-50/80 dark:hover:bg-black/70"
                            }`}
                          >
                            <td className="px-6 py-4 align-top">
                              <div>
                                <p className="font-semibold text-zinc-900 dark:text-white">{formatWeekRange(record)}</p>
                                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Week starts {formatDisplayDate(record.weekStart)}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{formatHours(record.totalHours)}</td>
                            <td className="px-6 py-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusThemes[record.status].badge}`}>
                                {statusThemes[record.status].label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatUpdatedAt(record.updatedAt)}</td>
                            <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                              {summarizeProjects(record).length > 0 ? summarizeProjects(record).join(", ") : "No project rows"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRecordId(record.id);
                                    handleOpenWeek(record);
                                  }}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                                >
                                  <Icon name="eye" className="h-4 w-4" />
                                  Open
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRecordId(record.id);
                                    handleRequestLateAccess(record);
                                  }}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
                                >
                                  <Icon name="edit" className="h-4 w-4" />
                                  Request Access
                                </button>
                              </div>
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
                  <h3 className="mt-5 text-xl font-semibold text-zinc-900 dark:text-white">No timesheet history found</h3>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    Try a different month or status filter, or go back to the active timesheet screen to create a new weekly record.
                  </p>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Selected Week</p>
              {selectedRecord ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold text-zinc-900 dark:text-white">{formatWeekRange(selectedRecord)}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Last updated {formatUpdatedAt(selectedRecord.updatedAt)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusThemes[selectedRecord.status].badge}`}>
                      {statusThemes[selectedRecord.status].label}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Total Hours</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{formatHours(selectedRecord.totalHours)}</p>
                    </div>
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Rows Logged</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{selectedRecord.rows.length} row(s)</p>
                    </div>
                  </div>

                  <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Project Summary</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {summarizeProjects(selectedRecord).length > 0 ? (
                        summarizeProjects(selectedRecord).map((projectName) => (
                          <span
                            key={projectName}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-black dark:text-zinc-200"
                          >
                            {projectName}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">No project rows were saved for this week.</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Submission Audit</p>
                    <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                      <p>Week start: {formatDisplayDate(selectedRecord.weekStart)}</p>
                      <p>Week end: {formatDisplayDate(selectedRecord.weekEnd)}</p>
                      <p>Updated by admin context: {selectedRecord.adminName || "System"}</p>
                      <p>Status at save time: {statusThemes[selectedRecord.status].label}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenWeek(selectedRecord)}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      Open Week
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestLateAccess(selectedRecord)}
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
                    >
                      Request Late Entry Access
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Select a weekly record from the table to inspect its total hours, projects, and audit summary.
                </p>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">History Guidance</p>
              <div className="mt-4 space-y-3">
                {[
                  "Open takes you back to the selected week in the main timesheet workspace.",
                  "Request Late Entry Access opens the same week and starts the approval-based historical access flow.",
                  "Pending Approval reflects weeks that were submitted and are waiting for manager review.",
                ].map((note) => (
                  <div key={note} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70 dark:text-zinc-300">
                    {note}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  );
};

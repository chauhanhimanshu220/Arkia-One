import { useEffect } from "react";
import { Link } from "react-router-dom";
import { workspaceRoutes } from "../config/workspaceNavigation";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import type { PayrollRowView, PayrollRunStatus } from "../utils/timesheetPayroll";
import { formatCurrency, formatHours, formatWeekRange, getRowHours, rowStatusStyles } from "../utils/timesheetPayroll";
import { Icon } from "./Icon";

interface TimesheetPayrollQuickInfoModalProps {
  open: boolean;
  row: PayrollRowView | null;
  selectedMonthLabel: string;
  selectedYear: number;
  runStatus: PayrollRunStatus;
  bonusAmount: number;
  manualDeduction: number;
  onBonusAmountChange: (value: number) => void;
  onManualDeductionChange: (value: number) => void;
  onClose: () => void;
}

export const TimesheetPayrollQuickInfoModal = ({
  open,
  row,
  selectedMonthLabel,
  selectedYear,
  runStatus,
  bonusAmount,
  manualDeduction,
  onBonusAmountChange,
  onManualDeductionChange,
  onClose,
}: TimesheetPayrollQuickInfoModalProps) => {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || !row) {
    return null;
  }

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 backdrop-blur-md sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timesheet-payroll-quick-info-title"
        className="animate-modal-in flex h-full w-full flex-col overflow-hidden border border-white/10 bg-white shadow-2xl transition-all duration-300 dark:border-zinc-800 dark:bg-black sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-[2rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_35%),radial-gradient(circle_at_top_right,rgba(161,161,170,0.14),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.96))] px-5 py-5 text-white dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_35%),radial-gradient(circle_at_top_right,rgba(161,161,170,0.10),transparent_24%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.96))] sm:px-8 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 id="timesheet-payroll-quick-info-title" className="mt-3 text-3xl font-bold text-white">
                Timesheet Payroll Quick Info
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                Review {row.employeeName}&apos;s payroll snapshot for {selectedMonthLabel} {selectedYear}. This {runStatus.toLowerCase()} run includes approved hours, deductions, and approved weekly sheets.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to={workspaceRoutes["approved-timesheets"].path}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/15"
              >
                Approved Timesheets
              </Link>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close quick info"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-zinc-200 transition hover:bg-white/15"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 dark:bg-black sm:px-8 sm:py-7">
          <section className="rounded-[2rem] border border-zinc-200/80 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-black/80">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">Employee Breakdown</p>
                <h3 className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-white">{row.employeeName}</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {row.employeeCode} • {row.department} • {row.payrollType}
                </p>
              </div>
              <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${rowStatusStyles[row.status]}`}>
                {row.status}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Expected Hours</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{formatHours(row.expectedHours)}</p>
              </div>
              <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Approved Hours</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{formatHours(row.approvedHours)}</p>
              </div>
              <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Overtime</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{formatHours(row.overtimeHours)}</p>
              </div>
              <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Shortfall</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{formatHours(row.shortfallHours)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Manual bonus / allowance</span>
                <input
                  type="number"
                  step="100"
                  value={bonusAmount}
                  onChange={(event) => onBonusAmountChange(Number(event.target.value || 0))}
                  disabled={runStatus === "Locked"}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Manual deduction</span>
                <input
                  type="number"
                  step="100"
                  value={manualDeduction}
                  onChange={(event) => onManualDeductionChange(Number(event.target.value || 0))}
                  disabled={runStatus === "Locked"}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200"
                />
              </label>
            </div>

            <div className="mt-6 rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-black/50">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Gross Amount</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(row.grossAmount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Deduction Total</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(row.deductionAmount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Net Pay</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(row.netAmount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Latest Approved Week</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
                    {row.latestWeek ? formatWeekRange(row.latestWeek) : "No approved week"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-zinc-200/80 p-5 dark:border-zinc-800">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Approved period breakdown</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Recent approved weekly sheets included in this payroll calculation.</p>
              <div className="mt-4 space-y-3">
                {row.weeks.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No approved weekly sheet is available for this employee in the selected month.</p>
                ) : (
                  row.weeks.slice(0, 4).map((week) => (
                    <div key={week.id} className="rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white">{formatWeekRange(week)}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {formatHours(week.totalHours)} total • {formatHours(week.rows.filter((item) => item.billable).reduce((sum, item) => sum + getRowHours(item), 0))} billable
                          </p>
                        </div>
                        <Link to={workspaceRoutes["approved-timesheets"].path} className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                          Open
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {row.exceptions.length > 0 ? (
              <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 dark:border-rose-500/20 dark:bg-rose-500/10">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-700 dark:text-rose-200">Exceptions</p>
                <ul className="mt-3 space-y-2 text-sm text-rose-700 dark:text-rose-200">
                  {row.exceptions.map((exception) => (
                    <li key={exception}>• {exception}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

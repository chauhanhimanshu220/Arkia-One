import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer } from "../../components/ToastContainer";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import { normalizeUserRole } from "../../types/roles";
import {
  buildPayrollRows,
  formatCurrency,
  formatHours,
  formatWeekRange,
  getApprovedRecordsInPeriod,
  getRowHours,
  getWorkingDaysInMonth,
  rowStatusStyles,
  type PayrollRunStatus,
} from "../../utils/timesheetPayroll";

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth();
const monthOptions = [
  { value: 0, label: "January" },
  { value: 1, label: "February" },
  { value: 2, label: "March" },
  { value: 3, label: "April" },
  { value: 4, label: "May" },
  { value: 5, label: "June" },
  { value: 6, label: "July" },
  { value: 7, label: "August" },
  { value: 8, label: "September" },
  { value: 9, label: "October" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];

const parseInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseAmount = (value: string | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseRunStatus = (value: string | null): PayrollRunStatus =>
  value === "Calculated" || value === "Locked" || value === "Draft" ? value : "Draft";

export const TimesheetPayrollQuickInfoPage = ({ user }: { user: AuthUser }) => {
  const { employeeId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [bonusAmount, setBonusAmount] = useState(() => parseAmount(searchParams.get("bonus")));
  const [manualDeduction, setManualDeduction] = useState(() => parseAmount(searchParams.get("deduction")));

  const selectedMonth = Math.min(11, Math.max(0, parseInteger(searchParams.get("month"), currentMonth)));
  const selectedYear = parseInteger(searchParams.get("year"), currentYear);
  const runStatus = parseRunStatus(searchParams.get("runStatus"));
  const isHeld = searchParams.get("held") === "true";

  useEffect(() => {
    setBonusAmount(parseAmount(searchParams.get("bonus")));
    setManualDeduction(parseAmount(searchParams.get("deduction")));
  }, [searchParams]);

  useEffect(() => {
    const loadRecords = async () => {
      setLoading(true);
      try {
        const items = await timesheetService.listWeeks();
        setRecords(items);
      } catch {
        showToast("Unable to load payroll quick info right now.", "error");
      } finally {
        setLoading(false);
      }
    };

    void loadRecords();
  }, [showToast]);

  const payrollEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "Active" && normalizeUserRole(employee.role) !== "System Admin"),
    [employees],
  );

  const periodExpectedHours = useMemo(() => getWorkingDaysInMonth(selectedYear, selectedMonth) * 8, [selectedMonth, selectedYear]);
  const approvedRecordsInPeriod = useMemo(
    () => getApprovedRecordsInPeriod(records, selectedMonth, selectedYear),
    [records, selectedMonth, selectedYear],
  );

  const payrollRows = useMemo(
    () =>
      buildPayrollRows({
        payrollEmployees,
        approvedRecordsInPeriod,
        periodExpectedHours,
        bonusAdjustments: employeeId ? { [employeeId]: bonusAmount } : {},
        manualDeductions: employeeId ? { [employeeId]: manualDeduction } : {},
        heldRowIds: isHeld && employeeId ? [employeeId] : [],
        runStatus,
      }),
    [approvedRecordsInPeriod, bonusAmount, employeeId, isHeld, manualDeduction, payrollEmployees, periodExpectedHours, runStatus],
  );

  const selectedRow = payrollRows.find((row) => row.employeeId === employeeId) ?? null;
  const selectedMonthLabel = monthOptions.find((month) => month.value === selectedMonth)?.label ?? "Selected";

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading payroll quick info..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(161,161,170,0.14),_transparent_40%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.96))] p-8 text-white shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.10),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(161,161,170,0.10),_transparent_40%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.96))]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Timesheet Payroll Quick Info</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
                Review one employee&apos;s payroll snapshot for {selectedMonthLabel} {selectedYear}, including approved hours, deductions, and approved weekly sheets.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to={workspaceRoutes["timesheet-payroll"].path} className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-brand-200 hover:text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">
                Back to Payroll
              </Link>
              <Link to={workspaceRoutes["approved-timesheets"].path} className="rounded-full bg-black px-4 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                Approved Timesheets
              </Link>
            </div>
          </div>
        </section>

        {!selectedRow ? (
          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/80">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Quick Info</p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-white">Employee quick info is unavailable</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              The selected employee could not be resolved for the current payroll period. Try reopening quick info from the payroll table.
            </p>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/80">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">Employee Breakdown</p>
                <h2 className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-white">{selectedRow.employeeName}</h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {selectedRow.employeeCode} • {selectedRow.department} • {selectedRow.payrollType}
                </p>
              </div>
              <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${rowStatusStyles[selectedRow.status]}`}>
                {selectedRow.status}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Expected Hours</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{formatHours(selectedRow.expectedHours)}</p>
              </div>
              <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Approved Hours</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{formatHours(selectedRow.approvedHours)}</p>
              </div>
              <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Overtime</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{formatHours(selectedRow.overtimeHours)}</p>
              </div>
              <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Shortfall</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{formatHours(selectedRow.shortfallHours)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Manual bonus / allowance</span>
                <input
                  type="number"
                  step="100"
                  value={bonusAmount}
                  onChange={(event) => setBonusAmount(Number(event.target.value || 0))}
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
                  onChange={(event) => setManualDeduction(Number(event.target.value || 0))}
                  disabled={runStatus === "Locked"}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200"
                />
              </label>
            </div>

            <div className="mt-6 rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-black/50">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Gross Amount</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(selectedRow.grossAmount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Deduction Total</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(selectedRow.deductionAmount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Net Pay</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(selectedRow.netAmount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Latest Approved Week</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
                    {selectedRow.latestWeek ? formatWeekRange(selectedRow.latestWeek) : "No approved week"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-zinc-200/80 p-5 dark:border-zinc-800">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Approved period breakdown</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Recent approved weekly sheets included in this payroll calculation.</p>
              <div className="mt-4 space-y-3">
                {selectedRow.weeks.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No approved weekly sheet is available for this employee in the selected month.</p>
                ) : (
                  selectedRow.weeks.slice(0, 4).map((week) => (
                    <div key={week.id} className="rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white">{formatWeekRange(week)}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {formatHours(week.totalHours)} total • {formatHours(week.rows.filter((row) => row.billable).reduce((sum, row) => sum + getRowHours(row), 0))} billable
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

            {selectedRow.exceptions.length > 0 ? (
              <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 dark:border-rose-500/20 dark:bg-rose-500/10">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-700 dark:text-rose-200">Exceptions</p>
                <ul className="mt-3 space-y-2 text-sm text-rose-700 dark:text-rose-200">
                  {selectedRow.exceptions.map((exception) => (
                    <li key={exception}>• {exception}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </>
  );
};

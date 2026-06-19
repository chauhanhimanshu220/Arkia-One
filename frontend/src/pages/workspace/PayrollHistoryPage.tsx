import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { ToastContainer } from "../../components/ToastContainer";
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
  getApprovedRecordsInPeriod,
  getWorkingDaysInMonth,
  type PayrollRowView,
  type RowPayrollStatus,
} from "../../utils/timesheetPayroll";

type HistoryRunStatus = "Generated" | "Reviewed" | "Exported" | "Locked";

interface PayrollHistoryRun {
  id: string;
  month: number;
  year: number;
  generatedAt: string;
  generatedBy: string;
  status: HistoryRunStatus;
  employees: number;
  approvedHours: number;
  overtimeHours: number;
  exceptions: number;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  rows: PayrollRowView[];
}

const PAGE_SIZE = 8;
const STORAGE_KEY = "tms.payrollHistoryRuns";
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, value) => ({ label, value }));
const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);

const inputClass =
  "h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-100";
const buttonClass =
  "h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900";
const primaryButtonClass =
  "h-11 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const panelClass = "rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black";

const statusClass: Record<HistoryRunStatus, string> = {
  Generated: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Reviewed: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Exported: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  Locked: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
};

const rowStatusClass: Record<RowPayrollStatus, string> = {
  Calculated: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  "Needs Review": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Held: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  Locked: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
};

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const getPeriodLabel = (month: number, year: number) => `${monthOptions[month]?.label ?? "Payroll"} ${year}`;
const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const loadStoredRuns = (): PayrollHistoryRun[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as PayrollHistoryRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredRuns = (runs: PayrollHistoryRun[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
};

const downloadCsv = (filename: string, rows: Array<Array<string | number>>) => {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const url = window.URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const PayrollHistoryPage = ({ user }: { user: AuthUser }) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<PayrollHistoryRun[]>(() => loadStoredRuns());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | HistoryRunStatus>("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    const loadRecords = async () => {
      setLoading(true);
      try {
        const items = await timesheetService.listWeeks();
        setRecords(items);
      } catch {
        showToast("Unable to load approved timesheets for payroll history.", "error");
      } finally {
        setLoading(false);
      }
    };

    void loadRecords();
  }, [showToast]);

  useEffect(() => {
    saveStoredRuns(runs);
  }, [runs]);

  const payrollEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "Active" && normalizeUserRole(employee.role) !== "System Admin"),
    [employees],
  );

  const departmentOptions = useMemo(
    () => Array.from(new Set(payrollEmployees.map((employee) => employee.department))).sort((left, right) => left.localeCompare(right)),
    [payrollEmployees],
  );

  const generatedRows = useMemo(() => {
    const approvedRecordsInPeriod = getApprovedRecordsInPeriod(records, selectedMonth, selectedYear);
    const periodExpectedHours = getWorkingDaysInMonth(selectedYear, selectedMonth) * 8;

    return buildPayrollRows({
      payrollEmployees,
      approvedRecordsInPeriod,
      periodExpectedHours,
      runStatus: "Locked",
    });
  }, [payrollEmployees, records, selectedMonth, selectedYear]);

  const filteredRuns = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return runs
      .filter((run) => {
        if (statusFilter !== "All" && run.status !== statusFilter) {
          return false;
        }

        if (departmentFilter !== "All" && !run.rows.some((row) => row.department === departmentFilter)) {
          return false;
        }

        if (query) {
          const haystack = [
            getPeriodLabel(run.month, run.year),
            run.status,
            run.generatedBy,
            ...run.rows.map((row) => `${row.employeeName} ${row.employeeCode} ${row.department}`),
          ]
            .join(" ")
            .toLowerCase();

          if (!haystack.includes(query)) {
            return false;
          }
        }

        return true;
      })
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
  }, [departmentFilter, runs, searchText, statusFilter]);

  const paginatedRuns = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredRuns.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredRuns]);

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / PAGE_SIZE));
  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId) ?? null, [runs, selectedRunId]);

  const summary = useMemo(
    () => ({
      runs: filteredRuns.length,
      employees: filteredRuns.reduce((sum, run) => sum + run.employees, 0),
      netAmount: filteredRuns.reduce((sum, run) => sum + run.netAmount, 0),
      exceptions: filteredRuns.reduce((sum, run) => sum + run.exceptions, 0),
    }),
    [filteredRuns],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [departmentFilter, searchText, statusFilter]);

  const upsertRun = (status: HistoryRunStatus) => {
    if (generatedRows.length === 0) {
      showToast("No employees are available for this payroll period.", "info");
      return;
    }

    const id = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    const run: PayrollHistoryRun = {
      id,
      month: selectedMonth,
      year: selectedYear,
      generatedAt: new Date().toISOString(),
      generatedBy: user.fullName || user.email,
      status,
      employees: generatedRows.length,
      approvedHours: generatedRows.reduce((sum, row) => sum + row.approvedHours, 0),
      overtimeHours: generatedRows.reduce((sum, row) => sum + row.overtimeHours, 0),
      exceptions: generatedRows.reduce((sum, row) => sum + row.exceptions.length, 0),
      grossAmount: generatedRows.reduce((sum, row) => sum + row.grossAmount, 0),
      deductionAmount: generatedRows.reduce((sum, row) => sum + row.deductionAmount, 0),
      netAmount: generatedRows.reduce((sum, row) => sum + row.netAmount, 0),
      rows: generatedRows,
    };

    setRuns((current) => [run, ...current.filter((item) => item.id !== id)]);
    setSelectedRunId(id);
    showToast(`${getPeriodLabel(selectedMonth, selectedYear)} payroll history generated.`, "success");
  };

  const updateRunStatus = (runId: string, status: HistoryRunStatus) => {
    setRuns((current) => current.map((run) => (run.id === runId ? { ...run, status } : run)));
    showToast(`Payroll run marked ${status.toLowerCase()}.`, "success");
  };

  const exportRun = (run: PayrollHistoryRun) => {
    downloadCsv(`payroll-history-${run.year}-${String(run.month + 1).padStart(2, "0")}.csv`, [
      ["Employee", "Employee Code", "Department", "Approved Hours", "Overtime Hours", "Gross", "Deductions", "Net", "Status", "Exceptions"],
      ...run.rows.map((row) => [
        row.employeeName,
        row.employeeCode,
        row.department,
        row.approvedHours,
        row.overtimeHours,
        row.grossAmount,
        row.deductionAmount,
        row.netAmount,
        row.status,
        row.exceptions.join(" | "),
      ]),
    ]);
    updateRunStatus(run.id, "Exported");
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading payroll history..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {selectedRun ? (
        <div className="fixed inset-0 z-50 bg-black/30" role="dialog" aria-modal="true" aria-label="Payroll history run details">
          <div className="ml-auto flex h-full w-full max-w-5xl flex-col overflow-y-auto border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-black">
            <div className="sticky top-0 z-10 flex flex-col gap-4 border-b border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-black lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Payroll History Detail</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">{getPeriodLabel(selectedRun.month, selectedRun.year)}</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Generated by {selectedRun.generatedBy} on {new Date(selectedRun.generatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => updateRunStatus(selectedRun.id, "Reviewed")} className={buttonClass}>
                  Mark Reviewed
                </button>
                <button type="button" onClick={() => updateRunStatus(selectedRun.id, "Locked")} className={primaryButtonClass}>
                  Lock Run
                </button>
                <button type="button" onClick={() => exportRun(selectedRun)} className={buttonClass}>
                  Export CSV
                </button>
                <button type="button" onClick={() => setSelectedRunId(null)} className={buttonClass}>
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {[
                  ["Employees", selectedRun.employees],
                  ["Approved Hours", formatHours(selectedRun.approvedHours)],
                  ["Overtime", formatHours(selectedRun.overtimeHours)],
                  ["Exceptions", selectedRun.exceptions],
                  ["Net Payroll", formatCurrency(selectedRun.netAmount)],
                ].map(([label, value]) => (
                  <div key={String(label)} className={panelClass}>
                    <div className="px-5 py-4">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
                      <p className="mt-2 text-xl font-semibold text-zinc-950 dark:text-white">{value}</p>
                    </div>
                  </div>
                ))}
              </section>

              <section className={`${panelClass} overflow-hidden`}>
                <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">Employee payout rows</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-950">
                      <tr>
                        {["Employee", "Department", "Approved", "Overtime", "Gross", "Deductions", "Net", "Status"].map((heading) => (
                          <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {selectedRun.rows.map((row) => (
                        <tr key={row.employeeId} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-950">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-zinc-950 dark:text-white">{row.employeeName}</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{row.employeeCode}</p>
                          </td>
                          <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{row.department}</td>
                          <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatHours(row.approvedHours)}</td>
                          <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatHours(row.overtimeHours)}</td>
                          <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatCurrency(row.grossAmount)}</td>
                          <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatCurrency(row.deductionAmount)}</td>
                          <td className="px-4 py-4 text-sm font-semibold text-zinc-950 dark:text-white">{formatCurrency(row.netAmount)}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${rowStatusClass[row.status]}`}>{row.status}</span>
                            {row.exceptions[0] ? <p className="mt-2 max-w-[220px] text-xs text-amber-600 dark:text-amber-300">{row.exceptions[0]}</p> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        <section className="workspace-hero rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-600 dark:text-zinc-300">Payroll Management</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">Payroll History</h2>
              <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-300">
                Generate payroll snapshots from approved timesheets, review previous cycles, lock completed runs, and export employee payout history.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
              <Link to="/admin/payroll/processing" className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                Open Processing
              </Link>
              <Link to="/admin/payroll/export" className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                Payroll Export
              </Link>
              <button type="button" onClick={() => upsertRun("Generated")} className={`${primaryButtonClass} sm:col-span-2`}>
                Generate Payroll History
              </button>
            </div>
          </div>
        </section>

        <section className={`${panelClass} p-5`}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Payroll month</span>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} className={`${inputClass} w-full`}>
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Year</span>
              <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className={`${inputClass} w-full`}>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Run status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | HistoryRunStatus)} className={`${inputClass} w-full`}>
                <option value="All">All statuses</option>
                <option value="Generated">Generated</option>
                <option value="Reviewed">Reviewed</option>
                <option value="Exported">Exported</option>
                <option value="Locked">Locked</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Department</span>
              <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className={`${inputClass} w-full`}>
                <option value="All">All departments</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">Search history</span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Employee, period, department"
                className={`${inputClass} w-full`}
              />
            </label>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["History Runs", formatNumber(summary.runs), "Payroll cycles matching current filters"],
            ["Employee Rows", formatNumber(summary.employees), "Generated employee payout records"],
            ["Net Payroll", formatCurrency(summary.netAmount), "Total payable across filtered history"],
            ["Exceptions", formatNumber(summary.exceptions), "Warnings preserved from the payroll cycle"],
          ].map(([label, value, description]) => (
            <div key={label} className={panelClass}>
              <div className="px-5 py-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">{value}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
              </div>
            </div>
          ))}
        </section>

        <section className={`${panelClass} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">Generated payroll runs</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {filteredRuns.length} payroll run(s) are available in history.
              </p>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Preview for {getPeriodLabel(selectedMonth, selectedYear)}: {generatedRows.length} rows / {formatCurrency(generatedRows.reduce((sum, row) => sum + row.netAmount, 0))}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-950">
                <tr>
                  {["Period", "Generated", "Employees", "Hours", "Gross", "Deductions", "Net", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {paginatedRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <p className="font-semibold text-zinc-950 dark:text-white">No payroll history generated yet.</p>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Choose a payroll month and click Generate Payroll History to create the first run.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedRuns.map((run) => (
                    <tr key={run.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-950">
                      <td className="px-4 py-4">
                        <button type="button" onClick={() => setSelectedRunId(run.id)} className="text-left">
                          <span className="block font-semibold text-zinc-950 hover:underline dark:text-white">{getPeriodLabel(run.month, run.year)}</span>
                          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{run.exceptions} exception(s)</span>
                        </button>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">
                        {new Date(run.generatedAt).toLocaleDateString()}
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{run.generatedBy}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatNumber(run.employees)}</td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">
                        {formatHours(run.approvedHours)}
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatHours(run.overtimeHours)} overtime</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatCurrency(run.grossAmount)}</td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatCurrency(run.deductionAmount)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-zinc-950 dark:text-white">{formatCurrency(run.netAmount)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass[run.status]}`}>{run.status}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setSelectedRunId(run.id)} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                            View
                          </button>
                          <button type="button" onClick={() => exportRun(run)} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                            CSV
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </section>
      </div>
    </>
  );
};

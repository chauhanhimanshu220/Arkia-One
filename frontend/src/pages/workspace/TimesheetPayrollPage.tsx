import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { StatCard } from "../../components/StatCard";
import { TimesheetPayrollQuickInfoModal } from "../../components/TimesheetPayrollQuickInfoModal";
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
  rowStatusStyles,
  type PayrollRowView,
  type PayrollRunStatus,
  type RowPayrollStatus,
} from "../../utils/timesheetPayroll";

const PAGE_SIZE = 8;
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
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
const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);

const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const TimesheetPayrollPage = ({ user }: { user: AuthUser }) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedPayrollStatus, setSelectedPayrollStatus] = useState<"All" | RowPayrollStatus>("All");
  const [searchText, setSearchText] = useState("");
  const [bonusAdjustments, setBonusAdjustments] = useState<Record<string, number>>({});
  const [manualDeductions, setManualDeductions] = useState<Record<string, number>>({});
  const [heldRowIds, setHeldRowIds] = useState<string[]>([]);
  const [runStatus, setRunStatus] = useState<PayrollRunStatus>("Draft");
  const [lastCalculatedAt, setLastCalculatedAt] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const items = await timesheetService.listWeeks();
      setRecords(items);
    } catch {
      showToast("Unable to load payroll-ready timesheets right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const payrollEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "Active" && normalizeUserRole(employee.role) !== "System Admin"),
    [employees],
  );

  const departmentOptions = useMemo(
    () => Array.from(new Set(payrollEmployees.map((employee) => employee.department))).sort((left, right) => left.localeCompare(right)),
    [payrollEmployees],
  );

  const periodExpectedHours = useMemo(() => getWorkingDaysInMonth(selectedYear, selectedMonth) * 8, [selectedMonth, selectedYear]);

  const approvedRecordsInPeriod = useMemo(
    () => getApprovedRecordsInPeriod(records, selectedMonth, selectedYear),
    [records, selectedMonth, selectedYear],
  );

  const hasApprovedTimesheets = approvedRecordsInPeriod.length > 0;

  const payrollRows = useMemo<PayrollRowView[]>(
    () =>
      buildPayrollRows({
        payrollEmployees,
        approvedRecordsInPeriod,
        periodExpectedHours,
        bonusAdjustments,
        manualDeductions,
        heldRowIds,
        runStatus,
      }),
    [approvedRecordsInPeriod, bonusAdjustments, heldRowIds, manualDeductions, payrollEmployees, periodExpectedHours, runStatus],
  );

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return payrollRows.filter((row) => {
      if (selectedDepartment !== "All" && row.department !== selectedDepartment) {
        return false;
      }

      if (selectedPayrollStatus !== "All" && row.status !== selectedPayrollStatus) {
        return false;
      }

      if (query) {
        const haystack = `${row.employeeName} ${row.employeeCode} ${row.department}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [payrollRows, searchText, selectedDepartment, selectedPayrollStatus]);

  const summary = useMemo(() => {
    const totalEmployees = filteredRows.length;
    const approvedHours = filteredRows.reduce((sum, row) => sum + row.approvedHours, 0);
    const overtimeHours = filteredRows.reduce((sum, row) => sum + row.overtimeHours, 0);
    const netAmount = filteredRows.reduce((sum, row) => sum + row.netAmount, 0);
    const exceptions = filteredRows.filter((row) => row.exceptions.length > 0).length;
    const missingTimesheets = filteredRows.filter((row) => row.approvedHours === 0).length;

    return {
      totalEmployees,
      approvedHours,
      overtimeHours,
      netAmount,
      exceptions,
      missingTimesheets,
    };
  }, [filteredRows]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const hasPayrollRows = payrollRows.length > 0;
  const locked = runStatus === "Locked";
  const canCalculatePayroll = hasApprovedTimesheets && !locked;
  const canSaveDraft = runStatus === "Calculated";
  const canLockPayroll = runStatus === "Calculated" && hasApprovedTimesheets && hasPayrollRows;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, selectedDepartment, selectedMonth, selectedPayrollStatus, selectedYear]);

  useEffect(() => {
    if (selectedEmployeeId && !filteredRows.some((row) => row.employeeId === selectedEmployeeId)) {
      setSelectedEmployeeId(null);
    }
  }, [filteredRows, selectedEmployeeId]);

  const selectedRow = useMemo(
    () => filteredRows.find((row) => row.employeeId === selectedEmployeeId) ?? null,
    [filteredRows, selectedEmployeeId],
  );

  const handleOpenQuickInfo = (row: PayrollRowView) => {
    setSelectedEmployeeId(row.employeeId);
  };

  const handleCalculate = () => {
    if (!hasApprovedTimesheets) {
      showToast("No approved timesheets are available for the selected payroll month.", "info");
      return;
    }

    if (locked) {
      showToast("Locked payroll cannot be recalculated.", "info");
      return;
    }

    setRunStatus("Calculated");
    setLastCalculatedAt(new Date().toISOString());
    showToast("Payroll recalculated from approved timesheets.", "success");
  };

  const handleSaveDraft = () => {
    if (locked) {
      showToast("Locked payroll cannot be saved as draft.", "info");
      return;
    }

    setRunStatus("Draft");
    showToast("Payroll snapshot saved as draft.", "success");
  };

  const handleLock = () => {
    if (!canLockPayroll) {
      showToast(
        runStatus === "Calculated"
          ? "Approved payroll rows are required before locking payroll."
          : "Calculate payroll before locking this run.",
        "info",
      );
      return;
    }

    setRunStatus("Locked");
    setLastCalculatedAt(new Date().toISOString());
    showToast("Payroll run locked for export readiness.", "success");
  };

  const handleToggleHold = (employeeId: string) => {
    if (locked) {
      showToast("Locked payroll rows cannot be changed right now.", "info");
      return;
    }

    setHeldRowIds((current) => (current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]));
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      showToast("No payroll rows are available to export.", "info");
      return;
    }

    const headers = [
      "Employee",
      "Employee Code",
      "Department",
      "Payroll Type",
      "Approved Hours",
      "Overtime Hours",
      "Gross Amount",
      "Deductions",
      "Net Amount",
      "Payroll Status",
      "Exceptions",
    ];

    const rows = filteredRows.map((row) =>
      [
        row.employeeName,
        row.employeeCode,
        row.department,
        row.payrollType,
        row.approvedHours,
        row.overtimeHours,
        row.grossAmount,
        row.deductionAmount,
        row.netAmount,
        row.status,
        row.exceptions.join(" | "),
      ].join(","),
    );

    downloadBlob(
      `timesheet-payroll-${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}.csv`,
      new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" }),
    );
    showToast("Payroll rows exported to CSV.", "success");
  };

  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      showToast("No payroll rows are available to export.", "info");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(
      filteredRows.map((row) => ({
        Employee: row.employeeName,
        "Employee Code": row.employeeCode,
        Department: row.department,
        "Payroll Type": row.payrollType,
        "Expected Hours": row.expectedHours,
        "Approved Hours": row.approvedHours,
        "Overtime Hours": row.overtimeHours,
        "Billable Hours": row.billableHours,
        "Non-billable Hours": row.nonBillableHours,
        "Gross Amount": row.grossAmount,
        Deductions: row.deductionAmount,
        "Net Amount": row.netAmount,
        Status: row.status,
        Exceptions: row.exceptions.join(" | "),
      })),
    );
    XLSX.utils.book_append_sheet(workbook, sheet, "Timesheet Payroll");
    XLSX.writeFile(workbook, `timesheet-payroll-${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}.xlsx`);
    showToast("Payroll rows exported to Excel.", "success");
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading timesheet payroll..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <TimesheetPayrollQuickInfoModal
        open={Boolean(selectedRow)}
        row={selectedRow}
        selectedMonthLabel={monthOptions.find((month) => month.value === selectedMonth)?.label ?? "Selected"}
        selectedYear={selectedYear}
        runStatus={runStatus}
        bonusAmount={selectedRow ? bonusAdjustments[selectedRow.employeeId] ?? 0 : 0}
        manualDeduction={selectedRow ? manualDeductions[selectedRow.employeeId] ?? 0 : 0}
        onBonusAmountChange={(value) => {
          if (!selectedRow) {
            return;
          }

          setBonusAdjustments((current) => ({ ...current, [selectedRow.employeeId]: value }));
        }}
        onManualDeductionChange={(value) => {
          if (!selectedRow) {
            return;
          }

          setManualDeductions((current) => ({ ...current, [selectedRow.employeeId]: value }));
        }}
        onClose={() => setSelectedEmployeeId(null)}
      />

      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(161,161,170,0.14),_transparent_40%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.96))] p-8 text-white shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.10),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(161,161,170,0.10),_transparent_40%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.96))]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Timesheet Payroll</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
                Convert approved timesheet hours into payroll-ready employee rows with overtime, shortfall deductions, and finance review checkpoints.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
              <button
                type="button"
                onClick={loadRecords}
                className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-brand-200 hover:text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200"
              >
                Fetch Approved Timesheets
              </button>
              <button
                type="button"
                onClick={handleCalculate}
                disabled={!canCalculatePayroll}
                title={!hasApprovedTimesheets ? "Fetch or select a month with approved timesheets first" : undefined}
                className="rounded-full bg-zinc-950 dark:bg-white px-4 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Calculate Payroll
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={!canSaveDraft}
                title={runStatus === "Draft" ? "Calculate payroll before saving the draft" : undefined}
                className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-brand-200 hover:text-zinc-700 dark:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={handleLock}
                disabled={!canLockPayroll}
                title={runStatus !== "Calculated" ? "Calculate payroll before locking this run" : undefined}
                className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-brand-200 hover:text-zinc-700 dark:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200"
              >
                Lock Payroll
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Payroll Employees" value={summary.totalEmployees} subtitle="Visible employees in the current payroll scope" accent="bg-zinc-400/25" />
          <StatCard label="Approved Hours" value={Math.round(summary.approvedHours)} subtitle="Approved hours included in the payroll run" accent="bg-emerald-400/25" />
          <StatCard label="Overtime Hours" value={Math.round(summary.overtimeHours)} subtitle="Hours above the monthly target in the current run" accent="bg-amber-400/25" />
          <StatCard label="Net Pay Estimate" value={Math.round(summary.netAmount)} subtitle="Calculated payable total after deductions" accent="bg-rose-400/25" />
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/80">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Payroll Month</span>
                <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Year</span>
                <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Department</span>
                <select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">
                  <option value="All">All departments</option>
                  {departmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Payroll Status</span>
                <select value={selectedPayrollStatus} onChange={(event) => setSelectedPayrollStatus(event.target.value as "All" | RowPayrollStatus)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">
                  <option value="All">All statuses</option>
                  <option value="Calculated">Calculated</option>
                  <option value="Needs Review">Needs Review</option>
                  <option value="Held">Held</option>
                  <option value="Locked">Locked</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:w-[460px]">
              <label className="space-y-2 text-sm md:col-span-3">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Search employee</span>
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search by employee name, code, or department"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200"
                />
              </label>

              <button type="button" onClick={handleExportCsv} className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-brand-200 hover:text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">
                Export CSV
              </button>
              <button type="button" onClick={handleExportExcel} className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-brand-200 hover:text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">
                Export XLSX
              </button>
              <Link to="/admin/reports/payroll-export" className="rounded-full bg-black px-4 py-3 text-center text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                Payroll Export
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Payroll Run Status</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{runStatus}</p>
            </div>
            <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Expected Hours / Employee</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{formatHours(periodExpectedHours)}</p>
            </div>
            <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Exceptions</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{summary.exceptions}</p>
            </div>
            <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Missing Sheets</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{summary.missingTimesheets}</p>
            </div>
            <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/50">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Calculated At</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{lastCalculatedAt ? new Date(lastCalculatedAt).toLocaleString() : "Not calculated yet"}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/80">
            <div className="flex flex-col gap-3 border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">Payroll Processing Table</p>
                  <h3 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Employee payroll rows</h3>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Approved timesheet hours, payroll calculations, and exception status are shown employee by employee.</p>
                </div>
                <Link to="/admin/timesheets/approved" className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                  Review approved sheets
                </Link>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{filteredRows.length} payroll row(s) match the current period and filters.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50/80 dark:bg-black/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Approved</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Overtime</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Net Pay</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <p className="text-base font-semibold text-zinc-900 dark:text-white">No payroll rows match the current filters.</p>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Try another month, department, or payroll status to surface approved timesheet data.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr
                        key={row.employeeId}
                        className={`transition hover:bg-zinc-50/80 dark:hover:bg-black/50 ${
                          selectedRow?.employeeId === row.employeeId ? "bg-brand-50/60 dark:bg-brand-500/10" : ""
                        }`}
                      >
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-zinc-900 dark:text-white">{row.employeeName}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{row.employeeCode}</p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="text-sm text-zinc-700 dark:text-zinc-200">{row.department}</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{row.payrollType}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">{formatHours(row.approvedHours)}</td>
                        <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">{formatHours(row.overtimeHours)}</td>
                        <td className="px-4 py-4 align-top text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(row.netAmount)}</td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${rowStatusStyles[row.status]}`}>{row.status}</span>
                            {row.exceptions[0] ? <p className="text-xs text-rose-600 dark:text-rose-300">{row.exceptions[0]}</p> : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenQuickInfo(row);
                              }}
                              className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                selectedRow?.employeeId === row.employeeId
                                  ? "border-brand-500 bg-zinc-950 dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-zinc-100"
                                  : "border-zinc-200 text-zinc-700 hover:border-brand-200 hover:text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:text-zinc-200"
                              }`}
                            >
                              {selectedRow?.employeeId === row.employeeId ? "Viewing" : "View"}
                            </button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); handleToggleHold(row.employeeId); }} className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-brand-200 hover:text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 dark:text-zinc-200">
                              {heldRowIds.includes(row.employeeId) ? "Release" : "Hold"}
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
          </div>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-400">Exceptions Panel</p>
                  <h3 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Blocking payroll issues</h3>
                </div>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">{summary.exceptions} flagged</span>
              </div>

              <div className="mt-5 space-y-3">
                {filteredRows.filter((row) => row.exceptions.length > 0).slice(0, 6).length === 0 ? (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                    No blocking issues are visible for the current payroll scope.
                  </div>
                ) : (
                  filteredRows.filter((row) => row.exceptions.length > 0).slice(0, 6).map((row) => (
                    <div key={row.employeeId} className="rounded-3xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">{row.employeeName}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{row.department}</p>
                        </div>
                        <button type="button" onClick={() => handleOpenQuickInfo(row)} className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                          Review
                        </button>
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-rose-600 dark:text-rose-300">
                        {row.exceptions.map((exception) => (
                          <li key={exception}>• {exception}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </>
  );
};

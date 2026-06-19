import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Icon } from "../../components/Icon";
import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { ToastContainer } from "../../components/ToastContainer";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import { normalizeUserRole } from "../../types/roles";

const PAGE_SIZE = 10;
const panelClass =
  "rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50";
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

const statusOptions: Array<"All" | TimesheetWeekRecord["status"]> = ["All", "Draft", "Submitted", "Manager Approved", "Approved", "Rejected"];

const statusStyles: Record<TimesheetWeekRecord["status"], string> = {
  Draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Submitted: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  "Manager Approved": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
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

const formatHours = (value: number) => `${Number(value || 0).toFixed(1).replace(".0", "")}h`;
const formatWeekRange = (record: TimesheetWeekRecord) => `${formatDisplayDate(record.weekStart)} - ${formatDisplayDate(record.weekEnd)}`;

const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const AllTimesheetsPage = ({
  user,
  mode = "all",
}: {
  user: AuthUser;
  mode?: "all" | "approved" | "bulk-approvals";
}) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const role = normalizeUserRole(user.role);
  const isFinanceApprovedView = mode === "approved" || role === "Finance Admin";
  const isBulkApprovalView = mode === "bulk-approvals";
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("All");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<"All" | TimesheetWeekRecord["status"]>(
    isFinanceApprovedView ? "Approved" : isBulkApprovalView ? "Submitted" : "All",
  );
  const [searchText, setSearchText] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [bulkApproving, setBulkApproving] = useState(false);
  const selectedTimesheetPanelRef = useRef<HTMLElement | null>(null);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const items = await timesheetService.listWeeks();
      setRecords([...items].sort((left, right) => right.weekStart.localeCompare(left.weekStart)));
    } catch {
      showToast("Unable to load organization timesheets right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const employeeDirectory = useMemo(() => {
    const directory = new Map(
      employees.map((employee) => [
        employee.id,
        {
          id: employee.id,
          fullName: employee.fullName,
          email: employee.email,
          department: employee.department,
          role: employee.role,
        },
      ]),
    );

    directory.set(user.id, {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      department: "Operations",
      role: user.role,
    });

    return directory;
  }, [employees, user.email, user.fullName, user.id, user.role]);

  const departmentOptions = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department))).sort((left, right) => left.localeCompare(right)),
    [employees],
  );

  const employeeOptions = useMemo(() => {
    return employees
      .filter((employee) => (selectedDepartment === "All" ? true : employee.department === selectedDepartment))
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }, [employees, selectedDepartment]);

  const decoratedRecords = useMemo(() => {
    return records.filter((record) => employeeDirectory.has(record.userId)).map((record) => {
      const employee = employeeDirectory.get(record.userId);
      return {
        ...record,
        employeeName: employee?.fullName ?? "Unknown employee",
        employeeEmail: employee?.email ?? "",
        department: employee?.department ?? "Unknown",
      };
    });
  }, [employeeDirectory, records]);

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return decoratedRecords.filter((record) => {
      const startDate = new Date(`${record.weekStart}T00:00:00`);

      if (selectedDepartment !== "All" && record.department !== selectedDepartment) {
        return false;
      }

      if (selectedEmployeeId !== "All" && record.userId !== selectedEmployeeId) {
        return false;
      }

      if (startDate.getFullYear() !== selectedYear) {
        return false;
      }

      if (selectedMonth !== "All" && startDate.getMonth() !== Number(selectedMonth)) {
        return false;
      }

      if (isFinanceApprovedView && record.status !== "Approved") {
        return false;
      }

      if (selectedStatus !== "All" && record.status !== selectedStatus) {
        return false;
      }

      if (query) {
        const haystack = [
          record.employeeName,
          record.employeeEmail,
          record.department,
          record.weekStart,
          record.weekEnd,
          record.rows.map((row) => `${row.projectName} ${row.taskName} ${row.notes}`).join(" "),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [decoratedRecords, isFinanceApprovedView, searchText, selectedDepartment, selectedEmployeeId, selectedMonth, selectedStatus, selectedYear]);

  const selectedRecord = filteredRecords.find((record) => record.id === selectedRecordId) ?? null;

  useEffect(() => {
    if (!selectedRecordId) {
      return;
    }

    if (!selectedRecord) {
      setSelectedRecordId(null);
    }
  }, [selectedRecord, selectedRecordId]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedRowIds([]);
  }, [selectedDepartment, selectedEmployeeId, selectedMonth, selectedStatus, selectedYear, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(
    () => ({
      total: filteredRecords.length,
      hours: filteredRecords.reduce((sum, record) => sum + Number(record.totalHours || 0), 0),
      submitted: filteredRecords.filter((record) => record.status === "Submitted").length,
      approved: filteredRecords.filter((record) => record.status === "Approved").length,
    }),
    [filteredRecords],
  );

  const selectableSubmittedIds = paginatedRecords.filter((record) => record.status === "Submitted").map((record) => record.id);
  const allPageSubmittedSelected =
    selectableSubmittedIds.length > 0 && selectableSubmittedIds.every((recordId) => selectedRowIds.includes(recordId));

  const selectedSubmittedRecords = filteredRecords.filter(
    (record) => selectedRowIds.includes(record.id) && record.status === "Submitted",
  );

  const toggleRowSelection = (recordId: string) => {
    setSelectedRowIds((current) =>
      current.includes(recordId) ? current.filter((item) => item !== recordId) : [...current, recordId],
    );
  };

  const toggleSelectAllOnPage = () => {
    setSelectedRowIds((current) => {
      if (allPageSubmittedSelected) {
        return current.filter((item) => !selectableSubmittedIds.includes(item));
      }

      return Array.from(new Set([...current, ...selectableSubmittedIds]));
    });
  };

  const handleViewRecord = (recordId: string) => {
    setSelectedRecordId(recordId);
    window.requestAnimationFrame(() => {
      selectedTimesheetPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      selectedTimesheetPanelRef.current?.focus({ preventScroll: true });
    });
  };

  const handleBulkApprove = async () => {
    if (selectedSubmittedRecords.length === 0 || isFinanceApprovedView) {
      showToast("Select submitted timesheets first.", "info");
      return;
    }

    setBulkApproving(true);
    try {
      await Promise.all(
        selectedSubmittedRecords.map((record) => {
          const { id, adminId, adminName, updatedAt, ...rest } = record;
          return timesheetService.saveWeek(
            {
              ...rest,
              status: "Approved",
              managerApprovalStatus: record.managerApprovalStatus || "Approved",
              adminApprovalStatus: "Approved",
              approvedBy: user.fullName || "System Admin",
              approvalFlowType: record.status === "Submitted" ? "Direct Approved by Admin" : "Fully Approved (Manager + Admin)",
            },
            record.userId,
          );
        }),
      );

      showToast(`${selectedSubmittedRecords.length} timesheet(s) approved successfully.`, "success");
      setSelectedRowIds([]);
      await loadRecords();
    } catch {
      showToast("Unable to bulk approve the selected timesheets right now.", "error");
    } finally {
      setBulkApproving(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      showToast("No filtered timesheets are available to export.", "info");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(
      filteredRecords.map((record) => ({
        Employee: record.employeeName,
        Email: record.employeeEmail,
        Department: record.department,
        "Week Start": record.weekStart,
        "Week End": record.weekEnd,
        "Total Hours": record.totalHours,
        Status: record.status,
        "Updated At": formatUpdatedAt(record.updatedAt),
        Projects: record.rows.map((row) => row.projectName).filter(Boolean).join(", "),
      })),
    );
    sheet["!cols"] = [
      { wch: 24 },
      { wch: 28 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 36 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, "All Timesheets");
    XLSX.writeFile(workbook, `all-timesheets-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Filtered timesheets exported to Excel.", "success");
  };

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) {
      showToast("No filtered timesheets are available to export.", "info");
      return;
    }

    const headers = ["Employee", "Email", "Department", "Week Start", "Week End", "Total Hours", "Status", "Updated At", "Projects"];
    const rows = filteredRecords.map((record) =>
      [
        record.employeeName,
        record.employeeEmail,
        record.department,
        record.weekStart,
        record.weekEnd,
        String(record.totalHours),
        record.status,
        formatUpdatedAt(record.updatedAt),
        record.rows.map((row) => row.projectName).filter(Boolean).join(", "),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );

    downloadBlob(
      `all-timesheets-${new Date().toISOString().slice(0, 10)}.csv`,
      new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" }),
    );
    showToast("Filtered timesheets exported to CSV.", "success");
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading all timesheets..." />;
  }

  const title = isFinanceApprovedView ? "Approved Timesheets" : isBulkApprovalView ? "Bulk Approvals" : "All Timesheets";

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title={title} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Visible Weeks", value: summary.total, helper: "Filtered weekly timesheets", accent: "from-sky-100 to-sky-50 dark:from-sky-500/15 dark:to-black" },
            { label: "Visible Hours", value: formatHours(summary.hours), helper: "Total hours across the table", accent: "from-emerald-100 to-emerald-50 dark:from-emerald-500/15 dark:to-black" },
            { label: "Submitted", value: summary.submitted, helper: "Pending bulk-approval candidates", accent: "from-amber-100 to-amber-50 dark:from-amber-500/15 dark:to-black" },
            { label: "Departments", value: new Set(filteredRecords.map((record) => record.department)).size, helper: "Departments represented in view", accent: "from-violet-100 to-violet-50 dark:from-violet-500/15 dark:to-black" },
          ].map((card) => (
            <article key={card.label} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm transition hover:-translate-y-1 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{card.label}</p>
              <p className="mt-3 text-4xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{card.value}</p>
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{card.helper}</p>
            </article>
          ))}
        </div>

        <section className={`${panelClass} p-6 shadow-sm`}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Org</span>
              <input
                value={user.organization}
                readOnly
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Department</span>
              <select
                value={selectedDepartment}
                onChange={(event) => {
                  setSelectedDepartment(event.target.value);
                  setSelectedEmployeeId("All");
                }}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All departments</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Employee</span>
              <select
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All employees</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Year</span>
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Period</span>
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as "All" | TimesheetWeekRecord["status"])}
                disabled={isFinanceApprovedView}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "All" ? "All statuses" : status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Search</span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Employee, department, project, task, note"
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedDepartment("All");
                  setSelectedEmployeeId("All");
                  setSelectedYear(currentYear);
                  setSelectedMonth("All");
                  setSelectedStatus(isFinanceApprovedView ? "Approved" : isBulkApprovalView ? "Submitted" : "All");
                  setSearchText("");
                }}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <Icon name="download" className="h-4 w-4" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                <Icon name="file-spreadsheet" className="h-4 w-4" />
                Export XLSX
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="space-y-6">
            <section className={`overflow-hidden ${panelClass} shadow-sm`}>
              <div className="flex flex-col gap-3 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {isFinanceApprovedView
                      ? "Approved Timesheet Table"
                      : isBulkApprovalView
                        ? "Bulk Approval Queue"
                        : "Global Timesheet Table"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {isFinanceApprovedView
                      ? "Export-focused approved sheets filtered for payroll and billing review."
                      : isBulkApprovalView
                        ? "Review submitted weekly sheets and approve multiple records in one pass."
                        : "Use row selection for bulk approval on submitted timesheets."}
                  </p>
                </div>
                {!isFinanceApprovedView ? (
                  <button
                    type="button"
                    onClick={() => void handleBulkApprove()}
                    disabled={selectedSubmittedRecords.length === 0 || bulkApproving}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="approvals" className="h-4 w-4" />
                    {bulkApproving ? "Approving..." : `Bulk Approve (${selectedSubmittedRecords.length})`}
                  </button>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                  <thead className="bg-zinc-50 dark:bg-black/90">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                      <th className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={allPageSubmittedSelected}
                          onChange={toggleSelectAllOnPage}
                          className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                        />
                      </th>
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4">Period</th>
                      <th className="px-6 py-4">Hours</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Updated</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {paginatedRecords.map((record) => {
                      const isSelected = selectedRowIds.includes(record.id);
                      const selectable = record.status === "Submitted" || record.status === "Manager Approved";

                      return (
                        <tr
                          key={record.id}
                          className={`transition ${
                            selectedRecord?.id === record.id
                              ? "bg-brand-50/70 dark:bg-brand-500/10"
                              : "bg-transparent hover:bg-zinc-50/80 dark:hover:bg-black/70"
                          }`}
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!selectable || isFinanceApprovedView}
                              onChange={() => toggleRowSelection(record.id)}
                              className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                            />
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div>
                              <p className="font-semibold text-zinc-900 dark:text-white">{record.employeeName}</p>
                              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{record.employeeEmail}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{record.department}</td>
                          <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatWeekRange(record)}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{formatHours(record.totalHours)}</td>
                          <td className="px-6 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[record.status]}`}>{record.status}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatUpdatedAt(record.updatedAt)}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleViewRecord(record.id)}
                              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                                selectedRecord?.id === record.id
                                  ? "border-brand-500 bg-zinc-950 dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-zinc-100"
                                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                              }`}
                            >
                              <Icon name="eye" className="h-4 w-4" />
                              {selectedRecord?.id === record.id ? "Viewing" : "View"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {paginatedRecords.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                          No timesheets match the current global filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </section>
          </div>

          <div className="space-y-6">
            <section
              ref={selectedTimesheetPanelRef}
              tabIndex={-1}
              className={`${panelClass} p-6 shadow-sm outline-none`}
            >
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Selected Timesheet</p>
              {selectedRecord ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold text-zinc-900 dark:text-white">{selectedRecord.employeeName}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{selectedRecord.department} · {formatWeekRange(selectedRecord)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[selectedRecord.status]}`}>{selectedRecord.status}</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Total Hours</p>
                      <p className="mt-2 text-sm font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{formatHours(selectedRecord.totalHours)}</p>
                    </div>
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Rows Logged</p>
                      <p className="mt-2 text-sm font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{selectedRecord.rows.length} row(s)</p>
                    </div>
                  </div>

                  <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Project and Task Breakdown</p>
                    <div className="mt-3 space-y-3">
                      {selectedRecord.rows.map((row) => (
                        <div key={row.id} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                          <p className="font-semibold text-zinc-900 dark:text-white">{row.projectName || "Unassigned project"}</p>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{row.taskName || "No task name"}</p>
                          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{row.notes || "No notes captured"}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Audit Visibility</p>
                    <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                      <p>Employee: {selectedRecord.employeeName}</p>
                      <p>Approver context: {selectedRecord.adminName || "System"}</p>
                      <p>Updated on: {formatUpdatedAt(selectedRecord.updatedAt)}</p>
                      <p>Status: {selectedRecord.status}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Select a row from the table to review its period summary, task mix, and audit details.
                </p>
              )}
            </section>

            <section className={`${panelClass} p-6 shadow-sm`}>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Action Notes</p>
              <div className="mt-4 space-y-3">
                {[
                  isFinanceApprovedView
                    ? "This finance view is read and export focused for already approved sheets."
                    : isBulkApprovalView
                      ? "This queue opens with Submitted timesheets selected for faster approval runs."
                      : "Bulk approve acts only on rows currently in Submitted status.",
                  "Exports are generated from the currently visible filtered result set.",
                  "Use department and employee filters together for quick escalation-ready review.",
                ].map((note) => (
                  <div key={note} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:text-zinc-300">
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

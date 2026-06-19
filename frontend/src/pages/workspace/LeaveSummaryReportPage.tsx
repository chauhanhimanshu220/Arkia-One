import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Icon } from "../../components/Icon";
import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { useEmployees } from "../../hooks/useEmployees";
import { useLeaves } from "../../hooks/useLeaves";
import { useToast } from "../../hooks/useToast";

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const monthStart = new Date();
monthStart.setDate(1);
monthStart.setHours(0, 0, 0, 0);

const formatDisplayDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const statusColors = {
  Approved: "#16a34a",
  "Manager Approved": "#0ea5e9",
  "HR Approved": "#6366f1",
  Pending: "#f59e0b",
  Rejected: "#ef4444",
} as const;

const statusBadge = {
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  "Manager Approved": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  "HR Approved": "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
} as const;

const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const LeaveSummaryReportPage = () => {
  const { leaves, loading } = useLeaves();
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [startDate, setStartDate] = useState(formatDateInput(monthStart));
  const [endDate, setEndDate] = useState(formatDateInput(new Date()));
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Approved" | "Manager Approved" | "HR Approved" | "Pending" | "Rejected">("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [searchText, setSearchText] = useState("");

  const employeeDirectory = useMemo(
    () =>
      new Map(
        employees.map((employee) => [
          employee.id,
          {
            name: employee.fullName,
            department: employee.department,
            email: employee.email,
          },
        ]),
      ),
    [employees],
  );

  const decoratedLeaves = useMemo(
    () =>
      leaves.map((leave) => {
        const employee = employeeDirectory.get(leave.employeeId);
        return {
          ...leave,
          employeeEmail: employee?.email ?? "",
          departmentLabel: employee?.department ?? leave.department,
        };
      }),
    [employeeDirectory, leaves],
  );

  const departmentOptions = useMemo(
    () => Array.from(new Set(decoratedLeaves.map((leave) => leave.departmentLabel))).sort((left, right) => left.localeCompare(right)),
    [decoratedLeaves],
  );

  const leaveTypeOptions = useMemo(
    () => Array.from(new Set(decoratedLeaves.map((leave) => leave.type))).sort((left, right) => left.localeCompare(right)),
    [decoratedLeaves],
  );

  const employeeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          decoratedLeaves.map((leave) => [leave.employeeId, { id: leave.employeeId, name: leave.employeeName, email: leave.employeeEmail }]),
        ).values(),
      ).sort((left, right) => left.name.localeCompare(right.name)),
    [decoratedLeaves],
  );

  const visibleLeaves = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return decoratedLeaves.filter((leave) => {
      if (startDate && leave.startDate < startDate) {
        return false;
      }

      if (endDate && leave.endDate > endDate) {
        return false;
      }

      if (departmentFilter !== "All" && leave.departmentLabel !== departmentFilter) {
        return false;
      }

      if (leaveTypeFilter !== "All" && leave.type !== leaveTypeFilter) {
        return false;
      }

      if (statusFilter !== "All" && leave.status !== statusFilter) {
        return false;
      }

      if (employeeFilter !== "All" && leave.employeeId !== employeeFilter) {
        return false;
      }

      if (query) {
        const haystack = [leave.employeeName, leave.departmentLabel, leave.type, leave.reason].join(" ").toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [decoratedLeaves, departmentFilter, employeeFilter, endDate, leaveTypeFilter, searchText, startDate, statusFilter]);

  const summary = useMemo(() => {
    const approved = visibleLeaves.filter((leave) => leave.status === "Approved");
    const pending = visibleLeaves.filter((leave) => leave.status === "Pending");
    const rejected = visibleLeaves.filter((leave) => leave.status === "Rejected");

    return {
      totalDays: visibleLeaves.reduce((sum, leave) => sum + leave.days, 0),
      approvedDays: approved.reduce((sum, leave) => sum + leave.days, 0),
      pendingDays: pending.reduce((sum, leave) => sum + leave.days, 0),
      rejectedDays: rejected.reduce((sum, leave) => sum + leave.days, 0),
      approvedCount: approved.length,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
    };
  }, [visibleLeaves]);

  const statusBreakdown = useMemo(
    () => [
      { label: "Approved", count: summary.approvedCount, days: summary.approvedDays, color: statusColors.Approved },
      { label: "Manager Approved", count: visibleLeaves.filter(l => l.status === "Manager Approved").length, days: visibleLeaves.filter(l => l.status === "Manager Approved").reduce((s, l) => s + l.days, 0), color: statusColors["Manager Approved"] },
      { label: "HR Approved", count: visibleLeaves.filter(l => l.status === "HR Approved").length, days: visibleLeaves.filter(l => l.status === "HR Approved").reduce((s, l) => s + l.days, 0), color: statusColors["HR Approved"] },
      { label: "Pending", count: summary.pendingCount, days: summary.pendingDays, color: statusColors.Pending },
      { label: "Rejected", count: summary.rejectedCount, days: summary.rejectedDays, color: statusColors.Rejected },
    ],
    [summary, visibleLeaves],
  );

  const totalStatusCount = Math.max(statusBreakdown.reduce((sum, item) => sum + item.count, 0), 1);
  const donutStops = useMemo(() => {
    let offset = 0;
    return statusBreakdown
      .map((item) => {
        const start = offset;
        const size = (item.count / totalStatusCount) * 100;
        offset += size;
        return `${item.color} ${start}% ${offset}%`;
      })
      .join(", ");
  }, [statusBreakdown, totalStatusCount]);

  const leaveTypeSummary = useMemo(() => {
    const totals = new Map<string, { type: string; days: number; requests: number }>();

    visibleLeaves.forEach((leave) => {
      const current = totals.get(leave.type) ?? { type: leave.type, days: 0, requests: 0 };
      current.days += leave.days;
      current.requests += 1;
      totals.set(leave.type, current);
    });

    return Array.from(totals.values()).sort((left, right) => right.days - left.days);
  }, [visibleLeaves]);

  const departmentSummary = useMemo(() => {
    const totals = new Map<string, { department: string; days: number; requests: number; approved: number; pending: number; rejected: number }>();

    visibleLeaves.forEach((leave) => {
      const current = totals.get(leave.departmentLabel) ?? {
        department: leave.departmentLabel,
        days: 0,
        requests: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
      };
      current.days += leave.days;
      current.requests += 1;
      if (leave.status === "Approved") current.approved += 1;
      else if (leave.status === "Pending") current.pending += 1;
      else if (leave.status === "Rejected") current.rejected += 1;
      totals.set(leave.departmentLabel, current);
    });

    return Array.from(totals.values()).sort((left, right) => right.days - left.days);
  }, [visibleLeaves]);

  const monthlyTrend = useMemo(() => {
    const totals = new Map<string, { month: string; days: number; requests: number }>();

    visibleLeaves.forEach((leave) => {
      const month = leave.startDate.slice(0, 7);
      const current = totals.get(month) ?? { month, days: 0, requests: 0 };
      current.days += leave.days;
      current.requests += 1;
      totals.set(month, current);
    });

    return Array.from(totals.values()).sort((left, right) => left.month.localeCompare(right.month));
  }, [visibleLeaves]);

  const maxTypeDays = Math.max(...leaveTypeSummary.map((item) => item.days), 1);
  const maxTrendDays = Math.max(...monthlyTrend.map((item) => item.days), 1);

  const filtersSummary = [
    `Date: ${startDate || "Any"} to ${endDate || "Any"}`,
    `Department: ${departmentFilter === "All" ? "All" : departmentFilter}`,
    `Leave Type: ${leaveTypeFilter === "All" ? "All" : leaveTypeFilter}`,
    `Status: ${statusFilter}`,
    `Employee: ${employeeFilter === "All" ? "All" : employeeFilter}`,
    `Search: ${searchText.trim() || "Any"}`,
  ].join(" | ");

  const exportCsv = () => {
    if (visibleLeaves.length === 0) {
      showToast("No leave rows available to export.", "info");
      return;
    }

    const headers = ["Employee", "Department", "Leave Type", "From", "To", "Days", "Status", "Reason"];
    const rows = visibleLeaves.map((leave) =>
      [
        leave.employeeName,
        leave.departmentLabel,
        leave.type,
        leave.startDate,
        leave.endDate,
        String(leave.days),
        leave.status,
        leave.reason,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );

    downloadBlob(
      `leave-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" }),
    );
    showToast("Leave summary exported to CSV.", "success");
  };

  const exportExcel = () => {
    if (visibleLeaves.length === 0) {
      showToast("No leave rows available to export.", "info");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const detailSheet = XLSX.utils.json_to_sheet(
      visibleLeaves.map((leave) => ({
        Employee: leave.employeeName,
        Department: leave.departmentLabel,
        "Leave Type": leave.type,
        "Start Date": leave.startDate,
        "End Date": leave.endDate,
        Days: leave.days,
        Status: leave.status,
        Reason: leave.reason,
      })),
    );
    const summarySheet = XLSX.utils.json_to_sheet(
      statusBreakdown.map((item) => ({
        Status: item.label,
        Requests: item.count,
        Days: item.days,
        Filters: filtersSummary,
      })),
    );

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Status Summary");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Leave Details");
    XLSX.writeFile(workbook, `leave-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Leave summary exported to Excel.", "success");
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading leave summary report..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Leave Summary Report">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Icon name="download" className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={exportExcel}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              <Icon name="file-spreadsheet" className="h-4 w-4" />
              Export XLSX
            </button>
          </div>
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Leave Days" value={summary.totalDays} subtitle="Days in current filtered report" accent="bg-zinc-100 dark:bg-white/10" />
          <StatCard label="Approved Days" value={summary.approvedDays} subtitle={`${summary.approvedCount} approved request(s)`} accent="bg-emerald-500/20" />
          <StatCard label="Pending Days" value={summary.pendingDays} subtitle={`${summary.pendingCount} request(s) waiting review`} accent="bg-amber-500/20" />
          <StatCard label="Rejected Days" value={summary.rejectedDays} subtitle={`${summary.rejectedCount} rejected request(s)`} accent="bg-rose-500/20" />
        </div>

        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-5 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Start Date</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">End Date</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Department</span>
              <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                <option value="All">All departments</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Leave Type</span>
              <select value={leaveTypeFilter} onChange={(event) => setLeaveTypeFilter(event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                <option value="All">All leave types</option>
                {leaveTypeOptions.map((leaveType) => (
                  <option key={leaveType} value={leaveType}>
                    {leaveType}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                <option value="All">All statuses</option>
                <option value="Approved">Approved</option>
                <option value="Manager Approved">Manager Approved</option>
                <option value="HR Approved">HR Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Employee</span>
              <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                <option value="All">All employees</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Search</span>
              <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Employee, department, leave type, reason" className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setStartDate(formatDateInput(monthStart));
                  setEndDate(formatDateInput(new Date()));
                  setDepartmentFilter("All");
                  setLeaveTypeFilter("All");
                  setStatusFilter("All");
                  setEmployeeFilter("All");
                  setSearchText("");
                }}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Reset
              </button>
            </div>
          </div>

          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{filtersSummary}</p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Leave Status Breakdown</p>
            <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
              <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full" style={{ background: `conic-gradient(${donutStops})` }}>
                <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white text-center dark:bg-black">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Requests</p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{visibleLeaves.length}</p>
                </div>
              </div>
              <div className="space-y-3">
                {statusBreakdown.map((item) => (
                  <div key={item.label} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <p className="font-semibold text-zinc-900 dark:text-white">{item.label}</p>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.count} request(s)</p>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{item.days} day(s) in current report</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Leave Type Distribution</p>
            <div className="mt-6 space-y-4">
              {leaveTypeSummary.map((item) => (
                <div key={item.type}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p className="font-semibold text-zinc-900 dark:text-white">{item.type}</p>
                    <p className="text-zinc-500 dark:text-zinc-400">{item.days} day(s)</p>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div className="h-3 rounded-full bg-zinc-950 dark:bg-white" style={{ width: `${(item.days / maxTypeDays) * 100}%` }} />
                  </div>
                </div>
              ))}
              {leaveTypeSummary.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No leave-type data available for the current filters.</p> : null}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Department-Level Leave Review</p>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-black/90">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    <th className="px-4 py-4">Department</th>
                    <th className="px-4 py-4">Days</th>
                    <th className="px-4 py-4">Requests</th>
                    <th className="px-4 py-4">Approved</th>
                    <th className="px-4 py-4">Pending</th>
                    <th className="px-4 py-4">Rejected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {departmentSummary.map((item) => (
                    <tr key={item.department}>
                      <td className="px-4 py-4 font-semibold text-zinc-900 dark:text-white">{item.department}</td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{item.days}</td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{item.requests}</td>
                      <td className="px-4 py-4 text-sm text-emerald-700 dark:text-emerald-200">{item.approved}</td>
                      <td className="px-4 py-4 text-sm text-amber-700 dark:text-amber-200">{item.pending}</td>
                      <td className="px-4 py-4 text-sm text-rose-700 dark:text-rose-200">{item.rejected}</td>
                    </tr>
                  ))}
                  {departmentSummary.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No department summary data is available for the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Monthly Leave Trend</p>
            <div className="mt-6 space-y-4">
              {monthlyTrend.map((item) => (
                <div key={item.month}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p className="font-semibold text-zinc-900 dark:text-white">{item.month}</p>
                    <p className="text-zinc-500 dark:text-zinc-400">{item.days} day(s) · {item.requests} request(s)</p>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${(item.days / maxTrendDays) * 100}%` }} />
                  </div>
                </div>
              ))}
              {monthlyTrend.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No monthly trend data is available for the current filters.</p> : null}
            </div>
          </section>
        </div>

        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-800">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Detailed Leave Table</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Use this table for review, comparison, and export verification.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-black/90">
                <tr>
                  {["Employee", "Department", "Leave Type", "From", "To", "Days", "Status", "Reason"].map((label) => (
                    <th key={label} className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {visibleLeaves.map((leave) => (
                  <tr key={leave.id} className="align-top transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white">{leave.employeeName}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{leave.employeeEmail || "No email"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{leave.departmentLabel}</td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{leave.type}</td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatDisplayDate(leave.startDate)}</td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatDisplayDate(leave.endDate)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{leave.days}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[leave.status]}`}>{leave.status}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{leave.reason}</td>
                  </tr>
                ))}
                {visibleLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No leave records match the current report filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>
  );
};

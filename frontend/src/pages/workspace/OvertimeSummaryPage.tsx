import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Icon } from "../../components/Icon";
import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { DAILY_WORK_HOURS as STANDARD_HOURS_PER_DAY } from "../../constants/timesheet";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { timesheetService } from "../../services/timesheetService";
import type { TimesheetWeekRecord } from "../../types/timesheet";

const monthStart = new Date();
monthStart.setDate(1);
monthStart.setHours(0, 0, 0, 0);

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const weekdayLabel = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
  });

const weekdayShort = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
};

const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

interface OvertimeEntry {
  recordId: string;
  userId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  role: string;
  weekStart: string;
  weekEnd: string;
  date: string;
  dayLabel: string;
  totalHours: number;
  overtimeHours: number;
  status: TimesheetWeekRecord["status"];
}

export const OvertimeSummaryPage = () => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(formatDateInput(monthStart));
  const [endDate, setEndDate] = useState(formatDateInput(new Date()));
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");

  useEffect(() => {
    const loadRecords = async () => {
      setLoading(true);
      try {
        const items = await timesheetService.listWeeks();
        setRecords(items);
      } catch {
        showToast("Unable to load overtime analytics right now.", "error");
      } finally {
        setLoading(false);
      }
    };

    void loadRecords();
  }, [showToast]);

  const employeeDirectory = useMemo(
    () =>
      new Map(
        employees.map((employee) => [
          employee.id,
          {
            name: employee.fullName,
            email: employee.email,
            department: employee.department,
            role: employee.role,
          },
        ]),
      ),
    [employees],
  );

  const overtimeEntries = useMemo<OvertimeEntry[]>(() => {
    return records.filter((record) => employeeDirectory.has(record.userId)).flatMap((record) => {
      const employee = employeeDirectory.get(record.userId);
      const aggregatedByDay = new Map<string, number>();

      record.rows.forEach((row) => {
        Object.entries(row.hours).forEach(([date, hours]) => {
          aggregatedByDay.set(date, (aggregatedByDay.get(date) ?? 0) + Number(hours || 0));
        });
      });

      return Array.from(aggregatedByDay.entries())
        .map(([date, totalHours]) => ({
          recordId: record.id,
          userId: record.userId,
          employeeName: employee?.name ?? "Unknown employee",
          employeeEmail: employee?.email ?? "",
          department: employee?.department ?? "Unknown",
          role: employee?.role ?? "Employee",
          weekStart: record.weekStart,
          weekEnd: record.weekEnd,
          date,
          dayLabel: weekdayLabel(date),
          totalHours,
          overtimeHours: Math.max(Number(totalHours) - STANDARD_HOURS_PER_DAY, 0),
          status: record.status,
        }))
        .filter((entry) => entry.overtimeHours > 0);
    });
  }, [employeeDirectory, records]);

  const departmentOptions = useMemo(
    () => Array.from(new Set(overtimeEntries.map((entry) => entry.department))).sort((left, right) => left.localeCompare(right)),
    [overtimeEntries],
  );

  const employeeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          overtimeEntries.map((entry) => [entry.userId, { id: entry.userId, name: entry.employeeName, email: entry.employeeEmail }]),
        ).values(),
      ).sort((left, right) => left.name.localeCompare(right.name)),
    [overtimeEntries],
  );

  const roleOptions = useMemo(
    () => Array.from(new Set(overtimeEntries.map((entry) => entry.role))).sort((left, right) => left.localeCompare(right)),
    [overtimeEntries],
  );

  const visibleEntries = useMemo(() => {
    return overtimeEntries.filter((entry) => {
      if (startDate && entry.date < startDate) {
        return false;
      }

      if (endDate && entry.date > endDate) {
        return false;
      }

      if (departmentFilter !== "All" && entry.department !== departmentFilter) {
        return false;
      }

      if (employeeFilter !== "All" && entry.userId !== employeeFilter) {
        return false;
      }

      if (roleFilter !== "All" && entry.role !== roleFilter) {
        return false;
      }

      return true;
    });
  }, [departmentFilter, employeeFilter, endDate, overtimeEntries, roleFilter, startDate]);

  const summary = useMemo(() => {
    const totalOvertime = visibleEntries.reduce((sum, entry) => sum + entry.overtimeHours, 0);
    const employeesWithOvertime = new Set(visibleEntries.map((entry) => entry.userId)).size;
    const averageOvertime = employeesWithOvertime === 0 ? 0 : totalOvertime / employeesWithOvertime;

    const dayTotals = new Map<string, number>();
    visibleEntries.forEach((entry) => {
      dayTotals.set(entry.dayLabel, (dayTotals.get(entry.dayLabel) ?? 0) + entry.overtimeHours);
    });

    const peakDay = Array.from(dayTotals.entries()).sort((left, right) => right[1] - left[1])[0];

    return {
      totalOvertime,
      employeesWithOvertime,
      averageOvertime,
      peakDay: peakDay?.[0] ?? "No overtime",
      peakDayHours: peakDay?.[1] ?? 0,
    };
  }, [visibleEntries]);

  const employeeSummary = useMemo(() => {
    const totals = new Map<string, { employeeName: string; department: string; overtimeHours: number; days: number }>();

    visibleEntries.forEach((entry) => {
      const current = totals.get(entry.userId) ?? {
        employeeName: entry.employeeName,
        department: entry.department,
        overtimeHours: 0,
        days: 0,
      };
      current.overtimeHours += entry.overtimeHours;
      current.days += 1;
      totals.set(entry.userId, current);
    });

    return Array.from(totals.values()).sort((left, right) => right.overtimeHours - left.overtimeHours);
  }, [visibleEntries]);

  const departmentSummary = useMemo(() => {
    const totals = new Map<string, { department: string; overtimeHours: number; employees: number; entries: number }>();

    visibleEntries.forEach((entry) => {
      const current = totals.get(entry.department) ?? {
        department: entry.department,
        overtimeHours: 0,
        employees: 0,
        entries: 0,
      };
      current.overtimeHours += entry.overtimeHours;
      current.entries += 1;
      totals.set(entry.department, current);
    });

    return Array.from(totals.values())
      .map((item) => ({
        ...item,
        employees: new Set(visibleEntries.filter((entry) => entry.department === item.department).map((entry) => entry.userId)).size,
      }))
      .sort((left, right) => right.overtimeHours - left.overtimeHours);
  }, [visibleEntries]);

  const trendSummary = useMemo(() => {
    const totals = new Map<string, { bucket: string; overtimeHours: number; entries: number }>();

    visibleEntries.forEach((entry) => {
      const bucket = entry.date.slice(0, 7);
      const current = totals.get(bucket) ?? { bucket, overtimeHours: 0, entries: 0 };
      current.overtimeHours += entry.overtimeHours;
      current.entries += 1;
      totals.set(bucket, current);
    });

    return Array.from(totals.values()).sort((left, right) => left.bucket.localeCompare(right.bucket));
  }, [visibleEntries]);

  const maxEmployeeHours = Math.max(...employeeSummary.map((item) => item.overtimeHours), 1);
  const maxTrendHours = Math.max(...trendSummary.map((item) => item.overtimeHours), 1);

  const detailRows = useMemo(
    () => [...visibleEntries].sort((left, right) => right.date.localeCompare(left.date) || right.overtimeHours - left.overtimeHours),
    [visibleEntries],
  );

  const filtersSummary = [
    `Date: ${startDate || "Any"} to ${endDate || "Any"}`,
    `Department: ${departmentFilter === "All" ? "All" : departmentFilter}`,
    `Employee: ${employeeFilter === "All" ? "All" : employeeFilter}`,
    `Role: ${roleFilter === "All" ? "All" : roleFilter}`,
  ].join(" | ");

  const exportCsv = () => {
    if (detailRows.length === 0) {
      showToast("No overtime rows available to export.", "info");
      return;
    }

    const headers = ["Employee", "Email", "Department", "Role", "Date", "Week", "Total Hours", "Overtime", "Status"];
    const rows = detailRows.map((row) =>
      [
        row.employeeName,
        row.employeeEmail,
        row.department,
        row.role,
        row.date,
        `${row.weekStart} to ${row.weekEnd}`,
        String(row.totalHours),
        String(row.overtimeHours),
        row.status,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );

    downloadBlob(
      `overtime-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" }),
    );
    showToast("Overtime summary exported to CSV.", "success");
  };

  const exportExcel = () => {
    if (detailRows.length === 0) {
      showToast("No overtime rows available to export.", "info");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(
      trendSummary.map((item) => ({
        Month: monthLabel(item.bucket),
        "Overtime Hours": item.overtimeHours,
        Entries: item.entries,
        Filters: filtersSummary,
      })),
    );
    const detailSheet = XLSX.utils.json_to_sheet(
      detailRows.map((row) => ({
        Employee: row.employeeName,
        Email: row.employeeEmail,
        Department: row.department,
        Role: row.role,
        Date: row.date,
        "Week Start": row.weekStart,
        "Week End": row.weekEnd,
        "Total Hours": row.totalHours,
        "Overtime Hours": row.overtimeHours,
        Status: row.status,
      })),
    );

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Trend Summary");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Daily Overtime");
    XLSX.writeFile(workbook, `overtime-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Overtime summary exported to Excel.", "success");
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading overtime summary..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Overtime Summary">
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
          <StatCard label="Total Overtime" value={summary.totalOvertime} subtitle="Extra hours in current result set" accent="bg-orange-500/20" />
          <StatCard label="Employees With OT" value={summary.employeesWithOvertime} subtitle="People logging hours above the daily threshold" accent="bg-rose-500/20" />
          <StatCard label="Avg OT / Employee" value={Number(summary.averageOvertime.toFixed(1))} subtitle="Average overtime per impacted employee" accent="bg-amber-500/20" />
          <StatCard label="Peak Day" value={summary.peakDayHours} subtitle={`${summary.peakDay} carried the highest overtime load`} accent="bg-fuchsia-500/20" />
        </div>

        <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-5 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Department</span>
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
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
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All employees</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Role</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end justify-end">
              <button
                type="button"
                onClick={() => {
                  setStartDate(formatDateInput(monthStart));
                  setEndDate(formatDateInput(new Date()));
                  setDepartmentFilter("All");
                  setEmployeeFilter("All");
                  setRoleFilter("All");
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
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Overtime Trend</p>
            <div className="mt-6 space-y-4">
              {trendSummary.map((item) => (
                <div key={item.bucket}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p className="font-semibold text-zinc-900 dark:text-white">{monthLabel(item.bucket)}</p>
                    <p className="text-zinc-500 dark:text-zinc-400">{item.overtimeHours}h overtime · {item.entries} spike entry(s)</p>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div className="h-3 rounded-full bg-orange-500" style={{ width: `${(item.overtimeHours / maxTrendHours) * 100}%` }} />
                  </div>
                </div>
              ))}
              {trendSummary.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No overtime trend data is available for the selected filters.</p> : null}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Employee-Level Spikes</p>
            <div className="mt-6 space-y-4">
              {employeeSummary.slice(0, 8).map((item) => (
                <div key={`${item.employeeName}-${item.department}`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">{item.employeeName}</p>
                      <p className="text-zinc-500 dark:text-zinc-400">{item.department}</p>
                    </div>
                    <p className={`font-semibold ${item.overtimeHours >= 10 ? "text-rose-600 dark:text-rose-300" : "text-zinc-600 dark:text-zinc-300"}`}>
                      {item.overtimeHours}h
                    </p>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div
                      className={`h-3 rounded-full ${item.overtimeHours >= 10 ? "bg-rose-500" : "bg-amber-500"}`}
                      style={{ width: `${(item.overtimeHours / maxEmployeeHours) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {employeeSummary.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No employee overtime spikes are visible for the selected filters.</p> : null}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Department-Level Overtime</p>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50/90 dark:bg-black/70">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    <th className="px-4 py-4">Department</th>
                    <th className="px-4 py-4">Overtime</th>
                    <th className="px-4 py-4">Employees</th>
                    <th className="px-4 py-4">Spike Entries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {departmentSummary.map((item) => (
                    <tr key={item.department}>
                      <td className="px-4 py-4 font-semibold text-zinc-900 dark:text-white">{item.department}</td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{item.overtimeHours}h</td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{item.employees}</td>
                      <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{item.entries}</td>
                    </tr>
                  ))}
                  {departmentSummary.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No department overtime data is available for the selected filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Workload Notes</p>
            <div className="mt-4 space-y-3">
              {[
                `${employeeSummary.filter((item) => item.overtimeHours >= 10).length} employee(s) crossed the 10h overtime warning threshold in the current report.`,
                `${summary.peakDay} is the current peak overtime day with ${summary.peakDayHours}h logged above standard hours.`,
                `${departmentSummary[0]?.department ?? "No department"} is carrying the highest overtime load right now.`,
              ].map((note) => (
                <div key={note} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:text-zinc-300">
                  {note}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-800">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Detailed Overtime Table</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Daily entries that crossed the standard 9-hour threshold appear here.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50/90 dark:bg-black/70">
                <tr>
                  {["Employee", "Department", "Role", "Date", "Week", "Hours", "Overtime", "Status"].map((label) => (
                    <th key={label} className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {detailRows.map((row) => (
                  <tr key={`${row.recordId}-${row.date}-${row.userId}`} className="align-top transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white">{row.employeeName}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{row.employeeEmail || "No email"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{row.department}</td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{row.role}</td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">
                      {formatDisplayDate(row.date)} ({weekdayShort(row.date)})
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">
                      {formatDisplayDate(row.weekStart)} to {formatDisplayDate(row.weekEnd)}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{row.totalHours}h</td>
                    <td className={`px-4 py-4 text-sm font-semibold ${row.overtimeHours >= 3 ? "text-rose-600 dark:text-rose-300" : "text-amber-700 dark:text-amber-200"}`}>
                      {row.overtimeHours}h
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{row.status}</td>
                  </tr>
                ))}
                {detailRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No overtime entries match the current filters.
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

import { useEffect, useMemo, useState } from "react";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { ReportExportActions } from "../../components/ReportExportActions";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { projectService } from "../../services/projectService";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { Project } from "../../types/project";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import { canViewOrganizationReports, normalizeUserRole } from "../../types/roles";
import { formatDisplayDate } from "../../utils/adminDashboard";
import { exportTimesheetReportToExcel, exportTimesheetReportToPdf, type TimesheetReportExportRow } from "../../utils/reportExports";
import { buildTeamScope } from "../../utils/teamScope";

type BillableFilter = "All" | "Billable" | "Non-billable";

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekDates = (weekStart: string) => {
  const start = new Date(`${weekStart}T00:00:00`);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return formatDateInput(date);
  });
};

const monthStart = new Date();
monthStart.setDate(1);
monthStart.setHours(0, 0, 0, 0);

export const ReportsPage = ({ user }: { user: AuthUser }) => {
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(formatDateInput(monthStart));
  const [endDate, setEndDate] = useState(formatDateInput(new Date()));
  const [statusFilter, setStatusFilter] = useState<"All" | TimesheetWeekRecord["status"]>("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [billableFilter, setBillableFilter] = useState<BillableFilter>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const { employees } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const accessRoles = user.role;
  const role = normalizeUserRole(accessRoles);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      try {
        const [items, projectRecords] = await Promise.all([
          timesheetService.listWeeks(canViewOrganizationReports(accessRoles) ? undefined : user.id),
          projectService.getProjects(),
        ]);
        setRecords(items);
        setProjects(projectRecords);
      } finally {
        setLoading(false);
      }
    };

    void loadReports();
  }, [accessRoles, user.id]);

  const employeeDirectory = useMemo(() => {
    const baseEntries = employees.map((employee) => [
      employee.id,
      {
        id: employee.id,
        name: employee.fullName,
        email: employee.email,
      },
    ] as const);

    return new Map([
      ...baseEntries,
      [
        user.id,
        {
          id: user.id,
          name: user.fullName,
          email: user.email,
        },
      ] as const,
    ]);
  }, [employees, user.email, user.fullName, user.id]);

  const teamScope = useMemo(
    () => buildTeamScope({ role, employees, projects, userId: user.id }),
    [employees, projects, role, user.id],
  );

  const scopedRecords = useMemo(
    () => records.filter((record) => employeeDirectory.has(record.userId) && (role === "Team Manager" ? teamScope.employeeIds.has(record.userId) : true)),
    [records, role, teamScope.employeeIds, employeeDirectory],
  );

  const flattenedRows = useMemo<TimesheetReportExportRow[]>(() => {
    return scopedRecords.flatMap((record) => {
      const weekDates = getWeekDates(record.weekStart);
      const employee = employeeDirectory.get(record.userId) ?? {
        id: record.userId,
        name: record.userId === user.id ? user.fullName : "Unknown employee",
        email: record.userId === user.id ? user.email : "",
      };

      return record.rows
        .map((row) => {
          const dayValues = weekDates.map((date) => Number(row.hours[date] ?? 0));
          const totalHours = dayValues.reduce((sum, value) => sum + value, 0);

          return {
            weekRange: `${formatDisplayDate(record.weekStart)} - ${formatDisplayDate(record.weekEnd)}`,
            weekStart: record.weekStart,
            weekEnd: record.weekEnd,
            employeeName: employee.name,
            employeeEmail: employee.email,
            status: record.status,
            projectName: row.projectName || "Unassigned",
            taskName: row.taskName || "No task name",
            billable: row.billable ? "Billable" : "Non-billable",
            totalHours,
            monday: dayValues[0] ?? 0,
            tuesday: dayValues[1] ?? 0,
            wednesday: dayValues[2] ?? 0,
            thursday: dayValues[3] ?? 0,
            friday: dayValues[4] ?? 0,
            saturday: dayValues[5] ?? 0,
            sunday: dayValues[6] ?? 0,
            notes: row.notes || "-",
            updatedAt: new Date(record.updatedAt).toLocaleString(),
          };
        })
        .filter((row) => row.totalHours > 0 || row.taskName !== "No task name" || row.notes !== "-");
    });
  }, [employeeDirectory, scopedRecords, user.email, user.fullName, user.id]);

  const visibleRows = useMemo(() => {
    return flattenedRows.filter((row) => {
      if (startDate && row.weekStart < startDate) {
        return false;
      }

      if (endDate && row.weekEnd > endDate) {
        return false;
      }

      if (statusFilter !== "All" && row.status !== statusFilter) {
        return false;
      }

      if (employeeFilter !== "All" && row.employeeEmail !== employeeFilter) {
        return false;
      }

      if (billableFilter !== "All" && row.billable !== billableFilter) {
        return false;
      }

      if (searchTerm) {
        const query = searchTerm.trim().toLowerCase();
        const haystack = [row.employeeName, row.employeeEmail, row.projectName, row.taskName, row.notes]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [billableFilter, employeeFilter, endDate, flattenedRows, searchTerm, startDate, statusFilter]);

  const visibleHours = useMemo(() => visibleRows.reduce((sum, row) => sum + row.totalHours, 0), [visibleRows]);
  const visibleEmployees = useMemo(() => new Set(visibleRows.map((row) => row.employeeEmail || row.employeeName)).size, [visibleRows]);
  const submittedCount = useMemo(() => visibleRows.filter((row) => row.status === "Submitted").length, [visibleRows]);
  const employeeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          flattenedRows
            .filter((row) => row.employeeEmail)
            .map((row) => [row.employeeEmail, { email: row.employeeEmail, name: row.employeeName }]),
        ).values(),
      ),
    [flattenedRows],
  );

  const filtersSummary = useMemo(
    () =>
      [
        `Date: ${startDate || "Any"} to ${endDate || "Any"}`,
        `Status: ${statusFilter}`,
        `Employee: ${employeeFilter === "All" ? "All employees" : employeeFilter}`,
        `Billable: ${billableFilter}`,
        `Search: ${searchTerm.trim() || "Any"}`,
      ].join(" | "),
    [billableFilter, employeeFilter, endDate, searchTerm, startDate, statusFilter],
  );

  const exportExcel = () => {
    if (visibleRows.length === 0) {
      showToast("No filtered rows available to export.", "info");
      return;
    }

    exportTimesheetReportToExcel(visibleRows, filtersSummary);
    showToast("Filtered Excel report downloaded.", "success");
  };

  const exportPdf = () => {
    if (visibleRows.length === 0) {
      showToast("No filtered rows available to export.", "info");
      return;
    }

    exportTimesheetReportToPdf(visibleRows, filtersSummary);
    showToast("Filtered PDF report downloaded.", "success");
  };

  if (loading) {
    return <LoadingSpinner label="Loading reports..." />;
  }

  const canViewAllEmployees = canViewOrganizationReports(accessRoles);
  const pageRows = canViewAllEmployees ? visibleRows : visibleRows.filter((row) => row.employeeEmail === user.email);

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Operational Export" />

        <ReportExportActions onExportExcel={exportExcel} onExportPdf={exportPdf} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Visible Entries" value={pageRows.length} subtitle="Rows after filters" accent="bg-zinc-100 dark:bg-white/10" />
          <StatCard label="Visible Hours" value={visibleHours} subtitle="Hours in current export" accent="bg-emerald-500/20" />
          <StatCard label="Employees" value={visibleEmployees} subtitle="People included in report" accent="bg-amber-500/20" />
          <StatCard label="Submitted Rows" value={submittedCount} subtitle="Submitted status count" accent="bg-fuchsia-500/20" />
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-5 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "All" | TimesheetWeekRecord["status"])}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All statuses</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Employee</span>
              <select
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                disabled={!canViewAllEmployees}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:disabled:bg-zinc-800"
              >
                <option value="All">{canViewAllEmployees ? "All employees" : user.email}</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.email} value={employee.email}>
                    {employee.name} ({employee.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Billable</span>
              <select
                value={billableFilter}
                onChange={(event) => setBillableFilter(event.target.value as BillableFilter)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All rows</option>
                <option value="Billable">Billable</option>
                <option value="Non-billable">Non-billable</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Search</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Project, task, notes, employee"
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>
          </div>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{filtersSummary}</p>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-800">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">Filtered report preview</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">The exports use this filtered result set.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50/90 dark:bg-black/70">
                <tr>
                  {["Week", "Employee", "Status", "Project", "Task", "Billable", "Hours", "Notes", "Updated"].map((label) => (
                    <th key={label} className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pageRows.map((row, index) => (
                  <tr key={`${row.weekStart}-${row.employeeEmail}-${row.projectName}-${index}`} className="align-top transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60">
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{row.weekRange}</td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white">{row.employeeName}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{row.employeeEmail || "Local record"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          row.status === "Submitted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{row.projectName}</td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{row.taskName}</td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200">{row.billable}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{row.totalHours}h</td>
                    <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{row.notes}</td>
                    <td className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">{row.updatedAt}</td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No records match the current report filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
};

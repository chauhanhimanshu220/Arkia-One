import { useEffect, useMemo, useState } from "react";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { SsrsReportWorkspaceViewer } from "../../components/SsrsReportWorkspaceViewer";
import { ToastContainer } from "../../components/ToastContainer";
import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { projectService } from "../../services/projectService";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type { Project } from "../../types/project";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import { canViewOrganizationReports, normalizeUserRole } from "../../types/roles";
import { formatDisplayDate } from "../../utils/adminDashboard";
import type { TimesheetReportExportRow } from "../../utils/reportExports";
import {
  buildSsrsPayrollExportSnapshotDownloadUrl,
  buildSsrsPayrollExportSnapshotViewerUrl,
  createSsrsPayrollExportSnapshot,
  createSsrsPayrollExportFileName,
  getSsrsPayrollRenderFormatOption,
  resetSsrsApiBaseResolution,
  type SsrsPayrollFilterState,
  type SsrsPayrollRenderFormat,
  type SsrsPayrollSnapshotRow,
} from "../../utils/ssrsPayrollReports";
import { buildTeamScope } from "../../utils/teamScope";

type BillableFilter = "All" | "Billable" | "Non-billable";

type ReportFilterState = {
  startDate: string;
  endDate: string;
  projectFilter: string;
  statusFilter: "All" | TimesheetWeekRecord["status"];
  employeeFilter: string;
  billableFilter: BillableFilter;
  searchTerm: string;
};

type TimesheetReportSourceRow = Omit<
  TimesheetReportExportRow,
  "totalHours" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | "notes"
> & {
  projectId: string;
  weekDates: string[];
  hoursByDate: Record<string, number>;
  notesByDate: Record<string, string>;
  fallbackNotes: string;
  employeeCode: string;
  department: string;
  designation: string;
  projectCode: string;
  clientBusinessUnit: string;
};

type PayrollExportEmployee = {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  department: string;
  designation: string;
};

const parameterInputClass =
  "h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 dark:focus:ring-brand-500/20";
const primaryActionButtonClass =
  "inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-100";
const secondaryActionButtonClass =
  "inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-brand-200 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 dark:hover:bg-zinc-900";

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

const createInitialFilters = (): ReportFilterState => ({
  startDate: formatDateInput(monthStart),
  endDate: formatDateInput(new Date()),
  projectFilter: "All",
  statusFilter: "All",
  employeeFilter: "All",
  billableFilter: "All",
  searchTerm: "",
});

const serializeFilterState = (filters: ReportFilterState) => JSON.stringify(filters);

const buildFiltersSummary = (filters: ReportFilterState, projectLabel: string) =>
  [
    `Date: ${filters.startDate || "Any"} to ${filters.endDate || "Any"}`,
    `Project: ${projectLabel}`,
    `Status: ${filters.statusFilter}`,
    `Employee: ${filters.employeeFilter === "All" ? "All visible employees" : filters.employeeFilter}`,
    `Billable: ${filters.billableFilter}`,
    `Search: ${filters.searchTerm.trim() || "Any"}`,
  ].join(" | ");

export const PayrollExportPage = ({ user }: { user: AuthUser }) => {
  const initialFilters = useMemo(() => createInitialFilters(), []);
  const [records, setRecords] = useState<TimesheetWeekRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(initialFilters.startDate);
  const [endDate, setEndDate] = useState(initialFilters.endDate);
  const [projectFilter, setProjectFilter] = useState(initialFilters.projectFilter);
  const [statusFilter, setStatusFilter] = useState<"All" | TimesheetWeekRecord["status"]>(initialFilters.statusFilter);
  const [employeeFilter, setEmployeeFilter] = useState(initialFilters.employeeFilter);
  const [billableFilter, setBillableFilter] = useState<BillableFilter>(initialFilters.billableFilter);
  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilterState>(initialFilters);
  const [ssrsFormat, setSsrsFormat] = useState<SsrsPayrollRenderFormat>("PDF");
  const [isReportSectionOpen, setIsReportSectionOpen] = useState(true);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(true);
  const [viewerRevision, setViewerRevision] = useState(0);
  const [viewerSnapshotId, setViewerSnapshotId] = useState<string | null>(null);

  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();

  const accessRoles = user.role;
  const role = normalizeUserRole(accessRoles);
  const canViewAllEmployees = canViewOrganizationReports(accessRoles);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      try {
        const [items, projectRecords] = await Promise.all([
          timesheetService.listWeeks(canViewOrganizationReports(accessRoles) || normalizeUserRole(accessRoles) === "Team Manager" ? undefined : user.id),
          projectService.getProjects(),
        ]);
        setRecords(items);
        setProjects(projectRecords);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to load the payroll report data right now.", "error");
      } finally {
        setLoading(false);
      }
    };

    void loadReports();
  }, [accessRoles, showToast, user.id]);

  const employeeDirectory = useMemo(() => {
    const baseEntries = employees.map((employee) => [
      employee.id,
        {
          id: employee.id,
          employeeCode: employee.employeeCode,
          name: employee.fullName,
          email: employee.email,
          department: employee.department,
          designation: employee.designation,
        },
    ] as const);

    return new Map([
      ...baseEntries,
      [
        user.id,
        {
          id: user.id,
          employeeCode: "",
          name: user.fullName,
          email: user.email,
          department: "",
          designation: user.role,
        },
      ] as const,
    ]);
  }, [employees, user.email, user.fullName, user.id]);

  const projectDirectory = useMemo(() => new Map(projects.map((project) => [project.id, project] as const)), [projects]);

  const teamScope = useMemo(
    () => buildTeamScope({ role, employees, projects, userId: user.id }),
    [employees, projects, role, user.id],
  );

  const visibleEmployees = useMemo<PayrollExportEmployee[]>(() => {
    const activeEmployees = employees.filter((employee) => employee.status === "Active");
    const scopedEmployees = canViewAllEmployees
      ? activeEmployees
      : role === "Team Manager"
        ? activeEmployees.filter((employee) => teamScope.employeeIds.has(employee.id))
        : activeEmployees.filter((employee) => employee.id === user.id || employee.email === user.email);

    const employeeRows = scopedEmployees.map((employee) => ({
      id: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.fullName,
      email: employee.email,
      department: employee.department,
      designation: employee.designation,
    }));

    if (!employeeRows.some((employee) => employee.id === user.id || employee.email === user.email)) {
      employeeRows.push({
        id: user.id,
        employeeCode: "",
        name: user.fullName,
        email: user.email,
        department: "",
        designation: user.role,
      });
    }

    return employeeRows.sort((left, right) => left.name.localeCompare(right.name));
  }, [canViewAllEmployees, employees, role, teamScope.employeeIds, user.email, user.fullName, user.id, user.role]);

  const scopedRecords = useMemo(
    () => records.filter((record) => employeeDirectory.has(record.userId) && (role === "Team Manager" ? teamScope.employeeIds.has(record.userId) : true)),
    [employeeDirectory, records, role, teamScope.employeeIds],
  );

  const flattenedRows = useMemo<TimesheetReportSourceRow[]>(() => {
    return scopedRecords.flatMap((record) => {
      const weekDates = getWeekDates(record.weekStart);
      const employee = employeeDirectory.get(record.userId) ?? {
        id: record.userId,
        employeeCode: "",
        name: record.userId === user.id ? user.fullName : "Unknown employee",
        email: record.userId === user.id ? user.email : "",
        department: "",
        designation: "",
      };

      return record.rows
        .map((row) => {
          const hoursByDate = Object.fromEntries(weekDates.map((date) => [date, Number(row.hours[date] ?? 0)]));
          const project = projectDirectory.get(row.projectId);

          return {
            weekRange: `${formatDisplayDate(record.weekStart)} - ${formatDisplayDate(record.weekEnd)}`,
            weekStart: record.weekStart,
            weekEnd: record.weekEnd,
            employeeName: employee.name,
            employeeEmail: employee.email,
            employeeCode: employee.employeeCode,
            department: employee.department,
            designation: employee.designation,
            status: record.status,
            projectId: row.projectId,
            projectName: row.projectName || project?.name || "Unassigned",
            projectCode: project?.code ?? "",
            clientBusinessUnit: project?.clientBusinessUnit ?? "",
            taskName: row.taskName || "No task name",
            billable: row.billable ? "Billable" : "Non-billable",
            weekDates,
            hoursByDate,
            notesByDate: row.notesByDate ?? {},
            fallbackNotes: row.notes || "-",
            updatedAt: record.updatedAt,
          };
        })
        .filter(
          (row) =>
            Object.values(row.hoursByDate).some((value) => value > 0) ||
            row.taskName !== "No task name" ||
            row.fallbackNotes !== "-",
        );
    });
  }, [employeeDirectory, projectDirectory, scopedRecords, user.email, user.fullName, user.id]);

  const employeeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          visibleEmployees
            .filter((employee) => employee.email)
            .map((employee) => [employee.email, { email: employee.email, name: employee.name }]),
        ).values(),
      ),
    [visibleEmployees],
  );

  const projectOptions = useMemo(() => {
    const options = new Map<string, { id: string; label: string }>();

    flattenedRows.forEach((row) => {
      if (!row.projectId) {
        return;
      }

      const project = projectDirectory.get(row.projectId);
      const label = project
        ? `${project.code ? `${project.code} - ` : ""}${project.name}`
        : row.projectName;

      if (!options.has(row.projectId)) {
        options.set(row.projectId, { id: row.projectId, label });
      }
    });

    return Array.from(options.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [flattenedRows, projectDirectory]);

  const resolveProjectLabel = (selectedProjectId: string) => {
    if (selectedProjectId === "All") {
      return "All projects";
    }

    return (
      projectOptions.find((option) => option.id === selectedProjectId)?.label ??
      projectDirectory.get(selectedProjectId)?.name ??
      "Selected project"
    );
  };

  const accessibleEmployeeEmails = useMemo(() => {
    if (canViewAllEmployees) {
      return [] as string[];
    }

    if (role === "Team Manager") {
      return Array.from(
        new Set(
          Array.from(teamScope.employeeIds)
            .map((employeeId) => employeeDirectory.get(employeeId)?.email?.trim() ?? "")
            .filter(Boolean),
        ),
      );
    }

    return user.email ? [user.email] : [];
  }, [canViewAllEmployees, employeeDirectory, role, teamScope.employeeIds, user.email]);

  const pendingFilters: ReportFilterState = {
    startDate,
    endDate,
    projectFilter,
    statusFilter,
    employeeFilter,
    billableFilter,
    searchTerm,
  };

  const hasInvalidDateRange = Boolean(startDate && endDate && startDate > endDate);
  const hasPendingChanges = serializeFilterState(pendingFilters) !== serializeFilterState(appliedFilters);
  const appliedProjectLabel = useMemo(
    () => resolveProjectLabel(appliedFilters.projectFilter),
    [appliedFilters.projectFilter, projectDirectory, projectOptions],
  );
  const activeFiltersSummary = useMemo(
    () => buildFiltersSummary(appliedFilters, appliedProjectLabel),
    [appliedFilters, appliedProjectLabel],
  );

  const availableEntryDateRange = useMemo(() => {
    const entryDates = flattenedRows
      .flatMap((row) =>
        Object.entries(row.hoursByDate)
          .filter(([, hours]) => Number(hours) > 0)
          .map(([date]) => date),
      )
      .sort();

    if (entryDates.length === 0) {
      return null;
    }

    return {
      startDate: entryDates[0],
      endDate: entryDates[entryDates.length - 1],
    };
  }, [flattenedRows]);

  const hasEntriesInInitialRange = useMemo(
    () =>
      flattenedRows.some((row) =>
        Object.entries(row.hoursByDate).some(
          ([date, hours]) =>
            Number(hours) > 0 &&
            date >= initialFilters.startDate &&
            date <= initialFilters.endDate,
        ),
      ),
    [flattenedRows, initialFilters.endDate, initialFilters.startDate],
  );

  useEffect(() => {
    if (!availableEntryDateRange || hasEntriesInInitialRange) {
      return;
    }

    if (serializeFilterState(appliedFilters) !== serializeFilterState(initialFilters)) {
      return;
    }

    const nextFilters = {
      ...initialFilters,
      startDate: availableEntryDateRange.startDate,
      endDate: availableEntryDateRange.endDate,
    };

    setStartDate(nextFilters.startDate);
    setEndDate(nextFilters.endDate);
    setAppliedFilters(nextFilters);
    setViewerRevision((value) => value + 1);
  }, [appliedFilters, availableEntryDateRange, hasEntriesInInitialRange, initialFilters]);

  const buildSsrsFilters = (filters: ReportFilterState): SsrsPayrollFilterState => ({
    ...filters,
    projectLabel: resolveProjectLabel(filters.projectFilter),
    employeeScope: accessibleEmployeeEmails.length > 0 ? accessibleEmployeeEmails : undefined,
  });

  const snapshotRows = useMemo<SsrsPayrollSnapshotRow[]>(() => {
    const filters = appliedFilters;
    const normalizedSearch = filters.searchTerm.trim().toLowerCase();

    const actualRows = flattenedRows.flatMap((row) => {
      if (filters.projectFilter !== "All" && row.projectId !== filters.projectFilter) {
        return [];
      }

      if (filters.statusFilter !== "All" && row.status !== filters.statusFilter) {
        return [];
      }

      if (filters.employeeFilter !== "All" && row.employeeEmail !== filters.employeeFilter) {
        return [];
      }

      if (filters.billableFilter !== "All" && row.billable !== filters.billableFilter) {
        return [];
      }

      const haystack = [
        row.employeeName,
        row.employeeEmail,
        row.projectName,
        row.taskName,
        row.fallbackNotes,
        ...Object.values(row.notesByDate),
      ]
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !haystack.includes(normalizedSearch)) {
        return [];
      }

      return Object.entries(row.hoursByDate)
        .filter(([date, hours]) => Number(hours) > 0 && date >= filters.startDate && date <= filters.endDate)
        .map(([date, hours]) => ({
          employeeCode: row.employeeCode,
          employeeName: row.employeeName,
          employeeEmail: row.employeeEmail,
          department: row.department,
          designation: row.designation,
          timesheetStatus: row.status,
          weekStart: row.weekStart,
          weekEnd: row.weekEnd,
          entryDate: date,
          projectCode: row.projectCode,
          projectName: row.projectName,
          clientBusinessUnit: row.clientBusinessUnit,
          taskName: row.taskName,
          billableLabel: row.billable,
          entryHours: Number(hours),
          entryNote: row.notesByDate[date] || row.fallbackNotes || "-",
          updatedAtUtc: new Date(row.updatedAt).toISOString(),
        }));
    });

    const canShowEmptyEmployees =
      filters.projectFilter === "All" &&
      filters.statusFilter === "All" &&
      filters.billableFilter !== "Billable";

    if (!canShowEmptyEmployees) {
      return actualRows;
    }

    const matchedEmployees = new Set(actualRows.map((row) => row.employeeEmail.trim().toLowerCase() || row.employeeName.trim().toLowerCase()));
    const selectedEmployeeEmail = filters.employeeFilter === "All" ? null : filters.employeeFilter.trim().toLowerCase();
    const placeholderRows = visibleEmployees.flatMap((employee) => {
      const employeeEmail = employee.email.trim().toLowerCase();
      const employeeKey = employeeEmail || employee.name.trim().toLowerCase();

      if (!employeeKey || matchedEmployees.has(employeeKey)) {
        return [];
      }

      if (selectedEmployeeEmail && employeeEmail !== selectedEmployeeEmail) {
        return [];
      }

      const employeeHaystack = [
        employee.employeeCode,
        employee.name,
        employee.email,
        employee.department,
        employee.designation,
        "No approved timesheet found",
      ]
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !employeeHaystack.includes(normalizedSearch)) {
        return [];
      }

      return [
        {
          employeeCode: employee.employeeCode,
          employeeName: employee.name,
          employeeEmail: employee.email,
          department: employee.department,
          designation: employee.designation,
          timesheetStatus: "No timesheet",
          weekStart: filters.startDate,
          weekEnd: filters.endDate,
          entryDate: filters.startDate,
          projectCode: "",
          projectName: "No project",
          clientBusinessUnit: "",
          taskName: "No approved timesheet found",
          billableLabel: "Non-billable",
          entryHours: 0,
          entryNote: "No payroll timesheet found for the selected period.",
          updatedAtUtc: new Date().toISOString(),
        },
      ];
    });

    return [...actualRows, ...placeholderRows];
  }, [appliedFilters, flattenedRows, visibleEmployees]);

  useEffect(() => {
    let cancelled = false;

    if (!isReportSectionOpen) {
      setViewerUrl(null);
      setViewerLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadViewer = async () => {
      setViewerLoading(true);
      try {
        const ssrsFilters = buildSsrsFilters(appliedFilters);
        const snapshotId = await createSsrsPayrollExportSnapshot(ssrsFilters, snapshotRows);
        const baseUrl = await buildSsrsPayrollExportSnapshotViewerUrl(ssrsFilters, snapshotId);
        if (cancelled) {
          return;
        }

        const nextUrl = new URL(baseUrl, window.location.origin);
        nextUrl.searchParams.set("_ts", String(viewerRevision));
        setViewerSnapshotId(snapshotId);
        setViewerUrl(nextUrl.toString());
      } catch (error) {
        if (cancelled) {
          return;
        }

        resetSsrsApiBaseResolution();
        setViewerUrl(null);
        showToast(error instanceof Error ? error.message : "Unable to load the SSRS payroll viewer right now.", "error");
      } finally {
        if (!cancelled) {
          setViewerLoading(false);
        }
      }
    };

    void loadViewer();

    return () => {
      cancelled = true;
    };
  }, [accessibleEmployeeEmails, appliedFilters, isReportSectionOpen, showToast, snapshotRows, viewerRevision]);

  const launchReport = (url: string) => {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      showToast("Allow pop-ups for this site to open the SSRS report.", "error");
      return false;
    }

    reportWindow.opener = null;
    reportWindow.location.replace(url);
    return true;
  };

  const triggerDownload = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  };

  const applyViewerFilters = () => {
    if (hasInvalidDateRange) {
      showToast("Start date must be on or before end date.", "error");
      return;
    }

    setIsReportSectionOpen(true);
    setAppliedFilters({ ...pendingFilters });
    setViewerRevision((value) => value + 1);
    showToast("Payroll report parameters applied to the embedded viewer.", "success");
  };

  const closeReportSection = () => {
    setIsReportSectionOpen(false);
    showToast("Payroll report section closed.", "success");
  };

  const downloadSsrsReport = async () => {
    try {
      const ssrsFilters = buildSsrsFilters(appliedFilters);
      const formatOption = getSsrsPayrollRenderFormatOption(ssrsFormat);
      const snapshotId = viewerSnapshotId ?? (await createSsrsPayrollExportSnapshot(ssrsFilters, snapshotRows));
      const launched = triggerDownload(
        await buildSsrsPayrollExportSnapshotDownloadUrl(
          {
            ...ssrsFilters,
            format: ssrsFormat,
          },
          snapshotId,
        ),
        createSsrsPayrollExportFileName(ssrsFilters, ssrsFormat),
      );

      if (launched) {
        showToast(`${formatOption.label} download requested.`, "success");
      }
    } catch (error) {
      resetSsrsApiBaseResolution();
      showToast(error instanceof Error ? error.message : "Unable to download the payroll export right now.", "error");
    }
  };

  const openSsrsViewerInNewTab = async () => {
    try {
      const ssrsFilters = buildSsrsFilters(appliedFilters);
      const snapshotId = viewerSnapshotId ?? (await createSsrsPayrollExportSnapshot(ssrsFilters, snapshotRows));
      const launched = launchReport(viewerUrl ?? (await buildSsrsPayrollExportSnapshotViewerUrl(ssrsFilters, snapshotId)));
      if (launched) {
        showToast("SSRS payroll report opened in a new tab.", "success");
      }
    } catch (error) {
      resetSsrsApiBaseResolution();
      showToast(error instanceof Error ? error.message : "Unable to open the payroll export right now.", "error");
    }
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading payroll report workspace..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero
          title="Payroll export viewer"
          belowTitle={
            <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              D365-inspired SSRS workspace with applied parameters, embedded preview controls, download formats, print, and in-report find.
            </p>
          }
        />

        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/80">
          <div className="grid gap-5 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-end">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">From Date</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={parameterInputClass} />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">To Date</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={parameterInputClass} />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Project</span>
                <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className={parameterInputClass}>
                  <option value="All">All projects</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={applyViewerFilters}
                  disabled={hasInvalidDateRange}
                  className={primaryActionButtonClass}
                >
                  View Report
                </button>
                <button
                  type="button"
                  onClick={closeReportSection}
                  disabled={!isReportSectionOpen}
                  className={secondaryActionButtonClass}
                >
                  Clear
                </button>
              </div>
              <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                The embedded viewer updates only when you apply the parameters, just like the SSRS workflow in D365.
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-200/80 px-6 py-5 dark:border-zinc-800">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "All" | TimesheetWeekRecord["status"])}
                  className={parameterInputClass}
                >
                  <option value="All">All statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Employee</span>
                <select
                  value={employeeFilter}
                  onChange={(event) => setEmployeeFilter(event.target.value)}
                  disabled={!canViewAllEmployees && role !== "Team Manager"}
                  className={parameterInputClass}
                >
                  <option value="All">
                    {canViewAllEmployees ? "All employees" : role === "Team Manager" ? "All team members" : user.email}
                  </option>
                  {employeeOptions.map((employee) => (
                    <option key={employee.email} value={employee.email}>
                      {employee.name} ({employee.email})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Billable</span>
                <select
                  value={billableFilter}
                  onChange={(event) => setBillableFilter(event.target.value as BillableFilter)}
                  className={parameterInputClass}
                >
                  <option value="All">All rows</option>
                  <option value="Billable">Billable</option>
                  <option value="Non-billable">Non-billable</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Data Search</span>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Project, task, notes, employee"
                  className={parameterInputClass}
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="rounded-full border border-zinc-200 bg-white px-4 py-2 shadow-sm dark:border-zinc-700 dark:bg-black/60">
                {activeFiltersSummary}
              </span>
              {!isReportSectionOpen ? (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 font-medium text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-black/50 dark:text-zinc-300">
                  Report section is closed. Select View Report to open it again.
                </span>
              ) : hasPendingChanges ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 font-medium text-amber-700 shadow-sm">
                  Pending parameter changes are waiting to be applied.
                </span>
              ) : (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 font-medium text-emerald-700 shadow-sm">
                  Viewer is using the current parameter set.
                </span>
              )}
            </div>

            {hasInvalidDateRange ? (
              <p className="mt-3 text-sm font-medium text-rose-600">Start date must be on or before end date.</p>
            ) : null}
          </div>

          {isReportSectionOpen ? (
            <SsrsReportWorkspaceViewer
              integrated
              viewerUrl={viewerUrl}
              viewerLoading={viewerLoading}
              hasPendingChanges={hasPendingChanges}
              ssrsFormat={ssrsFormat}
              onSsrsFormatChange={setSsrsFormat}
              onRefresh={() => setViewerRevision((value) => value + 1)}
              onDownload={() => {
                void downloadSsrsReport();
              }}
              onOpenInNewTab={() => {
                void openSsrsViewerInNewTab();
              }}
            />
          ) : null}
        </section>
      </section>
    </>
  );
};

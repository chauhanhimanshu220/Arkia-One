import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer } from "../../components/ToastContainer";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { leaveService } from "../../services/leaveService";
import type { AuthUser } from "../../types/auth";
import type { LeaveRequest, LeaveTypeDefinition } from "../../types/leave";
import type { Project } from "../../types/project";
import { normalizeUserRole } from "../../types/roles";
import { projectService } from "../../services/projectService";
import { buildTeamScope } from "../../utils/teamScope";

interface PublicHoliday {
  date: string;
  name: string;
}

interface CalendarLeaveEvent {
  id: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  styles: LeaveTypeTheme;
}

interface CalendarDayEntries {
  holidays: PublicHoliday[];
  leaves: CalendarLeaveEvent[];
}

interface LeaveTypeTheme {
  chip: string;
  dot: string;
  accent: string;
}

const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const today = new Date();
today.setHours(0, 0, 0, 0);

const leaveTypeThemes: Record<string, LeaveTypeTheme> = {
  "Casual Leave": {
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    dot: "bg-zinc-100 dark:bg-white/10",
    accent: "text-zinc-700 dark:text-sky-200",
  },
  "Sick Leave": {
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    dot: "bg-emerald-500",
    accent: "text-emerald-700 dark:text-emerald-200",
  },
  "Earned Leave": {
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
    dot: "bg-violet-500",
    accent: "text-violet-700 dark:text-violet-200",
  },
  "Unpaid Leave": {
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    dot: "bg-amber-500",
    accent: "text-amber-700 dark:text-amber-200",
  },
  "Work From Home": {
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    dot: "bg-rose-500",
    accent: "text-rose-700 dark:text-rose-200",
  },
};

const defaultTheme: LeaveTypeTheme = {
  chip: "bg-brand-50 text-zinc-700 dark:bg-brand-500/15 dark:text-zinc-300",
  dot: "bg-brand-500",
  accent: "text-zinc-700 dark:text-zinc-300",
};

const getPublicHolidaysForYear = (year: number): PublicHoliday[] => [
  { date: `${year}-01-01`, name: "New Year" },
  { date: `${year}-01-26`, name: "Republic Day" },
  { date: `${year}-04-14`, name: "Ambedkar Jayanti" },
  { date: `${year}-05-01`, name: "Labour Day" },
  { date: `${year}-08-15`, name: "Independence Day" },
  { date: `${year}-10-02`, name: "Gandhi Jayanti" },
  { date: `${year}-12-25`, name: "Christmas" },
];

const getDateOnly = (value: Date | string) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const toIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return getDateOnly(next);
};

const addMonths = (value: Date, months: number) => {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
};

const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);
const endOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth() + 1, 0);

const startOfWeek = (value: Date) => {
  const normalized = getDateOnly(value);
  const day = normalized.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(normalized, offset);
};

const endOfWeek = (value: Date) => addDays(startOfWeek(value), 6);

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

const isWithinRange = (target: Date, start: Date, end: Date) => target >= start && target <= end;

const formatMonthLabel = (value: Date) =>
  value.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

const formatFullDate = (value: Date | string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatShortDate = (value: Date | string) =>
  getDateOnly(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });

const getFirstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

export const TeamCalendarPage = ({ user }: { user: AuthUser }) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(today));
  const [selectedDateIso, setSelectedDateIso] = useState(() => toIsoDate(today));
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("All");
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDefinition[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const role = normalizeUserRole(user.role);

  const selectedYear = selectedMonth.getFullYear();

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);

      try {
        const [types, requests, projectRecords] = await Promise.all([
          leaveService.getLeaveTypes(),
          leaveService.getLeaves({ year: selectedYear }),
          projectService.getProjects(),
        ]);

        if (!active) {
          return;
        }

        setLeaveTypes(types.filter((leaveType) => leaveType.active));
        setLeaveRequests(requests);
        setProjects(projectRecords);
      } catch {
        if (active) {
          showToast("Unable to load the shared leave calendar right now.", "error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [selectedYear, showToast]);

  const employeeProfile = useMemo(() => employees.find((employee) => employee.id === user.id), [employees, user.id]);
  const visibleDepartment = employeeProfile?.department ?? "Operations";
  const teamScope = useMemo(
    () => buildTeamScope({ role, employees, projects, userId: user.id, includeSelf: role !== "Team Manager" }),
    [employees, projects, role, user.id],
  );

  const visibleEmployees = useMemo(() => {
    if (role === "Team Manager") {
      return teamScope.employees;
    }

    if (role === "HR Manager" || role === "System Admin") {
      return employees.filter((employee) => employee.status === "Active");
    }

    return employees.filter((employee) => employee.status === "Active" && employee.department === visibleDepartment);
  }, [employees, role, teamScope.employees, visibleDepartment]);

  const visibleEmployeeIds = useMemo(() => new Set(visibleEmployees.map((employee) => employee.id)), [visibleEmployees]);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const holidayCalendar = useMemo(() => getPublicHolidaysForYear(selectedYear), [selectedYear]);

  const leaveTypeOptions = useMemo(() => {
    return Array.from(
      new Set(
        leaveTypes
          .map((leaveType) => leaveType.name)
          .concat(leaveRequests.map((leaveRequest) => leaveRequest.type)),
      ),
    ).sort((left, right) => left.localeCompare(right));
  }, [leaveRequests, leaveTypes]);

  const approvedTeamLeaves = useMemo(() => {
    return leaveRequests
      .filter((leaveRequest) => leaveRequest.status === "Approved")
      .filter((leaveRequest) => visibleEmployeeIds.has(leaveRequest.employeeId))
      .filter((leaveRequest) => selectedLeaveType === "All" || leaveRequest.type === selectedLeaveType)
      .map<CalendarLeaveEvent>((leaveRequest) => ({
        id: leaveRequest.id,
        employeeName: leaveRequest.employeeName,
        leaveType: leaveRequest.type,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        days: leaveRequest.days,
        reason: leaveRequest.reason,
        styles: leaveTypeThemes[leaveRequest.type] ?? defaultTheme,
      }));
  }, [leaveRequests, selectedLeaveType, visibleEmployeeIds]);

  const selectedMonthLeaves = useMemo(() => {
    return approvedTeamLeaves.filter((leaveRequest) => {
      const startDate = getDateOnly(leaveRequest.startDate);
      const endDate = getDateOnly(leaveRequest.endDate);
      return endDate >= monthStart && startDate <= monthEnd;
    });
  }, [approvedTeamLeaves, monthEnd, monthStart]);

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    let cursor = gridStart;

    while (cursor <= gridEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }

    return days;
  }, [gridEnd, gridStart]);

  const entriesByDay = useMemo(() => {
    const entries = new Map<string, CalendarDayEntries>();

    calendarDays.forEach((day) => {
      entries.set(toIsoDate(day), { holidays: [], leaves: [] });
    });

    holidayCalendar.forEach((holiday) => {
      const holidayDate = getDateOnly(holiday.date);
      const holidayKey = toIsoDate(holidayDate);
      if (entries.has(holidayKey)) {
        entries.get(holidayKey)?.holidays.push(holiday);
      }
    });

    selectedMonthLeaves.forEach((leaveRequest) => {
      let cursor = getDateOnly(leaveRequest.startDate);
      const endDate = getDateOnly(leaveRequest.endDate);

      while (cursor <= endDate) {
        const key = toIsoDate(cursor);
        if (entries.has(key)) {
          entries.get(key)?.leaves.push(leaveRequest);
        }
        cursor = addDays(cursor, 1);
      }
    });

    return entries;
  }, [calendarDays, holidayCalendar, selectedMonthLeaves]);

  useEffect(() => {
    const preferredDate = selectedMonth.getFullYear() === today.getFullYear() && selectedMonth.getMonth() === today.getMonth() ? today : monthStart;
    setSelectedDateIso(toIsoDate(preferredDate));
  }, [monthStart, selectedMonth]);

  const selectedDate = getDateOnly(selectedDateIso);
  const selectedDayEntries = entriesByDay.get(selectedDateIso) ?? { holidays: [], leaves: [] };

  const todaysLeave = useMemo(
    () =>
      approvedTeamLeaves.filter((leaveRequest) => {
        const startDate = getDateOnly(leaveRequest.startDate);
        const endDate = getDateOnly(leaveRequest.endDate);
        return isWithinRange(today, startDate, endDate);
      }),
    [approvedTeamLeaves],
  );

  const upcomingLeaves = useMemo(() => {
    const anchorDate = monthStart > today ? monthStart : today;
    return selectedMonthLeaves
      .filter((leaveRequest) => getDateOnly(leaveRequest.endDate) >= anchorDate)
      .sort((left, right) => getDateOnly(left.startDate).getTime() - getDateOnly(right.startDate).getTime())
      .slice(0, 6);
  }, [monthStart, selectedMonthLeaves]);

  const conflictAlerts = useMemo(() => {
    const conflicts: Array<{ date: string; count: number; names: string[] }> = [];

    calendarDays.forEach((day) => {
      if (day.getMonth() !== selectedMonth.getMonth()) {
        return;
      }

      const dayKey = toIsoDate(day);
      const dayEntries = entriesByDay.get(dayKey);
      if (!dayEntries || dayEntries.leaves.length < 2) {
        return;
      }

      conflicts.push({
        date: dayKey,
        count: dayEntries.leaves.length,
        names: dayEntries.leaves.map((leaveRequest) => getFirstName(leaveRequest.employeeName)),
      });
    });

    return conflicts.sort((left, right) => right.count - left.count).slice(0, 5);
  }, [calendarDays, entriesByDay, selectedMonth]);

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading team calendar..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Team calendar">
          <WorkspaceHeroMeta
            primary={role === "Team Manager" ? teamScope.label : `${visibleDepartment} team`}
            secondary={`${visibleEmployees.length} teammate(s)`}
          />
          <WorkspaceHeroMeta
            primary={`${selectedMonthLeaves.length} booking(s)`}
            secondary={`${conflictAlerts.length} overlap day(s) · ${formatMonthLabel(selectedMonth)}`}
          />
        </WorkspacePageHero>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Month View</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Approved leave and public holidays are plotted date by date so the team can avoid conflicts.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-black">
                    <button
                      type="button"
                      onClick={() => setSelectedMonth((current) => addMonths(current, -1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      <Icon name="chevron-down" className="h-4 w-4 rotate-90" />
                    </button>
                    <div className="min-w-40 px-4 text-center text-sm font-semibold text-zinc-900 dark:text-white">{formatMonthLabel(selectedMonth)}</div>
                    <button
                      type="button"
                      onClick={() => setSelectedMonth((current) => addMonths(current, 1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      <Icon name="chevron-down" className="h-4 w-4 -rotate-90" />
                    </button>
                  </div>

                  <label className="space-y-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    <span className="sr-only">Leave type</span>
                    <select
                      value={selectedLeaveType}
                      onChange={(event) => setSelectedLeaveType(event.target.value)}
                      className="h-12 min-w-48 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-zinc-700 dark:bg-black dark:text-zinc-100 dark:focus:ring-brand-500/40"
                    >
                      <option value="All">All leave types</option>
                      {leaveTypeOptions.map((leaveType) => (
                        <option key={leaveType} value={leaveType}>
                          {leaveType}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-7 gap-2">
                {weekDayLabels.map((label) => (
                  <div key={label} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                    {label}
                  </div>
                ))}

                {calendarDays.map((day) => {
                  const dayKey = toIsoDate(day);
                  const entries = entriesByDay.get(dayKey) ?? { holidays: [], leaves: [] };
                  const isCurrentMonth = day.getMonth() === selectedMonth.getMonth();
                  const isSelected = selectedDateIso === dayKey;
                  const isToday = isSameDay(day, today);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => setSelectedDateIso(dayKey)}
                      className={`min-h-36 rounded-[1.5rem] border p-3 text-left transition ${
                        isSelected
                          ? "border-brand-400 bg-brand-50/70 shadow-sm dark:border-brand-500 dark:bg-brand-500/10"
                          : "border-zinc-200 bg-zinc-50/70 hover:bg-white dark:border-zinc-800 dark:bg-black/60 dark:hover:bg-zinc-950"
                      } ${!isCurrentMonth ? "opacity-50" : ""} ${isWeekend ? "ring-1 ring-inset ring-zinc-100 dark:ring-zinc-900" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                            isToday
                              ? "bg-black text-white dark:text-black dark:bg-white dark:text-black"
                              : "bg-white text-zinc-700 dark:bg-black dark:text-zinc-200"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {entries.holidays.length > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                            Holiday
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 space-y-2">
                        {entries.holidays.slice(0, 1).map((holiday) => (
                          <div
                            key={holiday.name}
                            className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                          >
                            {holiday.name}
                          </div>
                        ))}

                        {entries.leaves.slice(0, 2).map((leaveRequest) => (
                          <div
                            key={`${leaveRequest.id}-${dayKey}`}
                            className={`rounded-xl px-2.5 py-2 text-xs font-medium ${leaveRequest.styles.chip}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${leaveRequest.styles.dot}`} />
                              <span>{getFirstName(leaveRequest.employeeName)}</span>
                            </div>
                            <p className="mt-1 truncate">{leaveRequest.leaveType}</p>
                          </div>
                        ))}

                        {entries.leaves.length > 2 ? (
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">+{entries.leaves.length - 2} more</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Selected Day</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{formatFullDate(selectedDate)}</p>

              {selectedDayEntries.holidays.length === 0 && selectedDayEntries.leaves.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  No approved leave or public holiday is scheduled on this date.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedDayEntries.holidays.map((holiday) => (
                    <div
                      key={holiday.name}
                      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                      <p className="font-semibold">{holiday.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em]">Public Holiday</p>
                    </div>
                  ))}

                  {selectedDayEntries.leaves.map((leaveRequest) => (
                    <div key={`${leaveRequest.id}-details`} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">{leaveRequest.employeeName}</p>
                          <p className={`mt-1 text-sm font-medium ${leaveRequest.styles.accent}`}>{leaveRequest.leaveType}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${leaveRequest.styles.chip}`}>Approved</span>
                      </div>
                      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                        {formatShortDate(leaveRequest.startDate)} to {formatShortDate(leaveRequest.endDate)} · {leaveRequest.days} day(s)
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{leaveRequest.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Today's Leave</p>
              {todaysLeave.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {todaysLeave.map((leaveRequest) => (
                    <div key={`today-${leaveRequest.id}`} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <p className="font-semibold text-zinc-900 dark:text-white">{leaveRequest.employeeName}</p>
                      <p className={`mt-1 text-sm font-medium ${leaveRequest.styles.accent}`}>{leaveRequest.leaveType}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No one in your visible team is on approved leave today.</p>
              )}
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Upcoming Approved Leave</p>
              {upcomingLeaves.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {upcomingLeaves.map((leaveRequest) => (
                    <div key={`upcoming-${leaveRequest.id}`} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">{leaveRequest.employeeName}</p>
                          <p className={`mt-1 text-sm font-medium ${leaveRequest.styles.accent}`}>{leaveRequest.leaveType}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${leaveRequest.styles.chip}`}>{leaveRequest.days} day(s)</span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {formatFullDate(leaveRequest.startDate)} to {formatFullDate(leaveRequest.endDate)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No approved leave is lined up for the rest of this month.</p>
              )}
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Conflict Alerts</p>
              {conflictAlerts.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {conflictAlerts.map((alert) => (
                    <div key={alert.date} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <p className="font-semibold text-amber-800 dark:text-amber-200">{formatFullDate(alert.date)}</p>
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-200">
                        {alert.count} teammate(s) are off: {alert.names.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No high-overlap leave days are detected for this month.</p>
              )}
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Quick Actions</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/admin/leave/request"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
                >
                  Request Leave
                </Link>
                <Link
                  to="/admin/leave/history"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  My Leave History
                </Link>
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  );
};

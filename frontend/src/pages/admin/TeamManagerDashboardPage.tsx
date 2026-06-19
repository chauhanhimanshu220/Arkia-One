import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../../types/auth";
import type { Employee } from "../../types/employee";
import type { LeaveRequest } from "../../types/leave";
import type { DailyTimesheet } from "../../types/task";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import { useEmployees } from "../../hooks/useEmployees";
import { useProjects } from "../../hooks/useProjects";
import { leaveService } from "../../services/leaveService";
import { taskService } from "../../services/taskService";
import { timesheetService } from "../../services/timesheetService";
import { DashboardPage } from "./DashboardPage";
import { EmployeeInsightsModal } from "../../components/dashboard/EmployeeInsightsModal";
import { buildEmployeeInsights } from "../../utils/adminDashboard";

/**
 * Team Manager Dashboard Page
 * 
 * Specifically designed for Team Managers to monitor their direct reports,
 * track team-wide productivity, and manage approvals.
 */
export const TeamManagerDashboardPage = ({
  user,
  title = "Team Manager Dashboard",
}: {
  user: AuthUser;
  title?: string;
}) => {
  const { employees, loading: employeesLoading, reload: reloadEmployees } = useEmployees();
  const { projects, loading: projectsLoading, reload: reloadProjects } = useProjects();
  const [allTimesheets, setAllTimesheets] = useState<DailyTimesheet[]>([]);
  const [weeklyTimesheets, setWeeklyTimesheets] = useState<TimesheetWeekRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loadingTimesheets, setLoadingTimesheets] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const loadData = async () => {
    setLoadingTimesheets(true);
    try {
      const [dailyRecords, weekRecords, leaveRecords] = await Promise.all([
        taskService.listDailyTimesheets(),
        timesheetService.listWeeks(),
        leaveService.getLeaves(),
      ]);
      setAllTimesheets(dailyRecords);
      setWeeklyTimesheets(weekRecords);
      setLeaveRequests(leaveRecords);
      setLastSyncedAt(new Date().toISOString());
    } finally {
      setLoadingTimesheets(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleUpdateLogStatus = async (employeeId: string, logId: string, status: string) => {
    const record = allTimesheets.find(s => s.id === logId);
    if (!record) return;

    try {
      await taskService.updateDailyTimesheet(logId, {
        userId: record.userId,
        date: record.date,
        status: status,
        entries: record.entries.map(e => ({
          taskId: e.taskId,
          hours: e.hours,
          workDescription: e.workDescription
        }))
      });
      await loadData();
    } catch {
      console.error("Failed to update status");
    }
  };

  const insights = useMemo(() => buildEmployeeInsights(employees, projects, allTimesheets), [employees, projects, allTimesheets]);
  
  const selectedInsight = useMemo(() => 
    selectedEmployee ? insights.find(i => i.employee.id === selectedEmployee.id) || null : null
  , [selectedEmployee, insights]);

  return (
    <>
      <EmployeeInsightsModal
        open={!!selectedEmployee}
        insight={selectedInsight}
        viewer={user}
        onClose={() => setSelectedEmployee(null)}
        onUpdateLogStatus={(empId, logId, status) => void handleUpdateLogStatus(empId, logId, status)}
      />
      <DashboardPage
        user={user}
        title={title}
        employees={employees}
        projects={projects}
        dailyTimesheets={allTimesheets}
        weeklyTimesheets={weeklyTimesheets}
        leaves={leaveRequests}
        loading={employeesLoading || projectsLoading || loadingTimesheets}
        lastSyncedAt={lastSyncedAt}
        onRefresh={() => {
          void Promise.all([reloadEmployees(), reloadProjects(), loadData()]);
        }}
        onOpenEmployeeInsights={setSelectedEmployee}
      />
    </>
  );
};

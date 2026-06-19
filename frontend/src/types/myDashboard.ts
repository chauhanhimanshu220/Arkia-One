export interface MyDashboardKpis {
  hoursLogged: number;
  draftEntries: number;
  pendingApprovals: number;
  rejectedEntries: number;
  leaveBalance: number;
  completedApprovalActions: number;
}

export interface MyDashboardHoursPoint {
  label: string;
  expectedHours: number;
  actualHours: number;
}

export interface MyDashboardTimesheetStatus {
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
  resubmitted: number;
}

export type MyDashboardTaskSeverity = "high" | "medium" | "low";

export interface MyDashboardApprovalTask {
  id: string;
  type: "timesheet" | "leave" | "overdue" | "escalated";
  title: string;
  subtitle: string;
  count: number;
  severity: MyDashboardTaskSeverity;
  actionUrl: string;
}

export interface MyDashboardRecentActivity {
  id: string;
  category: "timesheet" | "approval" | "leave" | "activity";
  title: string;
  description: string;
  timestamp: string;
  actionUrl: string;
}

export interface MyDashboardProjectHours {
  projectName: string;
  hours: number;
}

export interface MyDashboardLeaveTypeBalance {
  leaveType: string;
  allocation: number;
  used: number;
  balance: number;
}

export interface MyDashboardLeaveSummary {
  totalBalance: number;
  used: number;
  pending: number;
  upcoming: string | null;
  byType: MyDashboardLeaveTypeBalance[];
}

export interface MyDashboardMeta {
  rangeLabel: string;
  lastUpdatedAt: string | null;
  focusNote: string;
}

export interface MyDashboardData {
  kpis: MyDashboardKpis;
  previousKpis: MyDashboardKpis;
  weeklyHours: MyDashboardHoursPoint[];
  timesheetStatus: MyDashboardTimesheetStatus;
  approvalTasks: MyDashboardApprovalTask[];
  recentActivities: MyDashboardRecentActivity[];
  projectHours: MyDashboardProjectHours[];
  leaveSummary: MyDashboardLeaveSummary;
  meta: MyDashboardMeta;
}

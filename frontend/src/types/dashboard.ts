export interface DashboardSummary {
  pendingFinanceApprovals: number;
  payrollReadyTimesheets: number;
  approvedBillableHours: number;
  approvedNonBillableHours: number;
  estimatedPayrollHours: number;
  overtimeHours: number;
  estimatedPayrollCost: number;
  billingReadyHours: number;
  employeesNotSubmitted: number;
  billableUtilizationPercent: number;
  blockedTimesheets: number;
}

export interface ApprovalStatusData {
  submitted: number;
  financePending: number;
  financeApproved: number;
  rejected: number;
  returned: number;
  payrollExported: number;
}

export interface BillableTrendData {
  label: string;
  billableHours: number;
  nonBillableHours: number;
}

export interface PayrollReadinessData {
  label: string;
  ready: number;
  pending: number;
  blocked: number;
  exported: number;
}

export interface CostTrendData {
  label: string;
  estimatedPayrollCost: number;
}

export interface DepartmentHoursData {
  departmentName: string;
  approvedHours: number;
}

export interface ProjectBillableData {
  projectName: string;
  approvedHours: number;
  billableHours: number;
  estimatedPayrollCost: number;
}

export interface ComplianceData {
  totalEmployeesExpected: number;
  submittedOnTime: number;
  lateSubmitted: number;
  missing: number;
  rejectedForCorrection: number;
}

export type AlertSeverity = "high" | "medium" | "low";

export interface FinanceAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  count: number;
  severity: AlertSeverity;
  actionUrl: string;
  actionLabel: string;
}

export interface FinanceRecord {
  id: string;
  employeeName: string;
  department: string;
  project: string;
  period: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  approvalStatus: string;
  payrollStatus: string;
  billingStatus: string;
  overtimeHours: number;
  lastUpdated: string;
}

export interface DashboardFilterOptions {
  departments: string[];
  projects: string[];
  statuses: string[];
}

export interface DashboardMeta {
  rangeLabel: string;
  workflowModel: string;
  costModel: string;
  usesEstimatedCosts: boolean;
}

export interface DashboardData {
  summary: DashboardSummary;
  approvalStatus: ApprovalStatusData;
  billableTrend: BillableTrendData[];
  payrollReadiness: PayrollReadinessData[];
  costTrend: CostTrendData[];
  departmentHours: DepartmentHoursData[];
  projectBillable: ProjectBillableData[];
  compliance: ComplianceData;
  alerts: FinanceAlert[];
  records: FinanceRecord[];
  filters: DashboardFilterOptions;
  meta: DashboardMeta;
}

export interface SystemDashboardKpis {
  totalEmployees: number;
  activeUsers: number;
  pendingApprovals: number;
  missingTimesheets: number;
  openLeaveRequests: number;
  payrollReadyCount: number;
}

export interface SystemDashboardTrendPoint {
  label: string;
  draft: number;
  submitted: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  resubmitted: number;
}

export interface SystemDashboardApprovalStage {
  id: string;
  label: string;
  count: number;
  subtitle: string;
}

export interface SystemDashboardApprovalAgingBucket {
  bucket: string;
  count: number;
}

export interface SystemDashboardApprovalSummary {
  stages: SystemDashboardApprovalStage[];
  aging: SystemDashboardApprovalAgingBucket[];
  blockedApprovals: number;
  stuckApprovals: number;
}

export interface SystemDashboardDepartmentUtilisation {
  department: string;
  utilisation: number;
  loggedHours: number;
  expectedHours: number;
  missingEmployees: number;
}

export interface SystemDashboardProjectHours {
  project: string;
  hours: number;
  billableHours: number;
  nonBillableHours: number;
}

export interface SystemDashboardLeaveTrendPoint {
  label: string;
  requested: number;
  approved: number;
  rejected: number;
}

export interface SystemDashboardLeaveSummary {
  peopleOnLeaveToday: number;
  pendingRequests: number;
  highestDepartment: string;
  risingBy: number;
}

export interface SystemDashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  count: number;
  actionUrl: string;
  actionLabel: string;
}

export interface SystemDashboardActivityItem {
  id: string;
  category: string;
  title: string;
  description: string;
  timestamp: string;
  actionUrl: string;
}

export interface SystemDashboardMeta {
  rangeLabel: string;
  lastUpdatedAt: string | null;
  commandNote: string;
  dataSources: string[];
}

export interface SystemDashboardData {
  kpis: SystemDashboardKpis;
  previousKpis: SystemDashboardKpis;
  timesheetTrend: SystemDashboardTrendPoint[];
  approvalSummary: SystemDashboardApprovalSummary;
  departmentUtilisation: SystemDashboardDepartmentUtilisation[];
  projectHours: SystemDashboardProjectHours[];
  leaveTrend: SystemDashboardLeaveTrendPoint[];
  leaveSummary: SystemDashboardLeaveSummary;
  alerts: SystemDashboardAlert[];
  recentActivities: SystemDashboardActivityItem[];
  meta: SystemDashboardMeta;
}

export interface PersonalDashboardSummary {
  pendingFinanceApprovals: number;
  readyForPayrollReview: number;
  returnedForCorrection: number;
  missingTimesheetCases: number;
  completedActionsToday: number;
  urgentExceptions: number;
}

export interface PersonalDashboardActionItem {
  id: string;
  employeeName: string;
  department: string;
  period: string;
  issueType: string;
  priority: string;
  ageLabel: string;
  totalHours: number;
  approvalStatus: string;
  payrollStatus: string;
  actionUrl: string;
  actionLabel: string;
}

export interface PersonalDashboardQueueStatus {
  pendingApprovals: number;
  readyForPayrollReview: number;
  returnedForCorrection: number;
  missingSubmissions: number;
}

export interface PersonalDashboardDelayedDepartment {
  departmentName: string;
  openItems: number;
}

export interface PersonalDashboardActivity {
  id: string;
  employeeName: string;
  department: string;
  period: string;
  totalHours: number;
  status: string;
  activityLabel: string;
  lastUpdated: string;
  actionUrl: string;
}

export interface PersonalDashboardCharts {
  queueStatus: PersonalDashboardQueueStatus;
  billableTrend: BillableTrendData[];
  payrollReadiness: PayrollReadinessData[];
  delayedDepartments: PersonalDashboardDelayedDepartment[];
}

export interface PersonalDashboardData {
  summary: PersonalDashboardSummary;
  actionQueue: PersonalDashboardActionItem[];
  alerts: FinanceAlert[];
  charts: PersonalDashboardCharts;
  recentActivity: PersonalDashboardActivity[];
  meta: DashboardMeta;
}

export type DateRange = "today" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

export interface DateRangeFilter {
  range: DateRange;
  startDate?: string;
  endDate?: string;
  department?: string;
  project?: string;
  status?: string;
  userId?: string;
}

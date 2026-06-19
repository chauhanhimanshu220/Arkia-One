import { apiRequest } from "./http";
import type {
  ApprovalStatusData,
  BillableTrendData,
  ComplianceData,
  CostTrendData,
  DashboardData,
  DashboardSummary,
  DateRange,
  DateRangeFilter,
  DepartmentHoursData,
  FinanceAlert,
  FinanceRecord,
  PersonalDashboardActionItem,
  PersonalDashboardCharts,
  PersonalDashboardData,
  PersonalDashboardSummary,
  PayrollReadinessData,
  ProjectBillableData,
} from "../types/dashboard";

type DashboardQuery = DateRange | DateRangeFilter;

const buildDashboardQuery = (filter: DashboardQuery = "this_month") => {
  const normalizedFilter = typeof filter === "string" ? { range: filter } : filter;
  const params = new URLSearchParams({
    range: normalizedFilter.range,
  });

  if (normalizedFilter.range === "custom") {
    if (normalizedFilter.startDate) {
      params.set("startDate", normalizedFilter.startDate);
    }

    if (normalizedFilter.endDate) {
      params.set("endDate", normalizedFilter.endDate);
    }
  }

  if (normalizedFilter.department?.trim()) {
    params.set("department", normalizedFilter.department.trim());
  }

  if (normalizedFilter.project?.trim()) {
    params.set("project", normalizedFilter.project.trim());
  }

  if (normalizedFilter.status?.trim()) {
    params.set("status", normalizedFilter.status.trim());
  }

  if (normalizedFilter.userId?.trim()) {
    params.set("userId", normalizedFilter.userId.trim());
  }

  return params.toString();
};

export class DashboardService {
  static async getDashboardData(filter: DashboardQuery = "this_month"): Promise<DashboardData> {
    return apiRequest<DashboardData>(`/finance/dashboard?${buildDashboardQuery(filter)}`);
  }

  static async getDashboardSummary(filter: DashboardQuery = "this_month"): Promise<DashboardSummary> {
    return apiRequest<DashboardSummary>(`/finance/dashboard/summary?${buildDashboardQuery(filter)}`);
  }

  static async getApprovalStatus(filter: DashboardQuery = "this_month"): Promise<ApprovalStatusData> {
    return apiRequest<ApprovalStatusData>(`/finance/dashboard/approval-status?${buildDashboardQuery(filter)}`);
  }

  static async getBillableTrend(filter: DashboardQuery = "this_month"): Promise<BillableTrendData[]> {
    return apiRequest<BillableTrendData[]>(`/finance/dashboard/billable-trend?${buildDashboardQuery(filter)}`);
  }

  static async getPayrollReadiness(filter: DashboardQuery = "this_month"): Promise<PayrollReadinessData[]> {
    return apiRequest<PayrollReadinessData[]>(`/finance/dashboard/payroll-readiness?${buildDashboardQuery(filter)}`);
  }

  static async getCostTrend(filter: DashboardQuery = "this_month"): Promise<CostTrendData[]> {
    return apiRequest<CostTrendData[]>(`/finance/dashboard/cost-trend?${buildDashboardQuery(filter)}`);
  }

  static async getDepartmentHours(filter: DashboardQuery = "this_month"): Promise<DepartmentHoursData[]> {
    return apiRequest<DepartmentHoursData[]>(`/finance/dashboard/department-hours?${buildDashboardQuery(filter)}`);
  }

  static async getProjectBillable(filter: DashboardQuery = "this_month"): Promise<ProjectBillableData[]> {
    return apiRequest<ProjectBillableData[]>(`/finance/dashboard/project-billable?${buildDashboardQuery(filter)}`);
  }

  static async getCompliance(filter: DashboardQuery = "this_month"): Promise<ComplianceData> {
    return apiRequest<ComplianceData>(`/finance/dashboard/compliance?${buildDashboardQuery(filter)}`);
  }

  static async getAlerts(filter: DashboardQuery = "this_month"): Promise<FinanceAlert[]> {
    return apiRequest<FinanceAlert[]>(`/finance/dashboard/alerts?${buildDashboardQuery(filter)}`);
  }

  static async getRecords(filter: DashboardQuery = "this_month"): Promise<FinanceRecord[]> {
    return apiRequest<FinanceRecord[]>(`/finance/dashboard/records?${buildDashboardQuery(filter)}`);
  }

  static async getPersonalDashboardData(filter: DashboardQuery = "this_week"): Promise<PersonalDashboardData> {
    return apiRequest<PersonalDashboardData>(`/finance/personal-dashboard?${buildDashboardQuery(filter)}`);
  }

  static async getPersonalDashboardSummary(filter: DashboardQuery = "this_week"): Promise<PersonalDashboardSummary> {
    return apiRequest<PersonalDashboardSummary>(`/finance/personal-dashboard/summary?${buildDashboardQuery(filter)}`);
  }

  static async getPersonalActionQueue(filter: DashboardQuery = "this_week"): Promise<PersonalDashboardActionItem[]> {
    return apiRequest<PersonalDashboardActionItem[]>(`/finance/personal-dashboard/action-queue?${buildDashboardQuery(filter)}`);
  }

  static async getPersonalDashboardAlerts(filter: DashboardQuery = "this_week"): Promise<FinanceAlert[]> {
    return apiRequest<FinanceAlert[]>(`/finance/personal-dashboard/alerts?${buildDashboardQuery(filter)}`);
  }

  static async getPersonalDashboardCharts(filter: DashboardQuery = "this_week"): Promise<PersonalDashboardCharts> {
    return apiRequest<PersonalDashboardCharts>(`/finance/personal-dashboard/charts?${buildDashboardQuery(filter)}`);
  }
}

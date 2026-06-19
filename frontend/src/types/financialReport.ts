import type { DateRange } from "./dashboard";

export type FinancialReportType =
  | "revenue"
  | "expenses"
  | "profit-loss"
  | "project-cost-analysis"
  | "employee-cost";

export interface FinancialReportSummary {
  totalRevenue: number;
  totalExpense: number;
  grossProfit: number;
  marginPercent: number;
  billableHours: number;
  nonBillableHours: number;
  recordCount: number;
}

export interface FinancialReportTrendPoint {
  label: string;
  revenue: number;
  expense: number;
  profit: number;
  hours: number;
}

export interface FinancialReportBreakdown {
  label: string;
  revenue: number;
  expense: number;
  profit: number;
  hours: number;
  marginPercent: number;
}

export interface FinancialReportRow {
  id: string;
  employeeName: string;
  department: string;
  project: string;
  period: string;
  status: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  revenue: number;
  expense: number;
  profit: number;
  marginPercent: number;
  lastUpdated: string;
}

export interface FinancialReportFilters {
  departments: string[];
  projects: string[];
  statuses: string[];
}

export interface FinancialReportMeta {
  reportType: FinancialReportType;
  title: string;
  rangeLabel: string;
  revenueModel: string;
  expenseModel: string;
  usesEstimatedFinancials: boolean;
}

export interface FinancialReportData {
  summary: FinancialReportSummary;
  trend: FinancialReportTrendPoint[];
  projectBreakdown: FinancialReportBreakdown[];
  employeeBreakdown: FinancialReportBreakdown[];
  departmentBreakdown: FinancialReportBreakdown[];
  rows: FinancialReportRow[];
  filters: FinancialReportFilters;
  meta: FinancialReportMeta;
}

export interface FinancialReportQuery {
  range: DateRange;
  startDate?: string;
  endDate?: string;
  department?: string;
  project?: string;
  status?: string;
}

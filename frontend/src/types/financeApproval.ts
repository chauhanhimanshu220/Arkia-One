import type { DateRange } from "./dashboard";

export type FinanceApprovalType = "payroll" | "expenses" | "billing";

export interface FinanceApprovalSummary {
  totalItems: number;
  pendingItems: number;
  approvedItems: number;
  returnedItems: number;
  highPriorityItems: number;
  totalHours: number;
  billableHours: number;
  totalAmount: number;
}

export interface FinanceApprovalItem {
  id: string;
  referenceNo: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  project: string;
  period: string;
  rawStatus: string;
  status: string;
  payrollStatus: string;
  billingStatus: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  overtimeHours: number;
  amount: number;
  priority: string;
  ageLabel: string;
  lastUpdated: string;
  recommendedAction: string;
}

export interface FinanceApprovalFilters {
  departments: string[];
  projects: string[];
  statuses: string[];
}

export interface FinanceApprovalMeta {
  approvalType: FinanceApprovalType;
  title: string;
  rangeLabel: string;
  dataModel: string;
  usesEstimatedFinancials: boolean;
}

export interface FinanceApprovalQueue {
  summary: FinanceApprovalSummary;
  items: FinanceApprovalItem[];
  filters: FinanceApprovalFilters;
  meta: FinanceApprovalMeta;
}

export interface FinanceApprovalQuery {
  range: DateRange;
  startDate?: string;
  endDate?: string;
  department?: string;
  project?: string;
  status?: string;
}

import { apiRequest } from "./http";
import type { FinanceApprovalQuery, FinanceApprovalQueue, FinanceApprovalType } from "../types/financeApproval";

const buildApprovalQuery = (filter: FinanceApprovalQuery) => {
  const params = new URLSearchParams({ range: filter.range });

  if (filter.range === "custom") {
    if (filter.startDate) params.set("startDate", filter.startDate);
    if (filter.endDate) params.set("endDate", filter.endDate);
  }

  if (filter.department?.trim()) params.set("department", filter.department.trim());
  if (filter.project?.trim()) params.set("project", filter.project.trim());
  if (filter.status?.trim()) params.set("status", filter.status.trim());

  return params.toString();
};

export class FinanceApprovalService {
  static async getQueue(approvalType: FinanceApprovalType, filter: FinanceApprovalQuery): Promise<FinanceApprovalQueue> {
    return apiRequest<FinanceApprovalQueue>(`/finance/approvals/${approvalType}?${buildApprovalQuery(filter)}`);
  }
}

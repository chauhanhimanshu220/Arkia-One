import { apiRequest } from "./http";
import type { FinancialReportData, FinancialReportQuery, FinancialReportType } from "../types/financialReport";

const buildReportQuery = (filter: FinancialReportQuery) => {
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

export class FinancialReportService {
  static async getReport(reportType: FinancialReportType, filter: FinancialReportQuery): Promise<FinancialReportData> {
    return apiRequest<FinancialReportData>(`/finance/reports/${reportType}?${buildReportQuery(filter)}`);
  }
}

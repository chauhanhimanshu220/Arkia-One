namespace AbhiTimesheet.Api.Contracts.FinanceReports;

public sealed record FinanceReportSummaryDto(
    decimal TotalRevenue,
    decimal TotalExpense,
    decimal GrossProfit,
    double MarginPercent,
    double BillableHours,
    double NonBillableHours,
    int RecordCount
);

public sealed record FinanceReportTrendPointDto(
    string Label,
    decimal Revenue,
    decimal Expense,
    decimal Profit,
    double Hours
);

public sealed record FinanceReportBreakdownDto(
    string Label,
    decimal Revenue,
    decimal Expense,
    decimal Profit,
    double Hours,
    double MarginPercent
);

public sealed record FinanceReportRowDto(
    string Id,
    string EmployeeName,
    string Department,
    string Project,
    string Period,
    string Status,
    double TotalHours,
    double BillableHours,
    double NonBillableHours,
    decimal Revenue,
    decimal Expense,
    decimal Profit,
    double MarginPercent,
    string LastUpdated
);

public sealed record FinanceReportFilterOptionsDto(
    IReadOnlyList<string> Departments,
    IReadOnlyList<string> Projects,
    IReadOnlyList<string> Statuses
);

public sealed record FinanceReportMetaDto(
    string ReportType,
    string Title,
    string RangeLabel,
    string RevenueModel,
    string ExpenseModel,
    bool UsesEstimatedFinancials
);

public sealed record FinanceReportDto(
    FinanceReportSummaryDto Summary,
    IReadOnlyList<FinanceReportTrendPointDto> Trend,
    IReadOnlyList<FinanceReportBreakdownDto> ProjectBreakdown,
    IReadOnlyList<FinanceReportBreakdownDto> EmployeeBreakdown,
    IReadOnlyList<FinanceReportBreakdownDto> DepartmentBreakdown,
    IReadOnlyList<FinanceReportRowDto> Rows,
    FinanceReportFilterOptionsDto Filters,
    FinanceReportMetaDto Meta
);

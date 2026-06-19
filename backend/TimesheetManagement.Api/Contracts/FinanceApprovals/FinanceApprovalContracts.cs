namespace AbhiTimesheet.Api.Contracts.FinanceApprovals;

public sealed record FinanceApprovalSummaryDto(
    int TotalItems,
    int PendingItems,
    int ApprovedItems,
    int ReturnedItems,
    int HighPriorityItems,
    double TotalHours,
    double BillableHours,
    decimal TotalAmount
);

public sealed record FinanceApprovalItemDto(
    string Id,
    string ReferenceNo,
    string EmployeeName,
    string EmployeeCode,
    string Department,
    string Project,
    string Period,
    string RawStatus,
    string Status,
    string PayrollStatus,
    string BillingStatus,
    double TotalHours,
    double BillableHours,
    double NonBillableHours,
    double OvertimeHours,
    decimal Amount,
    string Priority,
    string AgeLabel,
    string LastUpdated,
    string RecommendedAction
);

public sealed record FinanceApprovalFiltersDto(
    IReadOnlyList<string> Departments,
    IReadOnlyList<string> Projects,
    IReadOnlyList<string> Statuses
);

public sealed record FinanceApprovalMetaDto(
    string ApprovalType,
    string Title,
    string RangeLabel,
    string DataModel,
    bool UsesEstimatedFinancials
);

public sealed record FinanceApprovalQueueDto(
    FinanceApprovalSummaryDto Summary,
    IReadOnlyList<FinanceApprovalItemDto> Items,
    FinanceApprovalFiltersDto Filters,
    FinanceApprovalMetaDto Meta
);

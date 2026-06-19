namespace AbhiTimesheet.Api.Contracts.Dashboard;

public sealed record DashboardSummaryDto(
    int PendingFinanceApprovals,
    int PayrollReadyTimesheets,
    double ApprovedBillableHours,
    double ApprovedNonBillableHours,
    double EstimatedPayrollHours,
    double OvertimeHours,
    decimal EstimatedPayrollCost,
    double BillingReadyHours,
    int EmployeesNotSubmitted,
    double BillableUtilizationPercent,
    int BlockedTimesheets
);

public sealed record ApprovalStatusDto(
    int Submitted,
    int FinancePending,
    int FinanceApproved,
    int Rejected,
    int Returned,
    int PayrollExported
);

public sealed record BillableTrendDto(
    string Label,
    double BillableHours,
    double NonBillableHours
);

public sealed record PayrollReadinessDto(
    string Label,
    int Ready,
    int Pending,
    int Blocked,
    int Exported
);

public sealed record CostTrendDto(
    string Label,
    decimal EstimatedPayrollCost
);

public sealed record DepartmentHoursDto(
    string DepartmentName,
    double ApprovedHours
);

public sealed record ProjectBillableDto(
    string ProjectName,
    double ApprovedHours,
    double BillableHours,
    decimal EstimatedPayrollCost
);

public sealed record ComplianceDto(
    int TotalEmployeesExpected,
    int SubmittedOnTime,
    int LateSubmitted,
    int Missing,
    int RejectedForCorrection
);

public sealed record AlertDto(
    string Id,
    string Type,
    string Title,
    string Description,
    int Count,
    string Severity,
    string ActionUrl,
    string ActionLabel
);

public sealed record FinanceRecordDto(
    string Id,
    string EmployeeName,
    string Department,
    string Project,
    string Period,
    double TotalHours,
    double BillableHours,
    double NonBillableHours,
    string ApprovalStatus,
    string PayrollStatus,
    string BillingStatus,
    double OvertimeHours,
    string LastUpdated
);

public sealed record FilterOptionsDto(
    IReadOnlyList<string> Departments,
    IReadOnlyList<string> Projects,
    IReadOnlyList<string> Statuses
);

public sealed record DashboardMetaDto(
    string RangeLabel,
    string WorkflowModel,
    string CostModel,
    bool UsesEstimatedCosts
);

public sealed record DashboardDataDto(
    DashboardSummaryDto Summary,
    ApprovalStatusDto ApprovalStatus,
    IReadOnlyList<BillableTrendDto> BillableTrend,
    IReadOnlyList<PayrollReadinessDto> PayrollReadiness,
    IReadOnlyList<CostTrendDto> CostTrend,
    IReadOnlyList<DepartmentHoursDto> DepartmentHours,
    IReadOnlyList<ProjectBillableDto> ProjectBillable,
    ComplianceDto Compliance,
    IReadOnlyList<AlertDto> Alerts,
    IReadOnlyList<FinanceRecordDto> Records,
    FilterOptionsDto Filters,
    DashboardMetaDto Meta
);

public sealed record PersonalDashboardSummaryDto(
    int PendingFinanceApprovals,
    int ReadyForPayrollReview,
    int ReturnedForCorrection,
    int MissingTimesheetCases,
    int CompletedActionsToday,
    int UrgentExceptions
);

public sealed record PersonalDashboardActionItemDto(
    string Id,
    string EmployeeName,
    string Department,
    string Period,
    string IssueType,
    string Priority,
    string AgeLabel,
    double TotalHours,
    string ApprovalStatus,
    string PayrollStatus,
    string ActionUrl,
    string ActionLabel
);

public sealed record PersonalDashboardQueueStatusDto(
    int PendingApprovals,
    int ReadyForPayrollReview,
    int ReturnedForCorrection,
    int MissingSubmissions
);

public sealed record PersonalDashboardDelayedDepartmentDto(
    string DepartmentName,
    int OpenItems
);

public sealed record PersonalDashboardActivityDto(
    string Id,
    string EmployeeName,
    string Department,
    string Period,
    double TotalHours,
    string Status,
    string ActivityLabel,
    string LastUpdated,
    string ActionUrl
);

public sealed record PersonalDashboardChartsDto(
    PersonalDashboardQueueStatusDto QueueStatus,
    IReadOnlyList<BillableTrendDto> BillableTrend,
    IReadOnlyList<PayrollReadinessDto> PayrollReadiness,
    IReadOnlyList<PersonalDashboardDelayedDepartmentDto> DelayedDepartments
);

public sealed record PersonalDashboardDataDto(
    PersonalDashboardSummaryDto Summary,
    IReadOnlyList<PersonalDashboardActionItemDto> ActionQueue,
    IReadOnlyList<AlertDto> Alerts,
    PersonalDashboardChartsDto Charts,
    IReadOnlyList<PersonalDashboardActivityDto> RecentActivity,
    DashboardMetaDto Meta
);

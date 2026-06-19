namespace AbhiTimesheet.Api.Contracts.Timesheets;

public sealed record WeeklyTimesheetSaveRequest(
    string UserId,
    string AdminId,
    string AdminName,
    string WeekStart,
    string Status,
    string? ManagerApprovalStatus,
    string? AdminApprovalStatus,
    string? ApprovedBy,
    string? ApprovalFlowType,
    double TotalHours,
    string RowsJson);

public sealed record WeeklyTimesheetDto(
    string Id,
    string UserId,
    string AdminId,
    string AdminName,
    string WeekStart,
    string WeekEnd,
    string Status,
    string ManagerApprovalStatus,
    string AdminApprovalStatus,
    string ApprovedBy,
    string ApprovalFlowType,
    double TotalHours,
    string RowsJson,
    string UpdatedAtUtc);

public sealed record HistoricalWeeklyTimesheetApplyRequest(
    string UserId,
    string WeekStart,
    string RowsJson);

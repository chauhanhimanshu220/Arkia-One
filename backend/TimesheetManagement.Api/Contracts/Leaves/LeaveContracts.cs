namespace AbhiTimesheet.Api.Contracts.Leaves;

public sealed record LeaveTypeDto(
    string Id,
    string Name,
    int AnnualAllocation,
    bool Paid,
    bool ApprovalRequired,
    bool Active,
    string Description);

public sealed record LeaveRequestDto(
    string EmployeeId,
    string EmployeeName,
    string Department,
    string AdminId,
    string AdminName,
    string Type,
    string StartDate,
    string EndDate,
    int Days,
    string Reason,
    string Status,
    string? ManagerApprovalStatus = null,
    string? HRApprovalStatus = null,
    string? AdminApprovalStatus = null,
    string? ApprovalFlowType = null,
    string? ApprovedBy = null);

public sealed record LeaveDto(
    string Id,
    string EmployeeId,
    string EmployeeName,
    string Department,
    string AdminId,
    string AdminName,
    string Type,
    string StartDate,
    string EndDate,
    int Days,
    string Reason,
    string Status,
    string ManagerApprovalStatus,
    string HRApprovalStatus,
    string AdminApprovalStatus,
    string? ApprovedBy,
    string? ApprovalFlowType,
    string CreatedAt);

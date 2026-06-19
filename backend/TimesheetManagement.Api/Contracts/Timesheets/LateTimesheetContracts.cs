namespace AbhiTimesheet.Api.Contracts.Timesheets;

public sealed record LateTimesheetRequestItemInput(
    string Date,
    string ProjectId,
    string TaskId);

public sealed record LateTimesheetCreateRequest(
    string UserId,
    IReadOnlyList<LateTimesheetRequestItemInput> Items,
    string Reason,
    string AdditionalRemarks);

public sealed record LateTimesheetDecisionRequest(
    string Decision,
    string DecisionNote);

public sealed record LateTimesheetTaskOptionDto(
    string TaskId,
    string TaskTitle,
    string Status,
    string StartDate,
    string EndDate);

public sealed record LateTimesheetProjectOptionDto(
    string ProjectId,
    string ProjectName,
    string ManagerId,
    string ManagerName,
    IReadOnlyList<LateTimesheetTaskOptionDto> Tasks);

public sealed record LateTimesheetDateOptionDto(
    string Date,
    IReadOnlyList<LateTimesheetProjectOptionDto> Projects);

public sealed record LateTimesheetEligibleDateDto(
    string Date,
    int ProjectCount,
    int TaskCount);

public sealed record LateTimesheetRequestItemDto(
    string Id,
    string Date,
    string ProjectId,
    string ProjectName,
    string TaskId,
    string TaskTitle,
    string ManagerId,
    string ManagerName,
    string Status,
    string DecisionNote,
    string? DecisionAtUtc,
    string? UnlockExpiresAtUtc,
    string? LastUsedAtUtc);

public sealed record LateTimesheetRequestDto(
    string Id,
    string UserId,
    string UserName,
    string OverallStatus,
    string Reason,
    string AdditionalRemarks,
    string CreatedAtUtc,
    string UpdatedAtUtc,
    IReadOnlyList<LateTimesheetRequestItemDto> Items);

public sealed record LateTimesheetAccessItemDto(
    string RequestId,
    string RequestItemId,
    string Date,
    string ProjectId,
    string ProjectName,
    string TaskId,
    string TaskTitle,
    string ManagerId,
    string ManagerName,
    string UnlockExpiresAtUtc);

public sealed record LateTimesheetAccessDto(
    string WeekStart,
    string WeekEnd,
    IReadOnlyList<LateTimesheetAccessItemDto> Items);

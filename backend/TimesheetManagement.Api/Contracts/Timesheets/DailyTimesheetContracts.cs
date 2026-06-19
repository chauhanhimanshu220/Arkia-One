namespace AbhiTimesheet.Api.Contracts.Timesheets;

public sealed record DailyTimesheetEntryRequest(
    string TaskId,
    double Hours,
    string WorkDescription);

public sealed record DailyTimesheetSaveRequest(
    string UserId,
    string Date,
    string Status,
    IReadOnlyList<DailyTimesheetEntryRequest> Entries);

public sealed record DailyTimesheetEntryDto(
    string Id,
    string TaskId,
    string TaskTitle,
    double Hours,
    string WorkDescription);

public sealed record DailyTimesheetDto(
    string Id,
    string UserId,
    string Date,
    string Status,
    double TotalHours,
    IReadOnlyList<DailyTimesheetEntryDto> Entries);

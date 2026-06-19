namespace AbhiTimesheet.Api.Models;

public sealed class DailyTimesheetEntryEntity
{
    public Guid Id { get; set; }
    public Guid DailyTimesheetId { get; set; }
    public Guid TaskId { get; set; }
    public string TaskTitle { get; set; } = string.Empty;
    public double Hours { get; set; }
    public string WorkDescription { get; set; } = string.Empty;
    public DailyTimesheetEntity DailyTimesheet { get; set; } = null!;
}

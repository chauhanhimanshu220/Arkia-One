namespace AbhiTimesheet.Api.Models;

public sealed class DailyTimesheetEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public string Status { get; set; } = string.Empty;
    public double TotalHours { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public ICollection<DailyTimesheetEntryEntity> Entries { get; set; } = new List<DailyTimesheetEntryEntity>();
}

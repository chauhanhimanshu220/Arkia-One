namespace AbhiTimesheet.Api.Models;

public sealed class LateTimesheetRequestItemEntity
{
    public Guid Id { get; set; }
    public Guid RequestId { get; set; }
    public DateOnly EntryDate { get; set; }
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public Guid TaskId { get; set; }
    public string TaskTitle { get; set; } = string.Empty;
    public Guid ManagerId { get; set; }
    public string ManagerName { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string DecisionNote { get; set; } = string.Empty;
    public DateTime? DecisionAtUtc { get; set; }
    public DateTime? UnlockExpiresAtUtc { get; set; }
    public DateTime? LastUsedAtUtc { get; set; }
    public LateTimesheetRequestEntity Request { get; set; } = null!;
}

namespace AbhiTimesheet.Api.Models;

public sealed class LateTimesheetRequestEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string AdditionalRemarks { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public ICollection<LateTimesheetRequestItemEntity> Items { get; set; } = new List<LateTimesheetRequestItemEntity>();
}

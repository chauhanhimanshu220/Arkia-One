namespace AbhiTimesheet.Api.Models;

public sealed class AccountAuditLogEntity
{
    public Guid Id { get; set; }
    public Guid SubjectUserId { get; set; }
    public Guid ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}

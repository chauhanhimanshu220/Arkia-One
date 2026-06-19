namespace AbhiTimesheet.Api.Models;

public sealed class ChatPresenceEntity
{
    public Guid UserId { get; set; }
    public string PresenceStatus { get; set; } = "Offline";
    public Guid? ActiveThreadId { get; set; }
    public bool IsTyping { get; set; }
    public DateTime LastSeenAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

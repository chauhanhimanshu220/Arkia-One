namespace AbhiTimesheet.Api.Models;

public sealed class ChatParticipantEntity
{
    public Guid Id { get; set; }
    public Guid ChatThreadId { get; set; }
    public Guid UserId { get; set; }
    public string RoleInThread { get; set; } = string.Empty;
    public DateTime JoinedAtUtc { get; set; }
    public bool IsMuted { get; set; }
    public bool IsPinned { get; set; }
    public Guid? LastSeenMessageId { get; set; }
    public DateTime? LastSeenAtUtc { get; set; }
    public bool IsActive { get; set; }

    public ChatThreadEntity? ChatThread { get; set; }
}

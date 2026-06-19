namespace AbhiTimesheet.Api.Models;

public sealed class ChatMessageEntity
{
    public Guid Id { get; set; }
    public Guid ChatThreadId { get; set; }
    public Guid? SenderUserId { get; set; }
    public string MessageType { get; set; } = string.Empty;
    public string MessageText { get; set; } = string.Empty;
    public string MessageStatus { get; set; } = "Sent";
    public Guid? ReplyToMessageId { get; set; }
    public Guid? ForwardedFromMessageId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? EditedAtUtc { get; set; }
    public DateTime? DeliveredAtUtc { get; set; }
    public DateTime? SeenAtUtc { get; set; }
    public bool IsPinned { get; set; }
    public Guid? PinnedByUserId { get; set; }
    public DateTime? PinnedAtUtc { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public Guid? DeletedByUserId { get; set; }
    public bool IsDeleted { get; set; }

    public ChatThreadEntity? ChatThread { get; set; }
    public ICollection<ChatAttachmentEntity> Attachments { get; set; } = [];
    public ICollection<ChatReactionEntity> Reactions { get; set; } = [];
}

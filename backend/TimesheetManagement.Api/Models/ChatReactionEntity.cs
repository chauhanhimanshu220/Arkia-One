namespace AbhiTimesheet.Api.Models;

public sealed class ChatReactionEntity
{
    public Guid Id { get; set; }
    public Guid ChatMessageId { get; set; }
    public Guid UserId { get; set; }
    public string Emoji { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }

    public ChatMessageEntity? Message { get; set; }
}

namespace AbhiTimesheet.Api.Models;

public sealed class ChatThreadEntity
{
    public Guid Id { get; set; }
    public string ThreadType { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Guid? ProjectId { get; set; }
    public string? DepartmentName { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public bool IsActive { get; set; }
    public bool IsArchived { get; set; }
    public string? PhotoUrl { get; set; }
    public string? Description { get; set; }
    public string PermissionsJson { get; set; } = "[]";
    public Guid? ArchivedByUserId { get; set; }
    public DateTime? ArchivedAtUtc { get; set; }

    public ICollection<ChatParticipantEntity> Participants { get; set; } = [];
    public ICollection<ChatMessageEntity> Messages { get; set; } = [];
}

namespace AbhiTimesheet.Api.Models;

public sealed class ChatAttachmentEntity
{
    public Guid Id { get; set; }
    public Guid? ChatMessageId { get; set; }
    public Guid UploadedByUserId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public string PublicUrl { get; set; } = string.Empty;
    public string AttachmentType { get; set; } = "File";
    public string ScanStatus { get; set; } = "Pending";
    public string? PreviewUrl { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public ChatMessageEntity? Message { get; set; }
}

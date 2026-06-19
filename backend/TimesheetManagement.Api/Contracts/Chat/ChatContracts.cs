namespace AbhiTimesheet.Api.Contracts.Chat;

public sealed record ChatParticipantDto(
    string UserId,
    string FullName,
    string Role,
    string Department,
    string? ProfilePhotoUrl,
    string RoleInThread,
    bool IsCurrentUser);

public sealed record ChatMessageDto(
    string Id,
    string ThreadId,
    string? SenderUserId,
    string SenderName,
    string SenderRole,
    string? SenderProfilePhotoUrl,
    string MessageType,
    string MessageText,
    string MessageStatus,
    string? ReplyToMessageId,
    string? ReplyPreviewText,
    string? ForwardedFromMessageId,
    string CreatedAtUtc,
    string? EditedAtUtc,
    string? DeliveredAtUtc,
    string? SeenAtUtc,
    bool IsPinned,
    IReadOnlyList<ChatAttachmentDto> Attachments,
    IReadOnlyList<ChatReactionSummaryDto> Reactions,
    IReadOnlyList<string> Mentions,
    bool IsOwnMessage);

public sealed record ChatAttachmentDto(
    string Id,
    string FileName,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    string PublicUrl,
    string AttachmentType,
    string ScanStatus,
    string? PreviewUrl,
    string CreatedAtUtc);

public sealed record ChatReactionSummaryDto(
    string Emoji,
    int Count,
    bool ReactedByCurrentUser);

public sealed record ChatThreadDto(
    string Id,
    string ThreadType,
    string Name,
    string? Description,
    string? ProjectId,
    string? DepartmentName,
    string? PhotoUrl,
    int ParticipantCount,
    int UnreadCount,
    bool IsPinned,
    bool IsMuted,
    string? LastMessageId,
    string? LastMessageText,
    string? LastMessageType,
    string? LastMessageSenderName,
    string? LastMessageAtUtc,
    IReadOnlyList<ChatParticipantDto> Participants);

public sealed record ChatContactDto(
    string UserId,
    string FullName,
    string Role,
    string Department,
    string? ProfilePhotoUrl,
    string ContextLabel);

public sealed record ChatContactDirectoryDto(
    IReadOnlyList<ChatContactDto> ProjectMembers,
    IReadOnlyList<ChatContactDto> TeamMembers,
    IReadOnlyList<ChatContactDto> HierarchyMembers,
    IReadOnlyList<ChatContactDto> SupportMembers,
    IReadOnlyList<ChatContactDto> DirectoryMembers);

public sealed record CreateDirectChatRequest(string UserId);

public sealed record CreateChatGroupRequest(
    string Name,
    string ThreadType,
    string? Description,
    IReadOnlyList<string> ParticipantUserIds);

public sealed record SendChatMessageRequest(
    string ThreadId,
    string MessageText,
    string? MessageType,
    string? ReplyToMessageId = null,
    IReadOnlyList<string>? AttachmentIds = null,
    string? ForwardedFromMessageId = null);

public sealed record UpdateChatMessageRequest(string MessageText);

public sealed record ChatReactionRequest(string Emoji);

public sealed record UpdateThreadRequest(
    string? Name,
    string? Description,
    string? PhotoUrl);

public sealed record UpdateThreadParticipantRequest(
    string UserId,
    string? RoleInThread);

public sealed record ChatPresenceDto(
    string UserId,
    string PresenceStatus,
    string? ActiveThreadId,
    bool IsTyping,
    string LastSeenAtUtc);

public sealed record UpdatePresenceRequest(
    string PresenceStatus,
    string? ActiveThreadId,
    bool IsTyping);

public sealed record ChatNotificationPreferencesDto(
    bool BrowserNotificationsEnabled,
    bool SoundEnabled,
    bool EmailNotificationsEnabled,
    bool MentionNotificationsEnabled,
    bool OfflineNotificationsEnabled);

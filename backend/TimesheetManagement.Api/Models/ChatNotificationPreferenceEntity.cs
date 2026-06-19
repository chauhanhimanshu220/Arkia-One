namespace AbhiTimesheet.Api.Models;

public sealed class ChatNotificationPreferenceEntity
{
    public Guid UserId { get; set; }
    public bool BrowserNotificationsEnabled { get; set; } = true;
    public bool SoundEnabled { get; set; } = true;
    public bool EmailNotificationsEnabled { get; set; } = false;
    public bool MentionNotificationsEnabled { get; set; } = true;
    public bool OfflineNotificationsEnabled { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; }
}

namespace AbhiTimesheet.Api.Models;

public sealed class PasswordChangeRequestEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Designation { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string CurrentPasswordHashSnapshot { get; set; } = string.Empty;
    public string CurrentPasswordSaltSnapshot { get; set; } = string.Empty;
    public string? PendingPasswordHash { get; set; }
    public string? PendingPasswordSalt { get; set; }
    public string? OtpHash { get; set; }
    public string? OtpSalt { get; set; }
    public DateTime? OtpExpiresAtUtc { get; set; }
    public int OtpAttemptCount { get; set; }
    public DateTime? OtpVerifiedAtUtc { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public string ReviewedByName { get; set; } = string.Empty;
    public string DecisionNote { get; set; } = string.Empty;
    public DateTime? DecisionAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

using System;

namespace AbhiTimesheet.Api.Models;

public sealed class LicenseOwnerEntity
{
    public Guid Id { get; set; }
    public string WorkspaceId { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string PasswordSalt { get; set; } = string.Empty;
    public string SubscriptionPlan { get; set; } = string.Empty;
    public string SubscriptionStatus { get; set; } = string.Empty;
    public int SeatLimit { get; set; }
    public int CurrentUsage { get; set; }
    public DateTime RenewalDate { get; set; }
    public DateTime CreatedAt { get; set; }
}

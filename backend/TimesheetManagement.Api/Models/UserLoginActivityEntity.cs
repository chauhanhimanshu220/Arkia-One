namespace AbhiTimesheet.Api.Models;

public sealed class UserLoginActivityEntity
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string AttemptedEmail { get; set; } = string.Empty;
    public DateTime LoginTime { get; set; }
    public DateTime? LogoutTime { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? Accuracy { get; set; }
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public string Browser { get; set; } = string.Empty;
    public string OperatingSystem { get; set; } = string.Empty;
    public string DeviceType { get; set; } = string.Empty;
    public string LoginStatus { get; set; } = string.Empty;
    public string FailureReason { get; set; } = string.Empty;
    public bool IsSuspicious { get; set; }
    public DateTime CreatedAt { get; set; }
}

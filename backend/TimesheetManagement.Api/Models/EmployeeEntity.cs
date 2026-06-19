namespace AbhiTimesheet.Api.Models;

public sealed class EmployeeEntity
{
    public Guid Id { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string MobileNumber { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string RolesJson { get; set; } = "[]";
    public string Department { get; set; } = string.Empty;
    public string Designation { get; set; } = string.Empty;
    public Guid? ReportingManagerId { get; set; }
    public string BusinessUnit { get; set; } = string.Empty;
    public string WorkLocation { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string UserType { get; set; } = string.Empty;
    public string? ProfilePhotoUrl { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public string PasswordSalt { get; set; } = string.Empty;
    public DateTime? PasswordChangedAtUtc { get; set; }
    public string WorkspaceId { get; set; } = "wrk_default";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public Guid? UpdatedBy { get; set; }
}

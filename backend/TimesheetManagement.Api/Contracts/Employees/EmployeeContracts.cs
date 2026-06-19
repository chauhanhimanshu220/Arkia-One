namespace AbhiTimesheet.Api.Contracts.Employees;

public sealed record EmployeeRequest(
    string? EmployeeCode,
    string? UserId,
    string FullName,
    string Email,
    string MobileNumber,
    string DateOfBirth,
    string Gender,
    string? Role,
    IReadOnlyList<string>? Roles,
    string Department,
    string Designation,
    string? ReportingManagerId,
    string BusinessUnit,
    string WorkLocation,
    string Status,
    string UserType,
    string? Password,
    string? ProfilePhotoDataUrl,
    bool RemoveProfilePhoto);

public sealed record EmployeeDto(
    string Id,
    string EmployeeCode,
    string UserId,
    string FullName,
    string Email,
    string MobileNumber,
    string DateOfBirth,
    string Gender,
    string Role,
    IReadOnlyList<string> Roles,
    string Department,
    string Designation,
    string? ReportingManagerId,
    string? ReportingManagerName,
    string BusinessUnit,
    string WorkLocation,
    string Status,
    string UserType,
    string? ProfilePhotoUrl,
    string CreatedAt);

public sealed record EmployeeCreateResultDto(
    EmployeeDto Employee,
    EmployeeWelcomeEmailStatusDto WelcomeEmail);

public sealed record EmployeeWelcomeEmailStatusDto(
    bool WasSent,
    string Message);

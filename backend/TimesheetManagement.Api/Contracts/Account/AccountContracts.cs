using System;

namespace AbhiTimesheet.Api.Contracts.Account;

public sealed record MyProfileDto(
    string Id,
    string FullName,
    string EmployeeCode,
    string Email,
    string MobileNumber,
    string? DateOfBirth,
    string Gender,
    string? ProfilePhotoUrl,
    string Department,
    string Designation,
    string? ReportingManagerId,
    string? ReportingManagerName,
    string BusinessUnit,
    string WorkLocation,
    string OrganizationName,
    string Role,
    IReadOnlyList<string> Roles,
    string Status,
    string? PasswordChangedAtUtc,
    string UpdatedAtUtc);

public sealed record UpdateMyProfileRequest(
    string FullName,
    string? MobileNumber,
    string? DateOfBirth,
    string Gender);

public sealed record ChangeMyPasswordRequest(
    string CurrentPassword,
    string NewPassword,
    string ConfirmPassword);

public sealed record VerifyPasswordChangeOtpRequest(
    string RequestId,
    string Otp);

public sealed record PasswordChangeOtpChallengeDto(
    string RequestId,
    string MaskedEmail,
    string ExpiresAtUtc,
    string Message);

public sealed record PasswordChangeRequestDto(
    string Id,
    string UserId,
    string UserName,
    string UserEmail,
    string Department,
    string Designation,
    string Status,
    string RequestedAtUtc,
    string UpdatedAtUtc,
    string? OtpExpiresAtUtc,
    string? OtpVerifiedAtUtc,
    string? DecisionAtUtc,
    string? DecisionNote,
    string? ReviewedByUserId,
    string? ReviewedByName);

using System.Net;
using AbhiTimesheet.Api.Contracts.Account;
using AbhiTimesheet.Api.Common;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AbhiTimesheet.Api.Services;

public sealed class PasswordChangeRequestService(
    AppDbContext dbContext,
    IMemoryCache memoryCache,
    IEmailSender emailSender,
    IWebHostEnvironment environment,
    ILogger<PasswordChangeRequestService> logger)
{
    private const int PasswordChangeAttemptLimit = 5;
    private const int OtpAttemptLimit = 5;
    private static readonly TimeSpan PasswordChangeWindow = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(10);

    public async Task<PasswordChangeOtpChallengeDto> InitiateAsync(
        EmployeeEntity employee,
        ChangeMyPasswordRequest request,
        string ipAddress,
        string userAgent,
        CancellationToken cancellationToken)
    {
        var currentPassword = request.CurrentPassword?.Trim() ?? string.Empty;
        var newPassword = request.NewPassword?.Trim() ?? string.Empty;
        var confirmPassword = request.ConfirmPassword?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(currentPassword))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "Current password is required.");
        }

        if (string.IsNullOrWhiteSpace(newPassword))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "New password is required.");
        }

        if (string.IsNullOrWhiteSpace(confirmPassword))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "Confirm password is required.");
        }

        if (!string.Equals(newPassword, confirmPassword, StringComparison.Ordinal))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "New password and confirm password do not match.");
        }

        var passwordPolicyError = GetPasswordPolicyError(newPassword);
        if (passwordPolicyError is not null)
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, passwordPolicyError);
        }

        if (string.Equals(currentPassword, newPassword, StringComparison.Ordinal))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "New password cannot be the same as current password.");
        }

        if (string.IsNullOrWhiteSpace(employee.Email))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "Your account does not have a registered email address for OTP verification.");
        }

        if (!TryConsumePasswordChangeAttempt(employee.Id))
        {
            throw new PasswordChangeWorkflowException(
                StatusCodes.Status429TooManyRequests,
                $"Too many password change attempts. Please wait {(int)PasswordChangeWindow.TotalMinutes} minutes and try again.");
        }

        if (!PasswordHasher.VerifyPassword(currentPassword, employee.PasswordHash, employee.PasswordSalt))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status401Unauthorized, "Current password is incorrect.");
        }

        var now = DateTime.UtcNow;
        await ExpireStaleOtpRequestsAsync(employee.Id, now, cancellationToken);

        var replaceableRequests = await dbContext.PasswordChangeRequests
            .Where(item =>
                item.UserId == employee.Id &&
                (item.Status == PasswordChangeRequestStatusCatalog.OtpPending ||
                 item.Status == PasswordChangeRequestStatusCatalog.PendingHrApproval))
            .ToListAsync(cancellationToken);

        foreach (var existingRequest in replaceableRequests)
        {
            CancelRequest(
                existingRequest,
                now,
                existingRequest.Status == PasswordChangeRequestStatusCatalog.PendingHrApproval
                    ? "Cancelled because a newer password change request was started."
                    : "Replaced by a newer OTP request.");
            AddAuditLog(
                employee.Id,
                employee.Id,
                "Password change request cancelled",
                "A previous password change request was replaced by a newer password change submission.",
                ipAddress,
                userAgent);
        }

        var pendingPassword = PasswordHasher.HashPassword(newPassword);
        var otp = GenerateOtp();
        var otpSecret = PasswordHasher.HashPassword(otp);
        var entity = new PasswordChangeRequestEntity
        {
            Id = Guid.NewGuid(),
            UserId = employee.Id,
            UserName = employee.FullName,
            UserEmail = employee.Email,
            Department = employee.Department,
            Designation = employee.Designation,
            Status = PasswordChangeRequestStatusCatalog.OtpPending,
            CurrentPasswordHashSnapshot = employee.PasswordHash,
            CurrentPasswordSaltSnapshot = employee.PasswordSalt,
            PendingPasswordHash = pendingPassword.Hash,
            PendingPasswordSalt = pendingPassword.Salt,
            OtpHash = otpSecret.Hash,
            OtpSalt = otpSecret.Salt,
            OtpExpiresAtUtc = now.Add(OtpLifetime),
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        var challengeMessage = "An OTP has been sent to your registered email address. Verify it to update your password.";

        try
        {
            await emailSender.SendAsync(
                [employee.Email],
                $"Password change OTP for {BrandingConstants.BrandName}",
                BuildOtpEmailBody(employee.FullName, otp, entity.OtpExpiresAtUtc!.Value),
                cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Password change OTP delivery failed for user {UserId}.",
                employee.Id);

            if (!environment.IsDevelopment())
            {
                throw new PasswordChangeWorkflowException(
                    StatusCodes.Status503ServiceUnavailable,
                    "Unable to send the OTP email right now. Please confirm SMTP configuration and try again.");
            }

            challengeMessage =
                $"SMTP is not configured, so the development OTP is {otp}. Configure SMTP_USER and SMTP_PASS to send OTP emails.";

            logger.LogWarning(
                "Development SMTP fallback used for user {UserId}. OTP expires at {OtpExpiresAtUtc}.",
                employee.Id,
                entity.OtpExpiresAtUtc);
        }

        dbContext.PasswordChangeRequests.Add(entity);

        AddAuditLog(
            employee.Id,
            employee.Id,
            "Password change OTP sent",
            $"Generated a one-time password for {MaskEmailAddress(employee.Email)} password change verification.",
            ipAddress,
            userAgent);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new PasswordChangeOtpChallengeDto(
            entity.Id.ToString(),
            MaskEmailAddress(employee.Email),
            entity.OtpExpiresAtUtc.Value.ToString("O"),
            challengeMessage);
    }

    public async Task<PasswordChangeOtpChallengeDto> InitiateForgotPasswordAsync(
        EmployeeEntity employee,
        string ipAddress,
        string userAgent,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(employee.Email))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "Your account does not have a registered email address for OTP verification.");
        }

        if (!TryConsumePasswordChangeAttempt(employee.Id))
        {
            throw new PasswordChangeWorkflowException(
                StatusCodes.Status429TooManyRequests,
                $"Too many password change attempts. Please wait {(int)PasswordChangeWindow.TotalMinutes} minutes and try again.");
        }

        var now = DateTime.UtcNow;
        await ExpireStaleOtpRequestsAsync(employee.Id, now, cancellationToken);

        var replaceableRequests = await dbContext.PasswordChangeRequests
            .Where(item =>
                item.UserId == employee.Id &&
                (item.Status == PasswordChangeRequestStatusCatalog.OtpPending ||
                 item.Status == PasswordChangeRequestStatusCatalog.PendingHrApproval))
            .ToListAsync(cancellationToken);

        foreach (var existingRequest in replaceableRequests)
        {
            CancelRequest(
                existingRequest,
                now,
                existingRequest.Status == PasswordChangeRequestStatusCatalog.PendingHrApproval
                    ? "Cancelled because a newer password change request was started."
                    : "Replaced by a newer OTP request.");
            AddAuditLog(
                employee.Id,
                employee.Id,
                "Forgot password request cancelled",
                "A previous password change request was replaced by a newer forgot password submission.",
                ipAddress,
                userAgent);
        }

        var otp = GenerateOtp();
        var otpSecret = PasswordHasher.HashPassword(otp);
        var entity = new PasswordChangeRequestEntity
        {
            Id = Guid.NewGuid(),
            UserId = employee.Id,
            UserName = employee.FullName,
            UserEmail = employee.Email,
            Department = employee.Department,
            Designation = employee.Designation,
            Status = PasswordChangeRequestStatusCatalog.OtpPending,
            CurrentPasswordHashSnapshot = employee.PasswordHash,
            CurrentPasswordSaltSnapshot = employee.PasswordSalt,
            OtpHash = otpSecret.Hash,
            OtpSalt = otpSecret.Salt,
            OtpExpiresAtUtc = now.Add(OtpLifetime),
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        var challengeMessage = "An OTP has been sent to your registered email address. Verify it to update your password.";

        try
        {
            await emailSender.SendAsync(
                [employee.Email],
                $"Password change OTP for {BrandingConstants.BrandName}",
                BuildOtpEmailBody(employee.FullName, otp, entity.OtpExpiresAtUtc!.Value),
                cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Password change OTP delivery failed for user {UserId}.",
                employee.Id);

            if (!environment.IsDevelopment())
            {
                throw new PasswordChangeWorkflowException(
                    StatusCodes.Status503ServiceUnavailable,
                    "Unable to send the OTP email right now. Please confirm SMTP configuration and try again.");
            }

            challengeMessage =
                $"SMTP is not configured, so the development OTP is {otp}. Configure SMTP_USER and SMTP_PASS to send OTP emails.";

            logger.LogWarning(
                "Development SMTP fallback used for user {UserId}. OTP expires at {OtpExpiresAtUtc}.",
                employee.Id,
                entity.OtpExpiresAtUtc);
        }

        dbContext.PasswordChangeRequests.Add(entity);

        AddAuditLog(
            employee.Id,
            employee.Id,
            "Forgot password OTP sent",
            $"Generated a one-time password for {MaskEmailAddress(employee.Email)} password change verification.",
            ipAddress,
            userAgent);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new PasswordChangeOtpChallengeDto(
            entity.Id.ToString(),
            MaskEmailAddress(employee.Email),
            entity.OtpExpiresAtUtc.Value.ToString("O"),
            challengeMessage);
    }

    public async Task<PasswordChangeRequestDto> VerifyForgotPasswordOtpAsync(
        EmployeeEntity employee,
        string requestId,
        string rawOtp,
        string ipAddress,
        string userAgent,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(requestId, out var parsedRequestId))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "A valid password change request ID is required.");
        }

        var otp = rawOtp?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(otp))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "OTP is required.");
        }

        var entity = await dbContext.PasswordChangeRequests
            .FirstOrDefaultAsync(item => item.Id == parsedRequestId && item.UserId == employee.Id, cancellationToken);

        if (entity is null)
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status404NotFound, "Password change request was not found.");
        }

        var now = DateTime.UtcNow;
        if (entity.Status != PasswordChangeRequestStatusCatalog.OtpPending)
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "Only OTP-pending requests can be verified.");
        }

        if (entity.OtpExpiresAtUtc.HasValue && entity.OtpExpiresAtUtc.Value <= now)
        {
            ExpireRequest(entity, now, "The OTP expired before verification.");
            AddAuditLog(employee.Id, employee.Id, "Password change OTP expired", "The password change OTP expired before verification.", ipAddress, userAgent);
            await dbContext.SaveChangesAsync(cancellationToken);
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "The OTP has expired. Start the password change request again.");
        }

        if (entity.OtpAttemptCount >= OtpAttemptLimit)
        {
            ExpireRequest(entity, now, "OTP verification attempts exceeded the allowed limit.");
            AddAuditLog(employee.Id, employee.Id, "Password change OTP locked", "Locked after too many invalid OTP attempts.", ipAddress, userAgent);
            await dbContext.SaveChangesAsync(cancellationToken);
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "Too many invalid OTP attempts. Start again.");
        }

        if (!PasswordHasher.VerifyPassword(otp, entity.OtpHash, entity.OtpSalt))
        {
            entity.OtpAttemptCount += 1;
            entity.UpdatedAtUtc = now;

            if (entity.OtpAttemptCount >= OtpAttemptLimit)
            {
                ExpireRequest(entity, now, "OTP verification attempts exceeded the allowed limit.");
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "The OTP you entered is invalid.");
        }

        entity.Status = PasswordChangeRequestStatusCatalog.OtpVerified;
        entity.OtpVerifiedAtUtc = now;
        entity.UpdatedAtUtc = now;
        ClearSensitivePayload(entity);

        AddAuditLog(employee.Id, employee.Id, "Password change OTP verified", "OTP verified successfully. Waiting for new password.", ipAddress, userAgent);

        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(entity);
    }

    public async Task<PasswordChangeRequestDto> ResetPasswordAsync(
        EmployeeEntity employee,
        string requestId,
        string newPassword,
        string confirmPassword,
        string ipAddress,
        string userAgent,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(requestId, out var parsedRequestId))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "A valid password change request ID is required.");
        }

        var entity = await dbContext.PasswordChangeRequests
            .FirstOrDefaultAsync(item => item.Id == parsedRequestId && item.UserId == employee.Id, cancellationToken);

        if (entity is null)
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status404NotFound, "Password change request was not found.");
        }

        if (entity.Status != PasswordChangeRequestStatusCatalog.OtpVerified)
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "OTP must be verified before resetting password.");
        }

        if (string.IsNullOrWhiteSpace(newPassword) || string.IsNullOrWhiteSpace(confirmPassword))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "New password is required.");
        }

        if (!string.Equals(newPassword, confirmPassword, StringComparison.Ordinal))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "New password and confirm password do not match.");
        }

        var passwordPolicyError = GetPasswordPolicyError(newPassword);
        if (passwordPolicyError is not null)
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, passwordPolicyError);
        }

        var now = DateTime.UtcNow;
        var newPasswordHash = PasswordHasher.HashPassword(newPassword);
        employee.PasswordHash = newPasswordHash.Hash;
        employee.PasswordSalt = newPasswordHash.Salt;
        employee.PasswordChangedAtUtc = now;
        employee.UpdatedAtUtc = now;
        employee.UpdatedBy = employee.Id;

        entity.Status = PasswordChangeRequestStatusCatalog.Completed;
        entity.DecisionAtUtc = now;
        entity.DecisionNote = "Password updated after successful reset.";
        entity.UpdatedAtUtc = now;

        AddAuditLog(employee.Id, employee.Id, "Password reset completed", "Password reset successfully via forgot password flow.", ipAddress, userAgent);

        await dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            await emailSender.SendAsync(
                [employee.Email],
                $"Your {BrandingConstants.BrandShort} password was changed successfully",
                BuildPasswordChangedEmailBody(employee.FullName, now),
                cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Password change request {RequestId} completed, but the confirmation email could not be sent.", entity.Id);
        }

        return Map(entity);
    }


    public async Task<PasswordChangeRequestDto> VerifyOtpAsync(
        EmployeeEntity employee,
        VerifyPasswordChangeOtpRequest request,
        string ipAddress,
        string userAgent,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.RequestId, out var requestId))
        {
            throw new PasswordChangeWorkflowException(
                StatusCodes.Status400BadRequest,
                "A valid password change request ID is required.");
        }

        var otp = request.Otp?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(otp))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "OTP is required.");
        }

        var entity = await dbContext.PasswordChangeRequests
            .FirstOrDefaultAsync(item => item.Id == requestId && item.UserId == employee.Id, cancellationToken);

        if (entity is null)
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status404NotFound, "Password change request was not found.");
        }

        var now = DateTime.UtcNow;
        if (entity.Status == PasswordChangeRequestStatusCatalog.PendingHrApproval)
        {
            throw new PasswordChangeWorkflowException(
                StatusCodes.Status409Conflict,
                "This request belongs to the previous HR approval workflow. Start a new password change request to continue.");
        }

        if (entity.Status != PasswordChangeRequestStatusCatalog.OtpPending)
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "Only OTP-pending password change requests can be verified.");
        }

        if (entity.OtpExpiresAtUtc.HasValue && entity.OtpExpiresAtUtc.Value <= now)
        {
            ExpireRequest(entity, now, "The OTP expired before verification.");
            AddAuditLog(
                employee.Id,
                employee.Id,
                "Password change OTP expired",
                "The password change OTP expired before the user completed verification.",
                ipAddress,
                userAgent);
            await dbContext.SaveChangesAsync(cancellationToken);

            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "The OTP has expired. Start the password change request again.");
        }

        if (entity.OtpAttemptCount >= OtpAttemptLimit)
        {
            ExpireRequest(entity, now, "OTP verification attempts exceeded the allowed limit.");
            AddAuditLog(
                employee.Id,
                employee.Id,
                "Password change OTP locked",
                "The password change request was locked after too many invalid OTP attempts.",
                ipAddress,
                userAgent);
            await dbContext.SaveChangesAsync(cancellationToken);

            throw new PasswordChangeWorkflowException(StatusCodes.Status400BadRequest, "Too many invalid OTP attempts. Start the password change request again.");
        }

        if (!PasswordHasher.VerifyPassword(otp, entity.OtpHash, entity.OtpSalt))
        {
            entity.OtpAttemptCount += 1;
            entity.UpdatedAtUtc = now;

            if (entity.OtpAttemptCount >= OtpAttemptLimit)
            {
                ExpireRequest(entity, now, "OTP verification attempts exceeded the allowed limit.");
            }

            AddAuditLog(
                employee.Id,
                employee.Id,
                "Password change OTP failed",
                entity.Status == PasswordChangeRequestStatusCatalog.Expired
                    ? "Invalid OTP entered too many times. The request has expired."
                    : "Invalid OTP entered for password change verification.",
                ipAddress,
                userAgent);

            await dbContext.SaveChangesAsync(cancellationToken);

            throw new PasswordChangeWorkflowException(
                StatusCodes.Status400BadRequest,
                entity.Status == PasswordChangeRequestStatusCatalog.Expired
                    ? "Too many invalid OTP attempts. Start the password change request again."
                    : "The OTP you entered is invalid.");
        }

        if (!string.Equals(employee.PasswordHash, entity.CurrentPasswordHashSnapshot, StringComparison.Ordinal) ||
            !string.Equals(employee.PasswordSalt, entity.CurrentPasswordSaltSnapshot, StringComparison.Ordinal))
        {
            ExpireRequest(entity, now, "The account password changed after this request was created.");
            AddAuditLog(
                employee.Id,
                employee.Id,
                "Password change request expired",
                "The password change request expired because the account password changed before OTP verification completed.",
                ipAddress,
                userAgent);
            await dbContext.SaveChangesAsync(cancellationToken);

            throw new PasswordChangeWorkflowException(
                StatusCodes.Status409Conflict,
                "This request is no longer valid because your password changed after the OTP was issued.");
        }

        if (string.IsNullOrWhiteSpace(entity.PendingPasswordHash) || string.IsNullOrWhiteSpace(entity.PendingPasswordSalt))
        {
            throw new PasswordChangeWorkflowException(StatusCodes.Status409Conflict, "The pending password payload is no longer available for this request.");
        }

        employee.PasswordHash = entity.PendingPasswordHash;
        employee.PasswordSalt = entity.PendingPasswordSalt;
        employee.PasswordChangedAtUtc = now;
        employee.UpdatedAtUtc = now;
        employee.UpdatedBy = employee.Id;

        entity.Status = PasswordChangeRequestStatusCatalog.Completed;
        entity.OtpVerifiedAtUtc = now;
        entity.ReviewedByUserId = employee.Id;
        entity.ReviewedByName = "Self-service";
        entity.DecisionAtUtc = now;
        entity.DecisionNote = "Password updated after successful OTP verification.";
        entity.UpdatedAtUtc = now;
        ClearSensitivePayload(entity);

        AddAuditLog(
            employee.Id,
            employee.Id,
            "Password change OTP verified",
            "OTP verified successfully. Password updated immediately.",
            ipAddress,
            userAgent);
        AddAuditLog(
            employee.Id,
            employee.Id,
            "Password changed",
            "Password updated after successful email OTP verification.",
            ipAddress,
            userAgent);

        await dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            await emailSender.SendAsync(
                [entity.UserEmail],
                $"Your {BrandingConstants.BrandShort} password was changed successfully",
                BuildPasswordChangedEmailBody(entity.UserName, now),
                cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Password change request {RequestId} completed, but the confirmation email could not be sent.",
                entity.Id);
        }

        return Map(entity);
    }

    public async Task<IReadOnlyList<PasswordChangeRequestDto>> GetRequestsForUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        await ExpireStaleOtpRequestsAsync(userId, DateTime.UtcNow, cancellationToken);

        var requests = await dbContext.PasswordChangeRequests
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderByDescending(item => item.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return requests.Select(Map).ToList();
    }

    private async Task ExpireStaleOtpRequestsAsync(Guid userId, DateTime now, CancellationToken cancellationToken)
    {
        var staleRequests = await dbContext.PasswordChangeRequests
            .Where(item =>
                item.UserId == userId &&
                item.Status == PasswordChangeRequestStatusCatalog.OtpPending &&
                item.OtpExpiresAtUtc.HasValue &&
                item.OtpExpiresAtUtc.Value <= now)
            .ToListAsync(cancellationToken);

        if (staleRequests.Count == 0)
        {
            return;
        }

        foreach (var staleRequest in staleRequests)
        {
            ExpireRequest(staleRequest, now, "The OTP expired before verification.");
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string GenerateOtp()
    {
        return Random.Shared.Next(100_000, 1_000_000).ToString("D6");
    }

    private static string MaskEmailAddress(string email)
    {
        var atIndex = email.IndexOf('@');
        if (atIndex <= 1)
        {
            return email;
        }

        var localPart = email[..atIndex];
        var domain = email[(atIndex + 1)..];
        var maskedLocal = $"{localPart[0]}{new string('*', Math.Max(1, localPart.Length - 2))}{localPart[^1]}";

        return $"{maskedLocal}@{domain}";
    }

    private static string? GetPasswordPolicyError(string password)
    {
        if (password.Length < 8)
        {
            return "New password does not meet security requirements. Use at least 8 characters.";
        }

        if (!password.Any(char.IsUpper))
        {
            return "New password does not meet security requirements. Include at least 1 uppercase letter.";
        }

        if (!password.Any(char.IsLower))
        {
            return "New password does not meet security requirements. Include at least 1 lowercase letter.";
        }

        if (!password.Any(char.IsDigit))
        {
            return "New password does not meet security requirements. Include at least 1 number.";
        }

        if (!password.Any(character => !char.IsLetterOrDigit(character)))
        {
            return "New password does not meet security requirements. Include at least 1 special character.";
        }

        return null;
    }

    private bool TryConsumePasswordChangeAttempt(Guid userId)
    {
        var cacheKey = GetPasswordChangeLimitKey(userId);
        var currentCount = memoryCache.Get<int?>(cacheKey) ?? 0;
        if (currentCount >= PasswordChangeAttemptLimit)
        {
            return false;
        }

        memoryCache.Set(cacheKey, currentCount + 1, PasswordChangeWindow);
        return true;
    }

    private static string GetPasswordChangeLimitKey(Guid userId) => $"account:password-change:{userId:N}";

    private void AddAuditLog(
        Guid actorUserId,
        Guid subjectUserId,
        string action,
        string detail,
        string ipAddress,
        string userAgent)
    {
        dbContext.AccountAuditLogs.Add(new AccountAuditLogEntity
        {
            Id = Guid.NewGuid(),
            ActorUserId = actorUserId,
            SubjectUserId = subjectUserId,
            Action = action,
            Detail = detail,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAtUtc = DateTime.UtcNow
        });
    }

    private static void ExpireRequest(PasswordChangeRequestEntity entity, DateTime now, string note)
    {
        entity.Status = PasswordChangeRequestStatusCatalog.Expired;
        entity.DecisionNote = note;
        entity.DecisionAtUtc = now;
        entity.UpdatedAtUtc = now;
        ClearSensitivePayload(entity);
    }

    private static void CancelRequest(PasswordChangeRequestEntity entity, DateTime now, string note)
    {
        entity.Status = PasswordChangeRequestStatusCatalog.Cancelled;
        entity.DecisionNote = note;
        entity.DecisionAtUtc = now;
        entity.UpdatedAtUtc = now;
        ClearSensitivePayload(entity);
    }

    private static void ClearSensitivePayload(PasswordChangeRequestEntity entity)
    {
        entity.PendingPasswordHash = null;
        entity.PendingPasswordSalt = null;
        entity.OtpHash = null;
        entity.OtpSalt = null;
        entity.OtpExpiresAtUtc = null;
        entity.OtpAttemptCount = 0;
    }

    private static PasswordChangeRequestDto Map(PasswordChangeRequestEntity entity)
    {
        return new PasswordChangeRequestDto(
            entity.Id.ToString(),
            entity.UserId.ToString(),
            entity.UserName,
            entity.UserEmail,
            entity.Department,
            entity.Designation,
            entity.Status,
            entity.CreatedAtUtc.ToString("O"),
            entity.UpdatedAtUtc.ToString("O"),
            entity.OtpExpiresAtUtc?.ToString("O"),
            entity.OtpVerifiedAtUtc?.ToString("O"),
            entity.DecisionAtUtc?.ToString("O"),
            string.IsNullOrWhiteSpace(entity.DecisionNote) ? null : entity.DecisionNote,
            entity.ReviewedByUserId?.ToString(),
            string.IsNullOrWhiteSpace(entity.ReviewedByName) ? null : entity.ReviewedByName);
    }

    private static string BuildOtpEmailBody(string fullName, string otp, DateTime expiresAtUtc)
    {
        var encodedName = WebUtility.HtmlEncode(fullName);
        var encodedOtp = WebUtility.HtmlEncode(otp);
        var encodedExpiry = WebUtility.HtmlEncode(expiresAtUtc.ToLocalTime().ToString("dd MMM yyyy hh:mm tt"));

        return $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#18181b;">
              <p>Hello {encodedName},</p>
              <p>We received a request to change your {BrandingConstants.BrandName} password.</p>
              <p>Your verification OTP is:</p>
              <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0;">{encodedOtp}</p>
              <p>This OTP expires at {encodedExpiry}. After verification, your password will be updated immediately.</p>
              <p>If you did not start this request, please contact your System Admin immediately.</p>
            </div>
            """;
    }

    private static string BuildPasswordChangedEmailBody(string userName, DateTime changedAtUtc)
    {
        var encodedName = WebUtility.HtmlEncode(userName);
        var encodedChangedAt = WebUtility.HtmlEncode(changedAtUtc.ToLocalTime().ToString("dd MMM yyyy hh:mm tt"));

        return $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#18181b;">
              <p>Hello {encodedName},</p>
              <p>Your {BrandingConstants.BrandShort} password was changed successfully on {encodedChangedAt}.</p>
              <p>If you did not request this change, reset your password immediately and contact your System Admin.</p>
            </div>
            """;
    }
}

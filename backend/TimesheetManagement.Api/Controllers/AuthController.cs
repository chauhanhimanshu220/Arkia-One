using AbhiTimesheet.Api.Contracts.Account;
using AbhiTimesheet.Api.Contracts.Auth;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Services;
using AbhiTimesheet.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(
    AppDbContext dbContext,
    LoginActivityService loginActivityService,
    PasswordChangeRequestService passwordChangeRequestService,
    AuthTokenService authTokenService) : ControllerBase
{
    private const string Organization = "Timesheet Approval System";
    private const string LocationRequiredMessage = "Location access is required to login";
    private const string LoginStatusSuccess = "Success";
    private const string LoginStatusFailed = "Failed";
    private const string InvalidCredentialsMessage = "Invalid user ID or password.";
    private const string ForgotPasswordAcceptedMessage = "If an active account matches that email or user ID, an OTP will be sent to the registered email address.";
    private static readonly IReadOnlyDictionary<string, string> LoginDomainAliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["arkiatimesheet.com"] = "arkiatechnology.com"
    };

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<AuthSessionDto>> Login([FromBody] LoginRequest request)
    {
        var loginIds = BuildLoginIdCandidates(request.UserId);
        var password = request.Password?.Trim() ?? string.Empty;

        var owner = await dbContext.LicenseOwners
            .AsNoTracking()
            .FirstOrDefaultAsync(item =>
                item.SubscriptionStatus == "Active" &&
                loginIds.Contains(item.Email.ToLower()));

        var employee = await dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(item =>
                item.Status == "Active" &&
                (loginIds.Contains(item.UserId.ToLower()) || loginIds.Contains(item.Email.ToLower())));

        if (request.Latitude is null || request.Longitude is null)
        {
            await loginActivityService.RecordAsync(owner != null ? null : employee?.Id, request, HttpContext, LoginStatusFailed, LocationRequiredMessage);
            return BadRequest(new { message = LocationRequiredMessage });
        }

        if (owner is not null && PasswordHasher.VerifyPassword(password, owner.PasswordHash, owner.PasswordSalt))
        {
            await loginActivityService.RecordAsync(null, request, HttpContext, LoginStatusSuccess);
            return Ok(CreateSession(owner));
        }

        if (employee is not null && PasswordHasher.VerifyPassword(password, employee.PasswordHash, employee.PasswordSalt))
        {
            await loginActivityService.RecordAsync(employee.Id, request, HttpContext, LoginStatusSuccess);
            return Ok(CreateSession(employee));
        }

        await loginActivityService.RecordAsync(employee?.Id, request, HttpContext, LoginStatusFailed, InvalidCredentialsMessage);
        return Unauthorized(new { message = InvalidCredentialsMessage });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<AuthSessionDto>> GetCurrentSession()
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        var owner = await dbContext.LicenseOwners
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == userId && item.SubscriptionStatus == "Active");

        if (owner is not null)
        {
            return Ok(CreateSession(owner));
        }

        var employee = await dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == userId && item.Status == "Active");

        if (employee is null)
        {
            return Unauthorized(new { message = "Your session no longer matches an active employee record. Please sign in again." });
        }

        return Ok(CreateSession(employee));
    }

    [HttpPost("change-password")]
    public IActionResult ChangePassword([FromBody] AbhiTimesheet.Api.Contracts.Auth.ChangePasswordRequest request)
    {
        return StatusCode(StatusCodes.Status410Gone, new
        {
            message = "Direct password updates are disabled. Use Account Settings to complete email OTP verification before your password can change."
        });
    }

    [HttpPost("forgot-password")]
    public async Task<ActionResult<PasswordChangeOtpChallengeDto>> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var loginIds = BuildLoginIdCandidates(request.UserIdOrEmail);

        var employee = await dbContext.Employees
            .FirstOrDefaultAsync(item =>
                item.Status == "Active" &&
                (loginIds.Contains(item.UserId.ToLower()) || loginIds.Contains(item.Email.ToLower())));

        if (employee is null)
        {
            return Ok(new PasswordChangeOtpChallengeDto(
                string.Empty,
                string.Empty,
                string.Empty,
                ForgotPasswordAcceptedMessage));
        }

        try
        {
            var challenge = await passwordChangeRequestService.InitiateForgotPasswordAsync(
                employee,
                HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
                Request.Headers.UserAgent.ToString(),
                cancellationToken);

            return Ok(challenge);
        }
        catch (PasswordChangeWorkflowException exception)
        {
            return StatusCode(exception.StatusCode, new { message = exception.Message });
        }
    }

    [HttpPost("forgot-password/verify-otp")]
    public async Task<ActionResult<PasswordChangeRequestDto>> VerifyForgotPasswordOtp(
        [FromBody] VerifyForgotPasswordOtpRequest request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.RequestId, out var requestId))
        {
            return BadRequest(new { message = "A valid password change request ID is required." });
        }

        var reqEntity = await dbContext.PasswordChangeRequests.FirstOrDefaultAsync(item => item.Id == requestId, cancellationToken);
        if (reqEntity is null)
        {
            return NotFound(new { message = "Password change request was not found." });
        }

        var employee = await dbContext.Employees.FirstOrDefaultAsync(item => item.Id == reqEntity.UserId, cancellationToken);
        if (employee is null)
        {
            return NotFound(new { message = "Active employee account not found." });
        }

        try
        {
            var result = await passwordChangeRequestService.VerifyForgotPasswordOtpAsync(
                employee,
                request.RequestId,
                request.Otp,
                HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
                Request.Headers.UserAgent.ToString(),
                cancellationToken);

            return Ok(result);
        }
        catch (PasswordChangeWorkflowException exception)
        {
            return StatusCode(exception.StatusCode, new { message = exception.Message });
        }
    }

    [HttpPost("forgot-password/reset")]
    public async Task<ActionResult<PasswordChangeRequestDto>> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.RequestId, out var requestId))
        {
            return BadRequest(new { message = "A valid password change request ID is required." });
        }

        var reqEntity = await dbContext.PasswordChangeRequests.FirstOrDefaultAsync(item => item.Id == requestId, cancellationToken);
        if (reqEntity is null)
        {
            return NotFound(new { message = "Password change request was not found." });
        }

        var employee = await dbContext.Employees.FirstOrDefaultAsync(item => item.Id == reqEntity.UserId, cancellationToken);
        if (employee is null)
        {
            return NotFound(new { message = "Active employee account not found." });
        }

        try
        {
            var result = await passwordChangeRequestService.ResetPasswordAsync(
                employee,
                request.RequestId,
                request.NewPassword,
                request.ConfirmPassword,
                HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
                Request.Headers.UserAgent.ToString(),
                cancellationToken);

            return Ok(result);
        }
        catch (PasswordChangeWorkflowException exception)
        {
            return StatusCode(exception.StatusCode, new { message = exception.Message });
        }
    }

    private AuthSessionDto CreateSession(LicenseOwnerEntity owner)
    {
        return new AuthSessionDto(
            authTokenService.CreateAccessToken(owner),
            new AuthUserDto(
                owner.Id.ToString(),
                owner.OwnerName,
                owner.Email,
                "License Owner",
                ["License Owner"],
                owner.CompanyName,
                null));
    }

    private AuthSessionDto CreateSession(Models.EmployeeEntity employee)
    {
        var roles = RoleCatalog.ParseRoles(employee.RolesJson, employee.Role);
        return new AuthSessionDto(
            authTokenService.CreateAccessToken(employee),
            new AuthUserDto(
                employee.Id.ToString(),
                employee.FullName,
                employee.Email,
                RoleCatalog.GetPrimaryRole(roles),
                roles,
                Organization,
                BuildProfilePhotoUrl(employee.ProfilePhotoUrl)));
    }

    private string? BuildProfilePhotoUrl(string? profilePhotoUrl)
    {
        if (string.IsNullOrWhiteSpace(profilePhotoUrl))
        {
            return null;
        }

        if (Uri.TryCreate(profilePhotoUrl, UriKind.Absolute, out var absoluteUri))
        {
            return absoluteUri.ToString();
        }

        return $"{Request.Scheme}://{Request.Host}{profilePhotoUrl}";
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        userId = Guid.Empty;
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claimValue, out userId);
    }

    private static HashSet<string> BuildLoginIdCandidates(string? rawLoginId)
    {
        var normalizedLoginId = rawLoginId?.Trim().ToLowerInvariant() ?? string.Empty;
        var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(normalizedLoginId))
        {
            return candidates;
        }

        candidates.Add(normalizedLoginId);

        var domainSeparatorIndex = normalizedLoginId.LastIndexOf('@');
        if (domainSeparatorIndex <= 0 || domainSeparatorIndex == normalizedLoginId.Length - 1)
        {
            return candidates;
        }

        var localPart = normalizedLoginId[..domainSeparatorIndex];
        var domain = normalizedLoginId[(domainSeparatorIndex + 1)..];
        if (LoginDomainAliases.TryGetValue(domain, out var canonicalDomain) && !string.IsNullOrWhiteSpace(canonicalDomain))
        {
            candidates.Add($"{localPart}@{canonicalDomain.ToLowerInvariant()}");
        }

        return candidates;
    }
}

using AbhiTimesheet.Api.Contracts.Account;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using AbhiTimesheet.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AccountController(
    AppDbContext dbContext,
    IWebHostEnvironment environment,
    PasswordChangeRequestService passwordChangeRequestService) : ControllerBase
{
    private const string OrganizationName = "Timesheet Approval System";
    private const long MaxProfilePhotoSizeBytes = 2 * 1024 * 1024;
    private static readonly string[] AllowedGenders = ["Male", "Female", "Other", "Prefer not to say"];
    private static readonly Dictionary<string, string> AllowedPhotoContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp"
    };

    [HttpGet("me")]
    public async Task<ActionResult<MyProfileDto>> GetMyProfile()
    {
        var employee = await GetCurrentEmployeeAsync();
        if (employee.Error is not null)
        {
            return employee.Error;
        }

        return Ok(await MapProfileAsync(employee.Entity!));
    }

    [HttpPut("me")]
    public async Task<ActionResult<MyProfileDto>> UpdateMyProfile([FromBody] UpdateMyProfileRequest request)
    {
        var employee = await GetCurrentEmployeeAsync();
        if (employee.Error is not null)
        {
            return employee.Error;
        }

        var normalized = NormalizeProfileRequest(request);
        if (normalized.Error is not null)
        {
            return normalized.Error;
        }

        var entity = employee.Entity!;
        var input = normalized.Value!;
        var updatedFields = new List<string>();

        if (!string.Equals(entity.FullName, input.FullName, StringComparison.Ordinal))
        {
            entity.FullName = input.FullName;
            updatedFields.Add("fullName");
        }

        if (!string.Equals(entity.MobileNumber, input.MobileNumber, StringComparison.Ordinal))
        {
            entity.MobileNumber = input.MobileNumber;
            updatedFields.Add("mobileNumber");
        }

        if (entity.DateOfBirth != input.DateOfBirth)
        {
            entity.DateOfBirth = input.DateOfBirth;
            updatedFields.Add("dateOfBirth");
        }

        if (!string.Equals(entity.Gender, input.Gender, StringComparison.Ordinal))
        {
            entity.Gender = input.Gender;
            updatedFields.Add("gender");
        }

        entity.UpdatedAtUtc = DateTime.UtcNow;
        entity.UpdatedBy = entity.Id;

        AddAuditLog(entity.Id, entity.Id, "Profile updated", updatedFields.Count == 0
            ? "Profile save requested with no field changes."
            : $"Updated fields: {string.Join(", ", updatedFields)}.");

        await dbContext.SaveChangesAsync();

        return Ok(await MapProfileAsync(entity));
    }

    [HttpPost("me/photo")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<MyProfileDto>> UploadMyPhoto(IFormFile? file)
    {
        var employee = await GetCurrentEmployeeAsync();
        if (employee.Error is not null)
        {
            return employee.Error;
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Please choose an image to upload." });
        }

        if (file.Length > MaxProfilePhotoSizeBytes)
        {
            return BadRequest(new { message = "Profile photo must be 2 MB or smaller." });
        }

        if (!AllowedPhotoContentTypes.TryGetValue(file.ContentType ?? string.Empty, out var extension))
        {
            return BadRequest(new { message = "Only JPG, PNG, and WEBP images are allowed." });
        }

        var originalExtension = Path.GetExtension(file.FileName);
        if (!string.IsNullOrWhiteSpace(originalExtension) &&
            !AllowedPhotoContentTypes.Values.Contains(originalExtension, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only JPG, PNG, and WEBP images are allowed." });
        }

        var uploadsRoot = EnsureProfileUploadsRoot();
        DeleteOwnedProfilePhoto(employee.Entity!.ProfilePhotoUrl, uploadsRoot);

        var fileName = $"{employee.Entity.Id:N}-{DateTime.UtcNow:yyyyMMddHHmmssfff}{extension}";
        var absolutePath = Path.Combine(uploadsRoot, fileName);
        await using (var stream = System.IO.File.Create(absolutePath))
        {
            await file.CopyToAsync(stream);
        }

        employee.Entity.ProfilePhotoUrl = $"/uploads/profile/{fileName}";
        employee.Entity.UpdatedAtUtc = DateTime.UtcNow;
        employee.Entity.UpdatedBy = employee.Entity.Id;

        AddAuditLog(employee.Entity.Id, employee.Entity.Id, "Profile photo uploaded", "Uploaded a new profile photo.");

        await dbContext.SaveChangesAsync();

        return Ok(await MapProfileAsync(employee.Entity));
    }

    [HttpDelete("me/photo")]
    public async Task<ActionResult<MyProfileDto>> RemoveMyPhoto()
    {
        var employee = await GetCurrentEmployeeAsync();
        if (employee.Error is not null)
        {
            return employee.Error;
        }

        DeleteOwnedProfilePhoto(employee.Entity!.ProfilePhotoUrl, EnsureProfileUploadsRoot());
        employee.Entity.ProfilePhotoUrl = null;
        employee.Entity.UpdatedAtUtc = DateTime.UtcNow;
        employee.Entity.UpdatedBy = employee.Entity.Id;

        AddAuditLog(employee.Entity.Id, employee.Entity.Id, "Profile photo removed", "Removed the current profile photo.");

        await dbContext.SaveChangesAsync();

        return Ok(await MapProfileAsync(employee.Entity));
    }

    [HttpPost("change-password")]
    public async Task<ActionResult<PasswordChangeOtpChallengeDto>> ChangePassword(
        [FromBody] ChangeMyPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var employee = await GetCurrentEmployeeAsync();
        if (employee.Error is not null)
        {
            return employee.Error;
        }

        try
        {
            var challenge = await passwordChangeRequestService.InitiateAsync(
                employee.Entity!,
                request,
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

    [HttpPost("change-password/verify-otp")]
    public async Task<ActionResult<PasswordChangeRequestDto>> VerifyPasswordChangeOtp(
        [FromBody] VerifyPasswordChangeOtpRequest request,
        CancellationToken cancellationToken)
    {
        var employee = await GetCurrentEmployeeAsync();
        if (employee.Error is not null)
        {
            return employee.Error;
        }

        try
        {
            var result = await passwordChangeRequestService.VerifyOtpAsync(
                employee.Entity!,
                request,
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

    [HttpGet("change-password/requests")]
    public async Task<ActionResult<IReadOnlyList<PasswordChangeRequestDto>>> ListMyPasswordChangeRequests(CancellationToken cancellationToken)
    {
        var employee = await GetCurrentEmployeeAsync();
        if (employee.Error is not null)
        {
            return employee.Error;
        }

        var requests = await passwordChangeRequestService.GetRequestsForUserAsync(employee.Entity!.Id, cancellationToken);
        return Ok(requests);
    }

    private async Task<MyProfileDto> MapProfileAsync(EmployeeEntity employee)
    {
        var reportingManagerName = employee.ReportingManagerId.HasValue
            ? await dbContext.Employees
                .AsNoTracking()
                .Where(item => item.Id == employee.ReportingManagerId.Value)
                .Select(item => item.FullName)
                .FirstOrDefaultAsync()
            : null;

        var updatedAtUtc = employee.UpdatedAtUtc == default ? employee.CreatedAtUtc : employee.UpdatedAtUtc;
        var roles = RoleCatalog.ParseRoles(employee.RolesJson, employee.Role);

        return new MyProfileDto(
            employee.Id.ToString(),
            employee.FullName,
            employee.EmployeeCode,
            employee.Email,
            employee.MobileNumber,
            employee.DateOfBirth?.ToString("yyyy-MM-dd"),
            employee.Gender,
            BuildAbsoluteAssetUrl(employee.ProfilePhotoUrl),
            employee.Department,
            employee.Designation,
            employee.ReportingManagerId?.ToString(),
            reportingManagerName,
            employee.BusinessUnit,
            employee.WorkLocation,
            OrganizationName,
            RoleCatalog.GetPrimaryRole(roles),
            roles,
            employee.Status,
            employee.PasswordChangedAtUtc?.ToString("O"),
            updatedAtUtc.ToString("O"));
    }

    private (ActionResult<MyProfileDto>? Error, NormalizedProfileInput? Value) NormalizeProfileRequest(UpdateMyProfileRequest request)
    {
        var fullName = request.FullName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return (BadRequest(new { message = "Full name is required." }), null);
        }

        if (fullName.Length < 2 || fullName.Length > 100)
        {
            return (BadRequest(new { message = "Full name must be between 2 and 100 characters." }), null);
        }

        var mobileNumber = request.MobileNumber?.Trim() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(mobileNumber))
        {
            if (!mobileNumber.All(character => char.IsDigit(character) || character is '+' or '-' or '(' or ')' or ' '))
            {
                return (BadRequest(new { message = "Invalid mobile number format." }), null);
            }

            var digitCount = mobileNumber.Count(char.IsDigit);
            if (digitCount < 8 || digitCount > 15)
            {
                return (BadRequest(new { message = "Invalid mobile number format." }), null);
            }
        }

        DateOnly? dateOfBirth = null;
        if (!string.IsNullOrWhiteSpace(request.DateOfBirth))
        {
            if (!DateOnly.TryParse(request.DateOfBirth.Trim(), out var parsedDateOfBirth))
            {
                return (BadRequest(new { message = "Enter a valid date of birth." }), null);
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (parsedDateOfBirth > today)
            {
                return (BadRequest(new { message = "Date of birth cannot be in the future." }), null);
            }

            if (parsedDateOfBirth < today.AddYears(-100))
            {
                return (BadRequest(new { message = "Date of birth is outside the allowed range." }), null);
            }

            dateOfBirth = parsedDateOfBirth;
        }

        var gender = AllowedGenders.FirstOrDefault(item =>
            string.Equals(item, request.Gender?.Trim(), StringComparison.OrdinalIgnoreCase));

        if (gender is null)
        {
            return (BadRequest(new { message = $"Gender must be one of: {string.Join(", ", AllowedGenders)}." }), null);
        }

        return (null, new NormalizedProfileInput(fullName, mobileNumber, dateOfBirth, gender));
    }

    private async Task<(ActionResult? Error, EmployeeEntity? Entity)> GetCurrentEmployeeAsync()
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return (Unauthorized(new { message = "Your session could not be verified. Please sign in again." }), null);
        }

        var employee = await dbContext.Employees.FirstOrDefaultAsync(item => item.Id == userId && item.Status == "Active");
        if (employee is null)
        {
            return (NotFound(new { message = "Active employee account not found." }), null);
        }

        if (employee.UpdatedAtUtc == default)
        {
            employee.UpdatedAtUtc = employee.CreatedAtUtc == default ? DateTime.UtcNow : employee.CreatedAtUtc;
        }

        return (null, employee);
    }

    private string? BuildAbsoluteAssetUrl(string? assetPath)
    {
        if (string.IsNullOrWhiteSpace(assetPath))
        {
            return null;
        }

        if (Uri.TryCreate(assetPath, UriKind.Absolute, out var absoluteUri))
        {
            return absoluteUri.ToString();
        }

        return $"{Request.Scheme}://{Request.Host}{assetPath}";
    }

    private string EnsureProfileUploadsRoot()
    {
        var webRoot = environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(environment.ContentRootPath, "wwwroot");
        }

        var uploadsRoot = Path.Combine(webRoot, "uploads", "profile");
        Directory.CreateDirectory(uploadsRoot);
        return uploadsRoot;
    }

    private void DeleteOwnedProfilePhoto(string? profilePhotoUrl, string uploadsRoot)
    {
        if (string.IsNullOrWhiteSpace(profilePhotoUrl))
        {
            return;
        }

        var assetPath = profilePhotoUrl;
        if (Uri.TryCreate(profilePhotoUrl, UriKind.Absolute, out var absoluteUri))
        {
            assetPath = absoluteUri.AbsolutePath;
        }

        const string uploadPrefix = "/uploads/profile/";
        if (!assetPath.StartsWith(uploadPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var fileName = Path.GetFileName(assetPath);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return;
        }

        var rootPath = Path.GetFullPath(uploadsRoot);
        var targetPath = Path.GetFullPath(Path.Combine(rootPath, fileName));
        if (!targetPath.StartsWith(rootPath, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (System.IO.File.Exists(targetPath))
        {
            System.IO.File.Delete(targetPath);
        }
    }

    private void AddAuditLog(Guid actorUserId, Guid subjectUserId, string action, string detail)
    {
        dbContext.AccountAuditLogs.Add(new AccountAuditLogEntity
        {
            Id = Guid.NewGuid(),
            ActorUserId = actorUserId,
            SubjectUserId = subjectUserId,
            Action = action,
            Detail = detail,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
            UserAgent = Request.Headers.UserAgent.ToString(),
            CreatedAtUtc = DateTime.UtcNow
        });
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        userId = Guid.Empty;
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(claimValue, out userId))
        {
            return true;
        }

        var userIdHeader = Request.Headers["X-User-Id"].FirstOrDefault();
        return Guid.TryParse(userIdHeader, out userId);
    }

    private sealed record NormalizedProfileInput(
        string FullName,
        string MobileNumber,
        DateOnly? DateOfBirth,
        string Gender);
}

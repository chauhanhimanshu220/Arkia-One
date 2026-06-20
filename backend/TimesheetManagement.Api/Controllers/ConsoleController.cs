using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using AbhiTimesheet.Api.Contracts.Employees;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using AbhiTimesheet.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Controllers;

[Authorize(Roles = "License Owner")]
[ApiController]
[Route("api/[controller]")]
public sealed class ConsoleController(
    AppDbContext dbContext,
    IWebHostEnvironment environment,
    EmployeeWelcomeEmailService employeeWelcomeEmailService) : ControllerBase
{
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var owner = await GetCurrentOwnerAsync();
        if (owner is null) return Unauthorized(new { message = "License owner session invalid." });

        var activeEmployeesCount = await dbContext.Employees
            .CountAsync(e => e.WorkspaceId == owner.WorkspaceId && e.Status == "Active");

        var activeProjectsCount = await dbContext.Projects
            .CountAsync(p => p.WorkspaceId == owner.WorkspaceId && p.Status == "Active");

        // Keep current usage sync
        if (owner.CurrentUsage != activeEmployeesCount)
        {
            owner.CurrentUsage = activeEmployeesCount;
            await dbContext.SaveChangesAsync();
        }

        var invoices = await dbContext.Subscriptions
            .Where(s => s.WorkspaceId == owner.WorkspaceId)
            .OrderByDescending(s => s.TransactionDate)
            .Select(s => new
            {
                s.Id,
                s.PlanName,
                s.BillingCycle,
                s.Amount,
                s.Status,
                s.InvoiceNumber,
                s.PaymentMethod,
                TransactionDate = s.TransactionDate.ToString("yyyy-MM-dd")
            })
            .ToListAsync();

        var remainingDays = (owner.RenewalDate - DateTime.UtcNow).Days;
        remainingDays = remainingDays < 0 ? 0 : remainingDays;

        return Ok(new
        {
            workspaceId = owner.WorkspaceId,
            companyName = owner.CompanyName,
            ownerName = owner.OwnerName,
            planName = owner.SubscriptionPlan,
            status = owner.SubscriptionStatus,
            expiryDate = owner.RenewalDate.ToString("yyyy-MM-dd"),
            remainingDays,
            seatLimit = owner.SeatLimit,
            currentUsage = owner.CurrentUsage,
            remainingSeats = Math.Max(0, owner.SeatLimit - owner.CurrentUsage),
            totalEmployees = activeEmployeesCount,
            totalProjects = activeProjectsCount,
            invoices
        });
    }

    [HttpGet("admins")]
    public async Task<IActionResult> GetAdmins()
    {
        var owner = await GetCurrentOwnerAsync();
        if (owner is null) return Unauthorized();

        var admins = await dbContext.Employees
            .AsNoTracking()
            .Where(e => e.WorkspaceId == owner.WorkspaceId && (e.Role == "System Admin" || e.RolesJson.Contains("System Admin")))
            .Select(e => new
            {
                e.Id,
                e.EmployeeCode,
                e.UserId,
                e.FullName,
                e.Email,
                e.MobileNumber,
                e.Status,
                CreatedAt = e.CreatedAtUtc.ToString("yyyy-MM-dd")
            })
            .ToListAsync();

        return Ok(admins);
    }

    [HttpPost("admin/create")]
    public async Task<IActionResult> CreateAdmin([FromBody] EmployeeRequest? request, CancellationToken cancellationToken)
    {
        var owner = await GetCurrentOwnerAsync();
        if (owner is null) return Unauthorized();

        var normalized = await NormalizeRequestAsync(request, null);
        if (normalized.Error is not null)
        {
            return normalized.Error;
        }

        var input = normalized.Input!;

        // Check seat limit
        var currentActiveCount = await dbContext.Employees
            .CountAsync(e => e.WorkspaceId == owner.WorkspaceId && e.Status == "Active");
        if (currentActiveCount >= owner.SeatLimit)
        {
            return BadRequest(new { message = "Seat limit reached. Upgrade your subscription to add more users." });
        }

        var temporaryPassword = PasswordHasher.HashPassword(input.Password!);
        var employeeCode = await GenerateEmployeeCodeAsync();

        var adminEmployee = new EmployeeEntity
        {
            Id = Guid.NewGuid(),
            EmployeeCode = employeeCode,
            UserId = input.UserId ?? string.Empty,
            FullName = input.FullName,
            Email = input.Email,
            MobileNumber = input.MobileNumber,
            DateOfBirth = input.DateOfBirth,
            Gender = input.Gender,
            Role = "System Admin",
            RolesJson = "[\"System Admin\"]",
            Department = input.Department,
            Designation = input.Designation,
            ReportingManagerId = input.ReportingManagerId,
            BusinessUnit = input.BusinessUnit,
            WorkLocation = input.WorkLocation,
            Status = input.Status,
            UserType = input.UserType,
            PasswordHash = temporaryPassword.Hash,
            PasswordSalt = temporaryPassword.Salt,
            PasswordChangedAtUtc = DateTime.UtcNow,
            WorkspaceId = owner.WorkspaceId,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        var profilePhoto = await ResolveProfilePhotoAsync(adminEmployee, input.ProfilePhotoDataUrl, input.RemoveProfilePhoto);
        if (profilePhoto.Error is not null)
        {
            return profilePhoto.Error;
        }

        adminEmployee.ProfilePhotoUrl = profilePhoto.ProfilePhotoUrl;

        dbContext.Employees.Add(adminEmployee);
        owner.CurrentUsage = currentActiveCount + 1;

        await dbContext.SaveChangesAsync(cancellationToken);

        await employeeWelcomeEmailService.SendAsync(
            adminEmployee,
            input.Password!,
            ResolvePortalUrl(),
            cancellationToken);

        return Ok(new
        {
            message = "System Admin created successfully",
            admin = new
            {
                adminEmployee.Id,
                adminEmployee.EmployeeCode,
                adminEmployee.UserId,
                adminEmployee.FullName,
                adminEmployee.Email,
                adminEmployee.Status
            }
        });
    }

    [HttpPut("admin/update/{id:guid}")]
    public async Task<IActionResult> UpdateAdmin(Guid id, [FromBody] EmployeeRequest? request, CancellationToken cancellationToken)
    {
        var owner = await GetCurrentOwnerAsync();
        if (owner is null) return Unauthorized();

        var entity = await dbContext.Employees.FirstOrDefaultAsync(item => item.Id == id && item.WorkspaceId == owner.WorkspaceId, cancellationToken);
        if (entity is null)
        {
            return NotFound(new { message = "System Admin not found." });
        }

        var normalized = await NormalizeRequestAsync(request, id);
        if (normalized.Error is not null)
        {
            return normalized.Error;
        }

        var input = normalized.Input!;

        entity.FullName = input.FullName;
        entity.UserId = input.UserId ?? string.Empty;
        entity.Email = input.Email;
        entity.MobileNumber = input.MobileNumber;
        entity.DateOfBirth = input.DateOfBirth;
        entity.Gender = input.Gender;
        entity.Role = "System Admin";
        entity.RolesJson = "[\"System Admin\"]";
        entity.Department = input.Department;
        entity.Designation = input.Designation;
        entity.ReportingManagerId = input.ReportingManagerId;
        entity.BusinessUnit = input.BusinessUnit;
        entity.WorkLocation = input.WorkLocation;
        entity.Status = input.Status;
        entity.UserType = input.UserType;

        if (!string.IsNullOrWhiteSpace(input.Password))
        {
            var temporaryPassword = PasswordHasher.HashPassword(input.Password);
            entity.PasswordHash = temporaryPassword.Hash;
            entity.PasswordSalt = temporaryPassword.Salt;
            entity.PasswordChangedAtUtc = DateTime.UtcNow;
        }

        var profilePhoto = await ResolveProfilePhotoAsync(entity, input.ProfilePhotoDataUrl, input.RemoveProfilePhoto);
        if (profilePhoto.Error is not null)
        {
            return profilePhoto.Error;
        }

        entity.ProfilePhotoUrl = profilePhoto.ProfilePhotoUrl;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Unable to save admin because the record conflicts with existing data." });
        }

        return Ok(new { message = "System Admin updated successfully." });
    }

    [HttpPost("admin/deactivate")]
    public async Task<IActionResult> DeactivateAdmin([FromBody] DeactivateAdminRequest request)
    {
        var owner = await GetCurrentOwnerAsync();
        if (owner is null) return Unauthorized();

        var admin = await dbContext.Employees
            .FirstOrDefaultAsync(e => e.Id == request.AdminId && e.WorkspaceId == owner.WorkspaceId);

        if (admin is null)
        {
            return NotFound(new { message = "Admin account not found." });
        }

        admin.Status = request.Deactivate ? "Inactive" : "Active";
        admin.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        var activeCount = await dbContext.Employees
            .CountAsync(e => e.WorkspaceId == owner.WorkspaceId && e.Status == "Active");
        owner.CurrentUsage = activeCount;
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Admin account successfully {(request.Deactivate ? "deactivated" : "activated")}." });
    }

    [HttpPost("admin/reset-password")]
    public async Task<IActionResult> ResetAdminPassword([FromBody] ConsoleResetPasswordRequest request)
    {
        var owner = await GetCurrentOwnerAsync();
        if (owner is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters long." });
        }

        var admin = await dbContext.Employees
            .FirstOrDefaultAsync(e => e.Id == request.AdminId && e.WorkspaceId == owner.WorkspaceId);

        if (admin is null)
        {
            return NotFound(new { message = "Admin account not found." });
        }

        var passwordDetails = PasswordHasher.HashPassword(request.NewPassword);
        admin.PasswordHash = passwordDetails.Hash;
        admin.PasswordSalt = passwordDetails.Salt;
        admin.PasswordChangedAtUtc = DateTime.UtcNow;
        admin.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return Ok(new { message = "Admin password successfully reset." });
    }

    [HttpPost("subscription/upgrade")]
    public async Task<IActionResult> UpgradeSubscription([FromBody] UpgradePlanRequest request)
    {
        var owner = await GetCurrentOwnerAsync();
        if (owner is null) return Unauthorized();

        owner.SubscriptionPlan = request.Plan?.Trim() ?? "professional";
        owner.SeatLimit = request.Seats >= 10 ? request.Seats : 10;
        
        var rate = owner.SubscriptionPlan.ToLower() == "professional" ? 60 : 24;
        var amount = rate * owner.SeatLimit * 12; // upgrading automatically adds annual plan details
        var tax = Math.Round(amount * 0.18m);
        var totalAmount = amount + tax;

        var subscription = new SubscriptionEntity
        {
            Id = Guid.NewGuid(),
            WorkspaceId = owner.WorkspaceId,
            PlanName = owner.SubscriptionPlan,
            BillingCycle = "annual",
            Amount = totalAmount,
            Status = "Paid",
            InvoiceNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}",
            PaymentMethod = "card",
            TransactionDate = DateTime.UtcNow
        };

        dbContext.Subscriptions.Add(subscription);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = "Subscription successfully upgraded." });
    }

    [HttpPost("subscription/renew")]
    public async Task<IActionResult> RenewSubscription()
    {
        var owner = await GetCurrentOwnerAsync();
        if (owner is null) return Unauthorized();

        owner.RenewalDate = owner.RenewalDate.AddYears(1);

        var rate = owner.SubscriptionPlan.ToLower() == "professional" ? 60 : 24;
        var amount = rate * owner.SeatLimit * 12;
        var tax = Math.Round(amount * 0.18m);
        var totalAmount = amount + tax;

        var subscription = new SubscriptionEntity
        {
            Id = Guid.NewGuid(),
            WorkspaceId = owner.WorkspaceId,
            PlanName = owner.SubscriptionPlan,
            BillingCycle = "annual",
            Amount = totalAmount,
            Status = "Paid",
            InvoiceNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}",
            PaymentMethod = "card",
            TransactionDate = DateTime.UtcNow
        };

        dbContext.Subscriptions.Add(subscription);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = "Subscription successfully renewed." });
    }

    private async Task<LicenseOwnerEntity?> GetCurrentOwnerAsync()
    {
        var ownerIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(ownerIdClaim, out var ownerId)) return null;

        return await dbContext.LicenseOwners
            .FirstOrDefaultAsync(o => o.Id == ownerId);
    }

    private async Task<string> GenerateEmployeeCodeAsync()
    {
        var existingCodes = await dbContext.Employees
            .AsNoTracking()
            .Select(item => item.EmployeeCode)
            .ToListAsync();

        var maxNumber = existingCodes
            .Select(ParseEmployeeCodeNumber)
            .DefaultIfEmpty(0)
            .Max();

        return $"EMP-{maxNumber + 1:0000}";
    }

    private static int ParseEmployeeCodeNumber(string? employeeCode)
    {
        if (string.IsNullOrWhiteSpace(employeeCode)) return 0;
        var digits = new string(employeeCode.Where(char.IsDigit).ToArray());
        return int.TryParse(digits, out var value) ? value : 0;
    }

    // Config & helper methods for employee modal compatibility
    private const long MaxProfilePhotoSizeBytes = 2 * 1024 * 1024;
    private static readonly string[] AllowedGenders = ["Male", "Female", "Other", "Prefer not to say"];
    private static readonly string[] AllowedStatuses = ["Active", "Inactive"];
    private static readonly string[] AllowedWorkLocations = ["Office", "Remote", "Hybrid"];
    private static readonly string[] AllowedUserTypes = ["Internal", "Contractor", "Vendor"];
    private static readonly Dictionary<string, string> AllowedPhotoContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp"
    };

    private async Task<(IActionResult? Error, NormalizedEmployeeInput? Input)> NormalizeRequestAsync(
        EmployeeRequest? request,
        Guid? currentEmployeeId)
    {
        if (request is null)
        {
            return (BadRequest(new { message = "Employee details are required." }), null);
        }

        var fullName = request.FullName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return (BadRequest(new { message = "Full name is required." }), null);
        }

        var userId = request.UserId?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(userId))
        {
            return (BadRequest(new { message = "User ID is required." }), null);
        }

        if (userId.Any(char.IsWhiteSpace))
        {
            return (BadRequest(new { message = "User ID cannot contain spaces." }), null);
        }

        var existingUserIdOwner = await dbContext.Employees
            .AsNoTracking()
            .Where(item => item.Id != currentEmployeeId && item.UserId.ToLower() == userId)
            .Select(item => new { item.EmployeeCode, item.FullName })
            .FirstOrDefaultAsync();

        if (existingUserIdOwner is not null)
        {
            return (Conflict(new { message = $"User ID already exists for {existingUserIdOwner.FullName} ({existingUserIdOwner.EmployeeCode})." }), null);
        }

        var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(normalizedEmail) || !normalizedEmail.Contains('@') || !normalizedEmail.Contains('.'))
        {
            return (BadRequest(new { message = "Enter a valid email address." }), null);
        }

        if (await dbContext.Employees.AnyAsync(item => item.Id != currentEmployeeId && item.Email.ToLower() == normalizedEmail))
        {
            return (Conflict(new { message = "Email already exists." }), null);
        }

        var mobileNumber = request.MobileNumber?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(mobileNumber) || mobileNumber.Count(char.IsDigit) < 8)
        {
            return (BadRequest(new { message = "Enter a valid mobile number." }), null);
        }

        if (string.IsNullOrWhiteSpace(request.DateOfBirth) || !DateOnly.TryParse(request.DateOfBirth.Trim(), out var dateOfBirth))
        {
            return (BadRequest(new { message = "Enter a valid date of birth." }), null);
        }

        if (dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            return (BadRequest(new { message = "Date of birth cannot be in the future." }), null);
        }

        var gender = NormalizeChoice(request.Gender, AllowedGenders);
        if (gender is null)
        {
            return (BadRequest(new { message = $"Gender must be one of: {string.Join(", ", AllowedGenders)}." }), null);
        }

        var normalizedDepartment = request.Department?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedDepartment))
        {
            normalizedDepartment = "IT & Administration";
        }

        var department = await dbContext.Departments
            .AsNoTracking()
            .FirstOrDefaultAsync(item =>
                item.Status == "Active" &&
                item.Name.ToLower() == normalizedDepartment.ToLower());

        var finalDepartment = department?.Name ?? normalizedDepartment;

        var designation = request.Designation?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(designation))
        {
            return (BadRequest(new { message = "Designation is required." }), null);
        }

        Guid? reportingManagerId = null;
        if (!string.IsNullOrWhiteSpace(request.ReportingManagerId))
        {
            if (!Guid.TryParse(request.ReportingManagerId, out var parsedManagerId))
            {
                return (BadRequest(new { message = "Reporting manager is invalid." }), null);
            }

            if (currentEmployeeId.HasValue && parsedManagerId == currentEmployeeId.Value)
            {
                return (BadRequest(new { message = "An employee cannot report to themselves." }), null);
            }

            var manager = await dbContext.Employees
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == parsedManagerId);

            if (manager is null || manager.Status != "Active")
            {
                return (BadRequest(new { message = "Reporting manager must be an active employee." }), null);
            }

            reportingManagerId = manager.Id;
        }

        var businessUnit = request.BusinessUnit?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(businessUnit))
        {
            return (BadRequest(new { message = "Business unit is required." }), null);
        }

        var workLocation = NormalizeChoice(request.WorkLocation, AllowedWorkLocations);
        if (workLocation is null)
        {
            return (BadRequest(new { message = $"Work location must be one of: {string.Join(", ", AllowedWorkLocations)}." }), null);
        }

        var status = NormalizeChoice(request.Status, AllowedStatuses);
        if (status is null)
        {
            return (BadRequest(new { message = $"Status must be one of: {string.Join(", ", AllowedStatuses)}." }), null);
        }

        var userType = NormalizeChoice(request.UserType, AllowedUserTypes);
        if (userType is null)
        {
            return (BadRequest(new { message = $"User type must be one of: {string.Join(", ", AllowedUserTypes)}." }), null);
        }

        var password = request.Password?.Trim();
        if (!string.IsNullOrWhiteSpace(password) && password.Length < 8)
        {
            return (BadRequest(new { message = "Temporary password must be at least 8 characters long." }), null);
        }

        if (!currentEmployeeId.HasValue && string.IsNullOrWhiteSpace(password))
        {
            return (BadRequest(new { message = "Password is required when creating an employee." }), null);
        }

        return (null, new NormalizedEmployeeInput(
            fullName,
            userId,
            normalizedEmail,
            mobileNumber,
            dateOfBirth,
            gender,
            finalDepartment,
            designation,
            reportingManagerId,
            businessUnit,
            workLocation,
            status,
            userType,
            password,
            request.ProfilePhotoDataUrl?.Trim(),
            request.RemoveProfilePhoto));
    }

    private static string? NormalizeChoice(string? value, IEnumerable<string> allowedValues)
    {
        var normalized = value?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }
        return allowedValues.FirstOrDefault(item => string.Equals(item, normalized, StringComparison.OrdinalIgnoreCase));
    }

    private async Task<(IActionResult? Error, string? ProfilePhotoUrl)> ResolveProfilePhotoAsync(
        EmployeeEntity entity,
        string? requestedPhotoDataUrl,
        bool removeProfilePhoto)
    {
        if (removeProfilePhoto)
        {
            DeleteOwnedProfilePhoto(entity.ProfilePhotoUrl, EnsureProfileUploadsRoot());
            return (null, null);
        }

        if (string.IsNullOrWhiteSpace(requestedPhotoDataUrl))
        {
            return (null, entity.ProfilePhotoUrl);
        }

        var normalizedPhoto = requestedPhotoDataUrl.Trim();
        var currentAbsoluteUrl = BuildAbsoluteAssetUrl(entity.ProfilePhotoUrl);
        if (string.Equals(normalizedPhoto, entity.ProfilePhotoUrl, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedPhoto, currentAbsoluteUrl, StringComparison.OrdinalIgnoreCase))
        {
            return (null, entity.ProfilePhotoUrl);
        }

        if (!TryDecodeProfilePhotoDataUrl(normalizedPhoto, out var photoBytes, out var extension, out var errorMessage))
        {
            return (BadRequest(new { message = errorMessage }), null);
        }

        var uploadsRoot = EnsureProfileUploadsRoot();
        DeleteOwnedProfilePhoto(entity.ProfilePhotoUrl, uploadsRoot);

        var fileName = $"{entity.Id:N}-{DateTime.UtcNow:yyyyMMddHHmmssfff}{extension}";
        var absolutePath = Path.Combine(uploadsRoot, fileName);
        await System.IO.File.WriteAllBytesAsync(absolutePath, photoBytes);

        return (null, $"/uploads/profile/{fileName}");
    }

    private static bool TryDecodeProfilePhotoDataUrl(
        string value,
        out byte[] photoBytes,
        out string extension,
        out string errorMessage)
    {
        photoBytes = [];
        extension = string.Empty;
        errorMessage = string.Empty;

        const string prefix = "data:";
        const string base64Marker = ";base64,";
        if (!value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            errorMessage = "Profile photo data is invalid.";
            return false;
        }

        var markerIndex = value.IndexOf(base64Marker, StringComparison.OrdinalIgnoreCase);
        if (markerIndex <= prefix.Length)
        {
            errorMessage = "Profile photo data is invalid.";
            return false;
        }

        var contentType = value[prefix.Length..markerIndex].Trim();
        if (!AllowedPhotoContentTypes.TryGetValue(contentType, out var resolvedExtension) ||
            string.IsNullOrWhiteSpace(resolvedExtension))
        {
            errorMessage = "Only JPG, PNG, and WEBP images are allowed.";
            return false;
        }

        extension = resolvedExtension;

        try
        {
            photoBytes = Convert.FromBase64String(value[(markerIndex + base64Marker.Length)..]);
        }
        catch (FormatException)
        {
            errorMessage = "Profile photo data is invalid.";
            return false;
        }

        if (photoBytes.Length == 0)
        {
            errorMessage = "Please choose an image to upload.";
            return false;
        }

        if (photoBytes.Length > MaxProfilePhotoSizeBytes)
        {
            errorMessage = "Profile photo must be 2 MB or smaller.";
            return false;
        }

        return true;
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

    private string ResolvePortalUrl()
    {
        if (TryResolveAbsoluteUrl(Request.Headers.Origin.FirstOrDefault(), out var originUrl))
        {
            return originUrl;
        }

        if (TryResolveAbsoluteUrl(Request.Headers.Referer.FirstOrDefault(), out var refererUrl))
        {
            return refererUrl;
        }

        return $"{Request.Scheme}://{Request.Host}".TrimEnd('/');
    }

    private static bool TryResolveAbsoluteUrl(string? value, out string resolvedUrl)
    {
        resolvedUrl = string.Empty;
        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri))
        {
            return false;
        }

        resolvedUrl = uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
        return true;
    }

    private sealed record NormalizedEmployeeInput(
        string FullName,
        string UserId,
        string Email,
        string MobileNumber,
        DateOnly DateOfBirth,
        string Gender,
        string Department,
        string Designation,
        Guid? ReportingManagerId,
        string BusinessUnit,
        string WorkLocation,
        string Status,
        string UserType,
        string? Password,
        string? ProfilePhotoDataUrl,
        bool RemoveProfilePhoto);
}

public sealed class CreateAdminRequest
{
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? MobileNumber { get; set; }
    public string? Password { get; set; }
}

public sealed class DeactivateAdminRequest
{
    public Guid AdminId { get; set; }
    public bool Deactivate { get; set; }
}

public sealed class ConsoleResetPasswordRequest
{
    public Guid AdminId { get; set; }
    public string? NewPassword { get; set; }
}

public sealed class UpgradePlanRequest
{
    public string? Plan { get; set; }
    public int Seats { get; set; }
}

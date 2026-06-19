using AbhiTimesheet.Api.Contracts.Employees;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using AbhiTimesheet.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class EmployeesController(
    AppDbContext dbContext,
    IWebHostEnvironment environment,
    EmployeeWelcomeEmailService employeeWelcomeEmailService) : ControllerBase
{
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

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EmployeeDto>>> GetEmployees()
    {
        var employees = await dbContext.Employees
            .AsNoTracking()
            .OrderByDescending(item => item.CreatedAtUtc)
            .ToListAsync();

        var managerLookup = employees.ToDictionary(item => item.Id, item => item.FullName);

        return Ok(
            employees
                .Select(item =>
                    Map(
                        item,
                        item.ReportingManagerId.HasValue && managerLookup.TryGetValue(item.ReportingManagerId.Value, out var managerName)
                            ? managerName
                            : null))
                .ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EmployeeDto>> GetEmployee(Guid id, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (employee is null)
        {
            return NotFound(new { message = "Employee not found." });
        }

        var reportingManagerName = employee.ReportingManagerId.HasValue
            ? await dbContext.Employees
                .AsNoTracking()
                .Where(item => item.Id == employee.ReportingManagerId.Value)
                .Select(item => item.FullName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return Ok(Map(employee, reportingManagerName));
    }

    [HttpPost]
    public async Task<IActionResult> CreateEmployee([FromBody] EmployeeRequest? request, CancellationToken cancellationToken)
    {
        var normalized = await NormalizeRequestAsync(request, null);
        if (normalized.Error is not null)
        {
            return normalized.Error;
        }

        var input = normalized.Input!;
        var temporaryPassword = PasswordHasher.HashPassword(input.Password!);

        var entity = new EmployeeEntity
        {
            Id = Guid.NewGuid(),
            EmployeeCode = await GenerateEmployeeCodeAsync(),
            UserId = input.UserId ?? string.Empty,
            FullName = input.FullName,
            Email = input.Email,
            MobileNumber = input.MobileNumber,
            DateOfBirth = input.DateOfBirth,
            Gender = input.Gender,
            Role = input.Role,
            RolesJson = RoleCatalog.SerializeRoles(input.Roles),
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
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        var profilePhoto = await ResolveProfilePhotoAsync(entity, input.ProfilePhotoDataUrl, input.RemoveProfilePhoto);
        if (profilePhoto.Error is not null)
        {
            return profilePhoto.Error;
        }

        entity.ProfilePhotoUrl = profilePhoto.ProfilePhotoUrl;

        dbContext.Employees.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        var welcomeEmail = await employeeWelcomeEmailService.SendAsync(
            entity,
            input.Password!,
            ResolvePortalUrl(),
            cancellationToken);

        var reportingManagerName = input.ReportingManagerId.HasValue
            ? await dbContext.Employees
                .AsNoTracking()
                .Where(item => item.Id == input.ReportingManagerId.Value)
                .Select(item => item.FullName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return StatusCode(
            StatusCodes.Status201Created,
            new EmployeeCreateResultDto(
                Map(entity, reportingManagerName),
                new EmployeeWelcomeEmailStatusDto(welcomeEmail.WasSent, welcomeEmail.Message)));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateEmployee(Guid id, [FromBody] EmployeeRequest? request, CancellationToken cancellationToken)
    {
        var entity = await dbContext.Employees.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound(new { message = "Employee not found." });
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
        entity.Role = input.Role;
        entity.RolesJson = RoleCatalog.SerializeRoles(input.Roles);
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
            return Conflict(new { message = "Unable to save employee because the record conflicts with existing employee data. Please refresh and try again." });
        }

        var reportingManagerName = input.ReportingManagerId.HasValue
            ? await dbContext.Employees
                .AsNoTracking()
                .Where(item => item.Id == input.ReportingManagerId.Value)
                .Select(item => item.FullName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return Ok(Map(entity, reportingManagerName));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteEmployee(Guid id, CancellationToken cancellationToken)
    {
        var entity = await dbContext.Employees.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound(new { message = "Employee not found." });
        }

        var profilePhotoUrl = entity.ProfilePhotoUrl;
        var executionStrategy = dbContext.Database.CreateExecutionStrategy();

        try
        {
            await executionStrategy.ExecuteAsync(async () =>
            {
                await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

                await DeleteEmployeeOwnedRecordsAsync(entity, cancellationToken);
                RemoveEmployeeFromProjectTeams(entity);

                await dbContext.Employees
                    .Where(item => item.ReportingManagerId == id)
                    .ExecuteUpdateAsync(
                        setters => setters
                            .SetProperty(item => item.ReportingManagerId, (Guid?)null)
                            .SetProperty(item => item.UpdatedAtUtc, DateTime.UtcNow),
                        cancellationToken);

                await dbContext.Departments
                    .Where(item => item.HeadEmployeeId == id)
                    .ExecuteUpdateAsync(
                        setters => setters
                            .SetProperty(item => item.HeadEmployeeId, (Guid?)null)
                            .SetProperty(item => item.UpdatedAtUtc, DateTime.UtcNow),
                        cancellationToken);

                dbContext.Employees.Remove(entity);
                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            });
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Unable to delete employee because linked records still reference this user. Please refresh and try again." });
        }

        DeleteOwnedProfilePhoto(profilePhotoUrl, EnsureProfileUploadsRoot());

        return NoContent();
    }

    private async Task DeleteEmployeeOwnedRecordsAsync(EmployeeEntity employee, CancellationToken cancellationToken)
    {
        var employeeId = employee.Id;

        await dbContext.DailyTimesheetEntries
            .Where(item => item.DailyTimesheet.UserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.DailyTimesheets
            .Where(item => item.UserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.WeeklyTimesheets
            .Where(item => item.UserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.WeeklyTimesheets
            .Where(item => item.AdminId == employeeId)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(item => item.AdminId, Guid.Empty)
                    .SetProperty(item => item.AdminName, string.Empty)
                    .SetProperty(item => item.UpdatedAtUtc, DateTime.UtcNow),
                cancellationToken);

        await dbContext.TaskAssignments
            .Where(item => item.AssignedTo == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.LeaveRequests
            .Where(item => item.EmployeeId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.LeaveRequests
            .Where(item => item.AdminId == employeeId)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(item => item.AdminId, Guid.Empty)
                    .SetProperty(item => item.AdminName, string.Empty),
                cancellationToken);

        await dbContext.Projects
            .Where(item => item.AdminId == employeeId)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(item => item.AdminId, Guid.Empty)
                    .SetProperty(item => item.AdminName, string.Empty),
                cancellationToken);

        await dbContext.Projects
            .Where(item => item.ManagerId == employeeId)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(item => item.ManagerId, Guid.Empty)
                    .SetProperty(item => item.ManagerName, string.Empty)
                    .SetProperty(item => item.ProjectLead, string.Empty)
                    .SetProperty(item => item.ManagerRolePromotionApplied, false)
                    .SetProperty(item => item.ManagerOriginalRole, string.Empty)
                    .SetProperty(item => item.ManagerOriginalRolesJson, "[]"),
                cancellationToken);

        await dbContext.PasswordChangeRequests
            .Where(item => item.UserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.PasswordChangeRequests
            .Where(item => item.ReviewedByUserId == employeeId)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(item => item.ReviewedByUserId, (Guid?)null)
                    .SetProperty(item => item.ReviewedByName, string.Empty)
                    .SetProperty(item => item.UpdatedAtUtc, DateTime.UtcNow),
                cancellationToken);

        var requestIds = await dbContext.LateTimesheetRequests
            .Where(item => item.UserId == employeeId)
            .Select(item => item.Id)
            .ToListAsync(cancellationToken);

        if (requestIds.Count > 0)
        {
            await dbContext.LateTimesheetRequestItems
                .Where(item => requestIds.Contains(item.RequestId))
                .ExecuteDeleteAsync(cancellationToken);
        }

        await dbContext.LateTimesheetRequestItems
            .Where(item => item.ManagerId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.LateTimesheetRequests
            .Where(item => item.UserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.UserLoginActivities
            .Where(item => item.UserId == employeeId || item.AttemptedEmail.ToLower() == employee.Email.ToLower())
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.AccountAuditLogs
            .Where(item => item.SubjectUserId == employeeId || item.ActorUserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ChatNotificationPreferences
            .Where(item => item.UserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ChatPresences
            .Where(item => item.UserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ChatReactions
            .Where(item => item.UserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ChatAttachments
            .Where(item => item.UploadedByUserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ChatParticipants
            .Where(item => item.UserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);

        await dbContext.ChatThreads
            .Where(item => item.CreatedByUserId == employeeId || item.ArchivedByUserId == employeeId)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(item => item.CreatedByUserId, (Guid?)null)
                    .SetProperty(item => item.ArchivedByUserId, (Guid?)null)
                    .SetProperty(item => item.UpdatedAtUtc, DateTime.UtcNow),
                cancellationToken);

        await dbContext.ChatMessages
            .Where(item => item.PinnedByUserId == employeeId || item.DeletedByUserId == employeeId)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(item => item.PinnedByUserId, (Guid?)null)
                    .SetProperty(item => item.DeletedByUserId, (Guid?)null),
                cancellationToken);

        await dbContext.ChatMessages
            .Where(item => item.SenderUserId == employeeId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private void RemoveEmployeeFromProjectTeams(EmployeeEntity employee)
    {
        var employeeId = employee.Id.ToString();
        var employeeName = employee.FullName.Trim();
        var projects = dbContext.Projects
            .AsEnumerable()
            .Where(item =>
                JsonListSerializer.Deserialize(item.TeamMemberIdsJson).Any(teamMemberId => string.Equals(teamMemberId, employeeId, StringComparison.OrdinalIgnoreCase)) ||
                JsonListSerializer.Deserialize(item.TeamMemberNamesJson).Any(teamMemberName => string.Equals(teamMemberName, employeeName, StringComparison.OrdinalIgnoreCase)))
            .ToList();

        foreach (var project in projects)
        {
            var memberIds = JsonListSerializer.Deserialize(project.TeamMemberIdsJson).ToList();
            var memberNames = JsonListSerializer.Deserialize(project.TeamMemberNamesJson).ToList();

            var filteredMembers = memberIds
                .Select((memberId, index) => new
                {
                    Id = memberId,
                    Name = index < memberNames.Count ? memberNames[index] : string.Empty
                })
                .Where(item =>
                    !string.Equals(item.Id, employeeId, StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(item.Name, employeeName, StringComparison.OrdinalIgnoreCase))
                .ToList();

            project.TeamMemberIdsJson = JsonListSerializer.Serialize(filteredMembers.Select(item => item.Id));
            project.TeamMemberNamesJson = JsonListSerializer.Serialize(filteredMembers.Select(item => item.Name));
            project.TeamSize = filteredMembers.Count;
        }
    }

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

        var requestedRoles = (request.Roles ?? [])
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .ToList();

        if (requestedRoles.Count == 0 && !string.IsNullOrWhiteSpace(request.Role))
        {
            requestedRoles.Add(request.Role);
        }

        if (requestedRoles.Count == 0)
        {
            requestedRoles.Add(RoleCatalog.Employee);
        }

        var invalidRoles = requestedRoles
            .Select(RoleCatalog.NormalizeRole)
            .Where(role => !RoleCatalog.IsValidRole(role))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (invalidRoles.Count > 0)
        {
            return (BadRequest(new { message = $"Role must be one of: {string.Join(", ", RoleCatalog.All)}." }), null);
        }

        var normalizedRoles = RoleCatalog.NormalizeRoles(requestedRoles);
        var normalizedRole = RoleCatalog.GetPrimaryRole(normalizedRoles);

        var normalizedDepartment = request.Department?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(normalizedDepartment))
        {
            return (BadRequest(new { message = "Department is required." }), null);
        }

        var department = await dbContext.Departments
            .AsNoTracking()
            .FirstOrDefaultAsync(item =>
                item.Status == "Active" &&
                item.Name.ToLower() == normalizedDepartment.ToLower());

        if (department is null)
        {
            return (BadRequest(new { message = "Select a valid active department." }), null);
        }

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
            normalizedRole,
            normalizedRoles,
            department.Name,
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
        if (string.IsNullOrWhiteSpace(employeeCode))
        {
            return 0;
        }

        var digits = new string(employeeCode.Where(char.IsDigit).ToArray());
        return int.TryParse(digits, out var value) ? value : 0;
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

    private EmployeeDto Map(EmployeeEntity entity, string? reportingManagerName)
    {
        return new EmployeeDto(
            entity.Id.ToString(),
            entity.EmployeeCode,
            entity.UserId,
            entity.FullName,
            entity.Email,
            entity.MobileNumber,
            entity.DateOfBirth?.ToString("yyyy-MM-dd") ?? string.Empty,
            entity.Gender,
            RoleCatalog.GetPrimaryRole(entity.RolesJson, entity.Role),
            RoleCatalog.ParseRoles(entity.RolesJson, entity.Role),
            entity.Department,
            entity.Designation,
            entity.ReportingManagerId?.ToString(),
            reportingManagerName,
            entity.BusinessUnit,
            entity.WorkLocation,
            entity.Status,
            entity.UserType,
            BuildAbsoluteAssetUrl(entity.ProfilePhotoUrl),
            entity.CreatedAtUtc.ToString("O"));
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
        string Role,
        IReadOnlyList<string> Roles,
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

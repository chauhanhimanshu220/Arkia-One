using AbhiTimesheet.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Data;

public static class AppDbInitializer
{
    private static readonly Guid[] SeedEmployeeIds =
    [
        Guid.Parse("00000000-0000-0000-0000-000000000001"),
        Guid.Parse("00000000-0000-0000-0000-000000000002"),
        Guid.Parse("11111111-1111-1111-1111-111111111101"),
        Guid.Parse("11111111-1111-1111-1111-111111111102"),
        Guid.Parse("11111111-1111-1111-1111-111111111103"),
        Guid.Parse("11111111-1111-1111-1111-111111111104"),
        Guid.Parse("11111111-1111-1111-1111-111111111105"),
        Guid.Parse("11111111-1111-1111-1111-111111111106"),
        Guid.Parse("11111111-1111-1111-1111-111111111107"),
        Guid.Parse("11111111-1111-1111-1111-111111111108")
    ];

    private static readonly Guid[] SeedProjectIds =
    [
        Guid.Parse("22222222-2222-2222-2222-222222222201"),
        Guid.Parse("22222222-2222-2222-2222-222222222202"),
        Guid.Parse("22222222-2222-2222-2222-222222222203"),
        Guid.Parse("22222222-2222-2222-2222-222222222204"),
        Guid.Parse("22222222-2222-2222-2222-222222222205")
    ];

    private static readonly Guid[] SeedTaskIds =
    [
        Guid.Parse("33333333-3333-3333-3333-333333333301"),
        Guid.Parse("33333333-3333-3333-3333-333333333302"),
        Guid.Parse("33333333-3333-3333-3333-333333333303"),
        Guid.Parse("33333333-3333-3333-3333-333333333304"),
        Guid.Parse("33333333-3333-3333-3333-333333333305")
    ];

    private static readonly Guid[] SeedLeaveIds =
    [
        Guid.Parse("44444444-4444-4444-4444-444444444401"),
        Guid.Parse("44444444-4444-4444-4444-444444444402"),
        Guid.Parse("44444444-4444-4444-4444-444444444403")
    ];

    private static readonly Guid[] SeedDailyTimesheetIds =
    [
        Guid.Parse("55555555-5555-5555-5555-555555555501"),
        Guid.Parse("55555555-5555-5555-5555-555555555502"),
        Guid.Parse("55555555-5555-5555-5555-555555555503")
    ];

    private static readonly Guid[] SeedWeeklyTimesheetIds =
    [
        Guid.Parse("66666666-6666-6666-6666-666666666601"),
        Guid.Parse("66666666-6666-6666-6666-666666666602")
    ];

    public static async Task SeedAsync(AppDbContext dbContext)
    {
        await CleanupSeededDataAsync(dbContext);
        await NormalizeExistingTasksAsync(dbContext);
        await NormalizeExistingEmployeesAsync(dbContext);
        await EnsureDepartmentsAsync(dbContext);
        await dbContext.SaveChangesAsync();
    }

    private static async Task CleanupSeededDataAsync(AppDbContext dbContext)
    {
        var dailyTimesheets = await dbContext.DailyTimesheets
            .Where(item => SeedDailyTimesheetIds.Contains(item.Id))
            .ToListAsync();

        if (dailyTimesheets.Count > 0)
        {
            dbContext.DailyTimesheets.RemoveRange(dailyTimesheets);
        }

        var weeklyTimesheets = await dbContext.WeeklyTimesheets
            .Where(item => SeedWeeklyTimesheetIds.Contains(item.Id))
            .ToListAsync();

        if (weeklyTimesheets.Count > 0)
        {
            dbContext.WeeklyTimesheets.RemoveRange(weeklyTimesheets);
        }

        var leaves = await dbContext.LeaveRequests
            .Where(item => SeedLeaveIds.Contains(item.Id))
            .ToListAsync();

        if (leaves.Count > 0)
        {
            dbContext.LeaveRequests.RemoveRange(leaves);
        }

        var tasks = await dbContext.TaskAssignments
            .Where(item => SeedTaskIds.Contains(item.Id))
            .ToListAsync();

        if (tasks.Count > 0)
        {
            dbContext.TaskAssignments.RemoveRange(tasks);
        }

        var projects = await dbContext.Projects
            .Where(item => SeedProjectIds.Contains(item.Id))
            .ToListAsync();

        if (projects.Count > 0)
        {
            dbContext.Projects.RemoveRange(projects);
        }

        var employees = await dbContext.Employees
            .Where(item => SeedEmployeeIds.Contains(item.Id))
            .ToListAsync();

        if (employees.Count > 0)
        {
            dbContext.Employees.RemoveRange(employees);
        }
    }

    private static async Task NormalizeExistingEmployeesAsync(AppDbContext dbContext)
    {
        var employees = await dbContext.Employees.ToListAsync();
        var nextEmployeeCode = employees
            .Select(item => ParseEmployeeCodeNumber(item.EmployeeCode))
            .DefaultIfEmpty(0)
            .Max() + 1;
        var usedUserIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var employee in employees
            .OrderBy(item => item.CreatedAtUtc == default ? DateTime.MinValue : item.CreatedAtUtc)
            .ThenBy(item => item.Id))
        {
            var normalizedRoles = Infrastructure.RoleCatalog.ParseRoles(employee.RolesJson, employee.Role);
            employee.Role = Infrastructure.RoleCatalog.GetPrimaryRole(normalizedRoles);
            employee.RolesJson = Infrastructure.RoleCatalog.SerializeRoles(normalizedRoles);
            employee.EmployeeCode = string.IsNullOrWhiteSpace(employee.EmployeeCode)
                ? BuildEmployeeCode(nextEmployeeCode++)
                : employee.EmployeeCode.Trim().ToUpperInvariant();
            employee.UserId = BuildUniqueUserId(employee.UserId, employee, usedUserIds);
            employee.MobileNumber = employee.MobileNumber?.Trim() ?? string.Empty;
            employee.Gender = string.IsNullOrWhiteSpace(employee.Gender) ? "Prefer not to say" : employee.Gender.Trim();
            employee.Designation = string.IsNullOrWhiteSpace(employee.Designation)
                ? employee.Role
                : employee.Designation.Trim();
            employee.BusinessUnit = string.IsNullOrWhiteSpace(employee.BusinessUnit)
                ? employee.Department
                : employee.BusinessUnit.Trim();
            employee.WorkLocation = string.IsNullOrWhiteSpace(employee.WorkLocation) ? "Office" : employee.WorkLocation.Trim();
            employee.UserType = string.IsNullOrWhiteSpace(employee.UserType) ? "Internal" : employee.UserType.Trim();
            employee.Status = employee.Status == "Inactive" ? "Inactive" : "Active";
            employee.UpdatedAtUtc = employee.UpdatedAtUtc == default
                ? (employee.CreatedAtUtc == default ? DateTime.UtcNow : employee.CreatedAtUtc)
                : employee.UpdatedAtUtc;
        }
    }

    private static async Task NormalizeExistingTasksAsync(AppDbContext dbContext)
    {
        var tasks = await dbContext.TaskAssignments
            .OrderBy(item => item.CreatedAtUtc)
            .ThenBy(item => item.Id)
            .ToListAsync();

        var groupIdsBySignature = new Dictionary<string, Guid>(StringComparer.Ordinal);

        foreach (var task in tasks)
        {
            var signature = BuildTaskGroupingSignature(task);

            if (task.TaskGroupId != Guid.Empty && task.TaskGroupId != task.Id)
            {
                groupIdsBySignature.TryAdd(signature, task.TaskGroupId);
                continue;
            }

            if (!groupIdsBySignature.TryGetValue(signature, out var groupId))
            {
                groupId = Guid.NewGuid();
                groupIdsBySignature[signature] = groupId;
            }

            task.TaskGroupId = groupId;
        }
    }

    private static async Task EnsureDepartmentsAsync(AppDbContext dbContext)
    {
        var departments = await dbContext.Departments.ToListAsync();
        var employees = await dbContext.Employees.AsNoTracking().ToListAsync();
        var projects = await dbContext.Projects.AsNoTracking().ToListAsync();
        var leaves = await dbContext.LeaveRequests.AsNoTracking().ToListAsync();

        var referencedNames = employees
            .Select(item => item.Department)
            .Concat(projects.Select(item => item.Department))
            .Concat(leaves.Select(item => item.Department))
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item)
            .ToList();

        var usedCodes = new HashSet<string>(
            departments.Select(item => item.Code),
            StringComparer.OrdinalIgnoreCase);

        foreach (var name in referencedNames)
        {
            var existing = departments.FirstOrDefault(item => string.Equals(item.Name, name, StringComparison.OrdinalIgnoreCase));
            if (existing is not null)
            {
                if (existing.HeadEmployeeId is null)
                {
                    var suggestedHead = employees
                        .Where(item =>
                            item.Status == "Active" &&
                            string.Equals(item.Department, existing.Name, StringComparison.OrdinalIgnoreCase) &&
                            Infrastructure.RoleCatalog.GetPrimaryRole(item.RolesJson, item.Role) != Infrastructure.RoleCatalog.Employee)
                        .OrderBy(item => item.FullName)
                        .FirstOrDefault();

                    if (suggestedHead is not null)
                    {
                        existing.HeadEmployeeId = suggestedHead.Id;
                        existing.UpdatedAtUtc = DateTime.UtcNow;
                    }
                }

                continue;
            }

            var suggestedHeadEmployee = employees
                .Where(item =>
                    item.Status == "Active" &&
                    string.Equals(item.Department, name, StringComparison.OrdinalIgnoreCase) &&
                    Infrastructure.RoleCatalog.GetPrimaryRole(item.RolesJson, item.Role) != Infrastructure.RoleCatalog.Employee)
                .OrderBy(item => item.FullName)
                .FirstOrDefault();

            var department = new DepartmentEntity
            {
                Id = Guid.NewGuid(),
                Name = name,
                Code = BuildDepartmentCode(name, usedCodes),
                Description = string.Empty,
                ParentDepartmentId = null,
                HeadEmployeeId = suggestedHeadEmployee?.Id,
                EmailAlias = string.Empty,
                CostCenter = string.Empty,
                Status = "Active",
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };

            usedCodes.Add(department.Code);
            departments.Add(department);
            dbContext.Departments.Add(department);
        }
    }

    private static string BuildDepartmentCode(string departmentName, ISet<string> usedCodes)
    {
        var words = departmentName
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var baseCode = words.Length switch
        {
            0 => "DEPT",
            1 => words[0][..Math.Min(3, words[0].Length)].ToUpperInvariant(),
            _ => string.Concat(words.Select(word => word[0])).ToUpperInvariant()
        };

        if (string.IsNullOrWhiteSpace(baseCode))
        {
            baseCode = "DEPT";
        }

        var candidate = baseCode;
        var suffix = 1;
        while (usedCodes.Contains(candidate))
        {
            suffix++;
            candidate = $"{baseCode}{suffix}";
        }

        return candidate;
    }

    private static string BuildEmployeeCode(int sequence) => $"EMP-{sequence:0000}";

    private static string BuildUniqueUserId(string? requestedUserId, EmployeeEntity employee, ISet<string> usedUserIds)
    {
        var baseUserId = NormalizeUserIdCandidate(requestedUserId);
        if (string.IsNullOrWhiteSpace(baseUserId))
        {
            baseUserId = GenerateFallbackUserId(employee);
        }

        if (string.IsNullOrWhiteSpace(baseUserId))
        {
            baseUserId = $"user-{employee.Id.ToString("N")[..8]}";
        }

        var candidate = baseUserId;
        var suffix = 1;
        while (usedUserIds.Contains(candidate))
        {
            candidate = $"{baseUserId}{suffix}";
            suffix++;
        }

        usedUserIds.Add(candidate);
        return candidate;
    }

    private static string GenerateFallbackUserId(EmployeeEntity employee)
    {
        var fromName = NormalizeUserIdCandidate(
            string.Join(
                ".",
                employee.FullName
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)));
        if (!string.IsNullOrWhiteSpace(fromName))
        {
            return fromName;
        }

        var fromEmail = NormalizeUserIdCandidate(employee.Email?.Split('@')[0]);
        if (!string.IsNullOrWhiteSpace(fromEmail))
        {
            return fromEmail;
        }

        var fromEmployeeCode = NormalizeUserIdCandidate(employee.EmployeeCode.Replace("-", string.Empty));
        if (!string.IsNullOrWhiteSpace(fromEmployeeCode))
        {
            return fromEmployeeCode;
        }

        return string.Empty;
    }

    private static string NormalizeUserIdCandidate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return string.Join(
            ".",
            value
                .Trim()
                .ToLowerInvariant()
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
    }

    private static string BuildTaskGroupingSignature(TaskAssignmentEntity task)
    {
        var fiveMinuteBucket = task.CreatedAtUtc == default
            ? "0"
            : (task.CreatedAtUtc.ToUniversalTime().Ticks / TimeSpan.FromMinutes(5).Ticks).ToString();

        return string.Join(
            "|",
            task.ProjectId,
            task.Title.Trim().ToUpperInvariant(),
            task.Description.Trim().ToUpperInvariant(),
            task.StartDate,
            task.EndDate,
            task.TotalHours.ToString("0.####", System.Globalization.CultureInfo.InvariantCulture),
            task.Status.Trim().ToUpperInvariant(),
            fiveMinuteBucket);
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
}

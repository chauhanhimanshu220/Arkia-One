using AbhiTimesheet.Api.Contracts.Departments;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class DepartmentsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DepartmentListDto>>> GetDepartments(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] bool? hasHead,
        [FromQuery] bool? hasEmployees,
        [FromQuery] string? parentDepartmentId)
    {
        var rows = await BuildDepartmentRowsAsync();
        var filtered = rows.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var query = search.Trim().ToLowerInvariant();
            filtered = filtered.Where(item =>
                item.Department.Name.ToLowerInvariant().Contains(query) ||
                item.Department.Code.ToLowerInvariant().Contains(query) ||
                (item.HeadEmployeeName?.ToLowerInvariant().Contains(query) ?? false));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = NormalizeStatus(status);
            filtered = filtered.Where(item => item.Department.Status == normalizedStatus);
        }

        if (hasHead.HasValue)
        {
            filtered = filtered.Where(item => hasHead.Value ? item.Department.HeadEmployeeId.HasValue : !item.Department.HeadEmployeeId.HasValue);
        }

        if (hasEmployees.HasValue)
        {
            filtered = filtered.Where(item => hasEmployees.Value ? item.EmployeeCount > 0 : item.EmployeeCount == 0);
        }

        if (Guid.TryParse(parentDepartmentId, out var parsedParentId))
        {
            filtered = filtered.Where(item => item.Department.ParentDepartmentId == parsedParentId);
        }

        return Ok(filtered
            .OrderBy(item => item.Department.Name)
            .Select(MapList)
            .ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DepartmentDetailDto>> GetDepartment(Guid id)
    {
        var rows = await BuildDepartmentRowsAsync();
        var row = rows.FirstOrDefault(item => item.Department.Id == id);

        if (row is null)
        {
            return NotFound(new { message = "Department not found." });
        }

        return Ok(MapDetail(row));
    }

    [HttpPost]
    public async Task<ActionResult<DepartmentDetailDto>> CreateDepartment([FromBody] DepartmentRequest request)
    {
        var normalizedName = request.Name.Trim();
        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        var normalizedStatus = NormalizeStatus(request.Status);
        var normalizedDescription = request.Description.Trim();
        var normalizedEmailAlias = request.EmailAlias.Trim();
        var normalizedCostCenter = request.CostCenter.Trim();

        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return BadRequest(new { message = "Department name is required." });
        }

        if (string.IsNullOrWhiteSpace(normalizedCode))
        {
            return BadRequest(new { message = "Department code is required." });
        }

        if (await dbContext.Departments.AnyAsync(item => item.Name.ToLower() == normalizedName.ToLower()))
        {
            return Conflict(new { message = "Department name already exists." });
        }

        if (await dbContext.Departments.AnyAsync(item => item.Code.ToLower() == normalizedCode.ToLower()))
        {
            return Conflict(new { message = "Department code already exists." });
        }

        Guid? parentDepartmentId = null;
        if (!string.IsNullOrWhiteSpace(request.ParentDepartmentId))
        {
            if (!Guid.TryParse(request.ParentDepartmentId, out var parsedParentDepartmentId))
            {
                return BadRequest(new { message = "Parent department is invalid." });
            }

            var parentDepartment = await dbContext.Departments
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == parsedParentDepartmentId);

            if (parentDepartment is null)
            {
                return BadRequest(new { message = "Parent department was not found." });
            }

            parentDepartmentId = parentDepartment.Id;
        }

        Guid? headEmployeeId = null;
        if (!string.IsNullOrWhiteSpace(request.HeadEmployeeId))
        {
            if (!Guid.TryParse(request.HeadEmployeeId, out var parsedHeadEmployeeId))
            {
                return BadRequest(new { message = "Department head is invalid." });
            }

            var headEmployee = await dbContext.Employees
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == parsedHeadEmployeeId);

            if (headEmployee is null || headEmployee.Status != "Active")
            {
                return BadRequest(new { message = "Department head must be an active employee." });
            }

            if (!string.Equals(headEmployee.Department, normalizedName, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Department head must belong to the same department." });
            }

            headEmployeeId = headEmployee.Id;
        }

        var entity = new DepartmentEntity
        {
            Id = Guid.NewGuid(),
            Name = normalizedName,
            Code = normalizedCode,
            Description = normalizedDescription,
            ParentDepartmentId = parentDepartmentId,
            HeadEmployeeId = headEmployeeId,
            EmailAlias = normalizedEmailAlias,
            CostCenter = normalizedCostCenter,
            Status = normalizedStatus,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        dbContext.Departments.Add(entity);
        await dbContext.SaveChangesAsync();

        var rows = await BuildDepartmentRowsAsync();
        var created = rows.FirstOrDefault(item => item.Department.Id == entity.Id);
        return CreatedAtAction(nameof(GetDepartment), new { id = entity.Id }, MapDetail(created!));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DepartmentDetailDto>> UpdateDepartment(Guid id, [FromBody] DepartmentRequest request)
    {
        var entity = await dbContext.Departments.FirstOrDefaultAsync(item => item.Id == id);
        if (entity is null)
        {
            return NotFound(new { message = "Department not found." });
        }

        var normalizedName = request.Name.Trim();
        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        var normalizedStatus = NormalizeStatus(request.Status);
        var normalizedDescription = request.Description.Trim();
        var normalizedEmailAlias = request.EmailAlias.Trim();
        var normalizedCostCenter = request.CostCenter.Trim();

        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return BadRequest(new { message = "Department name is required." });
        }

        if (string.IsNullOrWhiteSpace(normalizedCode))
        {
            return BadRequest(new { message = "Department code is required." });
        }

        if (await dbContext.Departments.AnyAsync(item => item.Id != id && item.Name.ToLower() == normalizedName.ToLower()))
        {
            return Conflict(new { message = "Department name already exists." });
        }

        if (await dbContext.Departments.AnyAsync(item => item.Id != id && item.Code.ToLower() == normalizedCode.ToLower()))
        {
            return Conflict(new { message = "Department code already exists." });
        }

        Guid? parentDepartmentId = null;
        if (!string.IsNullOrWhiteSpace(request.ParentDepartmentId))
        {
            if (!Guid.TryParse(request.ParentDepartmentId, out var parsedParentDepartmentId))
            {
                return BadRequest(new { message = "Parent department is invalid." });
            }

            if (parsedParentDepartmentId == id)
            {
                return BadRequest(new { message = "Department cannot be its own parent." });
            }

            var parentDepartment = await dbContext.Departments
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == parsedParentDepartmentId);

            if (parentDepartment is null)
            {
                return BadRequest(new { message = "Parent department was not found." });
            }

            var hierarchy = await dbContext.Departments
                .AsNoTracking()
                .Select(item => new { item.Id, item.ParentDepartmentId })
                .ToListAsync();

            Guid? ancestorId = parsedParentDepartmentId;
            while (ancestorId != null)
            {
                if (ancestorId == id)
                {
                    return BadRequest(new { message = "Circular parent department hierarchy is not allowed." });
                }

                ancestorId = hierarchy
                    .FirstOrDefault(item => item.Id == ancestorId.Value)?
                    .ParentDepartmentId;
            }

            parentDepartmentId = parentDepartment.Id;
        }

        Guid? headEmployeeId = null;
        if (!string.IsNullOrWhiteSpace(request.HeadEmployeeId))
        {
            if (!Guid.TryParse(request.HeadEmployeeId, out var parsedHeadEmployeeId))
            {
                return BadRequest(new { message = "Department head is invalid." });
            }

            var headEmployee = await dbContext.Employees
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == parsedHeadEmployeeId);

            if (headEmployee is null || headEmployee.Status != "Active")
            {
                return BadRequest(new { message = "Department head must be an active employee." });
            }

            if (!string.Equals(headEmployee.Department, normalizedName, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Department head must belong to the same department." });
            }

            headEmployeeId = headEmployee.Id;
        }

        var previousName = entity.Name;
        entity.Name = normalizedName;
        entity.Code = normalizedCode;
        entity.Description = normalizedDescription;
        entity.ParentDepartmentId = parentDepartmentId;
        entity.HeadEmployeeId = headEmployeeId;
        entity.EmailAlias = normalizedEmailAlias;
        entity.CostCenter = normalizedCostCenter;
        entity.Status = normalizedStatus;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        if (!string.Equals(previousName, normalizedName, StringComparison.OrdinalIgnoreCase))
        {
            await RenameDepartmentReferencesAsync(previousName, normalizedName);
        }

        await dbContext.SaveChangesAsync();

        var rows = await BuildDepartmentRowsAsync();
        var updated = rows.FirstOrDefault(item => item.Department.Id == id);
        return Ok(MapDetail(updated!));
    }

    [HttpPatch("{id:guid}/activate")]
    public async Task<ActionResult<DepartmentDetailDto>> ActivateDepartment(Guid id)
    {
        var entity = await dbContext.Departments.FirstOrDefaultAsync(item => item.Id == id);
        if (entity is null)
        {
            return NotFound(new { message = "Department not found." });
        }

        entity.Status = "Active";
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        var rows = await BuildDepartmentRowsAsync();
        var updated = rows.FirstOrDefault(item => item.Department.Id == id);
        return Ok(MapDetail(updated!));
    }

    [HttpPatch("{id:guid}/deactivate")]
    public async Task<ActionResult<DepartmentDetailDto>> DeactivateDepartment(Guid id)
    {
        var entity = await dbContext.Departments.FirstOrDefaultAsync(item => item.Id == id);
        if (entity is null)
        {
            return NotFound(new { message = "Department not found." });
        }

        var activeEmployees = await dbContext.Employees.CountAsync(item =>
            item.Status == "Active" &&
            item.Department.ToLower() == entity.Name.ToLower());

        if (activeEmployees > 0)
        {
            return Conflict(new { message = "Department cannot be deactivated while active employees are still assigned." });
        }

        var activeProjects = await dbContext.Projects.CountAsync(item =>
            item.Status == "Active" &&
            item.Department.ToLower() == entity.Name.ToLower());

        if (activeProjects > 0)
        {
            return Conflict(new { message = "Department cannot be deactivated while active projects are still linked." });
        }

        entity.Status = "Inactive";
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        var rows = await BuildDepartmentRowsAsync();
        var updated = rows.FirstOrDefault(item => item.Department.Id == id);
        return Ok(MapDetail(updated!));
    }

    private async Task RenameDepartmentReferencesAsync(string previousName, string nextName)
    {
        var employees = await dbContext.Employees
            .Where(item => item.Department.ToLower() == previousName.ToLower())
            .ToListAsync();

        foreach (var employee in employees)
        {
            employee.Department = nextName;
        }

        var projects = await dbContext.Projects
            .Where(item => item.Department.ToLower() == previousName.ToLower())
            .ToListAsync();

        foreach (var project in projects)
        {
            project.Department = nextName;
        }

        var leaves = await dbContext.LeaveRequests
            .Where(item => item.Department.ToLower() == previousName.ToLower())
            .ToListAsync();

        foreach (var leave in leaves)
        {
            leave.Department = nextName;
        }
    }

    private async Task<List<DepartmentRow>> BuildDepartmentRowsAsync()
    {
        var departments = await dbContext.Departments
            .AsNoTracking()
            .OrderBy(item => item.Name)
            .ToListAsync();

        var employees = await dbContext.Employees
            .AsNoTracking()
            .ToListAsync();

        var projects = await dbContext.Projects
            .AsNoTracking()
            .ToListAsync();

        return departments.Select(department =>
        {
            var departmentEmployees = employees
                .Where(item => string.Equals(item.Department, department.Name, StringComparison.OrdinalIgnoreCase))
                .OrderBy(item => item.FullName)
                .ToList();

            var departmentProjects = projects
                .Where(item => string.Equals(item.Department, department.Name, StringComparison.OrdinalIgnoreCase))
                .OrderBy(item => item.Name)
                .ToList();

            var headEmployee = department.HeadEmployeeId.HasValue
                ? employees.FirstOrDefault(item => item.Id == department.HeadEmployeeId.Value)
                : null;

            var parentDepartment = department.ParentDepartmentId.HasValue
                ? departments.FirstOrDefault(item => item.Id == department.ParentDepartmentId.Value)
                : null;

            return new DepartmentRow(
                department,
                parentDepartment?.Name,
                headEmployee?.FullName,
                departmentEmployees,
                departmentProjects);
        }).ToList();
    }

    private static DepartmentListDto MapList(DepartmentRow row)
    {
        return new DepartmentListDto(
            row.Department.Id.ToString(),
            row.Department.Name,
            row.Department.Code,
            row.Department.Description,
            row.Department.ParentDepartmentId?.ToString(),
            row.ParentDepartmentName,
            row.Department.HeadEmployeeId?.ToString(),
            row.HeadEmployeeName,
            row.Department.EmailAlias,
            row.Department.CostCenter,
            row.EmployeeCount,
            row.ActiveEmployeeCount,
            row.InactiveEmployeeCount,
            row.ProjectCount,
            row.ActiveProjectCount,
            row.Department.Status,
            row.Department.CreatedAtUtc.ToString("O"),
            row.Department.UpdatedAtUtc.ToString("O"));
    }

    private static DepartmentDetailDto MapDetail(DepartmentRow row)
    {
        return new DepartmentDetailDto(
            row.Department.Id.ToString(),
            row.Department.Name,
            row.Department.Code,
            row.Department.Description,
            row.Department.ParentDepartmentId?.ToString(),
            row.ParentDepartmentName,
            row.Department.HeadEmployeeId?.ToString(),
            row.HeadEmployeeName,
            row.Department.EmailAlias,
            row.Department.CostCenter,
            row.EmployeeCount,
            row.ActiveEmployeeCount,
            row.InactiveEmployeeCount,
            row.ProjectCount,
            row.ActiveProjectCount,
            row.Department.Status,
            row.Department.CreatedAtUtc.ToString("O"),
            row.Department.UpdatedAtUtc.ToString("O"),
            row.Employees
                .Select(item => new DepartmentEmployeeDto(
                    item.Id.ToString(),
                    item.FullName,
                    item.Email,
                    RoleCatalog.FormatRoles(item.RolesJson, item.Role),
                    item.Status))
                .ToList(),
            row.Projects
                .Select(item => new DepartmentProjectDto(
                    item.Id.ToString(),
                    item.Name,
                    item.Code,
                    item.ManagerName,
                    item.Status,
                    item.EndDate.ToApiString()))
                .ToList());
    }

    private static string NormalizeStatus(string? status)
    {
        return string.Equals(status?.Trim(), "Inactive", StringComparison.OrdinalIgnoreCase)
            ? "Inactive"
            : "Active";
    }

    private sealed record DepartmentRow(
        DepartmentEntity Department,
        string? ParentDepartmentName,
        string? HeadEmployeeName,
        IReadOnlyList<EmployeeEntity> Employees,
        IReadOnlyList<ProjectEntity> Projects)
    {
        public int EmployeeCount => Employees.Count;
        public int ActiveEmployeeCount => Employees.Count(item => item.Status == "Active");
        public int InactiveEmployeeCount => Employees.Count(item => item.Status != "Active");
        public int ProjectCount => Projects.Count;
        public int ActiveProjectCount => Projects.Count(item => item.Status == "Active");
    }
}

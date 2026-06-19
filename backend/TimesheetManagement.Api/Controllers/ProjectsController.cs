using AbhiTimesheet.Api.Contracts.Projects;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using AbhiTimesheet.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ProjectsController(
    AppDbContext dbContext,
    ChatService chatService,
    ProjectManagerRoleService projectManagerRoleService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProjectDto>>> GetProjects()
    {
        var projects = await dbContext.Projects
            .AsNoTracking()
            .OrderByDescending(item => item.CreatedAtUtc)
            .ToListAsync();

        return Ok(projects.Select(Map).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<ProjectDto>> CreateProject([FromBody] ProjectRequest request)
    {
        if (!Guid.TryParse(request.AdminId, out var adminId))
        {
            return BadRequest(new { message = "Admin is invalid." });
        }

        if (await dbContext.Projects.AnyAsync(item => item.Code.ToLower() == request.Code.Trim().ToLower()))
        {
            return Conflict(new { message = "Project code already exists." });
        }

        var department = await dbContext.Departments
            .AsNoTracking()
            .FirstOrDefaultAsync(item =>
                item.Status == "Active" &&
                item.Name.ToLower() == request.Department.Trim().ToLower());

        if (department is null)
        {
            return BadRequest(new { message = "Select a valid active department." });
        }

        var manager = await ResolveActiveManagerAsync(request.ManagerId);
        if (manager is null)
        {
            return BadRequest(new { message = "Select a valid active project manager." });
        }

        var entity = MapToEntity(request, department.Name, adminId, manager, new ProjectEntity
        {
            Id = Guid.NewGuid(),
            CreatedAtUtc = DateTime.UtcNow
        });

        await projectManagerRoleService.SynchronizeProjectManagerRoleAsync(null, entity, manager, ResolveActorUserId(adminId));
        dbContext.Projects.Add(entity);
        await dbContext.SaveChangesAsync();
        await chatService.SynchronizeProjectThreadAsync(entity, ResolveActorUserId(entity.AdminId));

        return CreatedAtAction(nameof(GetProjects), new { id = entity.Id }, Map(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectDto>> UpdateProject(Guid id, [FromBody] ProjectRequest request)
    {
        var entity = await dbContext.Projects.FirstOrDefaultAsync(item => item.Id == id);
        if (entity is null)
        {
            return NotFound(new { message = "Project not found." });
        }

        if (!Guid.TryParse(request.AdminId, out var adminId))
        {
            return BadRequest(new { message = "Admin is invalid." });
        }

        if (await dbContext.Projects.AnyAsync(item => item.Id != id && item.Code.ToLower() == request.Code.Trim().ToLower()))
        {
            return Conflict(new { message = "Project code already exists." });
        }

        var department = await dbContext.Departments
            .AsNoTracking()
            .FirstOrDefaultAsync(item =>
                item.Status == "Active" &&
                item.Name.ToLower() == request.Department.Trim().ToLower());

        if (department is null)
        {
            return BadRequest(new { message = "Select a valid active department." });
        }

        var manager = await ResolveActiveManagerAsync(request.ManagerId);
        if (manager is null)
        {
            return BadRequest(new { message = "Select a valid active project manager." });
        }

        var previousProject = ProjectManagerRoleSnapshot.From(entity);
        MapToEntity(request, department.Name, adminId, manager, entity);
        await projectManagerRoleService.SynchronizeProjectManagerRoleAsync(previousProject, entity, manager, ResolveActorUserId(adminId));
        await dbContext.SaveChangesAsync();
        await chatService.SynchronizeProjectThreadAsync(entity, ResolveActorUserId(entity.AdminId));

        return Ok(Map(entity));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteProject(Guid id)
    {
        var entity = await dbContext.Projects.FirstOrDefaultAsync(item => item.Id == id);
        if (entity is null)
        {
            return NotFound(new { message = "Project not found." });
        }

        await projectManagerRoleService.HandleProjectDeletionAsync(
            ProjectManagerRoleSnapshot.From(entity),
            ResolveActorUserId(entity.AdminId));
        await chatService.ArchiveProjectThreadAsync(id, ResolveActorUserId(entity.AdminId));
        dbContext.Projects.Remove(entity);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    private Guid ResolveActorUserId(Guid fallbackUserId)
    {
        var headerValue = Request.Headers["X-User-Id"].FirstOrDefault();
        return Guid.TryParse(headerValue, out var parsedUserId) ? parsedUserId : fallbackUserId;
    }

    private async Task<EmployeeEntity?> ResolveActiveManagerAsync(string managerId)
    {
        if (!Guid.TryParse(managerId, out var parsedManagerId))
        {
            return null;
        }

        return await dbContext.Employees.FirstOrDefaultAsync(item => item.Id == parsedManagerId && item.Status == "Active");
    }

    private static ProjectEntity MapToEntity(
        ProjectRequest request,
        string departmentName,
        Guid adminId,
        EmployeeEntity manager,
        ProjectEntity entity)
    {
        entity.Name = request.Name.Trim();
        entity.Code = request.Code.Trim();
        entity.Description = request.Description.Trim();
        entity.ClientBusinessUnit = request.ClientBusinessUnit.Trim();
        entity.Department = departmentName;
        entity.AdminId = adminId;
        entity.AdminName = request.AdminName.Trim();
        entity.ManagerId = manager.Id;
        entity.ManagerName = manager.FullName;
        entity.ProjectLead = manager.FullName;
        entity.DeliveryModel = request.DeliveryModel.Trim();
        entity.TeamMemberIdsJson = JsonListSerializer.Serialize(request.TeamMemberIds);
        entity.TeamMemberNamesJson = JsonListSerializer.Serialize(request.TeamMemberNames);
        entity.TeamSize = request.TeamSize;
        entity.Budget = request.Budget;
        entity.Priority = request.Priority.Trim();
        entity.Status = request.Status.Trim();
        entity.StartDate = request.StartDate.ParseRequiredDate(nameof(request.StartDate));
        entity.EndDate = request.EndDate.ParseRequiredDate(nameof(request.EndDate));
        entity.IsBillable = request.IsBillable;
        return entity;
    }

    private static ProjectDto Map(ProjectEntity entity)
    {
        return new ProjectDto(
            entity.Id.ToString(),
            entity.Name,
            entity.Code,
            entity.Description,
            entity.ClientBusinessUnit,
            entity.Department,
            entity.AdminId.ToString(),
            entity.AdminName,
            entity.ManagerId.ToString(),
            entity.ManagerName,
            entity.ProjectLead,
            entity.DeliveryModel,
            JsonListSerializer.Deserialize(entity.TeamMemberIdsJson),
            JsonListSerializer.Deserialize(entity.TeamMemberNamesJson),
            entity.TeamSize,
            entity.Budget,
            entity.Priority,
            entity.Status,
            entity.StartDate.ToApiString(),
            entity.EndDate.ToApiString(),
            entity.IsBillable,
            entity.CreatedAtUtc.ToString("O"));
    }
}

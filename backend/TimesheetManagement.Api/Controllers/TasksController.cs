using AbhiTimesheet.Api.Contracts.Tasks;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/tasks")]
public sealed class TasksController(AppDbContext dbContext) : ControllerBase
{
    private const int TaskHoursPerDay = 9;

    [HttpPost("")]
    [HttpPost("create-task")]
    public async Task<ActionResult<TaskItemDto>> CreateTask([FromBody] TaskCreateRequest request)
    {
        try
        {
            var entity = await BuildTaskMasterEntityAsync(
                request,
                new TaskAssignmentEntity
                {
                    Id = Guid.NewGuid(),
                    CreatedAtUtc = DateTime.UtcNow
                });

            dbContext.TaskAssignments.Add(entity);
            await dbContext.SaveChangesAsync();

            return Ok(Map(entity));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("/api/task-assignments")]
    [HttpPost("assign-task")]
    public async Task<ActionResult<TaskItemDto>> AssignTask([FromBody] TaskAssignmentRequest request)
    {
        try
        {
            var taskMaster = await ResolveTaskMasterAsync(request.TaskId);
            if (taskMaster is null)
            {
                return NotFound(new { message = "Task not found." });
            }

            var entity = await BuildAssignmentEntityAsync(
                request,
                taskMaster,
                new TaskAssignmentEntity
                {
                    Id = Guid.NewGuid(),
                    CreatedAtUtc = DateTime.UtcNow,
                    TaskGroupId = taskMaster.TaskGroupId == Guid.Empty ? taskMaster.Id : taskMaster.TaskGroupId
                });

            dbContext.TaskAssignments.Add(entity);
            await dbContext.SaveChangesAsync();
            await RefreshAssignmentStatusAsync(entity.TaskGroupId);
            await dbContext.SaveChangesAsync();

            return Ok(Map(entity));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPut("/api/task-assignments/{id:guid}")]
    public async Task<ActionResult<TaskItemDto>> UpdateTaskAssignment(Guid id, [FromBody] TaskAssignmentRequest request)
    {
        var entity = await dbContext.TaskAssignments.FirstOrDefaultAsync(item => item.Id == id && item.AssignedTo != Guid.Empty);
        if (entity is null)
        {
            return NotFound(new { message = "Task assignment not found." });
        }

        try
        {
            var previousTaskGroupId = entity.TaskGroupId;
            var taskMaster = await ResolveTaskMasterAsync(request.TaskId);
            if (taskMaster is null)
            {
                return NotFound(new { message = "Task not found." });
            }

            await BuildAssignmentEntityAsync(request, taskMaster, entity);
            await dbContext.SaveChangesAsync();

            if (previousTaskGroupId != Guid.Empty && previousTaskGroupId != entity.TaskGroupId)
            {
                await RefreshAssignmentStatusAsync(previousTaskGroupId);
            }

            await RefreshAssignmentStatusAsync(entity.TaskGroupId);
            await dbContext.SaveChangesAsync();

            return Ok(Map(entity));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [HttpPut("{id:guid}/details")]
    public async Task<ActionResult<TaskItemDto>> UpdateTask(Guid id, [FromBody] TaskCreateRequest request)
    {
        try
        {
            var entity = await dbContext.TaskAssignments.FirstOrDefaultAsync(item => item.Id == id);
            if (entity is null)
            {
                return NotFound(new { message = "Task not found." });
            }

            var taskGroupId = entity.TaskGroupId == Guid.Empty ? entity.Id : entity.TaskGroupId;
            var groupMembers = await dbContext.TaskAssignments
                .Where(item => item.TaskGroupId == taskGroupId || item.Id == taskGroupId)
                .ToListAsync();

            var taskMaster = groupMembers.FirstOrDefault(item => item.AssignedTo == Guid.Empty);
            if (taskMaster is null)
            {
                taskMaster = new TaskAssignmentEntity
                {
                    Id = Guid.NewGuid(),
                    TaskGroupId = taskGroupId,
                    CreatedAtUtc = DateTime.UtcNow
                };

                dbContext.TaskAssignments.Add(taskMaster);
                groupMembers.Add(taskMaster);
            }

            await BuildTaskMasterEntityAsync(request, taskMaster);

            foreach (var assignment in groupMembers.Where(item => item.Id != taskMaster.Id && item.AssignedTo != Guid.Empty))
            {
                CopySharedTaskFields(taskMaster, assignment);
            }

            await dbContext.SaveChangesAsync();
            await RefreshAssignmentStatusAsync(taskMaster.TaskGroupId);
            await dbContext.SaveChangesAsync();

            return Ok(Map(taskMaster));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [HttpDelete("/api/task-assignments/{id:guid}")]
    public async Task<IActionResult> DeleteTask(Guid id)
    {
        var entity = await dbContext.TaskAssignments.FirstOrDefaultAsync(item => item.Id == id);
        if (entity is null)
        {
            return NotFound(new { message = "Task not found." });
        }

        var taskGroupId = entity.TaskGroupId;
        dbContext.TaskAssignments.Remove(entity);
        await dbContext.SaveChangesAsync();

        if (taskGroupId != Guid.Empty)
        {
            await RefreshAssignmentStatusAsync(taskGroupId);
            await dbContext.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpGet("user-tasks/{userId:guid}")]
    public async Task<ActionResult<IReadOnlyList<TaskItemDto>>> GetUserTasks(Guid userId, [FromQuery] string date)
    {
        var targetDate = date.ParseRequiredDate(nameof(date));

        var tasks = await dbContext.TaskAssignments
            .AsNoTracking()
            .Where(item => item.AssignedTo == userId && item.StartDate.HasValue && item.StartDate <= targetDate && item.EndDate.HasValue && item.EndDate >= targetDate)
            .OrderBy(item => item.StartDate)
            .ToListAsync();

        return Ok(tasks.Select(Map).ToList());
    }

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<TaskItemDto>>> GetHistory([FromQuery] Guid? projectId)
    {
        var query = dbContext.TaskAssignments.AsNoTracking();
        if (projectId.HasValue)
        {
            query = query.Where(item => item.ProjectId == projectId.Value);
        }

        var tasks = await query
            .OrderByDescending(item => item.CreatedAtUtc)
            .ToListAsync();

        return Ok(tasks.Select(Map).ToList());
    }

    private async Task<TaskAssignmentEntity> BuildTaskMasterEntityAsync(TaskCreateRequest request, TaskAssignmentEntity entity)
    {
        var isStandalone = string.IsNullOrWhiteSpace(request.ProjectId);
        Guid projectId = Guid.Empty;

        if (!isStandalone && !Guid.TryParse(request.ProjectId, out projectId))
        {
            throw new ArgumentException("Select a valid project before saving the task.");
        }

        if (string.IsNullOrWhiteSpace(request.TaskName))
        {
            throw new ArgumentException("Task name is required.");
        }

        if (request.PlannedDays <= 0)
        {
            throw new ArgumentException("Planned days must be greater than zero.");
        }

        ProjectEntity? project = null;
        if (!isStandalone)
        {
            project = await dbContext.Projects.AsNoTracking().FirstOrDefaultAsync(item => item.Id == projectId);
            if (project is null)
            {
                throw new InvalidOperationException("The selected project could not be found.");
            }
        }

        var existingProjectId = entity.ProjectId;
        var startYear = DateTime.UtcNow.Year;
        var existingStartYear = entity.StartDate?.Year ?? startYear;

        entity.TaskGroupId = !string.IsNullOrWhiteSpace(request.TaskGroupId) && Guid.TryParse(request.TaskGroupId, out var taskGroupId)
            ? taskGroupId
            : entity.TaskGroupId == Guid.Empty
                ? Guid.NewGuid()
                : entity.TaskGroupId;
        entity.ProjectId = projectId;
        entity.ProjectName = string.IsNullOrWhiteSpace(request.ProjectName)
            ? project?.Name ?? string.Empty
            : request.ProjectName.Trim();
        entity.Title = request.TaskName.Trim();
        entity.Description = request.Description.Trim();
        entity.WorkBreakdown = request.WorkBreakdown.Trim();
        entity.StartDate = null;
        entity.EndDate = null;
        entity.TotalHours = request.PlannedDays * TaskHoursPerDay;
        entity.PlannedDays = request.PlannedDays;
        entity.AssignedDays = 0;
        entity.Priority = NormalizePriority(request.Priority);
        entity.Status = NormalizeTaskStatus(request.Status);
        entity.AssignmentStatus = string.IsNullOrWhiteSpace(entity.AssignmentStatus) ? "Unassigned" : entity.AssignmentStatus.Trim();
        entity.Notes = string.Empty;
        entity.RoleInTask = string.Empty;
        entity.ExpectedDeliverable = string.Empty;
        entity.AssignedTo = Guid.Empty;
        entity.AssignedToName = string.Empty;

        var shouldGenerateTaskCode =
            string.IsNullOrWhiteSpace(entity.TaskCode) ||
            existingProjectId != projectId ||
            existingStartYear != startYear;
        if (shouldGenerateTaskCode)
        {
            entity.TaskCode = await GenerateTaskCodeAsync(project, startYear, entity.Id);
        }
        else
        {
            entity.TaskCode = entity.TaskCode.Trim();
        }

        return entity;
    }

    private async Task<TaskAssignmentEntity> BuildAssignmentEntityAsync(
        TaskAssignmentRequest request,
        TaskAssignmentEntity taskMaster,
        TaskAssignmentEntity entity)
    {
        if (!Guid.TryParse(request.UserId, out var assignedTo))
        {
            throw new ArgumentException("Select a valid employee before saving the assignment.");
        }

        if (request.AssignedDays <= 0)
        {
            throw new ArgumentException("Assigned days must be greater than zero.");
        }

        var assignmentStartDate = request.AssignmentStartDate.ParseRequiredDate(nameof(request.AssignmentStartDate));
        var assignmentDueDate = request.AssignmentDueDate.ParseRequiredDate(nameof(request.AssignmentDueDate));
        if (assignmentDueDate < assignmentStartDate)
        {
            throw new ArgumentException("Assignment due date cannot be before assignment start date.");
        }

        var employee = await dbContext.Employees.AsNoTracking().FirstOrDefaultAsync(item => item.Id == assignedTo);
        if (employee is null)
        {
            throw new InvalidOperationException("The selected employee could not be found.");
        }

        var taskGroupId = taskMaster.TaskGroupId == Guid.Empty ? taskMaster.Id : taskMaster.TaskGroupId;
        var assignedHours = request.AssignedDays * TaskHoursPerDay;
        var alreadyAssignedHours = await dbContext.TaskAssignments
            .AsNoTracking()
            .Where(item =>
                item.TaskGroupId == taskGroupId &&
                item.AssignedTo != Guid.Empty &&
                item.Id != entity.Id)
            .SumAsync(item => (double?)item.TotalHours) ?? 0;

        if (alreadyAssignedHours + assignedHours > taskMaster.TotalHours + 0.001d)
        {
            throw new InvalidOperationException("This assignment exceeds the remaining hours for the task.");
        }

        entity.TaskGroupId = taskGroupId;
        entity.ProjectId = taskMaster.ProjectId;
        entity.ProjectName = taskMaster.ProjectName;
        entity.TaskCode = taskMaster.TaskCode;
        entity.Title = taskMaster.Title;
        entity.Description = taskMaster.Description;
        entity.WorkBreakdown = taskMaster.WorkBreakdown;
        entity.PlannedDays = taskMaster.PlannedDays;
        entity.Priority = taskMaster.Priority;
        entity.Status = taskMaster.Status;
        entity.StartDate = assignmentStartDate;
        entity.EndDate = assignmentDueDate;
        entity.TotalHours = assignedHours;
        entity.AssignedDays = request.AssignedDays;
        entity.AssignedToName = string.IsNullOrWhiteSpace(request.AssignedToName)
            ? employee?.FullName ?? string.Empty
            : request.AssignedToName.Trim();
        entity.AssignedTo = assignedTo;
        entity.AssignmentStatus = NormalizeAssignmentStatus(entity.AssignmentStatus);
        entity.Notes = request.Notes?.Trim() ?? string.Empty;
        entity.RoleInTask = request.RoleInTask?.Trim() ?? string.Empty;
        entity.ExpectedDeliverable = request.ExpectedDeliverable?.Trim() ?? string.Empty;

        return entity;
    }

    private static TaskItemDto Map(TaskAssignmentEntity entity)
    {
        var isTaskMaster = entity.AssignedTo == Guid.Empty;

        return new TaskItemDto
        {
            Id = entity.Id.ToString(),
            TaskGroupId = (entity.TaskGroupId == Guid.Empty ? entity.Id : entity.TaskGroupId).ToString(),
            ProjectId = entity.ProjectId.ToString(),
            ProjectName = entity.ProjectName,
            AssignedTo = isTaskMaster ? string.Empty : entity.AssignedTo.ToString(),
            AssignedToName = isTaskMaster ? string.Empty : entity.AssignedToName,
            TaskCode = entity.TaskCode,
            TaskName = entity.Title,
            Title = entity.Title,
            Description = entity.Description,
            WorkBreakdown = entity.WorkBreakdown,
            StartDate = entity.StartDate?.ToApiString() ?? string.Empty,
            EndDate = entity.EndDate?.ToApiString() ?? string.Empty,
            DueDate = entity.EndDate?.ToApiString() ?? string.Empty,
            TotalHours = entity.TotalHours,
            EstimatedHours = isTaskMaster ? entity.TotalHours : 0,
            AssignedHours = isTaskMaster ? 0 : entity.TotalHours,
            PlannedDays = entity.PlannedDays,
            AssignedDays = isTaskMaster ? 0 : entity.AssignedDays,
            Priority = entity.Priority,
            Status = entity.Status,
            AssignmentStatus = entity.AssignmentStatus,
            Notes = entity.Notes,
            RoleInTask = entity.RoleInTask,
            ExpectedDeliverable = entity.ExpectedDeliverable,
            IsTaskMaster = isTaskMaster
        };
    }

    private async Task<TaskAssignmentEntity?> ResolveTaskMasterAsync(string taskId)
    {
        if (!Guid.TryParse(taskId, out var parsedTaskId))
        {
            return null;
        }

        var directTask = await dbContext.TaskAssignments.FirstOrDefaultAsync(item => item.Id == parsedTaskId);
        if (directTask is not null)
        {
            if (directTask.AssignedTo == Guid.Empty)
            {
                return directTask;
            }

            var groupedMaster = await dbContext.TaskAssignments.FirstOrDefaultAsync(item =>
                item.TaskGroupId == (directTask.TaskGroupId == Guid.Empty ? directTask.Id : directTask.TaskGroupId) &&
                item.AssignedTo == Guid.Empty);

            return groupedMaster ?? directTask;
        }

        return await dbContext.TaskAssignments.FirstOrDefaultAsync(item => item.TaskGroupId == parsedTaskId && item.AssignedTo == Guid.Empty);
    }

    private async Task<string> GenerateTaskCodeAsync(ProjectEntity? project, int year, Guid currentTaskId)
    {
        var prefix = BuildTaskCodePrefix(project);
        var projectId = project?.Id ?? Guid.Empty;
        var existingCodes = await dbContext.TaskAssignments
            .AsNoTracking()
            .Where(item =>
                item.ProjectId == projectId &&
                item.AssignedTo == Guid.Empty &&
                item.Id != currentTaskId &&
                item.StartDate.HasValue && item.StartDate.Value.Year == year)
            .Select(item => item.TaskCode)
            .ToListAsync();

        var nextSequence = existingCodes
            .Select(ParseTaskCodeSequence)
            .DefaultIfEmpty(0)
            .Max() + 1;

        return prefix == "STD" ? $"STD-{year}-{nextSequence:000}" : $"TSK-{prefix}-{year}-{nextSequence:000}";
    }

    private static string BuildTaskCodePrefix(ProjectEntity? project)
    {
        if (project is null) return "STD";

        var rawProjectCode = string.IsNullOrWhiteSpace(project.Code)
            ? string.Concat(
                project.Name
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(part => part[0]))
            : project.Code;

        var sanitized = new string(rawProjectCode
            .Where(char.IsLetterOrDigit)
            .ToArray())
            .ToUpperInvariant();

        return string.IsNullOrWhiteSpace(sanitized) ? "TASK" : sanitized[..Math.Min(6, sanitized.Length)];
    }

    private static int ParseTaskCodeSequence(string? taskCode)
    {
        if (string.IsNullOrWhiteSpace(taskCode))
        {
            return 0;
        }

        var segments = taskCode.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return segments.Length > 0 && int.TryParse(segments[^1], out var sequence)
            ? sequence
            : 0;
    }

    private async Task RefreshAssignmentStatusAsync(Guid taskGroupId)
    {
        if (taskGroupId == Guid.Empty)
        {
            return;
        }

        var taskMaster = await dbContext.TaskAssignments.FirstOrDefaultAsync(item =>
            item.TaskGroupId == taskGroupId &&
            item.AssignedTo == Guid.Empty);

        if (taskMaster is null)
        {
            return;
        }

        var assignedHours = await dbContext.TaskAssignments
            .AsNoTracking()
            .Where(item => item.TaskGroupId == taskGroupId && item.AssignedTo != Guid.Empty)
            .SumAsync(item => (double?)item.TotalHours) ?? 0;

        taskMaster.AssignmentStatus = assignedHours <= 0.001d
            ? "Unassigned"
            : assignedHours >= taskMaster.TotalHours - 0.001d
                ? "Fully Assigned"
                : "Partially Assigned";
    }

    private static void CopySharedTaskFields(TaskAssignmentEntity source, TaskAssignmentEntity target)
    {
        target.TaskGroupId = source.TaskGroupId;
        target.ProjectId = source.ProjectId;
        target.ProjectName = source.ProjectName;
        target.TaskCode = source.TaskCode;
        target.Title = source.Title;
        target.Description = source.Description;
        target.WorkBreakdown = source.WorkBreakdown;
        target.PlannedDays = source.PlannedDays;
        target.Priority = source.Priority;
        target.Status = source.Status;
    }

    private static string NormalizePriority(string? priority)
    {
        var normalized = priority?.Trim().ToLowerInvariant();
        return normalized switch
        {
            "low" => "Low",
            "high" => "High",
            "critical" => "Critical",
            _ => "Medium"
        };
    }

    private static string NormalizeTaskStatus(string? status)
    {
        var normalized = status?.Trim().ToLowerInvariant();
        return normalized switch
        {
            "planned" => "Planned",
            "in progress" => "In Progress",
            "on hold" => "On Hold",
            "completed" => "Completed",
            "done" => "Completed",
            _ => "To Do"
        };
    }

    private static string NormalizeAssignmentStatus(string? assignmentStatus)
    {
        var normalized = assignmentStatus?.Trim().ToLowerInvariant();
        return normalized switch
        {
            "in progress" => "In Progress",
            "completed" => "Completed",
            "reassigned" => "Reassigned",
            "cancelled" => "Cancelled",
            _ => "Assigned"
        };
    }
}

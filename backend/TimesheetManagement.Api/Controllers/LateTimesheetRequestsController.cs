using AbhiTimesheet.Api.Contracts.Timesheets;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using AbhiTimesheet.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/late-timesheet-requests")]
public sealed class LateTimesheetRequestsController(
    AppDbContext dbContext,
    LateTimesheetAccessService lateTimesheetAccessService) : ControllerBase
{
    private const int WeeklyWorkingDays = 6;
    private const string PendingStatus = "Pending";
    private const string ApprovedStatus = "Approved";
    private const string RejectedStatus = "Rejected";

    [HttpGet("eligible-dates")]
    public async Task<ActionResult<IReadOnlyList<LateTimesheetEligibleDateDto>>> GetEligibleDates(
        [FromQuery] string userId,
        CancellationToken cancellationToken)
    {
        var parsedUserId = Guid.Parse(userId);
        var candidateDates = await BuildCandidateHistoricalDatesAsync(parsedUserId, cancellationToken);
        if (candidateDates.Count == 0)
        {
            return Ok(Array.Empty<LateTimesheetEligibleDateDto>());
        }

        var options = await BuildEligibleOptionsAsync(parsedUserId, candidateDates, includeEmptyDates: false, cancellationToken);

        return Ok(options
            .OrderByDescending(item => item.Date, StringComparer.Ordinal)
            .Select(item => new LateTimesheetEligibleDateDto(
                item.Date,
                item.Projects.Count,
                item.Projects.Sum(project => project.Tasks.Count)))
            .ToList());
    }

    [HttpGet("eligible-options")]
    public async Task<ActionResult<IReadOnlyList<LateTimesheetDateOptionDto>>> GetEligibleOptions(
        [FromQuery] string userId,
        [FromQuery] string dates,
        CancellationToken cancellationToken)
    {
        var parsedUserId = Guid.Parse(userId);
        var requestedDates = ParseDateList(dates);

        if (requestedDates.Count == 0)
        {
            return BadRequest(new { message = "Select at least one historical date first." });
        }

        if (requestedDates.Any(date => !IsHistoricalDate(date)))
        {
            return BadRequest(new { message = "Late timesheet requests can only be created for dates before the Active Week." });
        }

        var result = await BuildEligibleOptionsAsync(parsedUserId, requestedDates, includeEmptyDates: true, cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<LateTimesheetRequestDto>> CreateRequest(
        [FromBody] LateTimesheetCreateRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Items.Count == 0)
        {
            return BadRequest(new { message = "Select at least one date / project / task item before submitting." });
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { message = "Reason is required for a late timesheet request." });
        }

        var userId = Guid.Parse(request.UserId);
        var employee = await dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);

        if (employee is null)
        {
            return NotFound(new { message = "Employee not found for late timesheet request." });
        }

        var requestItems = request.Items
            .Select(item => new RequestedLateEntryItem(
                item.Date.ParseRequiredDate(nameof(item.Date)),
                Guid.Parse(item.ProjectId),
                Guid.Parse(item.TaskId)))
            .Distinct()
            .ToList();

        if (requestItems.Any(item => !IsHistoricalDate(item.Date)))
        {
            return BadRequest(new { message = "Late timesheet requests can only be raised for dates before the Active Week." });
        }

        var taskIds = requestItems
            .Select(item => item.TaskId)
            .Distinct()
            .ToList();

        var projectIds = requestItems
            .Select(item => item.ProjectId)
            .Distinct()
            .ToList();

        var tasks = await dbContext.TaskAssignments
            .AsNoTracking()
            .Where(item => taskIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken);

        var projects = await dbContext.Projects
            .AsNoTracking()
            .Where(item => projectIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken);

        var existingItems = await dbContext.LateTimesheetRequestItems
            .Include(item => item.Request)
            .Where(item =>
                item.Request.UserId == userId &&
                (item.Status == PendingStatus ||
                 (item.Status == ApprovedStatus &&
                  item.UnlockExpiresAtUtc.HasValue &&
                  item.UnlockExpiresAtUtc.Value > DateTime.UtcNow)))
            .ToListAsync(cancellationToken);

        var existingKeys = existingItems
            .Select(item => new RequestedLateEntryItem(item.EntryDate, item.ProjectId, item.TaskId))
            .ToHashSet();

        var invalidItem = requestItems.FirstOrDefault(item =>
        {
            if (existingKeys.Contains(item))
            {
                return true;
            }

            if (!tasks.TryGetValue(item.TaskId, out var task) ||
                task.AssignedTo != userId ||
                task.ProjectId != item.ProjectId ||
                task.StartDate > item.Date ||
                task.EndDate < item.Date)
            {
                return true;
            }

            if (!projects.TryGetValue(item.ProjectId, out var project) ||
                project.StartDate > item.Date ||
                project.EndDate < item.Date ||
                project.ManagerId == Guid.Empty)
            {
                return true;
            }

            return false;
        });

        if (invalidItem is not null)
        {
            return BadRequest(new
            {
                message = "One or more selected date / project / task combinations are invalid, already pending, or no longer mapped to your historical assignment."
            });
        }

        var now = DateTime.UtcNow;
        var entity = new LateTimesheetRequestEntity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            UserName = employee.FullName,
            Reason = request.Reason.Trim(),
            AdditionalRemarks = request.AdditionalRemarks?.Trim() ?? string.Empty,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            Items = requestItems
                .OrderBy(item => item.Date)
                .ThenBy(item => projects[item.ProjectId].Name)
                .ThenBy(item => tasks[item.TaskId].Title)
                .Select(item =>
                {
                    var task = tasks[item.TaskId];
                    var project = projects[item.ProjectId];
                    return new LateTimesheetRequestItemEntity
                    {
                        Id = Guid.NewGuid(),
                        EntryDate = item.Date,
                        ProjectId = project.Id,
                        ProjectName = project.Name,
                        TaskId = task.Id,
                        TaskTitle = task.Title,
                        ManagerId = project.ManagerId,
                        ManagerName = project.ManagerName,
                        Status = PendingStatus
                    };
                })
                .ToList()
        };

        dbContext.LateTimesheetRequests.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapRequest(entity));
    }

    [HttpGet("by-user/{userId:guid}")]
    public async Task<ActionResult<IReadOnlyList<LateTimesheetRequestDto>>> ListByUser(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var requests = await dbContext.LateTimesheetRequests
            .AsNoTracking()
            .Include(item => item.Items)
            .Where(item => item.UserId == userId)
            .OrderByDescending(item => item.UpdatedAtUtc)
            .ToListAsync(cancellationToken);

        return Ok(requests.Select(item => MapRequest(item)).ToList());
    }

    [HttpGet("inbox")]
    public async Task<ActionResult<IReadOnlyList<LateTimesheetRequestDto>>> ListInbox(
        [FromQuery] string? managerId,
        CancellationToken cancellationToken)
    {
        Guid? parsedManagerId = null;
        if (!string.IsNullOrWhiteSpace(managerId))
        {
            parsedManagerId = Guid.Parse(managerId);
        }

        var query = dbContext.LateTimesheetRequests
            .AsNoTracking()
            .Include(item => item.Items)
            .AsQueryable();

        if (parsedManagerId.HasValue)
        {
            query = query.Where(item => item.Items.Any(child => child.ManagerId == parsedManagerId.Value));
        }

        var requests = await query
            .OrderByDescending(item => item.UpdatedAtUtc)
            .ToListAsync(cancellationToken);

        var mapped = requests
            .Select(item =>
            {
                var visibleItems = parsedManagerId.HasValue
                    ? item.Items.Where(child => child.ManagerId == parsedManagerId.Value).ToList()
                    : item.Items.ToList();
                return MapRequest(item, visibleItems);
            })
            .Where(item => item.Items.Count > 0)
            .ToList();

        return Ok(mapped);
    }

    [HttpPost("{itemId:guid}/decision")]
    public async Task<ActionResult<LateTimesheetRequestDto>> DecideRequestItem(
        Guid itemId,
        [FromBody] LateTimesheetDecisionRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await dbContext.LateTimesheetRequestItems
            .Include(item => item.Request)
            .ThenInclude(item => item.Items)
            .FirstOrDefaultAsync(item => item.Id == itemId, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { message = "Late timesheet request item was not found." });
        }

        if (!string.Equals(entity.Status, "Pending", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only pending late timesheet request items can be reviewed." });
        }

        var actorRoles = RoleCatalog.ParseRoles(
            Request.Headers["X-User-Roles"].FirstOrDefault(),
            Request.Headers["X-User-Role"].FirstOrDefault());
        var actorId = Guid.TryParse(Request.Headers["X-User-Id"].ToString(), out var parsedActorId)
            ? parsedActorId
            : Guid.Empty;

        if (!RoleCatalog.HasRole(actorRoles, RoleCatalog.SystemAdmin) && actorId != entity.ManagerId)
        {
            return BadRequest(new { message = "Only the mapped Team Manager can decide this late timesheet request item." });
        }

        var normalizedDecision = request.Decision.Trim().ToLowerInvariant();
        if (normalizedDecision is not "approved" and not "rejected")
        {
            return BadRequest(new { message = "Decision must be either Approved or Rejected." });
        }

        if (normalizedDecision == "rejected" && string.IsNullOrWhiteSpace(request.DecisionNote))
        {
            return BadRequest(new { message = "A rejection note is required before sending the request back." });
        }

        var now = DateTime.UtcNow;
        entity.Status = normalizedDecision == "approved" ? "Approved" : "Rejected";
        entity.DecisionNote = request.DecisionNote?.Trim() ?? string.Empty;
        entity.DecisionAtUtc = now;
        entity.UnlockExpiresAtUtc = normalizedDecision == "approved"
            ? now.AddHours(LateTimesheetAccessService.UnlockDurationHours)
            : null;
        entity.Request.UpdatedAtUtc = now;

        await dbContext.SaveChangesAsync(cancellationToken);

        var visibleItems = RoleCatalog.HasRole(actorRoles, RoleCatalog.SystemAdmin)
            ? entity.Request.Items.ToList()
            : entity.Request.Items.Where(item => item.ManagerId == entity.ManagerId).ToList();

        return Ok(MapRequest(entity.Request, visibleItems));
    }

    [HttpGet("access")]
    public async Task<ActionResult<LateTimesheetAccessDto>> GetApprovedAccess(
        [FromQuery] string userId,
        [FromQuery] string weekStart,
        CancellationToken cancellationToken)
    {
        var parsedUserId = Guid.Parse(userId);
        var parsedWeekStart = weekStart.ParseRequiredDate(nameof(weekStart));
        var accessItems = await lateTimesheetAccessService.GetApprovedAccessItemsAsync(parsedUserId, parsedWeekStart, cancellationToken);
        var weekEnd = parsedWeekStart.AddDays(WeeklyWorkingDays - 1);

        return Ok(new LateTimesheetAccessDto(
            parsedWeekStart.ToApiString(),
            weekEnd.ToApiString(),
            accessItems.Select(item => new LateTimesheetAccessItemDto(
                item.RequestId.ToString(),
                item.Id.ToString(),
                item.EntryDate.ToApiString(),
                item.ProjectId.ToString(),
                item.ProjectName,
                item.TaskId.ToString(),
                item.TaskTitle,
                item.ManagerId.ToString(),
                item.ManagerName,
                item.UnlockExpiresAtUtc?.ToString("O") ?? string.Empty))
            .ToList()));
    }

    private static List<DateOnly> ParseDateList(string dates) =>
        dates
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(item => item.ParseRequiredDate(nameof(dates)))
            .Where(item => item.DayOfWeek != DayOfWeek.Sunday)
            .Distinct()
            .OrderBy(item => item)
            .ToList();

    private static bool IsHistoricalDate(DateOnly date)
    {
        var currentWeekStart = GetWeekStart(DateOnly.FromDateTime(DateTime.Today));
        return date < currentWeekStart;
    }

    private static DateOnly GetWeekStart(DateOnly date)
    {
        var diff = date.DayOfWeek == DayOfWeek.Sunday ? -6 : DayOfWeek.Monday - date.DayOfWeek;
        return date.AddDays(diff);
    }

    private async Task<IReadOnlyList<DateOnly>> BuildCandidateHistoricalDatesAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var currentWeekStart = GetWeekStart(DateOnly.FromDateTime(DateTime.Today));
        var latestHistoricalDate = currentWeekStart.AddDays(-1);

        var taskAssignments = await dbContext.TaskAssignments
            .AsNoTracking()
            .Where(item => item.AssignedTo == userId && item.StartDate <= latestHistoricalDate)
            .ToListAsync(cancellationToken);

        if (taskAssignments.Count == 0)
        {
            return Array.Empty<DateOnly>();
        }

        var projectIds = taskAssignments
            .Select(item => item.ProjectId)
            .Distinct()
            .ToList();

        var projects = await dbContext.Projects
            .AsNoTracking()
            .Where(item => projectIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken);

        var candidateDates = new SortedSet<DateOnly>();

        foreach (var task in taskAssignments)
        {
            if (!projects.TryGetValue(task.ProjectId, out var project))
            {
                continue;
            }

            var start = MaxDate(task.StartDate.GetValueOrDefault(DateOnly.MinValue), project.StartDate);
            var end = MinDate(task.EndDate.GetValueOrDefault(DateOnly.MaxValue), project.EndDate, latestHistoricalDate);
            if (end < start)
            {
                continue;
            }

            for (var date = start; date <= end; date = date.AddDays(1))
            {
                if (date.DayOfWeek != DayOfWeek.Sunday)
                {
                    candidateDates.Add(date);
                }
            }
        }

        return candidateDates.ToList();
    }

    private async Task<IReadOnlyList<LateTimesheetDateOptionDto>> BuildEligibleOptionsAsync(
        Guid userId,
        IReadOnlyList<DateOnly> requestedDates,
        bool includeEmptyDates,
        CancellationToken cancellationToken)
    {
        var normalizedDates = requestedDates
            .Where(IsHistoricalDate)
            .Where(date => date.DayOfWeek != DayOfWeek.Sunday)
            .Distinct()
            .OrderBy(date => date)
            .ToList();

        if (normalizedDates.Count == 0)
        {
            return Array.Empty<LateTimesheetDateOptionDto>();
        }

        var minDate = normalizedDates.Min();
        var maxDate = normalizedDates.Max();

        var taskAssignments = await dbContext.TaskAssignments
            .AsNoTracking()
            .Where(item => item.AssignedTo == userId && item.StartDate <= maxDate && item.EndDate >= minDate)
            .OrderBy(item => item.ProjectName)
            .ThenBy(item => item.Title)
            .ToListAsync(cancellationToken);

        var projectIds = taskAssignments
            .Select(item => item.ProjectId)
            .Distinct()
            .ToList();

        var projects = await dbContext.Projects
            .AsNoTracking()
            .Where(item => projectIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken);

        var relevantWeekStarts = normalizedDates
            .Select(GetWeekStart)
            .Distinct()
            .ToList();

        var weeklyTimesheets = await dbContext.WeeklyTimesheets
            .AsNoTracking()
            .Where(item => item.UserId == userId && relevantWeekStarts.Contains(item.WeekStart))
            .ToListAsync(cancellationToken);

        var occupiedKeys = LateTimesheetAccessService.ParseOccupiedCellKeys(
            weeklyTimesheets.Select(item => item.RowsJson));

        var now = DateTime.UtcNow;
        var existingKeys = await dbContext.LateTimesheetRequestItems
            .AsNoTracking()
            .Include(item => item.Request)
            .Where(item =>
                item.Request.UserId == userId &&
                normalizedDates.Contains(item.EntryDate) &&
                (item.Status == PendingStatus ||
                 (item.Status == ApprovedStatus &&
                  item.UnlockExpiresAtUtc.HasValue &&
                  item.UnlockExpiresAtUtc.Value > now)))
            .Select(item => LateTimesheetAccessService.BuildCellKey(item.EntryDate, item.ProjectId, item.TaskId))
            .ToListAsync(cancellationToken);

        var unavailableKeys = existingKeys.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var result = normalizedDates
            .Select(date =>
            {
                var projectsForDate = taskAssignments
                    .Where(item =>
                        item.StartDate <= date &&
                        item.EndDate >= date &&
                        projects.TryGetValue(item.ProjectId, out var project) &&
                        project.StartDate <= date &&
                        project.EndDate >= date &&
                        project.ManagerId != Guid.Empty)
                    .GroupBy(item => item.ProjectId)
                    .Select(group =>
                    {
                        var project = projects[group.Key];
                        var tasks = group
                            .Where(item =>
                            {
                                var cellKey = LateTimesheetAccessService.BuildCellKey(date, item.ProjectId, item.Id);
                                return !occupiedKeys.Contains(cellKey) && !unavailableKeys.Contains(cellKey);
                            })
                            .OrderBy(item => item.Title)
                            .Select(item => new LateTimesheetTaskOptionDto(
                                item.Id.ToString(),
                                item.Title,
                                item.Status,
                                item.StartDate?.ToApiString() ?? string.Empty,
                                item.EndDate?.ToApiString() ?? string.Empty))
                            .ToList();

                        return new LateTimesheetProjectOptionDto(
                            project.Id.ToString(),
                            project.Name,
                            project.ManagerId.ToString(),
                            project.ManagerName,
                            tasks);
                    })
                    .Where(item => item.Tasks.Count > 0)
                    .OrderBy(item => item.ProjectName)
                    .ToList();

                return new LateTimesheetDateOptionDto(date.ToApiString(), projectsForDate);
            })
            .Where(item => includeEmptyDates || item.Projects.Count > 0)
            .ToList();

        return result;
    }

    private static DateOnly MaxDate(params DateOnly[] values) => values.Max();

    private static DateOnly MinDate(params DateOnly[] values) => values.Min();

    private static LateTimesheetRequestDto MapRequest(
        LateTimesheetRequestEntity entity,
        IReadOnlyCollection<LateTimesheetRequestItemEntity>? visibleItems = null)
    {
        IEnumerable<LateTimesheetRequestItemEntity> requestItems = visibleItems ?? entity.Items.ToList();

        var items = requestItems
            .OrderBy(item => item.EntryDate)
            .ThenBy(item => item.ProjectName)
            .ThenBy(item => item.TaskTitle)
            .Select(item => new LateTimesheetRequestItemDto(
                item.Id.ToString(),
                item.EntryDate.ToApiString(),
                item.ProjectId.ToString(),
                item.ProjectName,
                item.TaskId.ToString(),
                item.TaskTitle,
                item.ManagerId.ToString(),
                item.ManagerName,
                item.Status,
                item.DecisionNote,
                item.DecisionAtUtc?.ToString("O"),
                item.UnlockExpiresAtUtc?.ToString("O"),
                item.LastUsedAtUtc?.ToString("O")))
            .ToList();

        var overallStatus = CalculateOverallStatus(entity.Items);

        return new LateTimesheetRequestDto(
            entity.Id.ToString(),
            entity.UserId.ToString(),
            entity.UserName,
            overallStatus,
            entity.Reason,
            entity.AdditionalRemarks,
            entity.CreatedAtUtc.ToString("O"),
            entity.UpdatedAtUtc.ToString("O"),
            items);
    }

    private static string CalculateOverallStatus(IEnumerable<LateTimesheetRequestItemEntity> items)
    {
        var statuses = items
            .Select(item => item.Status.Trim())
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .ToList();

        if (statuses.Count == 0)
        {
            return "Pending";
        }

        if (statuses.All(item => string.Equals(item, PendingStatus, StringComparison.OrdinalIgnoreCase)))
        {
            return PendingStatus;
        }

        if (statuses.All(item => string.Equals(item, ApprovedStatus, StringComparison.OrdinalIgnoreCase)))
        {
            return ApprovedStatus;
        }

        if (statuses.All(item => string.Equals(item, RejectedStatus, StringComparison.OrdinalIgnoreCase)))
        {
            return RejectedStatus;
        }

        return "In Review";
    }

    private sealed record RequestedLateEntryItem(DateOnly Date, Guid ProjectId, Guid TaskId);
}

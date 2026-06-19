using AbhiTimesheet.Api.Contracts.Timesheets;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using AbhiTimesheet.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.Json;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class TimesheetsController(
    AppDbContext dbContext,
    LateTimesheetAccessService lateTimesheetAccessService) : ControllerBase
{
    private const double DailyHourLimit = 9;
    private const int WeeklyWorkingDays = 6;
    private const string CurrentLiveWeekOnlyMessage = "Timesheet entry is only allowed for the Active Week.";

    [HttpGet("timesheets/{userId:guid}")]
    public async Task<ActionResult<DailyTimesheetDto>> GetDailyTimesheet(Guid userId, [FromQuery] string date)
    {
        var targetDate = date.ParseRequiredDate(nameof(date));

        var entity = await dbContext.DailyTimesheets
            .AsNoTracking()
            .Include(item => item.Entries)
            .FirstOrDefaultAsync(item => item.UserId == userId && item.Date == targetDate);

        if (entity is null)
        {
            return NoContent();
        }

        return Ok(Map(entity));
    }

    [HttpGet("timesheets/history/{userId:guid}")]
    public async Task<ActionResult<IReadOnlyList<DailyTimesheetDto>>> GetDailyTimesheetHistory(Guid userId)
    {
        var items = await dbContext.DailyTimesheets
            .AsNoTracking()
            .Include(item => item.Entries)
            .Where(item => item.UserId == userId)
            .OrderByDescending(item => item.Date)
            .ToListAsync();

        return Ok(items.Select(Map).ToList());
    }

    [HttpPost("timesheets/save")]
    public async Task<ActionResult<DailyTimesheetDto>> SaveDailyTimesheet([FromBody] DailyTimesheetSaveRequest request)
    {
        var validationMessage = GetDailyValidationMessage(request);
        if (validationMessage is not null)
        {
            return BadRequest(new { message = validationMessage });
        }

        var userId = Guid.Parse(request.UserId);
        var date = request.Date.ParseRequiredDate(nameof(request.Date));
        if (!IsCurrentLiveWeekDate(date))
        {
            return BadRequest(new { message = CurrentLiveWeekOnlyMessage });
        }

        var entity = await dbContext.DailyTimesheets
            .Include(item => item.Entries)
            .FirstOrDefaultAsync(item => item.UserId == userId && item.Date == date);

        if (entity is null)
        {
            entity = new DailyTimesheetEntity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Date = date
            };
            dbContext.DailyTimesheets.Add(entity);
        }
        else if (IsLockedTimesheetStatus(entity.Status))
        {
            return BadRequest(new { message = "Submitted timesheets are locked and cannot be edited." });
        }

        ApplyDailyRequest(entity, request);
        await dbContext.SaveChangesAsync();

        return Ok(Map(entity));
    }

    [HttpPut("timesheets/{id:guid}")]
    public async Task<ActionResult<DailyTimesheetDto>> UpdateDailyTimesheet(Guid id, [FromBody] DailyTimesheetSaveRequest request)
    {
        var validationMessage = GetDailyValidationMessage(request);
        if (validationMessage is not null)
        {
            return BadRequest(new { message = validationMessage });
        }

        var requestedDate = request.Date.ParseRequiredDate(nameof(request.Date));
        if (!IsCurrentLiveWeekDate(requestedDate))
        {
            return BadRequest(new { message = CurrentLiveWeekOnlyMessage });
        }

        var entity = await dbContext.DailyTimesheets
            .Include(item => item.Entries)
            .FirstOrDefaultAsync(item => item.Id == id);

        if (entity is null)
        {
            return NotFound(new { message = "Timesheet entry not found." });
        }

        if (IsLockedTimesheetStatus(entity.Status))
        {
            return BadRequest(new { message = "Submitted timesheets are locked and cannot be edited." });
        }

        entity.UserId = Guid.Parse(request.UserId);
        entity.Date = requestedDate;

        ApplyDailyRequest(entity, request);
        await dbContext.SaveChangesAsync();

        return Ok(Map(entity));
    }

    [HttpGet("timesheets")]
    public async Task<ActionResult<IReadOnlyList<DailyTimesheetDto>>> ListDailyTimesheets()
    {
        var items = await dbContext.DailyTimesheets
            .AsNoTracking()
            .Include(item => item.Entries)
            .OrderByDescending(item => item.Date)
            .ToListAsync();

        return Ok(items.Select(Map).ToList());
    }

    [HttpDelete("timesheets/{id:guid}")]
    public async Task<IActionResult> DeleteDailyTimesheet(Guid id)
    {
        var entity = await dbContext.DailyTimesheets.FirstOrDefaultAsync(item => item.Id == id);
        if (entity is null)
        {
            return NotFound(new { message = "Timesheet entry not found." });
        }

        if (IsLockedTimesheetStatus(entity.Status))
        {
            return BadRequest(new { message = "Submitted timesheets are locked and cannot be deleted." });
        }

        dbContext.DailyTimesheets.Remove(entity);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("weekly-timesheets")]
    public async Task<ActionResult<IReadOnlyList<WeeklyTimesheetDto>>> ListWeeklyTimesheets()
    {
        var items = await dbContext.WeeklyTimesheets
            .AsNoTracking()
            .OrderByDescending(item => item.UpdatedAtUtc)
            .ToListAsync();

        return Ok(items.Select(Map).ToList());
    }

    [HttpGet("weekly-timesheets/by-user-week")]
    public async Task<ActionResult<WeeklyTimesheetDto>> GetWeeklyTimesheet([FromQuery] string weekStart, [FromQuery] string userId)
    {
        var targetWeekStart = weekStart.ParseRequiredDate(nameof(weekStart));
        var parsedUserId = Guid.Parse(userId);

        var entity = await dbContext.WeeklyTimesheets
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == parsedUserId && item.WeekStart == targetWeekStart);

        if (entity is null)
        {
            return NoContent();
        }

        return Ok(Map(entity));
    }

    [HttpPost("weekly-timesheets")]
    public async Task<ActionResult<WeeklyTimesheetDto>> SaveWeeklyTimesheet([FromBody] WeeklyTimesheetSaveRequest request)
    {
        var validationMessage = GetWeeklyValidationMessage(request.RowsJson);
        if (validationMessage is not null)
        {
            return BadRequest(new { message = validationMessage });
        }

        var weekStart = request.WeekStart.ParseRequiredDate(nameof(request.WeekStart));
        var userId = Guid.Parse(request.UserId);
        var nextStatus = request.Status.Trim();
        var entity = await dbContext.WeeklyTimesheets
            .FirstOrDefaultAsync(item => item.UserId == userId && item.WeekStart == weekStart);

        if (!IsCurrentLiveWeekStart(weekStart))
        {
            if (entity is null)
            {
                return BadRequest(new { message = CurrentLiveWeekOnlyMessage });
            }

            if (!IsHistoricalWorkflowStatusUpdateAllowed(entity, request.RowsJson, nextStatus, out var errorMessage))
            {
                return BadRequest(new { message = errorMessage });
            }

            entity.AdminId = Guid.Parse(request.AdminId);
            entity.AdminName = request.AdminName.Trim();
            entity.Status = nextStatus;
            entity.TotalHours = CalculateWeeklyTotalHours(request.RowsJson);
            entity.RowsJson = request.RowsJson;
            entity.UpdatedAtUtc = DateTime.UtcNow;

            await dbContext.SaveChangesAsync();

            return Ok(Map(entity));
        }

        if (entity is null)
        {
            entity = new WeeklyTimesheetEntity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                WeekStart = weekStart
            };
            dbContext.WeeklyTimesheets.Add(entity);
        }
        else
        {
            if (IsLockedTimesheetStatus(entity.Status))
            {
                if (IsApprovedTimesheetStatus(entity.Status))
                {
                    if (!RowsJsonEquivalent(entity.RowsJson, request.RowsJson) || !IsApprovedTimesheetStatus(nextStatus))
                    {
                        return BadRequest(new { message = "Approved timesheets cannot be changed." });
                    }
                }

                if (IsSubmittedTimesheetStatus(entity.Status) || entity.Status == "Manager Approved")
                {
                    if (IsDraftTimesheetStatus(nextStatus))
                    {
                        return BadRequest(new { message = "Submitted timesheets cannot be moved back to draft." });
                    }

                    if (!RowsJsonEquivalent(entity.RowsJson, request.RowsJson) &&
                        !IsSubmittedCurrentWeekAdvanceUpdateAllowed(entity, request.RowsJson, nextStatus))
                    {
                        return BadRequest(new
                        {
                            message = "Submitted timesheets are locked. Only future days in the Active Week can be added in advance."
                        });
                    }
                }
            }
        }

        entity.AdminId = Guid.Parse(request.AdminId);
        entity.AdminName = request.AdminName.Trim();
        entity.WeekStart = weekStart;
        entity.WeekEnd = weekStart.AddDays(WeeklyWorkingDays - 1);
        entity.TotalHours = request.TotalHours;
        entity.RowsJson = request.RowsJson;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        // NEW APPROVAL LOGIC
        if (nextStatus == "Approved")
        {
            if (request.AdminApprovalStatus == "Approved")
            {
                entity.AdminApprovalStatus = "Approved";
                entity.ApprovedBy = request.ApprovedBy ?? entity.AdminName;
                
                if (entity.ManagerApprovalStatus == "Approved")
                {
                    entity.Status = "Approved";
                    entity.ApprovalFlowType = "Fully Approved (Manager + Admin)";
                }
                else
                {
                    entity.Status = "Approved";
                    entity.ApprovalFlowType = "Direct Approved by Admin";
                }
            }
            else if (request.ManagerApprovalStatus == "Approved")
            {
                entity.ManagerApprovalStatus = "Approved";
                entity.Status = "Manager Approved";
                entity.ApprovalFlowType = "Approved by Manager";
            }
            else
            {
                entity.Status = "Approved"; // Legacy or direct set
            }
        }
        else if (nextStatus == "Rejected")
        {
            entity.Status = "Rejected";
            entity.ManagerApprovalStatus = "Rejected";
            entity.AdminApprovalStatus = "Rejected";
        }
        else
        {
            entity.Status = nextStatus;
        }

        await dbContext.SaveChangesAsync();

        return Ok(Map(entity));
    }

    [HttpDelete("weekly-timesheets/{id:guid}")]
    public async Task<IActionResult> DeleteWeeklyTimesheet(Guid id)
    {
        var entity = await dbContext.WeeklyTimesheets.FirstOrDefaultAsync(item => item.Id == id);
        if (entity is null)
        {
            return NotFound(new { message = "Timesheet week not found." });
        }

        if (IsLockedTimesheetStatus(entity.Status))
        {
            return BadRequest(new { message = "Submitted timesheets are locked and cannot be deleted." });
        }

        dbContext.WeeklyTimesheets.Remove(entity);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("weekly-timesheets/historical-apply")]
    public async Task<ActionResult<WeeklyTimesheetDto>> ApplyHistoricalWeeklyTimesheet(
        [FromBody] HistoricalWeeklyTimesheetApplyRequest request,
        CancellationToken cancellationToken)
    {
        var validationMessage = GetWeeklyValidationMessage(request.RowsJson);
        if (validationMessage is not null)
        {
            return BadRequest(new { message = validationMessage });
        }

        var userId = Guid.Parse(request.UserId);
        var weekStart = request.WeekStart.ParseRequiredDate(nameof(request.WeekStart));
        if (IsCurrentLiveWeekStart(weekStart))
        {
            return BadRequest(new { message = "Use the regular Active Week save flow for current timesheet entry." });
        }

        var entity = await dbContext.WeeklyTimesheets
            .FirstOrDefaultAsync(item => item.UserId == userId && item.WeekStart == weekStart, cancellationToken);

        if (entity is not null)
        {
            if (IsApprovedTimesheetStatus(entity.Status))
            {
                return BadRequest(new { message = "Approved historical timesheets cannot be changed." });
            }

            if (IsSubmittedTimesheetStatus(entity.Status))
            {
                if (RowsJsonEquivalent(entity.RowsJson, request.RowsJson))
                {
                    return Ok(Map(entity));
                }

                return BadRequest(new { message = "This historical timesheet is already submitted and waiting for Team Manager approval." });
            }
        }

        var currentRowsJson = entity?.RowsJson ?? "[]";
        var accessValidation = await lateTimesheetAccessService.ValidateHistoricalUpdateAsync(
            userId,
            weekStart,
            currentRowsJson,
            request.RowsJson,
            cancellationToken);

        if (!accessValidation.IsAllowed)
        {
            return BadRequest(new
            {
                message = accessValidation.ErrorMessage ?? "Historical late-entry access is not available for this update."
            });
        }

        var isRejectedHistoricalResubmission = entity is not null &&
            IsRejectedTimesheetStatus(entity.Status) &&
            RowsJsonEquivalent(entity.RowsJson, request.RowsJson);

        if (accessValidation.UsedRequestItemIds.Count == 0 && !isRejectedHistoricalResubmission)
        {
            return BadRequest(new { message = "No approved historical late-entry changes were detected for this week." });
        }

        var actorName = await dbContext.Employees
            .AsNoTracking()
            .Where(item => item.Id == userId)
            .Select(item => item.FullName)
            .FirstOrDefaultAsync(cancellationToken);

        if (entity is null)
        {
            entity = new WeeklyTimesheetEntity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                WeekStart = weekStart,
                WeekEnd = weekStart.AddDays(WeeklyWorkingDays - 1)
            };
            dbContext.WeeklyTimesheets.Add(entity);
        }

        entity.AdminId = userId;
        entity.AdminName = actorName ?? entity.AdminName;
        entity.WeekStart = weekStart;
        entity.WeekEnd = weekStart.AddDays(WeeklyWorkingDays - 1);
        entity.Status = "Submitted";
        entity.TotalHours = CalculateWeeklyTotalHours(request.RowsJson);
        entity.RowsJson = request.RowsJson;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        if (accessValidation.UsedRequestItemIds.Count > 0)
        {
            await lateTimesheetAccessService.MarkItemsUsedAsync(accessValidation.UsedRequestItemIds, cancellationToken);
        }
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(Map(entity));
    }

    private static void ApplyDailyRequest(DailyTimesheetEntity entity, DailyTimesheetSaveRequest request)
    {
        entity.Status = request.Status.Trim();
        entity.TotalHours = request.Entries.Sum(item => item.Hours);
        entity.UpdatedAtUtc = DateTime.UtcNow;
        entity.Entries.Clear();

        foreach (var entry in request.Entries)
        {
            entity.Entries.Add(new DailyTimesheetEntryEntity
            {
                Id = Guid.NewGuid(),
                TaskId = Guid.Parse(entry.TaskId),
                TaskTitle = string.Empty,
                Hours = entry.Hours,
                WorkDescription = entry.WorkDescription.Trim()
            });
        }
    }

    private static string? GetDailyValidationMessage(DailyTimesheetSaveRequest request)
    {
        if (request.Entries.Any(item => item.Hours < 0))
        {
            return "Timesheet hours cannot be negative.";
        }

        if (request.Entries.Any(item => item.Hours > DailyHourLimit))
        {
            return $"Single task entry cannot exceed {DailyHourLimit:0} hours per day.";
        }

        if (request.Entries.Sum(item => item.Hours) > DailyHourLimit)
        {
            return $"Daily timesheet total cannot exceed {DailyHourLimit:0} hours.";
        }

        return null;
    }

    private static string? GetWeeklyValidationMessage(string rowsJson)
    {
        try
        {
            using var document = JsonDocument.Parse(rowsJson);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return "Invalid weekly timesheet rows.";
            }

            var totalsByDate = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);

            foreach (var row in document.RootElement.EnumerateArray())
            {
                if (!row.TryGetProperty("hours", out var hours) || hours.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                foreach (var hourEntry in hours.EnumerateObject())
                {
                    if (!TryReadHours(hourEntry.Value, out var hoursValue))
                    {
                        return $"Invalid hours value for {hourEntry.Name}.";
                    }

                    if (hoursValue < 0)
                    {
                        return "Timesheet hours cannot be negative.";
                    }

                    if (hoursValue > DailyHourLimit)
                    {
                        return $"Single task entry cannot exceed {DailyHourLimit:0} hours for {hourEntry.Name}.";
                    }

                    totalsByDate[hourEntry.Name] = totalsByDate.GetValueOrDefault(hourEntry.Name) + hoursValue;
                }
            }

            var overLimitDate = totalsByDate.FirstOrDefault(item => item.Value > DailyHourLimit);
            if (!string.IsNullOrWhiteSpace(overLimitDate.Key))
            {
                return $"Daily timesheet total cannot exceed {DailyHourLimit:0} hours for {overLimitDate.Key}.";
            }

            return null;
        }
        catch (JsonException)
        {
            return "Invalid weekly timesheet rows.";
        }
    }

    private static bool TryReadHours(JsonElement value, out double hours)
    {
        if (value.ValueKind == JsonValueKind.Number)
        {
            return value.TryGetDouble(out hours);
        }

        if (value.ValueKind == JsonValueKind.String)
        {
            return double.TryParse(value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out hours);
        }

        hours = 0;
        return false;
    }

    private static double CalculateWeeklyTotalHours(string rowsJson)
    {
        try
        {
            using var document = JsonDocument.Parse(rowsJson);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return 0;
            }

            var totalHours = 0d;

            foreach (var row in document.RootElement.EnumerateArray())
            {
                if (!row.TryGetProperty("hours", out var hours) || hours.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                foreach (var hourEntry in hours.EnumerateObject())
                {
                    if (TryReadHours(hourEntry.Value, out var hoursValue))
                    {
                        totalHours += hoursValue;
                    }
                }
            }

            return totalHours;
        }
        catch (JsonException)
        {
            return 0;
        }
    }

    private static bool IsDraftTimesheetStatus(string status) =>
        string.Equals(status?.Trim(), "Draft", StringComparison.OrdinalIgnoreCase);

    private static bool IsSubmittedTimesheetStatus(string status) =>
        string.Equals(status?.Trim(), "Submitted", StringComparison.OrdinalIgnoreCase);

    private static bool IsApprovedTimesheetStatus(string status) =>
        string.Equals(status?.Trim(), "Approved", StringComparison.OrdinalIgnoreCase);

    private static bool IsRejectedTimesheetStatus(string status) =>
        string.Equals(status?.Trim(), "Rejected", StringComparison.OrdinalIgnoreCase);

    private static bool IsLockedTimesheetStatus(string status) =>
        IsSubmittedTimesheetStatus(status) || IsApprovedTimesheetStatus(status);

    private static bool IsHistoricalWorkflowStatusUpdateAllowed(
        WeeklyTimesheetEntity entity,
        string nextRowsJson,
        string nextStatus,
        out string errorMessage)
    {
        if (!RowsJsonEquivalent(entity.RowsJson, nextRowsJson))
        {
            errorMessage = "Historical timesheets can only change status after submission. Use the approved late-entry flow to edit entries.";
            return false;
        }

        if (IsApprovedTimesheetStatus(entity.Status))
        {
            if (!IsApprovedTimesheetStatus(nextStatus))
            {
                errorMessage = "Approved timesheets cannot be changed.";
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }

        if (!IsSubmittedTimesheetStatus(entity.Status))
        {
            errorMessage = "Only submitted historical timesheets can be reviewed outside the Active Week.";
            return false;
        }

        if (!IsSubmittedTimesheetStatus(nextStatus) &&
            !IsApprovedTimesheetStatus(nextStatus) &&
            !IsRejectedTimesheetStatus(nextStatus))
        {
            errorMessage = "Historical timesheets can only move through Submitted, Approved, or Rejected review states.";
            return false;
        }

        errorMessage = string.Empty;
        return true;
    }

    private static bool RowsJsonEquivalent(string currentRowsJson, string nextRowsJson)
    {
        if (string.Equals(currentRowsJson, nextRowsJson, StringComparison.Ordinal))
        {
            return true;
        }

        try
        {
            using var currentDocument = JsonDocument.Parse(currentRowsJson);
            using var nextDocument = JsonDocument.Parse(nextRowsJson);
            return JsonSerializer.Serialize(currentDocument.RootElement) == JsonSerializer.Serialize(nextDocument.RootElement);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool IsSubmittedCurrentWeekAdvanceUpdateAllowed(
        WeeklyTimesheetEntity entity,
        string nextRowsJson,
        string nextStatus)
    {
        if (!IsSubmittedTimesheetStatus(entity.Status) || !IsSubmittedTimesheetStatus(nextStatus))
        {
            return false;
        }

        var today = DateOnly.FromDateTime(DateTime.Now);
        if (today < entity.WeekStart || today > entity.WeekEnd)
        {
            return false;
        }

        return LockedRowsEquivalentThroughDate(entity.RowsJson, nextRowsJson, today);
    }

    private static bool LockedRowsEquivalentThroughDate(string currentRowsJson, string nextRowsJson, DateOnly lockedThroughDate)
    {
        try
        {
            return JsonSerializer.Serialize(CreateLockedRowsSnapshot(currentRowsJson, lockedThroughDate)) ==
                   JsonSerializer.Serialize(CreateLockedRowsSnapshot(nextRowsJson, lockedThroughDate));
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static List<LockedRowSnapshot> CreateLockedRowsSnapshot(string rowsJson, DateOnly lockedThroughDate)
    {
        using var document = JsonDocument.Parse(rowsJson);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            return new List<LockedRowSnapshot>();
        }

        var snapshots = new List<LockedRowSnapshot>();

        foreach (var row in document.RootElement.EnumerateArray())
        {
            var hours = ReadLockedHours(row, lockedThroughDate);
            var notesByDate = ReadLockedNotes(row, lockedThroughDate);
            if (hours.Count == 0 && notesByDate.Count == 0)
            {
                continue;
            }

            snapshots.Add(new LockedRowSnapshot(
                ReadStringProperty(row, "id"),
                ReadStringProperty(row, "projectId"),
                hours,
                notesByDate));
        }

        return snapshots
            .OrderBy(item => item.Id, StringComparer.Ordinal)
            .ThenBy(item => item.ProjectId, StringComparer.Ordinal)
            .ToList();
    }

    private static SortedDictionary<string, double> ReadLockedHours(JsonElement row, DateOnly lockedThroughDate)
    {
        var hours = new SortedDictionary<string, double>(StringComparer.Ordinal);
        if (!row.TryGetProperty("hours", out var hoursElement) || hoursElement.ValueKind != JsonValueKind.Object)
        {
            return hours;
        }

        foreach (var hourEntry in hoursElement.EnumerateObject())
        {
            if (!TryParseDateKey(hourEntry.Name, out var entryDate) || entryDate > lockedThroughDate)
            {
                continue;
            }

            if (TryReadHours(hourEntry.Value, out var hoursValue) && Math.Abs(hoursValue) > double.Epsilon)
            {
                hours[hourEntry.Name] = hoursValue;
            }
        }

        return hours;
    }

    private static SortedDictionary<string, string> ReadLockedNotes(JsonElement row, DateOnly lockedThroughDate)
    {
        var notesByDate = new SortedDictionary<string, string>(StringComparer.Ordinal);
        if (!row.TryGetProperty("notesByDate", out var notesElement) || notesElement.ValueKind != JsonValueKind.Object)
        {
            return notesByDate;
        }

        foreach (var noteEntry in notesElement.EnumerateObject())
        {
            if (!TryParseDateKey(noteEntry.Name, out var entryDate) || entryDate > lockedThroughDate)
            {
                continue;
            }

            var note = noteEntry.Value.ValueKind == JsonValueKind.String ? noteEntry.Value.GetString()?.Trim() ?? string.Empty : string.Empty;
            if (!string.IsNullOrWhiteSpace(note))
            {
                notesByDate[noteEntry.Name] = note;
            }
        }

        return notesByDate;
    }

    private static bool TryParseDateKey(string key, out DateOnly date) =>
        DateOnly.TryParseExact(key, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    private static bool IsCurrentLiveWeekStart(DateOnly weekStart) =>
        weekStart == GetWeekStart(DateOnly.FromDateTime(DateTime.Today));

    private static bool IsCurrentLiveWeekDate(DateOnly date)
    {
        var currentWeekStart = GetWeekStart(DateOnly.FromDateTime(DateTime.Today));
        var currentWeekEnd = currentWeekStart.AddDays(WeeklyWorkingDays - 1);
        return date >= currentWeekStart && date <= currentWeekEnd;
    }

    private static DateOnly GetWeekStart(DateOnly date)
    {
        var diff = date.DayOfWeek == DayOfWeek.Sunday ? -6 : DayOfWeek.Monday - date.DayOfWeek;
        return date.AddDays(diff);
    }

    private static string ReadStringProperty(JsonElement row, string propertyName) =>
        row.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()?.Trim() ?? string.Empty
            : string.Empty;

    private sealed record LockedRowSnapshot(
        string Id,
        string ProjectId,
        SortedDictionary<string, double> Hours,
        SortedDictionary<string, string> NotesByDate);

    private DailyTimesheetDto Map(DailyTimesheetEntity entity)
    {
        var taskLookup = dbContext.TaskAssignments
            .AsNoTracking()
            .Where(item => entity.Entries.Select(entry => entry.TaskId).Contains(item.Id))
            .ToDictionary(item => item.Id, item => item.Title);

        return new DailyTimesheetDto(
            entity.Id.ToString(),
            entity.UserId.ToString(),
            entity.Date.ToApiString(),
            entity.Status,
            entity.TotalHours,
            entity.Entries
                .OrderBy(item => item.Id)
                .Select(item => new DailyTimesheetEntryDto(
                    item.Id.ToString(),
                    item.TaskId.ToString(),
                    string.IsNullOrWhiteSpace(item.TaskTitle) && taskLookup.TryGetValue(item.TaskId, out var title)
                        ? title
                        : item.TaskTitle,
                    item.Hours,
                    item.WorkDescription))
                .ToList());
    }

    private static WeeklyTimesheetDto Map(WeeklyTimesheetEntity entity)
    {
        return new WeeklyTimesheetDto(
            entity.Id.ToString(),
            entity.UserId.ToString(),
            entity.AdminId.ToString(),
            entity.AdminName,
            entity.WeekStart.ToApiString(),
            entity.WeekEnd.ToApiString(),
            entity.Status,
            entity.ManagerApprovalStatus,
            entity.AdminApprovalStatus,
            entity.ApprovedBy,
            entity.ApprovalFlowType,
            entity.TotalHours,
            entity.RowsJson,
            entity.UpdatedAtUtc.ToString("O"));
    }
}

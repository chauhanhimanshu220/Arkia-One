using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.Json;

namespace AbhiTimesheet.Api.Services;

public sealed class LateTimesheetAccessService(AppDbContext dbContext)
{
    public const int UnlockDurationHours = 48;
    private const int WeeklyWorkingDays = 6;
    private const string ApprovedStatus = "Approved";

    public async Task<IReadOnlyList<LateTimesheetRequestItemEntity>> GetApprovedAccessItemsAsync(
        Guid userId,
        DateOnly weekStart,
        CancellationToken cancellationToken = default)
    {
        var weekEnd = weekStart.AddDays(WeeklyWorkingDays - 1);
        var now = DateTime.UtcNow;

        return await dbContext.LateTimesheetRequestItems
            .AsNoTracking()
            .Include(item => item.Request)
            .Where(item =>
                item.Request.UserId == userId &&
                item.EntryDate >= weekStart &&
                item.EntryDate <= weekEnd &&
                item.Status == ApprovedStatus &&
                item.UnlockExpiresAtUtc.HasValue &&
                item.UnlockExpiresAtUtc.Value > now)
            .OrderBy(item => item.EntryDate)
            .ThenBy(item => item.ProjectName)
            .ThenBy(item => item.TaskTitle)
            .ToListAsync(cancellationToken);
    }

    public async Task<HistoricalLateEntryValidationResult> ValidateHistoricalUpdateAsync(
        Guid userId,
        DateOnly weekStart,
        string currentRowsJson,
        string nextRowsJson,
        CancellationToken cancellationToken = default)
    {
        var currentCells = ParseTimesheetCells(currentRowsJson);
        var nextCells = ParseTimesheetCells(nextRowsJson);

        var changedKeys = currentCells.Keys
            .Union(nextCells.Keys)
            .Where(key =>
            {
                var currentValue = currentCells.GetValueOrDefault(key);
                var nextValue = nextCells.GetValueOrDefault(key);
                return !Equals(currentValue, nextValue);
            })
            .ToList();

        if (changedKeys.Count == 0)
        {
            return HistoricalLateEntryValidationResult.Allow(Array.Empty<Guid>());
        }

        var approvedItems = await GetApprovedAccessItemsAsync(userId, weekStart, cancellationToken);
        if (approvedItems.Count == 0)
        {
            return HistoricalLateEntryValidationResult.Deny("No approved late timesheet access is active for this historical week.");
        }

        var weekEnd = weekStart.AddDays(WeeklyWorkingDays - 1);
        var approvedLookup = approvedItems
            .GroupBy(item => new TimesheetCellKey(item.EntryDate, item.ProjectId, item.TaskId))
            .ToDictionary(group => group.Key, group => group.ToList());

        var changedTaskIds = changedKeys
            .Select(item => item.TaskId)
            .Distinct()
            .ToList();

        var taskLookup = await dbContext.TaskAssignments
            .AsNoTracking()
            .Where(item => changedTaskIds.Contains(item.Id) && item.AssignedTo == userId)
            .ToDictionaryAsync(item => item.Id, cancellationToken);

        var usedRequestItemIds = new HashSet<Guid>();

        foreach (var key in changedKeys)
        {
            var currentValue = currentCells.GetValueOrDefault(key);
            var nextValue = nextCells.GetValueOrDefault(key);

            if (key.Date < weekStart || key.Date > weekEnd)
            {
                return HistoricalLateEntryValidationResult.Deny("Historical late-entry updates can only be applied inside the selected week.");
            }

            if (currentValue is not null)
            {
                return HistoricalLateEntryValidationResult.Deny(
                    "Historical timesheet changes can only fill manager-approved empty date / project / task slots.");
            }

            if (nextValue is null)
            {
                continue;
            }

            if (!taskLookup.TryGetValue(key.TaskId, out var task) ||
                task.ProjectId != key.ProjectId ||
                task.StartDate > key.Date ||
                task.EndDate < key.Date)
            {
                return HistoricalLateEntryValidationResult.Deny(
                    "One or more historical cells no longer match your assigned task window for the selected date.");
            }

            if (!approvedLookup.TryGetValue(key, out var matchingItems))
            {
                return HistoricalLateEntryValidationResult.Deny(
                    "Only approved date / project / task combinations can be unlocked for historical timesheet entry.");
            }

            usedRequestItemIds.Add(matchingItems[0].Id);
        }

        return HistoricalLateEntryValidationResult.Allow(usedRequestItemIds);
    }

    public async Task MarkItemsUsedAsync(
        IEnumerable<Guid> requestItemIds,
        CancellationToken cancellationToken = default)
    {
        var uniqueIds = requestItemIds
            .Distinct()
            .ToList();

        if (uniqueIds.Count == 0)
        {
            return;
        }

        var items = await dbContext.LateTimesheetRequestItems
            .Where(item => uniqueIds.Contains(item.Id))
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        foreach (var item in items)
        {
            item.LastUsedAtUtc = now;
        }
    }

    public static string BuildCellKey(DateOnly date, Guid projectId, Guid taskId) =>
        $"{date:yyyy-MM-dd}|{projectId:D}|{taskId:D}";

    public static HashSet<string> ParseOccupiedCellKeys(IEnumerable<string> rowsJsonCollection)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var rowsJson in rowsJsonCollection)
        {
            foreach (var key in ParseOccupiedCellKeys(rowsJson))
            {
                keys.Add(key);
            }
        }

        return keys;
    }

    public static HashSet<string> ParseOccupiedCellKeys(string rowsJson) =>
        ParseTimesheetCells(rowsJson)
            .Keys
            .Select(key => BuildCellKey(key.Date, key.ProjectId, key.TaskId))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

    private static Dictionary<TimesheetCellKey, TimesheetCellValue> ParseTimesheetCells(string rowsJson)
    {
        try
        {
            using var document = JsonDocument.Parse(rowsJson);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return new Dictionary<TimesheetCellKey, TimesheetCellValue>();
            }

            var cells = new Dictionary<TimesheetCellKey, TimesheetCellValue>();

            foreach (var row in document.RootElement.EnumerateArray())
            {
                if (!TryReadGuidProperty(row, "id", out var taskId) ||
                    !TryReadGuidProperty(row, "projectId", out var projectId))
                {
                    continue;
                }

                var hoursByDate = ReadHoursByDate(row);
                var notesByDate = ReadNotesByDate(row, hoursByDate.Keys);

                foreach (var date in hoursByDate.Keys.Union(notesByDate.Keys))
                {
                    var hours = hoursByDate.GetValueOrDefault(date);
                    var note = notesByDate.GetValueOrDefault(date, string.Empty);
                    if (Math.Abs(hours) < double.Epsilon && string.IsNullOrWhiteSpace(note))
                    {
                        continue;
                    }

                    cells[new TimesheetCellKey(date, projectId, taskId)] = new TimesheetCellValue(hours, note);
                }
            }

            return cells;
        }
        catch (JsonException)
        {
            return new Dictionary<TimesheetCellKey, TimesheetCellValue>();
        }
    }

    private static Dictionary<DateOnly, double> ReadHoursByDate(JsonElement row)
    {
        var values = new Dictionary<DateOnly, double>();
        if (!row.TryGetProperty("hours", out var hoursElement) || hoursElement.ValueKind != JsonValueKind.Object)
        {
            return values;
        }

        foreach (var property in hoursElement.EnumerateObject())
        {
            if (!TryParseDate(property.Name, out var date) || !TryReadHours(property.Value, out var hours))
            {
                continue;
            }

            if (Math.Abs(hours) > double.Epsilon)
            {
                values[date] = hours;
            }
        }

        return values;
    }

    private static Dictionary<DateOnly, string> ReadNotesByDate(JsonElement row, IEnumerable<DateOnly> hourDates)
    {
        var values = new Dictionary<DateOnly, string>();
        if (row.TryGetProperty("notesByDate", out var notesByDateElement) && notesByDateElement.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in notesByDateElement.EnumerateObject())
            {
                if (!TryParseDate(property.Name, out var date))
                {
                    continue;
                }

                var note = property.Value.ValueKind == JsonValueKind.String
                    ? property.Value.GetString()?.Trim() ?? string.Empty
                    : string.Empty;

                if (!string.IsNullOrWhiteSpace(note))
                {
                    values[date] = note;
                }
            }

            return values;
        }

        var fallbackNote = row.TryGetProperty("notes", out var notesElement) && notesElement.ValueKind == JsonValueKind.String
            ? notesElement.GetString()?.Trim() ?? string.Empty
            : string.Empty;

        if (string.IsNullOrWhiteSpace(fallbackNote))
        {
            return values;
        }

        foreach (var date in hourDates)
        {
            values[date] = fallbackNote;
        }

        return values;
    }

    private static bool TryReadGuidProperty(JsonElement element, string propertyName, out Guid value)
    {
        value = Guid.Empty;
        return element.TryGetProperty(propertyName, out var property) &&
               property.ValueKind == JsonValueKind.String &&
               Guid.TryParse(property.GetString(), out value);
    }

    private static bool TryParseDate(string value, out DateOnly date) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

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

    private sealed record TimesheetCellKey(DateOnly Date, Guid ProjectId, Guid TaskId);

    private sealed record TimesheetCellValue(double Hours, string Note);
}

public sealed record HistoricalLateEntryValidationResult(
    bool IsAllowed,
    string? ErrorMessage,
    IReadOnlyList<Guid> UsedRequestItemIds)
{
    public static HistoricalLateEntryValidationResult Allow(IEnumerable<Guid> usedRequestItemIds) =>
        new(true, null, usedRequestItemIds.Distinct().ToList());

    public static HistoricalLateEntryValidationResult Deny(string errorMessage) =>
        new(false, errorMessage, Array.Empty<Guid>());
}

using System.Text;
using AbhiTimesheet.Api.Contracts.Activity;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Services;

public sealed class ActivityService(
    AppDbContext dbContext,
    LocationLookupService locationLookupService)
{
    private const string SuccessStatus = "Success";
    private const string FailedStatus = "Failed";

    public async Task<ActivitySummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        var startOfTodayUtc = DateTime.UtcNow.Date;
        var todayRecords = await dbContext.UserLoginActivities
            .AsNoTracking()
            .Where(item => item.LoginTime >= startOfTodayUtc)
            .Select(item => new SummaryProjection(item.LoginStatus, item.IsSuspicious))
            .ToListAsync(cancellationToken);

        var successfulLogins = todayRecords.Count(item => IsSuccessful(item.LoginStatus));
        var totalLogins = todayRecords.Count;

        return new ActivitySummaryDto(
            totalLogins,
            successfulLogins,
            totalLogins - successfulLogins,
            todayRecords.Count(item => item.IsSuspicious),
            DateTime.UtcNow);
    }

    public async Task<ActivityTrendDto> GetTrendAsync(string? range, CancellationToken cancellationToken = default)
    {
        var definition = CreateTrendDefinition(range, DateTime.UtcNow);
        var records = await dbContext.UserLoginActivities
            .AsNoTracking()
            .Where(item => item.LoginTime >= definition.StartUtc && item.LoginTime < definition.EndUtc)
            .Select(item => new TrendProjection(item.LoginTime, item.LoginStatus))
            .ToListAsync(cancellationToken);

        var buckets = definition.Labels
            .Select(label => new ActivityTrendBucketAccumulator(label))
            .ToArray();

        foreach (var record in records)
        {
            var index = definition.GetBucketIndex(record.LoginTime);
            if (index < 0 || index >= buckets.Length)
            {
                continue;
            }

            buckets[index].TotalLogins++;
            if (IsSuccessful(record.LoginStatus))
            {
                buckets[index].SuccessfulLogins++;
            }
            else
            {
                buckets[index].FailedLogins++;
            }
        }

        return new ActivityTrendDto(
            definition.Range,
            buckets.Select(item => new ActivityTrendBucketDto(item.Label, item.TotalLogins, item.SuccessfulLogins, item.FailedLogins)).ToArray());
    }

    public async Task<ActivityLoginsResponseDto> GetLoginsAsync(
        ActivityLoginsQuery query,
        string? acceptLanguage = null,
        CancellationToken cancellationToken = default)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var records = await GetFilteredRecordsAsync(query, acceptLanguage, cancellationToken);
        var totalCount = records.Count;
        var items = records
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToRowDto)
            .ToArray();

        var locations = records
            .Select(FormatLocation)
            .Where(item => !string.Equals(item, "Unknown", StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(25)
            .ToArray();

        var deviceTypes = records
            .Select(item => item.DeviceType)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item)
            .ToArray();

        return new ActivityLoginsResponseDto(
            page,
            pageSize,
            totalCount,
            items,
            new ActivityFilterOptionsDto(
                [SuccessStatus, FailedStatus],
                locations,
                deviceTypes));
    }

    public async Task<ActivityLoginDetailDto?> GetDetailAsync(
        Guid id,
        string? acceptLanguage = null,
        CancellationToken cancellationToken = default)
    {
        var records = await BuildBaseQuery().ToListAsync(cancellationToken);
        records = await EnrichMissingLocationsAsync(
            records,
            acceptLanguage,
            [id],
            1,
            cancellationToken);

        var record = records
            .FirstOrDefault(item => item.Id == id);

        return record is null ? null : ToDetailDto(record);
    }

    public async Task<string> ExportCsvAsync(
        ActivityLoginsQuery query,
        string? acceptLanguage = null,
        CancellationToken cancellationToken = default)
    {
        var records = await GetFilteredRecordsAsync(query, acceptLanguage, cancellationToken);
        var builder = new StringBuilder();
        builder.AppendLine("User,Email,Role,Department,Login Time,Location,Latitude,Longitude,Accuracy,IP Address,Device,Browser,Operating System,Status,Failure Reason,Suspicious");

        foreach (var record in records)
        {
            builder.AppendLine(string.Join(",", new[]
            {
                EscapeCsv(ResolveFullName(record)),
                EscapeCsv(ResolveEmail(record)),
                EscapeCsv(NormalizeRole(record.Role)),
                EscapeCsv(ResolveDepartment(record.Department)),
                EscapeCsv(record.LoginTime.ToString("yyyy-MM-dd HH:mm:ss")),
                EscapeCsv(FormatLocation(record)),
                EscapeCsv(record.Latitude?.ToString("0.000000") ?? string.Empty),
                EscapeCsv(record.Longitude?.ToString("0.000000") ?? string.Empty),
                EscapeCsv(record.Accuracy?.ToString("0.##") ?? string.Empty),
                EscapeCsv(record.IpAddress),
                EscapeCsv(record.DeviceType),
                EscapeCsv(record.Browser),
                EscapeCsv(record.OperatingSystem),
                EscapeCsv(NormalizeDisplayStatus(record.LoginStatus)),
                EscapeCsv(ResolveFailureReason(record)),
                EscapeCsv(record.IsSuspicious ? "Yes" : "No"),
            }));
        }

        return builder.ToString();
    }

    private async Task<List<ActivityProjection>> GetFilteredRecordsAsync(
        ActivityLoginsQuery query,
        string? acceptLanguage,
        CancellationToken cancellationToken)
    {
        var search = query.Search?.Trim();
        var status = NormalizeRequestedStatus(query.Status);
        var deviceType = query.DeviceType?.Trim();
        var fromDate = query.FromDate?.Date;
        var toExclusive = query.ToDate?.Date.AddDays(1);

        var records = await BuildBaseQuery().ToListAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch = search.ToLowerInvariant();
            records = records
                .Where(item =>
                    ResolveFullName(item).Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                    ResolveEmail(item).Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                    item.AttemptedEmail.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                    NormalizeRole(item.Role).Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                    ResolveDepartment(item.Department).Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        if (fromDate.HasValue)
        {
            records = records
                .Where(item => item.LoginTime >= fromDate.Value)
                .ToList();
        }

        if (toExclusive.HasValue)
        {
            records = records
                .Where(item => item.LoginTime < toExclusive.Value)
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            records = (status == SuccessStatus
                    ? records.Where(item => item.LoginStatus == SuccessStatus)
                    : records.Where(item => item.LoginStatus != SuccessStatus))
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(deviceType))
        {
            records = records
                .Where(item => string.Equals(item.DeviceType, deviceType, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        records = records
            .OrderByDescending(item => item.LoginTime)
            .ToList();

        records = await EnrichMissingLocationsAsync(
            records,
            acceptLanguage,
            records.Select(item => item.Id).Take(25),
            25,
            cancellationToken);

        if (!string.IsNullOrWhiteSpace(query.Location))
        {
            records = records
                .Where(item => string.Equals(FormatLocation(item), query.Location.Trim(), StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        return records;
    }

    private async Task<List<ActivityProjection>> EnrichMissingLocationsAsync(
        List<ActivityProjection> records,
        string? acceptLanguage,
        IEnumerable<Guid>? prioritizedIds,
        int maxLookups,
        CancellationToken cancellationToken)
    {
        var prioritizedIdSet = prioritizedIds?
            .Where(item => item != Guid.Empty)
            .ToHashSet() ?? [];

        var pendingRecords = records
            .Where(item =>
                item.Latitude.HasValue &&
                item.Longitude.HasValue &&
                string.IsNullOrWhiteSpace(item.City) &&
                string.IsNullOrWhiteSpace(item.State) &&
                string.IsNullOrWhiteSpace(item.Country))
            .OrderBy(item => prioritizedIdSet.Contains(item.Id) ? 0 : 1)
            .ThenByDescending(item => item.LoginTime)
            .Take(Math.Max(1, maxLookups))
            .ToList();

        if (pendingRecords.Count == 0)
        {
            return records;
        }

        var resolvedById = new Dictionary<Guid, ResolvedLocation>();

        foreach (var record in pendingRecords)
        {
            var resolvedLocation = await locationLookupService.ResolveAsync(
                record.Latitude,
                record.Longitude,
                acceptLanguage,
                cancellationToken);

            if (resolvedLocation is null || resolvedLocation.IsEmpty)
            {
                continue;
            }

            resolvedById[record.Id] = resolvedLocation;
        }

        if (resolvedById.Count == 0)
        {
            return records;
        }

        var recordIds = resolvedById.Keys.ToArray();
        var entities = await dbContext.UserLoginActivities
            .Where(item => recordIds.Contains(item.Id))
            .ToListAsync(cancellationToken);

        foreach (var entity in entities)
        {
            if (!resolvedById.TryGetValue(entity.Id, out var resolvedLocation))
            {
                continue;
            }

            entity.City = resolvedLocation.City;
            entity.State = resolvedLocation.State;
            entity.Country = resolvedLocation.Country;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return records
            .Select(item =>
                resolvedById.TryGetValue(item.Id, out var resolvedLocation)
                    ? item with
                    {
                        City = resolvedLocation.City,
                        State = resolvedLocation.State,
                        Country = resolvedLocation.Country,
                    }
                    : item)
            .ToList();
    }

    private IQueryable<ActivityProjection> BuildBaseQuery()
    {
        return
            from activity in dbContext.UserLoginActivities.AsNoTracking()
            join employee in dbContext.Employees.AsNoTracking() on activity.UserId equals employee.Id into employeeGroup
            from employee in employeeGroup.DefaultIfEmpty()
            select new ActivityProjection(
                activity.Id,
                activity.UserId,
                employee != null ? employee.FullName : string.Empty,
                employee != null ? employee.Email : string.Empty,
                employee != null ? employee.Role : string.Empty,
                employee != null ? employee.Department : string.Empty,
                activity.AttemptedEmail,
                activity.LoginTime,
                activity.LogoutTime,
                activity.Latitude,
                activity.Longitude,
                activity.Accuracy,
                activity.City,
                activity.State,
                activity.Country,
                activity.IpAddress,
                activity.UserAgent,
                activity.Browser,
                activity.OperatingSystem,
                activity.DeviceType,
                activity.LoginStatus,
                activity.FailureReason,
                activity.IsSuspicious,
                activity.CreatedAt);
    }

    private static ActivityLoginRowDto ToRowDto(ActivityProjection record) =>
        new(
            record.Id,
            record.UserId,
            ResolveFullName(record),
            ResolveEmail(record),
            NormalizeRole(record.Role),
            ResolveDepartment(record.Department),
            record.LoginTime,
            FormatLocation(record),
            record.Latitude,
            record.Longitude,
            record.City,
            record.State,
            record.Country,
            record.IpAddress,
            record.DeviceType,
            record.Browser,
            record.OperatingSystem,
            NormalizeDisplayStatus(record.LoginStatus),
            ResolveFailureReason(record),
            record.IsSuspicious);

    private static ActivityLoginDetailDto ToDetailDto(ActivityProjection record) =>
        new(
            record.Id,
            record.UserId,
            ResolveFullName(record),
            ResolveEmail(record),
            NormalizeRole(record.Role),
            ResolveDepartment(record.Department),
            record.LoginTime,
            record.LogoutTime,
            FormatLocation(record),
            record.Latitude,
            record.Longitude,
            record.Accuracy,
            record.City,
            record.State,
            record.Country,
            record.IpAddress,
            record.UserAgent,
            record.Browser,
            record.OperatingSystem,
            record.DeviceType,
            NormalizeDisplayStatus(record.LoginStatus),
            ResolveFailureReason(record),
            record.IsSuspicious,
            record.CreatedAt);

    private static string ResolveFullName(ActivityProjection record)
    {
        if (!string.IsNullOrWhiteSpace(record.FullName))
        {
            return record.FullName;
        }

        if (!string.IsNullOrWhiteSpace(record.AttemptedEmail))
        {
            return record.AttemptedEmail;
        }

        return "Unknown user";
    }

    private static string ResolveEmail(ActivityProjection record) =>
        !string.IsNullOrWhiteSpace(record.Email)
            ? record.Email
            : record.AttemptedEmail;

    private static string NormalizeRole(string? role) =>
        string.IsNullOrWhiteSpace(role)
            ? "Unknown"
            : RoleCatalog.NormalizeRole(role);

    private static string ResolveDepartment(string? department) =>
        string.IsNullOrWhiteSpace(department) ? "Unknown" : department.Trim();

    private static string NormalizeDisplayStatus(string? loginStatus) =>
        IsSuccessful(loginStatus) ? SuccessStatus : FailedStatus;

    private static string NormalizeRequestedStatus(string? loginStatus) =>
        string.Equals(loginStatus?.Trim(), SuccessStatus, StringComparison.OrdinalIgnoreCase)
            ? SuccessStatus
            : string.Equals(loginStatus?.Trim(), FailedStatus, StringComparison.OrdinalIgnoreCase)
                ? FailedStatus
                : string.Empty;

    private static bool IsSuccessful(string? loginStatus) =>
        string.Equals(loginStatus?.Trim(), SuccessStatus, StringComparison.OrdinalIgnoreCase);

    private static string ResolveFailureReason(ActivityProjection record)
    {
        if (!string.IsNullOrWhiteSpace(record.FailureReason))
        {
            return record.FailureReason.Trim();
        }

        if (IsSuccessful(record.LoginStatus))
        {
            return string.Empty;
        }

        return "Login attempt was rejected.";
    }

    private static string FormatLocation(ActivityProjection record)
    {
        var namedLocation = string.Join(
            ", ",
            new[] { record.City, record.State, record.Country }
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Select(item => item.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(namedLocation))
        {
            return namedLocation;
        }

        if (record.Latitude.HasValue && record.Longitude.HasValue)
        {
            return $"{record.Latitude.Value:0.0000}, {record.Longitude.Value:0.0000}";
        }

        return "Unknown";
    }

    private static string EscapeCsv(string value) => $"\"{value.Replace("\"", "\"\"")}\"";

    private static TrendDefinition CreateTrendDefinition(string? range, DateTime utcNow)
    {
        var normalizedRange = range?.Trim().ToLowerInvariant() switch
        {
            "this_week" => "this_week",
            "this_month" => "this_month",
            _ => "today",
        };

        if (normalizedRange == "this_week")
        {
            var start = utcNow.Date.AddDays(-(int)utcNow.DayOfWeek);
            var labels = Enumerable.Range(0, 7)
                .Select(offset => start.AddDays(offset).ToString("dd MMM"))
                .ToArray();

            return new TrendDefinition(
                normalizedRange,
                start,
                start.AddDays(7),
                labels,
                value => (int)(value.Date - start).TotalDays);
        }

        if (normalizedRange == "this_month")
        {
            var start = new DateTime(utcNow.Year, utcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var days = DateTime.DaysInMonth(utcNow.Year, utcNow.Month);
            var labels = Enumerable.Range(1, days)
                .Select(day => new DateTime(utcNow.Year, utcNow.Month, day).ToString("dd"))
                .ToArray();

            return new TrendDefinition(
                normalizedRange,
                start,
                start.AddMonths(1),
                labels,
                value => value.Day - 1);
        }

        var startOfDay = utcNow.Date;
        return new TrendDefinition(
            "today",
            startOfDay,
            startOfDay.AddDays(1),
            Enumerable.Range(0, 24).Select(hour => $"{hour:00}:00").ToArray(),
            value => value.Hour);
    }

    private sealed record SummaryProjection(string LoginStatus, bool IsSuspicious);

    private sealed record TrendProjection(DateTime LoginTime, string LoginStatus);

    private sealed record ActivityProjection(
        Guid Id,
        Guid? UserId,
        string FullName,
        string Email,
        string Role,
        string Department,
        string AttemptedEmail,
        DateTime LoginTime,
        DateTime? LogoutTime,
        double? Latitude,
        double? Longitude,
        double? Accuracy,
        string City,
        string State,
        string Country,
        string IpAddress,
        string UserAgent,
        string Browser,
        string OperatingSystem,
        string DeviceType,
        string LoginStatus,
        string FailureReason,
        bool IsSuspicious,
        DateTime CreatedAt);

    private sealed class ActivityTrendBucketAccumulator(string label)
    {
        public string Label { get; } = label;
        public int TotalLogins { get; set; }
        public int SuccessfulLogins { get; set; }
        public int FailedLogins { get; set; }
    }

    private sealed record TrendDefinition(
        string Range,
        DateTime StartUtc,
        DateTime EndUtc,
        IReadOnlyList<string> Labels,
        Func<DateTime, int> GetBucketIndex);
}

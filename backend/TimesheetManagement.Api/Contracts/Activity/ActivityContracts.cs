namespace AbhiTimesheet.Api.Contracts.Activity;

public sealed class ActivityLoginsQuery
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
    public string? Search { get; init; }
    public DateTime? FromDate { get; init; }
    public DateTime? ToDate { get; init; }
    public string? Status { get; init; }
    public string? Location { get; init; }
    public string? DeviceType { get; init; }
}

public sealed class ActivityTrendsQuery
{
    public string? Range { get; init; } = "today";
}

public sealed record ActivitySummaryDto(
    int TotalLoginsToday,
    int SuccessfulLoginsToday,
    int FailedLoginsToday,
    int UnusualLocationsToday,
    DateTime LastSyncedAtUtc
);

public sealed record ActivityTrendBucketDto(
    string Label,
    int TotalLogins,
    int SuccessfulLogins,
    int FailedLogins
);

public sealed record ActivityTrendDto(
    string Range,
    IReadOnlyList<ActivityTrendBucketDto> Buckets
);

public sealed record ActivityFilterOptionsDto(
    IReadOnlyList<string> Statuses,
    IReadOnlyList<string> Locations,
    IReadOnlyList<string> DeviceTypes
);

public sealed record ActivityLoginRowDto(
    Guid Id,
    Guid? UserId,
    string FullName,
    string Email,
    string Role,
    string Department,
    DateTime LoginTime,
    string Location,
    double? Latitude,
    double? Longitude,
    string City,
    string State,
    string Country,
    string IpAddress,
    string DeviceType,
    string Browser,
    string OperatingSystem,
    string Status,
    string FailureReason,
    bool IsSuspicious
);

public sealed record ActivityLoginsResponseDto(
    int Page,
    int PageSize,
    int TotalCount,
    IReadOnlyList<ActivityLoginRowDto> Items,
    ActivityFilterOptionsDto Filters
);

public sealed record ActivityLoginDetailDto(
    Guid Id,
    Guid? UserId,
    string FullName,
    string Email,
    string Role,
    string Department,
    DateTime LoginTime,
    DateTime? LogoutTime,
    string Location,
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
    string Status,
    string FailureReason,
    bool IsSuspicious,
    DateTime CreatedAt
);

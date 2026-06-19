using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

namespace AbhiTimesheet.Api.Services;

public sealed partial class LocationLookupService(
    HttpClient httpClient,
    IMemoryCache cache,
    ILogger<LocationLookupService> logger)
{
    private const string ReverseEndpoint = "reverse";
    private const string UserAgent = "TimesheetManagementSystem/1.0 (+https://timesheet.local)";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(12);
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(1.5);

    public async Task<ResolvedLocation?> ResolveAsync(
        double? latitude,
        double? longitude,
        string? acceptLanguage = null,
        CancellationToken cancellationToken = default)
    {
        if (latitude is null || longitude is null)
        {
            return null;
        }

        var cacheKey = BuildCacheKey(latitude.Value, longitude.Value, acceptLanguage);
        if (cache.TryGetValue<ResolvedLocation>(cacheKey, out var cachedLocation))
        {
            return cachedLocation;
        }

        try
        {
            using var timeoutScope = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutScope.CancelAfter(RequestTimeout);

            using var request = new HttpRequestMessage(HttpMethod.Get, BuildRequestUri(latitude.Value, longitude.Value));
            request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
            request.Headers.TryAddWithoutValidation("Accept", "application/json");

            var normalizedLanguage = NormalizeAcceptLanguage(acceptLanguage);
            if (!string.IsNullOrWhiteSpace(normalizedLanguage))
            {
                request.Headers.TryAddWithoutValidation("Accept-Language", normalizedLanguage);
            }

            using var response = await httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                timeoutScope.Token);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Reverse geocoding failed with status code {StatusCode} for coordinates {Latitude}, {Longitude}.",
                    (int)response.StatusCode,
                    latitude,
                    longitude);
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(timeoutScope.Token);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: timeoutScope.Token);

            var resolvedLocation = ParseLocation(json.RootElement);
            if (resolvedLocation is null)
            {
                return null;
            }

            cache.Set(cacheKey, resolvedLocation, CacheDuration);
            return resolvedLocation;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(
                "Reverse geocoding timed out for coordinates {Latitude}, {Longitude}.",
                latitude,
                longitude);
            return null;
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Reverse geocoding failed unexpectedly for coordinates {Latitude}, {Longitude}.",
                latitude,
                longitude);
            return null;
        }
    }

    private static string BuildRequestUri(double latitude, double longitude)
    {
        var latitudeText = latitude.ToString("0.000000", CultureInfo.InvariantCulture);
        var longitudeText = longitude.ToString("0.000000", CultureInfo.InvariantCulture);
        return $"{ReverseEndpoint}?format=jsonv2&lat={latitudeText}&lon={longitudeText}&addressdetails=1&zoom=18&layer=address";
    }

    private static string BuildCacheKey(double latitude, double longitude, string? acceptLanguage) =>
        $"{Math.Round(latitude, 5):0.00000}:{Math.Round(longitude, 5):0.00000}:{NormalizeAcceptLanguage(acceptLanguage)}";

    private static string NormalizeAcceptLanguage(string? acceptLanguage)
    {
        if (string.IsNullOrWhiteSpace(acceptLanguage))
        {
            return "en";
        }

        return string.Join(
            ",",
            acceptLanguage
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Take(5));
    }

    private static ResolvedLocation? ParseLocation(JsonElement root)
    {
        if (!root.TryGetProperty("address", out var address))
        {
            return null;
        }

        var displayName = ReadString(root, "display_name");
        var country = FirstNonEmpty(address, "country");
        var city = FirstNonEmpty(address, "city", "town", "village", "municipality", "hamlet", "suburb", "county", "state_district");
        var state = FirstNonEmpty(address, "state", "province", "region", "state_district", "county");

        if (string.IsNullOrWhiteSpace(state))
        {
            state = InferState(displayName, city, country);
        }

        if (string.IsNullOrWhiteSpace(city) || string.Equals(city, state, StringComparison.OrdinalIgnoreCase))
        {
            var inferredCity = InferCity(displayName, state, country);
            if (!string.IsNullOrWhiteSpace(inferredCity))
            {
                city = inferredCity;
            }
        }

        if (string.IsNullOrWhiteSpace(country) && !string.IsNullOrWhiteSpace(displayName))
        {
            country = displayName
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .LastOrDefault() ?? string.Empty;
        }

        var resolvedLocation = new ResolvedLocation(
            city?.Trim() ?? string.Empty,
            state?.Trim() ?? string.Empty,
            country?.Trim() ?? string.Empty);

        return resolvedLocation.IsEmpty ? null : resolvedLocation;
    }

    private static string FirstNonEmpty(JsonElement address, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            var value = ReadString(address, propertyName);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return string.Empty;
    }

    private static string ReadString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()?.Trim() ?? string.Empty
            : string.Empty;

    private static string InferState(string displayName, string city, string country)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            return string.Empty;
        }

        var parts = GetDisplayNameParts(displayName);
        for (var index = parts.Count - 1; index >= 0; index--)
        {
            var part = parts[index];
            if (Matches(part, country) || Matches(part, city) || IsPostalLike(part))
            {
                continue;
            }

            return part;
        }

        return string.Empty;
    }

    private static string InferCity(string displayName, string state, string country)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            return string.Empty;
        }

        var parts = GetDisplayNameParts(displayName);
        for (var index = parts.Count - 1; index >= 0; index--)
        {
            var part = parts[index];
            if (Matches(part, country) || Matches(part, state) || IsPostalLike(part))
            {
                continue;
            }

            return part;
        }

        return string.Empty;
    }

    private static List<string> GetDisplayNameParts(string displayName) =>
        displayName
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .ToList();

    private static bool Matches(string left, string right) =>
        !string.IsNullOrWhiteSpace(left) &&
        !string.IsNullOrWhiteSpace(right) &&
        string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);

    private static bool IsPostalLike(string value) =>
        PostalPattern().IsMatch(value.Trim());

    [GeneratedRegex(@"^[\d\-\.\s]+$")]
    private static partial Regex PostalPattern();
}

public sealed record ResolvedLocation(string City, string State, string Country)
{
    public bool IsEmpty =>
        string.IsNullOrWhiteSpace(City) &&
        string.IsNullOrWhiteSpace(State) &&
        string.IsNullOrWhiteSpace(Country);
}

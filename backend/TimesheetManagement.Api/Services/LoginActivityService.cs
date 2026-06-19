using AbhiTimesheet.Api.Contracts.Auth;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Services;

public sealed class LoginActivityService(
    AppDbContext dbContext,
    LocationLookupService locationLookupService)
{
    private const string LoginStatusSuccess = "Success";
    private const double SuspiciousLocationDistanceKm = 120;

    public async Task RecordAsync(
        Guid? userId,
        LoginRequest request,
        HttpContext httpContext,
        string loginStatus,
        string? failureReason = null,
        CancellationToken cancellationToken = default)
    {
        var timestamp = DateTime.UtcNow;
        var attemptedEmail = request.UserId?.Trim().ToLowerInvariant() ?? string.Empty;
        var userAgent = httpContext.Request.Headers.UserAgent.ToString().Trim();
        var acceptLanguage = httpContext.Request.Headers.AcceptLanguage.ToString().Trim();
        var deviceInfo = ParseUserAgent(userAgent);
        var normalizedStatus = NormalizeStatus(loginStatus);
        var resolvedLocation = await locationLookupService.ResolveAsync(
            request.Latitude,
            request.Longitude,
            acceptLanguage,
            cancellationToken);
        var isSuspicious = await EvaluateSuspiciousLoginAsync(
            userId,
            attemptedEmail,
            request.Latitude,
            request.Longitude,
            normalizedStatus,
            cancellationToken);

        dbContext.UserLoginActivities.Add(new UserLoginActivityEntity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AttemptedEmail = attemptedEmail,
            LoginTime = timestamp,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Accuracy = request.Accuracy,
            City = resolvedLocation?.City ?? string.Empty,
            State = resolvedLocation?.State ?? string.Empty,
            Country = resolvedLocation?.Country ?? string.Empty,
            IpAddress = GetIpAddress(httpContext),
            UserAgent = userAgent,
            Browser = deviceInfo.Browser,
            OperatingSystem = deviceInfo.OperatingSystem,
            DeviceType = deviceInfo.DeviceType,
            LoginStatus = normalizedStatus,
            FailureReason = failureReason?.Trim() ?? string.Empty,
            IsSuspicious = isSuspicious,
            CreatedAt = timestamp,
        });

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<bool> EvaluateSuspiciousLoginAsync(
        Guid? userId,
        string attemptedEmail,
        double? latitude,
        double? longitude,
        string loginStatus,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(loginStatus, LoginStatusSuccess, StringComparison.OrdinalIgnoreCase) || latitude is null || longitude is null)
        {
            return false;
        }

        var previousSuccess = await dbContext.UserLoginActivities
            .AsNoTracking()
            .Where(item =>
                item.LoginStatus == LoginStatusSuccess &&
                ((userId.HasValue && item.UserId == userId) ||
                 (!string.IsNullOrWhiteSpace(attemptedEmail) && item.AttemptedEmail == attemptedEmail)))
            .OrderByDescending(item => item.LoginTime)
            .FirstOrDefaultAsync(cancellationToken);

        if (previousSuccess is null || previousSuccess.Latitude is null || previousSuccess.Longitude is null)
        {
            return false;
        }

        var distanceKm = GetDistanceInKilometers(
            previousSuccess.Latitude.Value,
            previousSuccess.Longitude.Value,
            latitude.Value,
            longitude.Value);

        return distanceKm >= SuspiciousLocationDistanceKm;
    }

    private static string NormalizeStatus(string loginStatus) =>
        string.Equals(loginStatus?.Trim(), LoginStatusSuccess, StringComparison.OrdinalIgnoreCase)
            ? LoginStatusSuccess
            : "Failed";

    private static string GetIpAddress(HttpContext httpContext)
    {
        var forwardedFor = httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwardedFor))
        {
            return forwardedFor.Split(',')[0].Trim();
        }

        return httpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "Unknown";
    }

    private static UserAgentMetadata ParseUserAgent(string userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
        {
            return new UserAgentMetadata("Unknown", "Unknown", "Unknown");
        }

        var normalized = userAgent.ToLowerInvariant();
        return new UserAgentMetadata(
            GetBrowser(normalized),
            GetOperatingSystem(normalized),
            GetDeviceType(normalized));
    }

    private static string GetBrowser(string userAgent) =>
        userAgent.Contains("edg/") ? "Microsoft Edge"
        : userAgent.Contains("opr/") || userAgent.Contains("opera") ? "Opera"
        : userAgent.Contains("chrome/") && !userAgent.Contains("edg/") ? "Google Chrome"
        : userAgent.Contains("firefox/") ? "Mozilla Firefox"
        : userAgent.Contains("safari/") && !userAgent.Contains("chrome/") ? "Safari"
        : userAgent.Contains("trident/") || userAgent.Contains("msie") ? "Internet Explorer"
        : "Unknown";

    private static string GetOperatingSystem(string userAgent) =>
        userAgent.Contains("windows") ? "Windows"
        : userAgent.Contains("android") ? "Android"
        : userAgent.Contains("iphone") || userAgent.Contains("ipad") || userAgent.Contains("ios") ? "iOS"
        : userAgent.Contains("mac os") || userAgent.Contains("macintosh") ? "macOS"
        : userAgent.Contains("linux") ? "Linux"
        : "Unknown";

    private static string GetDeviceType(string userAgent)
    {
        if (userAgent.Contains("ipad") || userAgent.Contains("tablet"))
        {
            return "Tablet";
        }

        if (userAgent.Contains("mobile") || userAgent.Contains("iphone") || userAgent.Contains("android"))
        {
            return "Mobile";
        }

        if (userAgent.Contains("bot") || userAgent.Contains("crawl") || userAgent.Contains("spider"))
        {
            return "Bot";
        }

        return "Desktop";
    }

    private static double GetDistanceInKilometers(double latitude1, double longitude1, double latitude2, double longitude2)
    {
        const double earthRadiusKm = 6371;
        var deltaLatitude = DegreesToRadians(latitude2 - latitude1);
        var deltaLongitude = DegreesToRadians(longitude2 - longitude1);
        var a =
            Math.Sin(deltaLatitude / 2) * Math.Sin(deltaLatitude / 2) +
            Math.Cos(DegreesToRadians(latitude1)) *
            Math.Cos(DegreesToRadians(latitude2)) *
            Math.Sin(deltaLongitude / 2) *
            Math.Sin(deltaLongitude / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return earthRadiusKm * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * (Math.PI / 180);

    private sealed record UserAgentMetadata(string Browser, string OperatingSystem, string DeviceType);
}

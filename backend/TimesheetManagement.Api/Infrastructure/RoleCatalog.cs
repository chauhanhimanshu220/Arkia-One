using System.Text.Json;

namespace AbhiTimesheet.Api.Infrastructure;

public static class RoleCatalog
{
    public const string Employee = "Employee";
    public const string TeamManager = "Team Manager";
    public const string HrManager = "HR Manager";
    public const string FinanceAdmin = "Finance Admin";
    public const string SystemAdmin = "System Admin";

    public static readonly IReadOnlyList<string> All =
    [
        Employee,
        TeamManager,
        HrManager,
        FinanceAdmin,
        SystemAdmin
    ];

    private static readonly IReadOnlyDictionary<string, int> RoleOrder = All
        .Select((role, index) => new { role, index })
        .ToDictionary(item => item.role, item => item.index, StringComparer.OrdinalIgnoreCase);

    public static string NormalizeRole(string? role)
    {
        var normalized = role?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return Employee;
        }

        return normalized.ToLowerInvariant() switch
        {
            "employee" => Employee,
            "manager" => TeamManager,
            "team manager" => TeamManager,
            "hr" => HrManager,
            "hr manager" => HrManager,
            "finance admin" => FinanceAdmin,
            "admin" => SystemAdmin,
            "system admin" => SystemAdmin,
            _ when All.Contains(normalized, StringComparer.OrdinalIgnoreCase)
                => All.First(item => string.Equals(item, normalized, StringComparison.OrdinalIgnoreCase)),
            _ => normalized
        };
    }

    public static bool IsValidRole(string? role) =>
        All.Contains(NormalizeRole(role), StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyList<string> NormalizeRoles(IEnumerable<string?>? roles)
    {
        var normalizedRoles = (roles ?? [])
            .Select(NormalizeRole)
            .Where(IsValidRole)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(role => RoleOrder.GetValueOrDefault(role, int.MaxValue))
            .ToList();

        return normalizedRoles.Count > 0 ? normalizedRoles : [Employee];
    }

    public static IReadOnlyList<string> ParseRoles(string? rolesJson, string? fallbackRole = null)
    {
        var requestedRoles = new List<string?>();
        if (!string.IsNullOrWhiteSpace(rolesJson))
        {
            var trimmed = rolesJson.Trim();
            if (trimmed.StartsWith("[", StringComparison.Ordinal))
            {
                try
                {
                    var parsedRoles = JsonSerializer.Deserialize<string[]>(trimmed);
                    if (parsedRoles is not null)
                    {
                        requestedRoles.AddRange(parsedRoles);
                    }
                }
                catch (JsonException)
                {
                    // Fall back to legacy parsing below.
                }
            }

            if (requestedRoles.Count == 0)
            {
                requestedRoles.AddRange(trimmed
                    .Split(['|', ',', '+'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
            }
        }

        if (!string.IsNullOrWhiteSpace(fallbackRole))
        {
            requestedRoles.Add(fallbackRole);
        }

        return NormalizeRoles(requestedRoles);
    }

    public static string SerializeRoles(IEnumerable<string?>? roles) =>
        JsonSerializer.Serialize(NormalizeRoles(roles));

    public static string GetPrimaryRole(IEnumerable<string?>? roles) =>
        NormalizeRoles(roles).LastOrDefault() ?? Employee;

    public static string GetPrimaryRole(string? rolesJson, string? fallbackRole = null) =>
        GetPrimaryRole(ParseRoles(rolesJson, fallbackRole));

    public static bool HasRole(IEnumerable<string?>? roles, string role) =>
        NormalizeRoles(roles).Contains(NormalizeRole(role), StringComparer.OrdinalIgnoreCase);

    public static bool HasRole(string? rolesJson, string role, string? fallbackRole = null) =>
        HasRole(ParseRoles(rolesJson, fallbackRole), role);

    public static bool HasAnyRole(IEnumerable<string?>? roles, IEnumerable<string> candidateRoles)
    {
        var normalizedRoles = NormalizeRoles(roles);
        return candidateRoles.Any(candidateRole => normalizedRoles.Contains(NormalizeRole(candidateRole), StringComparer.OrdinalIgnoreCase));
    }

    public static bool HasAnyRole(string? rolesJson, IEnumerable<string> candidateRoles, string? fallbackRole = null) =>
        HasAnyRole(ParseRoles(rolesJson, fallbackRole), candidateRoles);

    public static string FormatRoles(IEnumerable<string?>? roles, string separator = " + ") =>
        string.Join(separator, NormalizeRoles(roles));

    public static string FormatRoles(string? rolesJson, string? fallbackRole = null, string separator = " + ") =>
        FormatRoles(ParseRoles(rolesJson, fallbackRole), separator);
}

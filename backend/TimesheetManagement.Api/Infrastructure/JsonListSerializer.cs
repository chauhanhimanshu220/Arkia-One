using System.Text.Json;

namespace AbhiTimesheet.Api.Infrastructure;

public static class JsonListSerializer
{
    public static string Serialize(IEnumerable<string> values) => JsonSerializer.Serialize(values);

    public static IReadOnlyList<string> Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<string>();
        }

        var items = JsonSerializer.Deserialize<List<string>>(json);
        return items is null ? Array.Empty<string>() : items;
    }
}

using System.Globalization;

namespace AbhiTimesheet.Api.Infrastructure;

public static class DateOnlyExtensions
{
    public static DateOnly ParseRequiredDate(this string value, string parameterName)
    {
        if (!DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var result))
        {
            throw new ArgumentException($"'{parameterName}' must be in yyyy-MM-dd format.", parameterName);
        }

        return result;
    }

    public static string ToApiString(this DateOnly value) => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}

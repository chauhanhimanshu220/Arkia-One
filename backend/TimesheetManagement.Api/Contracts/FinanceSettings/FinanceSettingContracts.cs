using System.Text.Json;

namespace AbhiTimesheet.Api.Contracts.FinanceSettings;

public sealed record FinanceSettingDto(
    Guid Id,
    string Category,
    string Key,
    string Name,
    string Description,
    string Status,
    JsonElement Data,
    string UpdatedAt,
    string UpdatedBy);

public sealed record FinanceSettingSaveRequest(
    string Name,
    string Description,
    string Status,
    JsonElement Data);


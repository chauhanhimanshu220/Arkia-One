using AbhiTimesheet.Api.Contracts.FinanceSettings;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/finance/settings")]
public sealed class FinanceSettingsController(AppDbContext dbContext) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet("{category}")]
    public async Task<ActionResult<IReadOnlyList<FinanceSettingDto>>> GetSettings(string category, CancellationToken cancellationToken)
    {
        var normalizedCategory = NormalizeCategory(category);
        if (normalizedCategory is null)
        {
            return NotFound(new { message = "Finance setting category was not found." });
        }

        await EnsureSeededAsync(normalizedCategory, cancellationToken);

        var settings = await dbContext.FinanceSettings
            .AsNoTracking()
            .Where(item => item.Category == normalizedCategory)
            .OrderBy(item => item.Name)
            .ToListAsync(cancellationToken);

        return Ok(settings.Select(MapSetting).ToList());
    }

    [HttpPost("{category}")]
    public async Task<ActionResult<FinanceSettingDto>> CreateSetting(
        string category,
        [FromBody] FinanceSettingSaveRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedCategory = NormalizeCategory(category);
        if (normalizedCategory is null)
        {
            return NotFound(new { message = "Finance setting category was not found." });
        }

        var now = DateTime.UtcNow;
        var entity = new FinanceSettingEntity
        {
            Id = Guid.NewGuid(),
            Category = normalizedCategory,
            Key = BuildKey(request.Name),
            Name = Clean(request.Name, "Untitled setting"),
            Description = Clean(request.Description),
            Status = Clean(request.Status, "Draft"),
            DataJson = JsonSerializer.Serialize(request.Data, JsonOptions),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            UpdatedBy = ResolveActor()
        };

        dbContext.FinanceSettings.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetSettings), new { category = normalizedCategory }, MapSetting(entity));
    }

    [HttpPut("{category}/{id:guid}")]
    public async Task<ActionResult<FinanceSettingDto>> UpdateSetting(
        string category,
        Guid id,
        [FromBody] FinanceSettingSaveRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedCategory = NormalizeCategory(category);
        if (normalizedCategory is null)
        {
            return NotFound(new { message = "Finance setting category was not found." });
        }

        var entity = await dbContext.FinanceSettings.FirstOrDefaultAsync(
            item => item.Id == id && item.Category == normalizedCategory,
            cancellationToken);

        if (entity is null)
        {
            return NotFound(new { message = "Finance setting was not found." });
        }

        entity.Name = Clean(request.Name, "Untitled setting");
        entity.Description = Clean(request.Description);
        entity.Status = Clean(request.Status, "Draft");
        entity.DataJson = JsonSerializer.Serialize(request.Data, JsonOptions);
        entity.UpdatedAtUtc = DateTime.UtcNow;
        entity.UpdatedBy = ResolveActor();

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapSetting(entity));
    }

    [HttpDelete("{category}/{id:guid}")]
    public async Task<IActionResult> DeleteSetting(string category, Guid id, CancellationToken cancellationToken)
    {
        var normalizedCategory = NormalizeCategory(category);
        if (normalizedCategory is null)
        {
            return NotFound(new { message = "Finance setting category was not found." });
        }

        var entity = await dbContext.FinanceSettings.FirstOrDefaultAsync(
            item => item.Id == id && item.Category == normalizedCategory,
            cancellationToken);

        if (entity is null)
        {
            return NotFound(new { message = "Finance setting was not found." });
        }

        dbContext.FinanceSettings.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task EnsureSeededAsync(string category, CancellationToken cancellationToken)
    {
        if (await dbContext.FinanceSettings.AnyAsync(item => item.Category == category, cancellationToken))
        {
            return;
        }

        dbContext.FinanceSettings.AddRange(DefaultSettings(category));
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static IEnumerable<FinanceSettingEntity> DefaultSettings(string category)
    {
        var now = DateTime.UtcNow;
        return category switch
        {
            "tax" => [
                Create(category, "gst-services", "GST - Professional Services", "Default GST rule for service invoices.", "Active", new { taxType = "GST", rate = 18, threshold = 0, region = "India", effectiveFrom = "2026-04-01" }, now),
                Create(category, "tds-consulting", "TDS - Consulting", "Standard TDS deduction for consulting payouts.", "Active", new { taxType = "TDS", rate = 10, threshold = 30000, region = "India", effectiveFrom = "2026-04-01" }, now)
            ],
            "currency" => [
                Create(category, "inr", "Indian Rupee", "Primary accounting currency.", "Active", new { code = "INR", symbol = "Rs.", exchangeRate = 1, precision = 2, isBaseCurrency = true }, now),
                Create(category, "usd", "US Dollar", "Client billing currency for export invoices.", "Active", new { code = "USD", symbol = "$", exchangeRate = 83.2, precision = 2, isBaseCurrency = false }, now)
            ],
            "billing-rules" => [
                Create(category, "monthly-timesheet", "Monthly Timesheet Billing", "Generate client invoices from approved monthly timesheets.", "Active", new { billingCycle = "Monthly", billableHoursOnly = true, overtimeBillable = true, paymentTermsDays = 30, invoicePrefix = "INV" }, now),
                Create(category, "fixed-project", "Fixed Project Milestone", "Milestone billing rule for fixed-price project delivery.", "Draft", new { billingCycle = "Milestone", billableHoursOnly = false, overtimeBillable = false, paymentTermsDays = 15, invoicePrefix = "MIL" }, now)
            ],
            _ => []
        };
    }

    private static FinanceSettingEntity Create(string category, string key, string name, string description, string status, object data, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        Category = category,
        Key = key,
        Name = name,
        Description = description,
        Status = status,
        DataJson = JsonSerializer.Serialize(data, JsonOptions),
        CreatedAtUtc = now,
        UpdatedAtUtc = now,
        UpdatedBy = "System"
    };

    private static FinanceSettingDto MapSetting(FinanceSettingEntity entity) => new(
        entity.Id,
        entity.Category,
        entity.Key,
        entity.Name,
        entity.Description,
        entity.Status,
        ParseData(entity.DataJson),
        entity.UpdatedAtUtc.ToString("O"),
        entity.UpdatedBy);

    private static JsonElement ParseData(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            return document.RootElement.Clone();
        }
        catch (JsonException)
        {
            using var document = JsonDocument.Parse("{}");
            return document.RootElement.Clone();
        }
    }

    private static string? NormalizeCategory(string category) =>
        category.Trim().ToLowerInvariant() switch
        {
            "tax" => "tax",
            "currency" => "currency",
            "billing-rules" => "billing-rules",
            "billing" => "billing-rules",
            _ => null
        };

    private string ResolveActor() =>
        Request.Headers.TryGetValue("X-User-Email", out var email) && !string.IsNullOrWhiteSpace(email)
            ? email.ToString()
            : "Finance Admin";

    private static string Clean(string value, string fallback = "") =>
        string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

    private static string BuildKey(string name) =>
        Clean(name, Guid.NewGuid().ToString("N"))
            .ToLowerInvariant()
            .Replace(" ", "-");
}

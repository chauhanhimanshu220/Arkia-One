using AbhiTimesheet.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using System.Globalization;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/ssrs/payroll-export")]
public sealed class SsrsReportsController(
    PayrollExportReportService payrollExportReportService,
    IMemoryCache memoryCache) : ControllerBase
{
    private const string SnapshotCachePrefix = "payroll-export-snapshot:";
    private static readonly HashSet<string> SupportedFormats = new(StringComparer.OrdinalIgnoreCase)
    {
        "PDF",
        "EXCELOPENXML",
        "WORDOPENXML",
        "CSV",
        "XML"
    };

    [HttpGet("view")]
    public async Task<IActionResult> View([FromQuery] PayrollExportQuery query, CancellationToken cancellationToken)
    {
        try
        {
            var report = await ResolveReportAsync(query, cancellationToken);
            return Content(payrollExportReportService.RenderHtml(report), "text/html; charset=utf-8");
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpGet("download")]
    public async Task<IActionResult> Download([FromQuery] PayrollExportQuery query, CancellationToken cancellationToken)
    {
        try
        {
            var report = await ResolveReportAsync(query, cancellationToken);
            var format = NormalizeFormat(query.Format);
            var safeRange = $"{report.Filter.StartDate:yyyyMMdd}-{report.Filter.EndDate:yyyyMMdd}";

            return format.ToUpperInvariant() switch
            {
                "CSV" => File(
                    payrollExportReportService.RenderCsv(report),
                    "text/csv; charset=utf-8",
                    $"payroll-export-{safeRange}.csv"),
                "XML" => File(
                    payrollExportReportService.RenderXml(report),
                    "application/xml",
                    $"payroll-export-{safeRange}.xml"),
                "EXCELOPENXML" => File(
                    payrollExportReportService.RenderXlsx(report),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"payroll-export-{safeRange}.xlsx"),
                "WORDOPENXML" => File(
                    payrollExportReportService.RenderDocx(report),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    $"payroll-export-{safeRange}.docx"),
                _ => File(
                    payrollExportReportService.RenderPdf(report),
                    "application/pdf",
                    $"payroll-export-{safeRange}.pdf")
            };
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("snapshot")]
    public IActionResult CreateSnapshot([FromBody] PayrollExportSnapshotRequest request)
    {
        try
        {
            var filter = request.Filter.ToFilter();
            var report = payrollExportReportService.BuildReportFromSnapshot(filter, request.Rows);
            var snapshotId = Guid.NewGuid().ToString("N");
            memoryCache.Set(
                SnapshotCachePrefix + snapshotId,
                report,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30),
                    SlidingExpiration = TimeSpan.FromMinutes(10)
                });

            return Ok(new { snapshotId });
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    private async Task<PayrollExportReport> ResolveReportAsync(PayrollExportQuery query, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(query.SnapshotId) &&
            memoryCache.TryGetValue(SnapshotCachePrefix + query.SnapshotId.Trim(), out PayrollExportReport? snapshotReport) &&
            snapshotReport is not null)
        {
            return snapshotReport;
        }

        return await payrollExportReportService.BuildReportAsync(query.ToFilter(), cancellationToken);
    }

    private static string NormalizeFormat(string? format)
    {
        var normalized = string.IsNullOrWhiteSpace(format) ? "PDF" : format.Trim().ToUpperInvariant();
        if (!SupportedFormats.Contains(normalized))
        {
            throw new ArgumentException($"Unsupported export format '{format}'.");
        }

        return normalized;
    }
}

public sealed class PayrollExportQuery
{
    public string? StartDate { get; init; }

    public string? EndDate { get; init; }

    public string? ProjectFilter { get; init; }

    public string? ProjectLabel { get; init; }

    public string? StatusFilter { get; init; }

    public string? EmployeeFilter { get; init; }

    public string? BillableFilter { get; init; }

    public string? SearchTerm { get; init; }

    public string? EmployeeScope { get; init; }

    public string? Format { get; init; }

    public string? SnapshotId { get; init; }

    public PayrollExportFilter ToFilter()
    {
        if (!DateOnly.TryParseExact(StartDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var startDate))
        {
            throw new ArgumentException("A valid start date is required.");
        }

        if (!DateOnly.TryParseExact(EndDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var endDate))
        {
            throw new ArgumentException("A valid end date is required.");
        }

        if (startDate > endDate)
        {
            throw new ArgumentException("Start date must be on or before end date.");
        }

        var normalizedProjectFilter = string.IsNullOrWhiteSpace(ProjectFilter) ? "All" : ProjectFilter.Trim();
        var normalizedProjectLabel = string.IsNullOrWhiteSpace(ProjectLabel)
            ? (string.Equals(normalizedProjectFilter, "All", StringComparison.OrdinalIgnoreCase) ? "All projects" : normalizedProjectFilter)
            : ProjectLabel.Trim();

        return new PayrollExportFilter(
            StartDate: startDate,
            EndDate: endDate,
            ProjectFilter: normalizedProjectFilter,
            ProjectLabel: normalizedProjectLabel,
            StatusFilter: string.IsNullOrWhiteSpace(StatusFilter) ? "All" : StatusFilter.Trim(),
            EmployeeFilter: string.IsNullOrWhiteSpace(EmployeeFilter) ? "All" : EmployeeFilter.Trim(),
            BillableFilter: string.IsNullOrWhiteSpace(BillableFilter) ? "All" : BillableFilter.Trim(),
            SearchTerm: SearchTerm?.Trim() ?? string.Empty,
            EmployeeScope: EmployeeScope?.Trim() ?? string.Empty);
    }
}

public sealed class PayrollExportSnapshotRequest
{
    public PayrollExportQuery Filter { get; init; } = new();

    public IReadOnlyList<PayrollExportSnapshotRow> Rows { get; init; } = [];
}

using System.Text;
using AbhiTimesheet.Api.Contracts.Activity;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ActivityController(ActivityService activityService) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult<ActivitySummaryDto>> GetSummary(CancellationToken cancellationToken)
    {
        var deniedResult = ValidateSystemAdminAccess();
        if (deniedResult is not null)
        {
            return deniedResult;
        }

        return Ok(await activityService.GetSummaryAsync(cancellationToken));
    }

    [HttpGet("trends")]
    public async Task<ActionResult<ActivityTrendDto>> GetTrend([FromQuery] ActivityTrendsQuery query, CancellationToken cancellationToken)
    {
        var deniedResult = ValidateSystemAdminAccess();
        if (deniedResult is not null)
        {
            return deniedResult;
        }

        return Ok(await activityService.GetTrendAsync(query.Range, cancellationToken));
    }

    [HttpGet("logins")]
    public async Task<ActionResult<ActivityLoginsResponseDto>> GetLogins([FromQuery] ActivityLoginsQuery query, CancellationToken cancellationToken)
    {
        var deniedResult = ValidateSystemAdminAccess();
        if (deniedResult is not null)
        {
            return deniedResult;
        }

        return Ok(await activityService.GetLoginsAsync(query, GetAcceptedLanguage(), cancellationToken));
    }

    [HttpGet("logins/{id:guid}")]
    public async Task<ActionResult<ActivityLoginDetailDto>> GetLoginDetail(Guid id, CancellationToken cancellationToken)
    {
        var deniedResult = ValidateSystemAdminAccess();
        if (deniedResult is not null)
        {
            return deniedResult;
        }

        var detail = await activityService.GetDetailAsync(id, GetAcceptedLanguage(), cancellationToken);
        if (detail is null)
        {
            return NotFound(new { message = "Activity record not found." });
        }

        return Ok(detail);
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] ActivityLoginsQuery query, CancellationToken cancellationToken)
    {
        var deniedResult = ValidateSystemAdminAccess();
        if (deniedResult is not null)
        {
            return deniedResult;
        }

        var csv = await activityService.ExportCsvAsync(query, GetAcceptedLanguage(), cancellationToken);
        var fileName = $"activity-logins-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv";
        return File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", fileName);
    }

    private ActionResult? ValidateSystemAdminAccess()
    {
        if (!Guid.TryParse(Request.Headers["X-User-Id"].FirstOrDefault(), out _))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        var roles = RoleCatalog.ParseRoles(
            Request.Headers["X-User-Roles"].FirstOrDefault(),
            Request.Headers["X-User-Role"].FirstOrDefault());
        if (!RoleCatalog.HasRole(roles, RoleCatalog.SystemAdmin))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only system administrators can access activity monitoring." });
        }

        return null;
    }

    private string? GetAcceptedLanguage() =>
        Request.Headers.AcceptLanguage.FirstOrDefault();
}

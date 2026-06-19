using AbhiTimesheet.Api.Contracts.Dashboard;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.Json;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/finance/personal-dashboard")]
public sealed class FinancePersonalDashboardController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PersonalDashboardDataDto>> GetDashboard(
        [FromQuery] string? userId = null,
        [FromQuery] string range = "this_week",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), userId);
        return Ok(BuildDashboardData(context));
    }

    [HttpGet("summary")]
    public async Task<ActionResult<PersonalDashboardSummaryDto>> GetSummary(
        [FromQuery] string? userId = null,
        [FromQuery] string range = "this_week",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), userId);
        return Ok(BuildSummary(context));
    }

    [HttpGet("action-queue")]
    public async Task<ActionResult<IReadOnlyList<PersonalDashboardActionItemDto>>> GetActionQueue(
        [FromQuery] string? userId = null,
        [FromQuery] string range = "this_week",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), userId);
        return Ok(BuildActionQueue(context));
    }

    [HttpGet("alerts")]
    public async Task<ActionResult<IReadOnlyList<AlertDto>>> GetAlerts(
        [FromQuery] string? userId = null,
        [FromQuery] string range = "this_week",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), userId);
        return Ok(BuildAlerts(context));
    }

    [HttpGet("charts")]
    public async Task<ActionResult<PersonalDashboardChartsDto>> GetCharts(
        [FromQuery] string? userId = null,
        [FromQuery] string range = "this_week",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), userId);
        return Ok(BuildCharts(context));
    }

    [HttpGet("recent-activity")]
    public async Task<ActionResult<IReadOnlyList<PersonalDashboardActivityDto>>> GetRecentActivity(
        [FromQuery] string? userId = null,
        [FromQuery] string range = "this_week",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), userId);
        return Ok(BuildRecentActivity(context));
    }

    private async Task<PersonalDashboardContext> BuildContextAsync((DateOnly Start, DateOnly End) dateRange, string? userId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var parsedUserId = Guid.TryParse(userId, out var userGuid) ? userGuid : (Guid?)null;

        var allEmployees = await dbContext.Employees
            .AsNoTracking()
            .ToListAsync();

        var employeesById = allEmployees.ToDictionary(item => item.Id, item => item);
        var activeEmployees = allEmployees
            .Where(IsActiveEmployee)
            .ToList();

        var assignedEmployeeIds = parsedUserId.HasValue
            ? await dbContext.WeeklyTimesheets
                .AsNoTracking()
                .Where(item => item.AdminId == parsedUserId.Value)
                .Select(item => item.UserId)
                .Distinct()
                .ToListAsync()
            : [];

        if (assignedEmployeeIds.Count == 0)
        {
            assignedEmployeeIds = await dbContext.WeeklyTimesheets
                .AsNoTracking()
                .Select(item => item.UserId)
                .Distinct()
                .ToListAsync();
        }

        var assignedEmployeeIdSet = assignedEmployeeIds.ToHashSet();
        var expectedEmployees = activeEmployees
            .Where(item => assignedEmployeeIdSet.Count == 0 || assignedEmployeeIdSet.Contains(item.Id))
            .ToList();

        var expectedEmployeeIdSet = expectedEmployees
            .Select(item => item.Id)
            .ToHashSet();

        var timesheets = await dbContext.WeeklyTimesheets
            .AsNoTracking()
            .Where(item => item.WeekStart <= dateRange.End && item.WeekEnd >= dateRange.Start)
            .Where(item => expectedEmployeeIdSet.Count == 0 || expectedEmployeeIdSet.Contains(item.UserId))
            .OrderByDescending(item => item.UpdatedAtUtc)
            .ToListAsync();

        var scopedTimesheets = timesheets
            .Where(item => employeesById.ContainsKey(item.UserId))
            .Select(item => CreateSnapshot(item, employeesById[item.UserId], dateRange, today))
            .ToList();

        return new PersonalDashboardContext(
            dateRange,
            today,
            expectedEmployees,
            scopedTimesheets,
            new DashboardMetaDto(
                BuildRangeLabel(dateRange),
                "Personal finance actions are derived from the current Draft / Submitted / Approved / Rejected weekly timesheet workflow and saved admin assignments when available.",
                "Billable mix and payroll-review readiness are inferred from weekly timesheet rows and status transitions because the schema does not yet store dedicated finance action logs.",
                false));
    }

    private PersonalDashboardDataDto BuildDashboardData(PersonalDashboardContext context) =>
        new(
            BuildSummary(context),
            BuildActionQueue(context),
            BuildAlerts(context),
            BuildCharts(context),
            BuildRecentActivity(context),
            context.Meta);

    private PersonalDashboardSummaryDto BuildSummary(PersonalDashboardContext context)
    {
        var missingEmployees = GetMissingEmployees(context);
        var overdueApprovals = context.ScopedTimesheets.Count(item => IsSubmittedStatus(item.RawStatus) && item.AgeDays > 2);
        var staleRejected = context.ScopedTimesheets.Count(item => IsRejectedStatus(item.RawStatus) && item.AgeDays > 2);
        var readyForPayrollFollowUp = context.ScopedTimesheets.Count(item => IsApprovedStatus(item.RawStatus) && item.AgeDays > 1);
        var completedActionsToday = context.ScopedTimesheets.Count(item =>
            item.UpdatedDate == context.Today &&
            (IsApprovedStatus(item.RawStatus) || IsRejectedStatus(item.RawStatus)));

        return new PersonalDashboardSummaryDto(
            PendingFinanceApprovals: context.ScopedTimesheets.Count(item => IsSubmittedStatus(item.RawStatus)),
            ReadyForPayrollReview: context.ScopedTimesheets.Count(item => IsApprovedStatus(item.RawStatus)),
            ReturnedForCorrection: context.ScopedTimesheets.Count(item => IsRejectedStatus(item.RawStatus)),
            MissingTimesheetCases: missingEmployees.Count,
            CompletedActionsToday: completedActionsToday,
            UrgentExceptions: overdueApprovals + staleRejected + readyForPayrollFollowUp + missingEmployees.Count);
    }

    private IReadOnlyList<PersonalDashboardActionItemDto> BuildActionQueue(PersonalDashboardContext context)
    {
        var queue = new List<(PersonalDashboardActionItemDto Item, int PriorityOrder, int AgeDays)>();

        foreach (var snapshot in context.ScopedTimesheets
                     .Where(item => IsSubmittedStatus(item.RawStatus))
                     .OrderByDescending(item => item.AgeDays)
                     .ThenByDescending(item => item.TotalHours))
        {
            var priority = snapshot.AgeDays > 2 ? "High" : "Medium";
            queue.Add((
                new PersonalDashboardActionItemDto(
                    snapshot.Timesheet.Id.ToString(),
                    snapshot.Employee.FullName,
                    snapshot.Employee.Department,
                    BuildTimesheetPeriod(snapshot.Timesheet),
                    "Finance Approval Pending",
                    priority,
                    FormatAge(snapshot.AgeDays),
                    snapshot.TotalHours,
                    snapshot.ApprovalStatus,
                    snapshot.PayrollStatus,
                    "/admin/timesheets/approved?status=submitted",
                    "Review now"),
                GetPriorityOrder(priority),
                snapshot.AgeDays));
        }

        foreach (var snapshot in context.ScopedTimesheets
                     .Where(item => IsApprovedStatus(item.RawStatus))
                     .OrderByDescending(item => item.AgeDays)
                     .ThenByDescending(item => item.TotalHours))
        {
            var priority = snapshot.AgeDays > 1 ? "High" : "Medium";
            queue.Add((
                new PersonalDashboardActionItemDto(
                    snapshot.Timesheet.Id.ToString(),
                    snapshot.Employee.FullName,
                    snapshot.Employee.Department,
                    BuildTimesheetPeriod(snapshot.Timesheet),
                    "Ready for Payroll Review",
                    priority,
                    FormatAge(snapshot.AgeDays),
                    snapshot.TotalHours,
                    snapshot.ApprovalStatus,
                    snapshot.PayrollStatus,
                    "/admin/payroll/timesheets",
                    "Open payroll"),
                GetPriorityOrder(priority),
                snapshot.AgeDays));
        }

        foreach (var snapshot in context.ScopedTimesheets
                     .Where(item => IsRejectedStatus(item.RawStatus))
                     .OrderByDescending(item => item.AgeDays)
                     .ThenByDescending(item => item.TotalHours))
        {
            var priority = snapshot.AgeDays > 2 ? "High" : "Medium";
            queue.Add((
                new PersonalDashboardActionItemDto(
                    snapshot.Timesheet.Id.ToString(),
                    snapshot.Employee.FullName,
                    snapshot.Employee.Department,
                    BuildTimesheetPeriod(snapshot.Timesheet),
                    "Returned for Correction",
                    priority,
                    FormatAge(snapshot.AgeDays),
                    snapshot.TotalHours,
                    snapshot.ApprovalStatus,
                    snapshot.PayrollStatus,
                    "/admin/timesheets/approved?status=rejected",
                    "Follow up"),
                GetPriorityOrder(priority),
                snapshot.AgeDays));
        }

        foreach (var employee in GetMissingEmployees(context))
        {
            var ageDays = Math.Max(context.Today.DayNumber - context.Range.End.DayNumber, 0);
            var priority = context.Range.End < context.Today ? "High" : "Medium";
            queue.Add((
                new PersonalDashboardActionItemDto(
                    $"missing-{employee.Id}",
                    employee.FullName,
                    employee.Department,
                    BuildRangeLabel(context.Range),
                    "Missing Timesheet Submission",
                    priority,
                    FormatAge(ageDays),
                    0,
                    "Missing",
                    "Blocked",
                    "/admin/dashboard/finance",
                    "Open finance view"),
                GetPriorityOrder(priority),
                ageDays));
        }

        return queue
            .OrderBy(item => item.PriorityOrder)
            .ThenByDescending(item => item.AgeDays)
            .ThenBy(item => item.Item.EmployeeName, StringComparer.OrdinalIgnoreCase)
            .Select(item => item.Item)
            .Take(12)
            .ToList();
    }

    private IReadOnlyList<AlertDto> BuildAlerts(PersonalDashboardContext context)
    {
        var alerts = new List<AlertDto>();
        var summary = BuildSummary(context);
        var overdueApprovals = context.ScopedTimesheets.Count(item => IsSubmittedStatus(item.RawStatus) && item.AgeDays > 2);
        var readyForPayrollReview = context.ScopedTimesheets.Count(item => IsApprovedStatus(item.RawStatus) && item.AgeDays > 1);
        var rejectedFollowUps = context.ScopedTimesheets.Count(item => IsRejectedStatus(item.RawStatus));

        if (overdueApprovals > 0)
        {
            alerts.Add(new AlertDto(
                "personal-overdue-approvals",
                "overdue_approvals",
                "Approvals waiting too long",
                $"{overdueApprovals} submitted timesheet{Pluralize(overdueApprovals)} have been in your finance queue for more than 48 hours.",
                overdueApprovals,
                "high",
                "/admin/timesheets/approved?status=submitted",
                "Open approval queue"));
        }

        if (summary.MissingTimesheetCases > 0)
        {
            alerts.Add(new AlertDto(
                "personal-missing-submissions",
                "missing_submissions",
                "Missing submissions to chase",
                $"{summary.MissingTimesheetCases} employee{Pluralize(summary.MissingTimesheetCases)} still have no submitted time in the selected period.",
                summary.MissingTimesheetCases,
                "high",
                "/admin/dashboard/finance",
                "Review missing cases"));
        }

        if (rejectedFollowUps > 0)
        {
            alerts.Add(new AlertDto(
                "personal-returned-items",
                "returned_items",
                "Returned items still open",
                $"{rejectedFollowUps} timesheet{Pluralize(rejectedFollowUps)} need correction follow-up before finance can close the cycle.",
                rejectedFollowUps,
                "medium",
                "/admin/timesheets/approved?status=rejected",
                "Open returned records"));
        }

        if (readyForPayrollReview > 0)
        {
            alerts.Add(new AlertDto(
                "personal-payroll-review",
                "payroll_review",
                "Payroll review queue is building",
                $"{readyForPayrollReview} finance-approved timesheet{Pluralize(readyForPayrollReview)} are ready for payroll review or export follow-up.",
                readyForPayrollReview,
                "medium",
                "/admin/reports/payroll-export",
                "Open payroll export"));
        }

        var abnormalNonBillableProjects = context.ScopedTimesheets
            .Where(item => !IsDraftStatus(item.RawStatus))
            .SelectMany(item => item.Rows)
            .GroupBy(item => item.ProjectName, StringComparer.OrdinalIgnoreCase)
            .Select(group => new
            {
                TotalHours = group.Sum(item => item.TotalHours),
                BillableHours = group.Where(item => item.Billable).Sum(item => item.TotalHours)
            })
            .Count(item => item.TotalHours > 0 && ((item.TotalHours - item.BillableHours) / item.TotalHours) >= 0.45);

        if (abnormalNonBillableProjects > 0)
        {
            alerts.Add(new AlertDto(
                "personal-non-billable-spike",
                "abnormal_non_billable_spike",
                "Non-billable spike in review scope",
                $"{abnormalNonBillableProjects} project{Pluralize(abnormalNonBillableProjects)} show unusually high non-billable effort and deserve finance attention.",
                abnormalNonBillableProjects,
                "low",
                "/admin/reports/billing",
                "Open billing reports"));
        }

        if (alerts.Count == 0)
        {
            alerts.Add(new AlertDto(
                "personal-all-clear",
                "all_clear",
                "No urgent finance blockers",
                "Your current finance queue has no overdue approvals, missing submissions, or returned records needing immediate follow-up.",
                0,
                "low",
                "/admin/dashboard",
                "Stay on dashboard"));
        }

        return alerts;
    }

    private PersonalDashboardChartsDto BuildCharts(PersonalDashboardContext context)
    {
        var missingEmployees = GetMissingEmployees(context).Count;
        var actionableTimesheets = context.ScopedTimesheets
            .Where(item => !IsDraftStatus(item.RawStatus))
            .ToList();

        var queueStatus = new PersonalDashboardQueueStatusDto(
            PendingApprovals: actionableTimesheets.Count(item => IsSubmittedStatus(item.RawStatus)),
            ReadyForPayrollReview: actionableTimesheets.Count(item => IsApprovedStatus(item.RawStatus)),
            ReturnedForCorrection: actionableTimesheets.Count(item => IsRejectedStatus(item.RawStatus)),
            MissingSubmissions: missingEmployees);

        var buckets = BuildBuckets(context.Range);
        var billableTrend = buckets
            .Select(bucket => new BillableTrendDto(
                bucket.Label,
                actionableTimesheets.SelectMany(item => item.Rows).Sum(row => SumRowHours(row, bucket, billableOnly: true)),
                actionableTimesheets.SelectMany(item => item.Rows).Sum(row => SumRowHours(row, bucket, billableOnly: false))))
            .ToList();

        var payrollReadiness = buckets
            .Select(bucket => new PayrollReadinessDto(
                bucket.Label,
                Ready: actionableTimesheets.Count(item => IsApprovedStatus(item.RawStatus) && BucketContains(bucket, item.UpdatedDate)),
                Pending: actionableTimesheets.Count(item => IsSubmittedStatus(item.RawStatus) && BucketContains(bucket, item.UpdatedDate)),
                Blocked: actionableTimesheets.Count(item => IsRejectedStatus(item.RawStatus) && BucketContains(bucket, item.UpdatedDate)),
                Exported: 0))
            .ToList();

        var delayedDepartments = context.ScopedTimesheets
            .Where(item =>
                (IsSubmittedStatus(item.RawStatus) && item.AgeDays > 2) ||
                (IsRejectedStatus(item.RawStatus) && item.AgeDays > 2) ||
                (IsApprovedStatus(item.RawStatus) && item.AgeDays > 1))
            .GroupBy(item => item.Employee.Department, StringComparer.OrdinalIgnoreCase)
            .Select(group => new PersonalDashboardDelayedDepartmentDto(group.Key, group.Count()))
            .OrderByDescending(item => item.OpenItems)
            .ThenBy(item => item.DepartmentName, StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .ToList();

        if (delayedDepartments.Count == 0)
        {
            delayedDepartments = context.ScopedTimesheets
                .Where(item => !IsDraftStatus(item.RawStatus))
                .GroupBy(item => item.Employee.Department, StringComparer.OrdinalIgnoreCase)
                .Select(group => new PersonalDashboardDelayedDepartmentDto(group.Key, group.Count()))
                .OrderByDescending(item => item.OpenItems)
                .ThenBy(item => item.DepartmentName, StringComparer.OrdinalIgnoreCase)
                .Take(5)
                .ToList();
        }

        return new PersonalDashboardChartsDto(queueStatus, billableTrend, payrollReadiness, delayedDepartments);
    }

    private IReadOnlyList<PersonalDashboardActivityDto> BuildRecentActivity(PersonalDashboardContext context) =>
        context.ScopedTimesheets
            .Where(item => !IsDraftStatus(item.RawStatus))
            .OrderByDescending(item => item.Timesheet.UpdatedAtUtc)
            .ThenByDescending(item => item.TotalHours)
            .Take(8)
            .Select(item => new PersonalDashboardActivityDto(
                item.Timesheet.Id.ToString(),
                item.Employee.FullName,
                item.Employee.Department,
                BuildTimesheetPeriod(item.Timesheet),
                item.TotalHours,
                item.ApprovalStatus,
                BuildActivityLabel(item.RawStatus),
                item.Timesheet.UpdatedAtUtc.ToString("dd MMM yyyy", CultureInfo.InvariantCulture),
                BuildActionUrl(item.RawStatus)))
            .ToList();

    private IReadOnlyList<EmployeeEntity> GetMissingEmployees(PersonalDashboardContext context)
    {
        var submittedEmployeeIds = context.ScopedTimesheets
            .Where(item => !IsDraftStatus(item.RawStatus))
            .Select(item => item.Employee.Id)
            .ToHashSet();

        return context.ExpectedEmployees
            .Where(item => !submittedEmployeeIds.Contains(item.Id))
            .OrderBy(item => item.Department, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.FullName, StringComparer.OrdinalIgnoreCase)
            .Take(6)
            .ToList();
    }

    private static PersonalTimesheetSnapshot CreateSnapshot(
        WeeklyTimesheetEntity timesheet,
        EmployeeEntity employee,
        (DateOnly Start, DateOnly End) dateRange,
        DateOnly today)
    {
        var rows = ParseRows(timesheet.RowsJson, dateRange)
            .Select(item => new PersonalRowSnapshot(
                item.ProjectName,
                item.Billable,
                item.HoursByDate,
                item.HoursByDate.Values.Sum()))
            .Where(item => item.TotalHours > 0)
            .ToList();

        var totalHours = rows.Sum(item => item.TotalHours);
        var billableHours = rows.Where(item => item.Billable).Sum(item => item.TotalHours);
        var updatedDate = DateOnly.FromDateTime(timesheet.UpdatedAtUtc);

        return new PersonalTimesheetSnapshot(
            timesheet,
            employee,
            rows,
            totalHours,
            billableHours,
            totalHours - billableHours,
            MapApprovalStatus(timesheet.Status),
            MapPayrollStatus(timesheet.Status),
            IsSubmittedOnTime(timesheet),
            Math.Max(today.DayNumber - updatedDate.DayNumber, 0));
    }

    private static IReadOnlyList<ParsedPersonalRow> ParseRows(string rowsJson, (DateOnly Start, DateOnly End) dateRange)
    {
        if (string.IsNullOrWhiteSpace(rowsJson))
        {
            return [];
        }

        try
        {
            using var document = JsonDocument.Parse(rowsJson);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            var rows = new List<ParsedPersonalRow>();

            foreach (var row in document.RootElement.EnumerateArray())
            {
                var hoursByDate = new Dictionary<DateOnly, double>();

                if (row.TryGetProperty("hours", out var hoursElement) && hoursElement.ValueKind == JsonValueKind.Object)
                {
                    foreach (var entry in hoursElement.EnumerateObject())
                    {
                        if (!DateOnly.TryParseExact(entry.Name, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                        {
                            continue;
                        }

                        if (date < dateRange.Start || date > dateRange.End || !TryReadHours(entry.Value, out var hours) || hours <= 0)
                        {
                            continue;
                        }

                        hoursByDate[date] = hours;
                    }
                }

                rows.Add(new ParsedPersonalRow(
                    string.IsNullOrWhiteSpace(ReadStringProperty(row, "projectName")) ? "Unassigned" : ReadStringProperty(row, "projectName"),
                    ReadBooleanProperty(row, "billable", defaultValue: true),
                    hoursByDate));
            }

            return rows;
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static double SumRowHours(PersonalRowSnapshot row, DateBucket bucket, bool billableOnly)
    {
        if (row.Billable != billableOnly)
        {
            return 0;
        }

        return row.HoursByDate
            .Where(item => BucketContains(bucket, item.Key))
            .Sum(item => item.Value);
    }

    private static IReadOnlyList<DateBucket> BuildBuckets((DateOnly Start, DateOnly End) dateRange)
    {
        var totalDays = dateRange.End.DayNumber - dateRange.Start.DayNumber + 1;
        if (totalDays <= 14)
        {
            return BuildDailyBuckets(dateRange);
        }

        if (totalDays <= 92)
        {
            return BuildWeeklyBuckets(dateRange);
        }

        return BuildMonthlyBuckets(dateRange);
    }

    private static IReadOnlyList<DateBucket> BuildDailyBuckets((DateOnly Start, DateOnly End) dateRange)
    {
        var buckets = new List<DateBucket>();
        for (var date = dateRange.Start; date <= dateRange.End; date = date.AddDays(1))
        {
            buckets.Add(new DateBucket(date, date, date.ToString("dd MMM", CultureInfo.InvariantCulture)));
        }

        return buckets;
    }

    private static IReadOnlyList<DateBucket> BuildWeeklyBuckets((DateOnly Start, DateOnly End) dateRange)
    {
        var buckets = new List<DateBucket>();
        var current = dateRange.Start;

        while (current <= dateRange.End)
        {
            var end = current.AddDays(6);
            if (end > dateRange.End)
            {
                end = dateRange.End;
            }

            buckets.Add(new DateBucket(
                current,
                end,
                current.Month == end.Month
                    ? $"{current:dd} - {end:dd MMM}"
                    : $"{current:dd MMM} - {end:dd MMM}"));

            current = end.AddDays(1);
        }

        return buckets;
    }

    private static IReadOnlyList<DateBucket> BuildMonthlyBuckets((DateOnly Start, DateOnly End) dateRange)
    {
        var buckets = new List<DateBucket>();
        var current = new DateOnly(dateRange.Start.Year, dateRange.Start.Month, 1);

        while (current <= dateRange.End)
        {
            var end = new DateOnly(current.Year, current.Month, DateTime.DaysInMonth(current.Year, current.Month));
            if (end > dateRange.End)
            {
                end = dateRange.End;
            }

            var start = current < dateRange.Start ? dateRange.Start : current;
            buckets.Add(new DateBucket(start, end, current.ToString("MMM yyyy", CultureInfo.InvariantCulture)));
            current = current.AddMonths(1);
        }

        return buckets;
    }

    private static bool BucketContains(DateBucket bucket, DateOnly date) => date >= bucket.Start && date <= bucket.End;

    private static bool TryReadHours(JsonElement value, out double hours)
    {
        if (value.ValueKind == JsonValueKind.Number)
        {
            return value.TryGetDouble(out hours);
        }

        if (value.ValueKind == JsonValueKind.String)
        {
            return double.TryParse(value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out hours);
        }

        hours = 0;
        return false;
    }

    private static string ReadStringProperty(JsonElement row, string propertyName) =>
        row.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()?.Trim() ?? string.Empty
            : string.Empty;

    private static bool ReadBooleanProperty(JsonElement row, string propertyName, bool defaultValue)
    {
        if (!row.TryGetProperty(propertyName, out var value))
        {
            return defaultValue;
        }

        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(value.GetString(), out var parsed) => parsed,
            _ => defaultValue
        };
    }

    private static bool IsSubmittedOnTime(WeeklyTimesheetEntity timesheet)
    {
        if (IsDraftStatus(timesheet.Status))
        {
            return false;
        }

        var dueDate = timesheet.WeekEnd.ToDateTime(TimeOnly.MinValue).AddDays(1);
        return timesheet.UpdatedAtUtc <= dueDate;
    }

    private static bool IsActiveEmployee(EmployeeEntity employee) =>
        !string.Equals(employee.Status?.Trim(), "Inactive", StringComparison.OrdinalIgnoreCase);

    private static bool IsDraftStatus(string status) =>
        string.Equals(status?.Trim(), "Draft", StringComparison.OrdinalIgnoreCase);

    private static bool IsSubmittedStatus(string status) =>
        string.Equals(status?.Trim(), "Submitted", StringComparison.OrdinalIgnoreCase);

    private static bool IsApprovedStatus(string status) =>
        string.Equals(status?.Trim(), "Approved", StringComparison.OrdinalIgnoreCase);

    private static bool IsRejectedStatus(string status) =>
        string.Equals(status?.Trim(), "Rejected", StringComparison.OrdinalIgnoreCase);

    private static string MapApprovalStatus(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            "submitted" => "Finance Pending",
            "approved" => "Finance Approved",
            "rejected" => "Rejected",
            _ => "Draft"
        };

    private static string MapPayrollStatus(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            "approved" => "Ready",
            "rejected" => "Blocked",
            "submitted" => "Pending",
            _ => "Not Ready"
        };

    private static string BuildActivityLabel(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            "submitted" => "Submitted for finance review",
            "approved" => "Moved into payroll review",
            "rejected" => "Returned for correction",
            _ => "Updated in finance scope"
        };

    private static string BuildActionUrl(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            "submitted" => "/admin/timesheets/approved?status=submitted",
            "approved" => "/admin/payroll/timesheets",
            "rejected" => "/admin/timesheets/approved?status=rejected",
            _ => "/admin/dashboard"
        };

    private static string BuildTimesheetPeriod(WeeklyTimesheetEntity timesheet) =>
        $"{timesheet.WeekStart:dd MMM} - {timesheet.WeekEnd:dd MMM}";

    private static string FormatAge(int ageDays) =>
        ageDays switch
        {
            <= 0 => "Updated today",
            1 => "1 day old",
            _ => $"{ageDays} days old"
        };

    private static int GetPriorityOrder(string priority) =>
        priority.Trim().ToLowerInvariant() switch
        {
            "high" => 0,
            "medium" => 1,
            _ => 2
        };

    private static string BuildRangeLabel((DateOnly Start, DateOnly End) dateRange) =>
        $"{dateRange.Start:dd MMM yyyy} - {dateRange.End:dd MMM yyyy}";

    private static string Pluralize(int count) => count == 1 ? string.Empty : "s";

    private static (DateOnly Start, DateOnly End) ParseDateRange(string range, string? startDate, string? endDate)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (string.Equals(range, "custom", StringComparison.OrdinalIgnoreCase) &&
            DateOnly.TryParse(startDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedStart) &&
            DateOnly.TryParse(endDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedEnd) &&
            parsedStart <= parsedEnd)
        {
            return (parsedStart, parsedEnd);
        }

        return range.Trim().ToLowerInvariant() switch
        {
            "today" => (today, today),
            "this_week" => GetWeekRange(today),
            "last_week" => GetWeekRange(today.AddDays(-7)),
            "this_month" => GetMonthRange(today),
            "last_month" => GetMonthRange(today.AddMonths(-1)),
            _ => GetWeekRange(today)
        };
    }

    private static (DateOnly Start, DateOnly End) GetWeekRange(DateOnly date)
    {
        var offset = ((int)date.DayOfWeek + 6) % 7;
        var start = date.AddDays(-offset);
        return (start, start.AddDays(6));
    }

    private static (DateOnly Start, DateOnly End) GetMonthRange(DateOnly date)
    {
        var start = new DateOnly(date.Year, date.Month, 1);
        return (start, start.AddMonths(1).AddDays(-1));
    }

    private sealed record PersonalDashboardContext(
        (DateOnly Start, DateOnly End) Range,
        DateOnly Today,
        IReadOnlyList<EmployeeEntity> ExpectedEmployees,
        IReadOnlyList<PersonalTimesheetSnapshot> ScopedTimesheets,
        DashboardMetaDto Meta);

    private sealed record ParsedPersonalRow(
        string ProjectName,
        bool Billable,
        IReadOnlyDictionary<DateOnly, double> HoursByDate);

    private sealed record PersonalRowSnapshot(
        string ProjectName,
        bool Billable,
        IReadOnlyDictionary<DateOnly, double> HoursByDate,
        double TotalHours);

    private sealed record PersonalTimesheetSnapshot(
        WeeklyTimesheetEntity Timesheet,
        EmployeeEntity Employee,
        IReadOnlyList<PersonalRowSnapshot> Rows,
        double TotalHours,
        double BillableHours,
        double NonBillableHours,
        string ApprovalStatus,
        string PayrollStatus,
        bool SubmittedOnTime,
        int AgeDays)
    {
        public string RawStatus => Timesheet.Status;
        public DateOnly UpdatedDate => DateOnly.FromDateTime(Timesheet.UpdatedAtUtc);
    }

    private sealed record DateBucket(DateOnly Start, DateOnly End, string Label);
}

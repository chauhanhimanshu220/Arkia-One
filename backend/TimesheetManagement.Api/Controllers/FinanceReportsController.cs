using AbhiTimesheet.Api.Contracts.FinanceReports;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.Json;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/finance/reports")]
public sealed class FinanceReportsController(AppDbContext dbContext) : ControllerBase
{
    private const double DailyRegularHours = 9;
    private const decimal RevenueMarkup = 1.65m;

    [HttpGet("{reportType}")]
    public async Task<ActionResult<FinanceReportDto>> GetReport(
        string reportType,
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var normalizedReportType = NormalizeReportType(reportType);
        if (normalizedReportType is null)
        {
            return NotFound(new { message = "Financial report type was not found." });
        }

        var dateRange = ParseDateRange(range, startDate, endDate);
        var context = await BuildReportContextAsync(dateRange, department, project, status, cancellationToken);

        return Ok(BuildReport(normalizedReportType, context));
    }

    private async Task<ReportContext> BuildReportContextAsync(
        (DateOnly Start, DateOnly End) dateRange,
        string? department,
        string? project,
        string? status,
        CancellationToken cancellationToken)
    {
        var normalizedDepartment = NormalizeFilterValue(department);
        var normalizedProject = NormalizeFilterValue(project);
        var normalizedStatus = NormalizeFilterValue(status);

        var employees = await dbContext.Employees
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var employeesById = employees.ToDictionary(item => item.Id, item => item);

        var timesheets = await dbContext.WeeklyTimesheets
            .AsNoTracking()
            .Where(item => item.WeekStart <= dateRange.End && item.WeekEnd >= dateRange.Start)
            .OrderByDescending(item => item.UpdatedAtUtc)
            .ToListAsync(cancellationToken);

        var snapshots = timesheets
            .Where(item => employeesById.ContainsKey(item.UserId))
            .Select(item => CreateSnapshot(item, employeesById[item.UserId], dateRange))
            .Where(item => item.TotalHours > 0)
            .ToList();

        var departmentScoped = snapshots
            .Where(item => MatchesFilter(item.Employee.Department, normalizedDepartment))
            .ToList();

        var projectScoped = departmentScoped
            .Select(item => ApplyProjectFilter(item, normalizedProject))
            .Where(item => item is not null)
            .Select(item => item!)
            .ToList();

        var visible = projectScoped
            .Where(item => MatchesFilter(item.RawStatus, normalizedStatus))
            .ToList();

        var departments = snapshots
            .Select(item => item.Employee.Department)
            .Concat(employees.Where(IsActiveEmployee).Select(item => item.Department))
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var projects = departmentScoped
            .SelectMany(item => item.Rows.Select(row => row.ProjectName))
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var statuses = projectScoped
            .Select(item => item.RawStatus)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(GetStatusSortOrder)
            .ThenBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new ReportContext(
            dateRange,
            visible,
            new FinanceReportFilterOptionsDto(departments, projects, statuses));
    }

    private static FinanceReportDto BuildReport(string reportType, ReportContext context)
    {
        var rows = context.VisibleTimesheets.Select(MapRow).ToList();
        var visibleRows = SelectRowsForReport(reportType, rows).ToList();

        return new FinanceReportDto(
            BuildSummary(visibleRows),
            BuildTrend(reportType, context),
            BuildBreakdown(visibleRows, row => row.Project),
            BuildBreakdown(visibleRows, row => row.EmployeeName),
            BuildBreakdown(visibleRows, row => row.Department),
            visibleRows.OrderByDescending(item => item.LastUpdated).Take(120).ToList(),
            context.Filters,
            new FinanceReportMetaDto(
                reportType,
                ResolveReportTitle(reportType),
                BuildRangeLabel(context.Range),
                "Revenue is estimated from approved billable hours using the finance billing-rate model because dedicated invoice revenue rows are not stored yet.",
                "Expense is estimated from approved effort using the same department and role rate-card model used by the finance dashboard.",
                true));
    }

    private static IEnumerable<FinanceReportRowDto> SelectRowsForReport(string reportType, IReadOnlyList<FinanceReportRowDto> rows) =>
        reportType switch
        {
            "revenue" => rows.Where(item => item.Revenue > 0),
            "expenses" => rows.Where(item => item.Expense > 0),
            "profit-loss" => rows,
            "project-cost-analysis" => rows.Where(item => item.Expense > 0),
            "employee-cost" => rows.Where(item => item.Expense > 0),
            _ => rows
        };

    private static FinanceReportSummaryDto BuildSummary(IReadOnlyList<FinanceReportRowDto> rows)
    {
        var revenue = rows.Sum(item => item.Revenue);
        var expense = rows.Sum(item => item.Expense);
        var profit = revenue - expense;
        var totalHours = rows.Sum(item => item.TotalHours);

        return new FinanceReportSummaryDto(
            revenue,
            expense,
            profit,
            CalculateMargin(revenue, profit),
            rows.Sum(item => item.BillableHours),
            rows.Sum(item => item.NonBillableHours),
            rows.Count);
    }

    private static IReadOnlyList<FinanceReportTrendPointDto> BuildTrend(string reportType, ReportContext context) =>
        BuildBuckets(context.Range)
            .Select(bucket =>
            {
                var bucketRows = context.VisibleTimesheets
                    .Select(item => ProjectSnapshotToBucket(item, bucket))
                    .Where(item => item.TotalHours > 0)
                    .Select(MapRow)
                    .ToList();
                var filteredRows = SelectRowsForReport(reportType, bucketRows).ToList();
                var revenue = filteredRows.Sum(item => item.Revenue);
                var expense = filteredRows.Sum(item => item.Expense);

                return new FinanceReportTrendPointDto(
                    bucket.Label,
                    revenue,
                    expense,
                    revenue - expense,
                    filteredRows.Sum(item => item.TotalHours));
            })
            .ToList();

    private static IReadOnlyList<FinanceReportBreakdownDto> BuildBreakdown(
        IReadOnlyList<FinanceReportRowDto> rows,
        Func<FinanceReportRowDto, string> keySelector) =>
        rows
            .GroupBy(keySelector, StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var revenue = group.Sum(item => item.Revenue);
                var expense = group.Sum(item => item.Expense);
                var profit = revenue - expense;

                return new FinanceReportBreakdownDto(
                    string.IsNullOrWhiteSpace(group.Key) ? "Unassigned" : group.Key,
                    revenue,
                    expense,
                    profit,
                    group.Sum(item => item.TotalHours),
                    CalculateMargin(revenue, profit));
            })
            .OrderByDescending(item => Math.Max(item.Revenue, item.Expense))
            .Take(10)
            .ToList();

    private static FinanceReportRowDto MapRow(FinanceReportSnapshot snapshot)
    {
        var profit = snapshot.Revenue - snapshot.Expense;

        return new FinanceReportRowDto(
            snapshot.Timesheet.Id.ToString(),
            snapshot.Employee.FullName,
            snapshot.Employee.Department,
            snapshot.PrimaryProject,
            $"{snapshot.Timesheet.WeekStart:dd MMM} - {snapshot.Timesheet.WeekEnd:dd MMM}",
            snapshot.ApprovalStatus,
            snapshot.TotalHours,
            snapshot.BillableHours,
            snapshot.NonBillableHours,
            snapshot.Revenue,
            snapshot.Expense,
            profit,
            CalculateMargin(snapshot.Revenue, profit),
            snapshot.Timesheet.UpdatedAtUtc.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
    }

    private static FinanceReportSnapshot ProjectSnapshotToBucket(FinanceReportSnapshot snapshot, DateBucket bucket)
    {
        var rows = snapshot.Rows
            .Select(row => row with
            {
                HoursByDate = row.HoursByDate
                    .Where(item => BucketContains(bucket, item.Key))
                    .ToDictionary(item => item.Key, item => item.Value)
            })
            .Where(item => item.HoursByDate.Count > 0)
            .Select(row => row with { TotalHours = row.HoursByDate.Values.Sum() })
            .ToList();

        return CreateSnapshotCore(snapshot.Timesheet, snapshot.Employee, rows);
    }

    private static FinanceReportSnapshot CreateSnapshot(
        WeeklyTimesheetEntity timesheet,
        EmployeeEntity employee,
        (DateOnly Start, DateOnly End) dateRange) =>
        CreateSnapshotCore(timesheet, employee, ParseRows(timesheet.RowsJson, dateRange));

    private static FinanceReportSnapshot? ApplyProjectFilter(FinanceReportSnapshot snapshot, string? project)
    {
        if (string.IsNullOrWhiteSpace(project))
        {
            return snapshot;
        }

        var rows = snapshot.Rows
            .Where(item =>
                string.Equals(item.ProjectId, project, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(item.ProjectName, project, StringComparison.OrdinalIgnoreCase))
            .ToList();

        return rows.Count == 0 ? null : CreateSnapshotCore(snapshot.Timesheet, snapshot.Employee, rows);
    }

    private static FinanceReportSnapshot CreateSnapshotCore(
        WeeklyTimesheetEntity timesheet,
        EmployeeEntity employee,
        IReadOnlyList<FinanceReportRowSnapshot> rows)
    {
        var payrollProfile = ResolvePayrollProfile(employee);
        var normalizedRows = rows
            .Select(item => item with { TotalHours = item.HoursByDate.Values.Sum() })
            .Where(item => item.TotalHours > 0)
            .ToList();

        var dailyTotals = normalizedRows
            .SelectMany(row => row.HoursByDate)
            .GroupBy(item => item.Key)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Value));

        var totalHours = normalizedRows.Sum(item => item.TotalHours);
        var billableHours = normalizedRows.Where(item => item.Billable).Sum(item => item.TotalHours);
        var nonBillableHours = totalHours - billableHours;
        var overtimeHours = dailyTotals.Sum(item => Math.Max(item.Value - DailyRegularHours, 0));
        var regularHours = Math.Max(totalHours - overtimeHours, 0);
        var expense = (decimal)regularHours * payrollProfile.BaseRate + (decimal)overtimeHours * payrollProfile.OvertimeRate;
        var revenue = IsApprovedStatus(timesheet.Status)
            ? normalizedRows.Where(item => item.Billable).Sum(item => (decimal)item.TotalHours * payrollProfile.BillingRate)
            : 0m;

        return new FinanceReportSnapshot(
            timesheet,
            employee,
            normalizedRows,
            totalHours,
            billableHours,
            nonBillableHours,
            revenue,
            expense,
            GetPrimaryProject(normalizedRows),
            MapApprovalStatus(timesheet.Status));
    }

    private static IReadOnlyList<FinanceReportRowSnapshot> ParseRows(string rowsJson, (DateOnly Start, DateOnly End) dateRange)
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

            var rows = new List<FinanceReportRowSnapshot>();
            foreach (var row in document.RootElement.EnumerateArray())
            {
                var hoursByDate = new Dictionary<DateOnly, double>();
                if (row.TryGetProperty("hours", out var hoursElement) && hoursElement.ValueKind == JsonValueKind.Object)
                {
                    foreach (var entry in hoursElement.EnumerateObject())
                    {
                        if (!DateOnly.TryParseExact(entry.Name, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ||
                            date < dateRange.Start ||
                            date > dateRange.End ||
                            !TryReadHours(entry.Value, out var hours) ||
                            hours <= 0)
                        {
                            continue;
                        }

                        hoursByDate[date] = hours;
                    }
                }

                rows.Add(new FinanceReportRowSnapshot(
                    ReadStringProperty(row, "projectId"),
                    string.IsNullOrWhiteSpace(ReadStringProperty(row, "projectName")) ? "Unassigned" : ReadStringProperty(row, "projectName"),
                    ReadBooleanProperty(row, "billable", defaultValue: true),
                    hoursByDate,
                    hoursByDate.Values.Sum()));
            }

            return rows;
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static PayrollProfile ResolvePayrollProfile(EmployeeEntity employee)
    {
        var baseRate = employee.Department.Trim() switch
        {
            "Engineering" => 780m,
            "Operations" => 640m,
            "Finance" => 700m,
            "HR" => 620m,
            "Human Resources" => 620m,
            "Support" => 610m,
            "Admin" => 600m,
            "Sales" => 680m,
            "Design" => 730m,
            _ => 650m
        };

        var normalizedRole = RoleCatalog.NormalizeRole(employee.Role);
        if (normalizedRole != RoleCatalog.Employee)
        {
            baseRate = Math.Round(baseRate * 1.25m, 2);
        }

        return new PayrollProfile(
            baseRate,
            Math.Round(baseRate * 1.5m, 2),
            Math.Round(baseRate * RevenueMarkup, 2));
    }

    private static IReadOnlyList<DateBucket> BuildBuckets((DateOnly Start, DateOnly End) dateRange)
    {
        var totalDays = dateRange.End.DayNumber - dateRange.Start.DayNumber + 1;
        if (totalDays <= 14)
        {
            return Enumerable.Range(0, totalDays)
                .Select(offset => dateRange.Start.AddDays(offset))
                .Select(date => new DateBucket(date, date, date.ToString("dd MMM", CultureInfo.InvariantCulture)))
                .ToList();
        }

        if (totalDays <= 92)
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
                    current.Month == end.Month ? $"{current:dd} - {end:dd MMM}" : $"{current:dd MMM} - {end:dd MMM}"));
                current = end.AddDays(1);
            }

            return buckets;
        }

        var monthlyBuckets = new List<DateBucket>();
        var month = new DateOnly(dateRange.Start.Year, dateRange.Start.Month, 1);
        while (month <= dateRange.End)
        {
            var end = new DateOnly(month.Year, month.Month, DateTime.DaysInMonth(month.Year, month.Month));
            monthlyBuckets.Add(new DateBucket(
                month < dateRange.Start ? dateRange.Start : month,
                end > dateRange.End ? dateRange.End : end,
                month.ToString("MMM yyyy", CultureInfo.InvariantCulture)));
            month = month.AddMonths(1);
        }

        return monthlyBuckets;
    }

    private static bool BucketContains(DateBucket bucket, DateOnly date) => date >= bucket.Start && date <= bucket.End;

    private static string GetPrimaryProject(IReadOnlyList<FinanceReportRowSnapshot> rows) =>
        rows.Count == 0
            ? "No project tagged"
            : rows.OrderByDescending(item => item.TotalHours).ThenBy(item => item.ProjectName, StringComparer.OrdinalIgnoreCase).First().ProjectName;

    private static string? NormalizeReportType(string reportType) =>
        reportType.Trim().ToLowerInvariant() switch
        {
            "revenue" => "revenue",
            "expenses" => "expenses",
            "expense" => "expenses",
            "profit-loss" => "profit-loss",
            "pnl" => "profit-loss",
            "project-cost-analysis" => "project-cost-analysis",
            "project-cost" => "project-cost-analysis",
            "employee-cost" => "employee-cost",
            _ => null
        };

    private static string ResolveReportTitle(string reportType) =>
        reportType switch
        {
            "revenue" => "Revenue Report",
            "expenses" => "Expense Report",
            "profit-loss" => "Profit & Loss Report",
            "project-cost-analysis" => "Project Cost Analysis",
            "employee-cost" => "Employee Cost Report",
            _ => "Financial Report"
        };

    private static string MapApprovalStatus(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            "submitted" => "Finance Pending",
            "approved" => "Finance Approved",
            "rejected" => "Rejected",
            _ => "Draft"
        };

    private static double CalculateMargin(decimal revenue, decimal profit) =>
        revenue <= 0 ? 0 : Math.Round((double)(profit / revenue) * 100, 1);

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

    private static bool MatchesFilter(string value, string? filter) =>
        string.IsNullOrWhiteSpace(filter) || string.Equals(value?.Trim(), filter, StringComparison.OrdinalIgnoreCase);

    private static bool IsActiveEmployee(EmployeeEntity employee) =>
        !string.Equals(employee.Status?.Trim(), "Inactive", StringComparison.OrdinalIgnoreCase);

    private static bool IsApprovedStatus(string status) =>
        string.Equals(status?.Trim(), "Approved", StringComparison.OrdinalIgnoreCase);

    private static int GetStatusSortOrder(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            "draft" => 0,
            "submitted" => 1,
            "approved" => 2,
            "rejected" => 3,
            _ => 10
        };

    private static string? NormalizeFilterValue(string? value) =>
        string.IsNullOrWhiteSpace(value) || string.Equals(value, "all", StringComparison.OrdinalIgnoreCase)
            ? null
            : value.Trim();

    private static string BuildRangeLabel((DateOnly Start, DateOnly End) dateRange) =>
        $"{dateRange.Start:dd MMM yyyy} - {dateRange.End:dd MMM yyyy}";

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
            _ => GetMonthRange(today)
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

    private sealed record ReportContext(
        (DateOnly Start, DateOnly End) Range,
        IReadOnlyList<FinanceReportSnapshot> VisibleTimesheets,
        FinanceReportFilterOptionsDto Filters);

    private sealed record FinanceReportRowSnapshot(
        string ProjectId,
        string ProjectName,
        bool Billable,
        IReadOnlyDictionary<DateOnly, double> HoursByDate,
        double TotalHours);

    private sealed record FinanceReportSnapshot(
        WeeklyTimesheetEntity Timesheet,
        EmployeeEntity Employee,
        IReadOnlyList<FinanceReportRowSnapshot> Rows,
        double TotalHours,
        double BillableHours,
        double NonBillableHours,
        decimal Revenue,
        decimal Expense,
        string PrimaryProject,
        string ApprovalStatus)
    {
        public string RawStatus => Timesheet.Status;
    }

    private sealed record PayrollProfile(decimal BaseRate, decimal OvertimeRate, decimal BillingRate);
    private sealed record DateBucket(DateOnly Start, DateOnly End, string Label);
}

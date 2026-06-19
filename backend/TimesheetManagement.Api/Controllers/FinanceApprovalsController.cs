using AbhiTimesheet.Api.Contracts.FinanceApprovals;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.Json;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/finance/approvals")]
public sealed class FinanceApprovalsController(AppDbContext dbContext) : ControllerBase
{
    private const double DailyRegularHours = 9;
    private const decimal RevenueMarkup = 1.65m;

    [HttpGet("{approvalType}")]
    public async Task<ActionResult<FinanceApprovalQueueDto>> GetApprovals(
        string approvalType,
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var normalizedApprovalType = NormalizeApprovalType(approvalType);
        if (normalizedApprovalType is null)
        {
            return NotFound(new { message = "Finance approval module was not found." });
        }

        var dateRange = ParseDateRange(range, startDate, endDate);
        var context = await BuildContextAsync(dateRange, department, project, cancellationToken);
        var allItems = context.Snapshots
            .Select(snapshot => MapItem(normalizedApprovalType, snapshot))
            .Where(item => item is not null)
            .Select(item => item!)
            .ToList();

        var normalizedStatus = NormalizeFilterValue(status);
        var visibleItems = allItems
            .Where(item =>
                MatchesFilter(item.Status, normalizedStatus) ||
                MatchesFilter(item.RawStatus, normalizedStatus) ||
                MatchesFilter(item.PayrollStatus, normalizedStatus) ||
                MatchesFilter(item.BillingStatus, normalizedStatus))
            .OrderBy(item => GetPrioritySortOrder(item.Priority))
            .ThenByDescending(item => DateTime.TryParse(item.LastUpdated, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed) ? parsed : DateTime.MinValue)
            .Take(160)
            .ToList();

        return Ok(new FinanceApprovalQueueDto(
            BuildSummary(visibleItems),
            visibleItems,
            new FinanceApprovalFiltersDto(
                context.Departments,
                context.Projects,
                allItems
                    .Select(item => item.Status)
                    .Where(item => !string.IsNullOrWhiteSpace(item))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(GetStatusSortOrder)
                    .ThenBy(item => item, StringComparer.OrdinalIgnoreCase)
                    .ToList()),
            new FinanceApprovalMetaDto(
                normalizedApprovalType,
                ResolveTitle(normalizedApprovalType),
                BuildRangeLabel(dateRange),
                ResolveDataModel(normalizedApprovalType),
                true)));
    }

    private async Task<FinanceApprovalContext> BuildContextAsync(
        (DateOnly Start, DateOnly End) dateRange,
        string? department,
        string? project,
        CancellationToken cancellationToken)
    {
        var normalizedDepartment = NormalizeFilterValue(department);
        var normalizedProject = NormalizeFilterValue(project);

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
            .Where(item => MatchesFilter(item.Employee.Department, normalizedDepartment))
            .Select(item => ApplyProjectFilter(item, normalizedProject))
            .Where(item => item is not null)
            .Select(item => item!)
            .ToList();

        var departments = employees
            .Where(IsActiveEmployee)
            .Select(item => item.Department)
            .Concat(snapshots.Select(item => item.Employee.Department))
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var projects = snapshots
            .SelectMany(item => item.Rows.Select(row => row.ProjectName))
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new FinanceApprovalContext(snapshots, departments, projects);
    }

    private static FinanceApprovalSummaryDto BuildSummary(IReadOnlyList<FinanceApprovalItemDto> items) =>
        new(
            items.Count,
            items.Count(item => IsPendingStatus(item.Status)),
            items.Count(item => IsApprovedStatus(item.Status)),
            items.Count(item => IsReturnedStatus(item.Status)),
            items.Count(item => string.Equals(item.Priority, "High", StringComparison.OrdinalIgnoreCase)),
            items.Sum(item => item.TotalHours),
            items.Sum(item => item.BillableHours),
            items.Sum(item => item.Amount));

    private static FinanceApprovalItemDto? MapItem(string approvalType, FinanceApprovalSnapshot snapshot)
    {
        var amount = approvalType switch
        {
            "billing" => snapshot.BillingAmount,
            _ => snapshot.EstimatedPayrollCost
        };
        var status = approvalType switch
        {
            "payroll" => snapshot.PayrollStatus,
            "billing" => snapshot.BillingStatus,
            _ => snapshot.ApprovalStatus
        };

        return new FinanceApprovalItemDto(
            snapshot.Timesheet.Id.ToString(),
            BuildReferenceNo(approvalType, snapshot.Timesheet),
            snapshot.Employee.FullName,
            snapshot.Employee.EmployeeCode,
            snapshot.Employee.Department,
            snapshot.PrimaryProject,
            $"{snapshot.Timesheet.WeekStart:dd MMM} - {snapshot.Timesheet.WeekEnd:dd MMM}",
            snapshot.RawStatus,
            status,
            snapshot.PayrollStatus,
            snapshot.BillingStatus,
            snapshot.TotalHours,
            snapshot.BillableHours,
            snapshot.NonBillableHours,
            snapshot.OvertimeHours,
            amount,
            ResolvePriority(snapshot, status),
            BuildAgeLabel(snapshot.Timesheet.UpdatedAtUtc),
            snapshot.Timesheet.UpdatedAtUtc.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ResolveRecommendedAction(approvalType, status));
    }

    private static FinanceApprovalSnapshot CreateSnapshot(
        WeeklyTimesheetEntity timesheet,
        EmployeeEntity employee,
        (DateOnly Start, DateOnly End) dateRange) =>
        CreateSnapshotCore(timesheet, employee, ParseRows(timesheet.RowsJson, dateRange));

    private static FinanceApprovalSnapshot? ApplyProjectFilter(FinanceApprovalSnapshot snapshot, string? project)
    {
        if (string.IsNullOrWhiteSpace(project))
        {
            return snapshot;
        }

        var rows = snapshot.Rows
            .Where(item => MatchesProject(item, project))
            .Select(item => new ParsedApprovalRow(item.ProjectId, item.ProjectName, item.Billable, item.HoursByDate))
            .ToList();

        return rows.Count == 0 ? null : CreateSnapshotCore(snapshot.Timesheet, snapshot.Employee, rows);
    }

    private static FinanceApprovalSnapshot CreateSnapshotCore(
        WeeklyTimesheetEntity timesheet,
        EmployeeEntity employee,
        IReadOnlyList<ParsedApprovalRow> parsedRows)
    {
        var payrollProfile = ResolvePayrollProfile(employee);
        var rows = parsedRows
            .Select(item =>
            {
                var totalHours = item.HoursByDate.Values.Sum();
                var estimatedCost = (decimal)totalHours * payrollProfile.BaseRate;
                return new FinanceApprovalRowSnapshot(
                    item.ProjectId,
                    item.ProjectName,
                    item.Billable,
                    item.HoursByDate,
                    totalHours,
                    estimatedCost,
                    item.Billable ? estimatedCost * RevenueMarkup : 0m);
            })
            .Where(item => item.TotalHours > 0)
            .ToList();

        var dailyTotals = rows
            .SelectMany(row => row.HoursByDate)
            .GroupBy(item => item.Key)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Value));
        var totalHours = rows.Sum(item => item.TotalHours);
        var overtimeHours = dailyTotals.Sum(item => Math.Max(item.Value - DailyRegularHours, 0));
        var regularHours = Math.Max(totalHours - overtimeHours, 0);
        var billableHours = rows.Where(item => item.Billable).Sum(item => item.TotalHours);

        return new FinanceApprovalSnapshot(
            timesheet,
            employee,
            rows,
            totalHours,
            billableHours,
            rows.Where(item => !item.Billable).Sum(item => item.TotalHours),
            overtimeHours,
            (decimal)regularHours * payrollProfile.BaseRate + (decimal)overtimeHours * payrollProfile.OvertimeRate,
            rows.Where(item => item.Billable).Sum(item => item.BillingAmount),
            GetPrimaryProject(rows),
            MapApprovalStatus(timesheet.Status),
            MapPayrollStatus(timesheet.Status),
            MapBillingStatus(timesheet.Status, billableHours));
    }

    private static IReadOnlyList<ParsedApprovalRow> ParseRows(string rowsJson, (DateOnly Start, DateOnly End) dateRange)
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

            var rows = new List<ParsedApprovalRow>();
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

                rows.Add(new ParsedApprovalRow(
                    ReadStringProperty(row, "projectId"),
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

        if (RoleCatalog.NormalizeRole(employee.Role) == RoleCatalog.Employee)
        {
            return new PayrollProfile(baseRate, Math.Round(baseRate * 1.5m, 2));
        }

        var elevatedRate = Math.Round(baseRate * 1.25m, 2);
        return new PayrollProfile(elevatedRate, Math.Round(elevatedRate * 1.25m, 2));
    }

    private static bool MatchesProject(FinanceApprovalRowSnapshot row, string project)
    {
        if (string.IsNullOrWhiteSpace(project))
        {
            return true;
        }

        return string.Equals(row.ProjectId, project, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(row.ProjectName, project, StringComparison.OrdinalIgnoreCase);
    }

    private static string GetPrimaryProject(IReadOnlyList<FinanceApprovalRowSnapshot> rows)
    {
        var projects = rows
            .GroupBy(item => item.ProjectName, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(group => group.Sum(item => item.TotalHours))
            .Select(group => group.Key)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .ToList();

        return projects.Count switch
        {
            0 => "Unassigned",
            1 => projects[0],
            _ => $"{projects[0]} +{projects.Count - 1}"
        };
    }

    private static string? NormalizeApprovalType(string approvalType) =>
        approvalType.Trim().ToLowerInvariant() switch
        {
            "payroll" => "payroll",
            "expense" or "expenses" => "expenses",
            "billing" => "billing",
            _ => null
        };

    private static string ResolveTitle(string approvalType) =>
        approvalType switch
        {
            "payroll" => "Payroll Approval",
            "expenses" => "Expense Approval",
            "billing" => "Billing Approval",
            _ => "Finance Approval"
        };

    private static string ResolveDataModel(string approvalType) =>
        approvalType switch
        {
            "payroll" => "Payroll approval data is derived from live weekly timesheets, employee departments, role rate cards, and approval status.",
            "expenses" => "Expense approval data is derived from live timesheet effort cost using the finance estimated cost model.",
            "billing" => "Billing approval data is derived from live billable timesheet effort and the finance revenue markup model.",
            _ => "Finance approval data is derived from live timesheet records."
        };

    private static string BuildReferenceNo(string approvalType, WeeklyTimesheetEntity timesheet)
    {
        var prefix = approvalType switch
        {
            "payroll" => "PAY",
            "expenses" => "EXP",
            "billing" => "BIL",
            _ => "FIN"
        };

        return $"{prefix}-{timesheet.WeekStart:yyyyMMdd}-{timesheet.Id.ToString("N")[..6].ToUpperInvariant()}";
    }

    private static string ResolveRecommendedAction(string approvalType, string status)
    {
        var normalized = status.ToLowerInvariant();
        if (normalized.Contains("blocked") || normalized.Contains("rejected"))
        {
            return "Resolve";
        }

        if (normalized.Contains("ready") || normalized.Contains("approved"))
        {
            return approvalType == "billing" ? "Invoice" : "Release";
        }

        return approvalType switch
        {
            "payroll" => "Validate",
            "expenses" => "Review",
            "billing" => "Approve",
            _ => "Review"
        };
    }

    private static string ResolvePriority(FinanceApprovalSnapshot snapshot, string status)
    {
        if (IsReturnedStatus(status) || snapshot.OvertimeHours >= DailyRegularHours)
        {
            return "High";
        }

        if (IsPendingStatus(status) && snapshot.Timesheet.UpdatedAtUtc < DateTime.UtcNow.AddDays(-2))
        {
            return "High";
        }

        return IsPendingStatus(status) ? "Medium" : "Normal";
    }

    private static string BuildAgeLabel(DateTime updatedAtUtc)
    {
        var days = Math.Max(0, (int)Math.Floor((DateTime.UtcNow - updatedAtUtc).TotalDays));
        return days switch
        {
            0 => "Today",
            1 => "1 day",
            _ => $"{days} days"
        };
    }

    private static string MapApprovalStatus(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            "submitted" => "Submitted",
            "approved" => "Finance Approved",
            "rejected" => "Rejected",
            "draft" => "Draft",
            _ => string.IsNullOrWhiteSpace(status) ? "Draft" : status.Trim()
        };

    private static string MapPayrollStatus(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            "approved" => "Ready",
            "rejected" => "Blocked",
            "submitted" => "Pending",
            _ => "Pending"
        };

    private static string MapBillingStatus(string status, double billableHours)
    {
        if (billableHours <= 0)
        {
            return "Non-billable Review";
        }

        return status.Trim().ToLowerInvariant() switch
        {
            "approved" => "Billing Ready",
            "rejected" => "Billing Blocked",
            "submitted" => "Billable Pending",
            _ => "Billable Pending"
        };
    }

    private static bool IsPendingStatus(string status)
    {
        var normalized = status.Trim().ToLowerInvariant();
        return normalized.Contains("pending") || normalized.Contains("submitted") || normalized.Contains("draft") || normalized.Contains("review");
    }

    private static bool IsApprovedStatus(string status)
    {
        var normalized = status.Trim().ToLowerInvariant();
        return normalized.Contains("approved") || normalized.Contains("ready");
    }

    private static bool IsReturnedStatus(string status)
    {
        var normalized = status.Trim().ToLowerInvariant();
        return normalized.Contains("blocked") || normalized.Contains("rejected") || normalized.Contains("returned");
    }

    private static int GetPrioritySortOrder(string priority) =>
        priority.Trim().ToLowerInvariant() switch
        {
            "high" => 0,
            "medium" => 1,
            _ => 2
        };

    private static int GetStatusSortOrder(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            var value when value.Contains("pending") || value.Contains("submitted") => 0,
            var value when value.Contains("blocked") || value.Contains("rejected") => 1,
            var value when value.Contains("ready") || value.Contains("approved") => 2,
            _ => 3
        };

    private static bool MatchesFilter(string value, string? filter) =>
        string.IsNullOrWhiteSpace(filter) ||
        string.Equals(value, filter, StringComparison.OrdinalIgnoreCase);

    private static string? NormalizeFilterValue(string? value) =>
        string.IsNullOrWhiteSpace(value) || string.Equals(value.Trim(), "All", StringComparison.OrdinalIgnoreCase)
            ? null
            : value.Trim();

    private static bool TryReadHours(JsonElement value, out double hours)
    {
        if (value.ValueKind == JsonValueKind.Number)
        {
            return value.TryGetDouble(out hours);
        }

        if (value.ValueKind == JsonValueKind.String &&
            double.TryParse(value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out hours))
        {
            return true;
        }

        hours = 0;
        return false;
    }

    private static string ReadStringProperty(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : string.Empty;

    private static bool ReadBooleanProperty(JsonElement element, string propertyName, bool defaultValue) =>
        element.TryGetProperty(propertyName, out var value)
            ? value.ValueKind switch
            {
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.String when bool.TryParse(value.GetString(), out var parsed) => parsed,
                _ => defaultValue
            }
            : defaultValue;

    private static bool IsActiveEmployee(EmployeeEntity employee) =>
        string.IsNullOrWhiteSpace(employee.Status) ||
        string.Equals(employee.Status, "Active", StringComparison.OrdinalIgnoreCase);

    private static (DateOnly Start, DateOnly End) ParseDateRange(string range, string? startDate, string? endDate)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return range.Trim().ToLowerInvariant() switch
        {
            "today" => (today, today),
            "this_week" => GetWeekRange(today),
            "last_week" => GetWeekRange(today.AddDays(-7)),
            "last_month" => GetMonthRange(today.AddMonths(-1)),
            "custom" => ParseCustomRange(startDate, endDate, today),
            _ => GetMonthRange(today)
        };
    }

    private static (DateOnly Start, DateOnly End) ParseCustomRange(string? startDate, string? endDate, DateOnly today)
    {
        if (!DateOnly.TryParseExact(startDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start) ||
            !DateOnly.TryParseExact(endDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var end) ||
            start > end)
        {
            return GetMonthRange(today);
        }

        return (start, end);
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

    private static string BuildRangeLabel((DateOnly Start, DateOnly End) range) =>
        $"{range.Start:dd MMM yyyy} - {range.End:dd MMM yyyy}";

    private sealed record FinanceApprovalContext(
        IReadOnlyList<FinanceApprovalSnapshot> Snapshots,
        IReadOnlyList<string> Departments,
        IReadOnlyList<string> Projects);

    private sealed record ParsedApprovalRow(
        string ProjectId,
        string ProjectName,
        bool Billable,
        IReadOnlyDictionary<DateOnly, double> HoursByDate);

    private sealed record FinanceApprovalRowSnapshot(
        string ProjectId,
        string ProjectName,
        bool Billable,
        IReadOnlyDictionary<DateOnly, double> HoursByDate,
        double TotalHours,
        decimal EstimatedCost,
        decimal BillingAmount);

    private sealed record FinanceApprovalSnapshot(
        WeeklyTimesheetEntity Timesheet,
        EmployeeEntity Employee,
        IReadOnlyList<FinanceApprovalRowSnapshot> Rows,
        double TotalHours,
        double BillableHours,
        double NonBillableHours,
        double OvertimeHours,
        decimal EstimatedPayrollCost,
        decimal BillingAmount,
        string PrimaryProject,
        string ApprovalStatus,
        string PayrollStatus,
        string BillingStatus)
    {
        public string RawStatus => Timesheet.Status;
    }

    private sealed record PayrollProfile(decimal BaseRate, decimal OvertimeRate);
}

using AbhiTimesheet.Api.Contracts.Dashboard;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.Json;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/finance/dashboard")]
public sealed class DashboardController(AppDbContext dbContext) : ControllerBase
{
    private const double DailyRegularHours = 9;

    [HttpGet]
    public async Task<ActionResult<DashboardDataDto>> GetDashboard(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status);
        return Ok(BuildDashboardData(context));
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status);
        return Ok(BuildSummary(context));
    }

    [HttpGet("approval-status")]
    public async Task<ActionResult<ApprovalStatusDto>> GetApprovalStatusData(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status);
        return Ok(BuildApprovalStatus(context.VisibleTimesheets));
    }

    [HttpGet("billable-trend")]
    public async Task<ActionResult<IReadOnlyList<BillableTrendDto>>> GetBillableTrendData(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status);
        return Ok(BuildBillableTrend(context));
    }

    [HttpGet("payroll-readiness")]
    public async Task<ActionResult<IReadOnlyList<PayrollReadinessDto>>> GetPayrollReadinessData(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status);
        return Ok(BuildPayrollReadiness(context));
    }

    [HttpGet("cost-trend")]
    public async Task<ActionResult<IReadOnlyList<CostTrendDto>>> GetCostTrendData(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status);
        return Ok(BuildCostTrend(context));
    }

    [HttpGet("department-hours")]
    public async Task<ActionResult<IReadOnlyList<DepartmentHoursDto>>> GetDepartmentHoursData(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status);
        return Ok(BuildDepartmentHours(context.VisibleTimesheets));
    }

    [HttpGet("project-billable")]
    public async Task<ActionResult<IReadOnlyList<ProjectBillableDto>>> GetProjectBillableData(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status);
        return Ok(BuildProjectBillable(context.VisibleTimesheets));
    }

    [HttpGet("compliance")]
    public async Task<ActionResult<ComplianceDto>> GetComplianceData(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status: null);
        return Ok(BuildCompliance(context));
    }

    [HttpGet("alerts")]
    public async Task<ActionResult<IReadOnlyList<AlertDto>>> GetAlertsData(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status);
        return Ok(BuildAlerts(context));
    }

    [HttpGet("records")]
    public async Task<ActionResult<IReadOnlyList<FinanceRecordDto>>> GetRecordsData(
        [FromQuery] string range = "this_month",
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? department = null,
        [FromQuery] string? project = null,
        [FromQuery] string? status = null)
    {
        var context = await BuildContextAsync(ParseDateRange(range, startDate, endDate), department, project, status);
        return Ok(BuildRecords(context.VisibleTimesheets));
    }

    private async Task<DashboardContext> BuildContextAsync(
        (DateOnly Start, DateOnly End) dateRange,
        string? department,
        string? project,
        string? status)
    {
        var normalizedDepartment = NormalizeFilterValue(department);
        var normalizedProject = NormalizeFilterValue(project);
        var normalizedStatus = NormalizeFilterValue(status);

        var allEmployees = await dbContext.Employees
            .AsNoTracking()
            .ToListAsync();

        var employeesById = allEmployees.ToDictionary(item => item.Id, item => item);
        var activeEmployees = allEmployees
            .Where(IsActiveEmployee)
            .ToList();

        var timesheets = await dbContext.WeeklyTimesheets
            .AsNoTracking()
            .Where(item => item.WeekStart <= dateRange.End && item.WeekEnd >= dateRange.Start)
            .OrderByDescending(item => item.UpdatedAtUtc)
            .ToListAsync();

        var parsedSnapshots = timesheets
            .Where(item => employeesById.ContainsKey(item.UserId))
            .Select(item => CreateSnapshot(item, employeesById[item.UserId], dateRange))
            .Where(item => item is not null)
            .Select(item => item!)
            .ToList();

        var departmentScopedSnapshots = parsedSnapshots
            .Where(item => MatchesFilter(item.Employee.Department, normalizedDepartment))
            .ToList();

        var projectScopedSnapshots = departmentScopedSnapshots
            .Select(item => ApplyProjectFilter(item, normalizedProject))
            .Where(item => item is not null)
            .Select(item => item!)
            .ToList();

        var visibleSnapshots = projectScopedSnapshots
            .Where(item => MatchesFilter(item.RawStatus, normalizedStatus))
            .ToList();

        var expectedEmployees = activeEmployees
            .Where(item => MatchesFilter(item.Department, normalizedDepartment))
            .ToList();

        if (!string.IsNullOrWhiteSpace(normalizedProject))
        {
            var scopedEmployeeIds = projectScopedSnapshots
                .Select(item => item.Employee.Id)
                .Distinct()
                .ToHashSet();

            expectedEmployees = expectedEmployees
                .Where(item => scopedEmployeeIds.Contains(item.Id))
                .ToList();
        }

        var departments = parsedSnapshots
            .Select(item => item.Employee.Department)
            .Concat(activeEmployees.Select(item => item.Department))
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var projects = departmentScopedSnapshots
            .SelectMany(item => item.Rows.Select(row => row.ProjectName))
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var statuses = projectScopedSnapshots
            .Select(item => item.RawStatus)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => GetStatusSortOrder(item))
            .ThenBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new DashboardContext(
            dateRange,
            expectedEmployees,
            projectScopedSnapshots,
            visibleSnapshots,
            new FilterOptionsDto(departments, projects, statuses),
            new DashboardMetaDto(
                BuildRangeLabel(dateRange),
                "Finance workflow states are derived from the current Draft / Submitted / Approved / Rejected weekly timesheet model.",
                "Estimated payroll cost uses the same department and role rate-card fallback currently applied in the payroll workspace.",
                true));
    }

    private DashboardDataDto BuildDashboardData(DashboardContext context) =>
        new(
            BuildSummary(context),
            BuildApprovalStatus(context.VisibleTimesheets),
            BuildBillableTrend(context),
            BuildPayrollReadiness(context),
            BuildCostTrend(context),
            BuildDepartmentHours(context.VisibleTimesheets),
            BuildProjectBillable(context.VisibleTimesheets),
            BuildCompliance(context),
            BuildAlerts(context),
            BuildRecords(context.VisibleTimesheets),
            context.Filters,
            context.Meta);

    private DashboardSummaryDto BuildSummary(DashboardContext context)
    {
        var approvedTimesheets = context.VisibleTimesheets
            .Where(item => IsApprovedStatus(item.RawStatus))
            .ToList();

        var compliance = BuildCompliance(context);
        var approvedHours = approvedTimesheets.Sum(item => item.TotalHours);
        var approvedBillableHours = approvedTimesheets.Sum(item => item.BillableHours);
        var approvedNonBillableHours = approvedTimesheets.Sum(item => item.NonBillableHours);

        return new DashboardSummaryDto(
            PendingFinanceApprovals: context.VisibleTimesheets.Count(item => IsSubmittedStatus(item.RawStatus)),
            PayrollReadyTimesheets: approvedTimesheets.Count,
            ApprovedBillableHours: approvedBillableHours,
            ApprovedNonBillableHours: approvedNonBillableHours,
            EstimatedPayrollHours: approvedHours,
            OvertimeHours: approvedTimesheets.Sum(item => item.OvertimeHours),
            EstimatedPayrollCost: approvedTimesheets.Sum(item => item.EstimatedPayrollCost),
            BillingReadyHours: approvedBillableHours,
            EmployeesNotSubmitted: compliance.Missing,
            BillableUtilizationPercent: approvedHours <= 0 ? 0 : (approvedBillableHours / approvedHours) * 100,
            BlockedTimesheets: context.VisibleTimesheets.Count(item => IsRejectedStatus(item.RawStatus)));
    }

    private static ApprovalStatusDto BuildApprovalStatus(IReadOnlyList<FinanceTimesheetSnapshot> timesheets) =>
        new(
            Submitted: timesheets.Count(item => IsSubmittedStatus(item.RawStatus)),
            FinancePending: 0,
            FinanceApproved: timesheets.Count(item => IsApprovedStatus(item.RawStatus)),
            Rejected: timesheets.Count(item => IsRejectedStatus(item.RawStatus)),
            Returned: 0,
            PayrollExported: 0);

    private static IReadOnlyList<BillableTrendDto> BuildBillableTrend(DashboardContext context)
    {
        var approvedTimesheets = context.VisibleTimesheets.Where(item => IsApprovedStatus(item.RawStatus)).ToList();

        return BuildBuckets(context.Range)
            .Select(bucket => new BillableTrendDto(
                bucket.Label,
                approvedTimesheets.SelectMany(item => item.Rows).Sum(row => SumRowHours(row, bucket, billableOnly: true)),
                approvedTimesheets.SelectMany(item => item.Rows).Sum(row => SumRowHours(row, bucket, billableOnly: false))))
            .ToList();
    }

    private static IReadOnlyList<PayrollReadinessDto> BuildPayrollReadiness(DashboardContext context) =>
        BuildBuckets(context.Range)
            .Select(bucket => new PayrollReadinessDto(
                bucket.Label,
                Ready: context.VisibleTimesheets.Count(item => IsApprovedStatus(item.RawStatus) && BucketContains(bucket, item.UpdatedDate)),
                Pending: context.VisibleTimesheets.Count(item => IsSubmittedStatus(item.RawStatus) && BucketContains(bucket, item.UpdatedDate)),
                Blocked: context.VisibleTimesheets.Count(item => IsRejectedStatus(item.RawStatus) && BucketContains(bucket, item.UpdatedDate)),
                Exported: 0))
            .ToList();

    private static IReadOnlyList<CostTrendDto> BuildCostTrend(DashboardContext context)
    {
        var approvedTimesheets = context.VisibleTimesheets.Where(item => IsApprovedStatus(item.RawStatus)).ToList();

        return BuildBuckets(context.Range)
            .Select(bucket => new CostTrendDto(
                bucket.Label,
                approvedTimesheets.Sum(item => GetBucketCost(item, bucket))))
            .ToList();
    }

    private static IReadOnlyList<DepartmentHoursDto> BuildDepartmentHours(IReadOnlyList<FinanceTimesheetSnapshot> timesheets) =>
        timesheets
            .Where(item => IsApprovedStatus(item.RawStatus))
            .GroupBy(item => item.Employee.Department, StringComparer.OrdinalIgnoreCase)
            .Select(group => new DepartmentHoursDto(
                group.Key,
                group.Sum(item => item.TotalHours)))
            .OrderByDescending(item => item.ApprovedHours)
            .ToList();

    private static IReadOnlyList<ProjectBillableDto> BuildProjectBillable(IReadOnlyList<FinanceTimesheetSnapshot> timesheets) =>
        timesheets
            .Where(item => IsApprovedStatus(item.RawStatus))
            .SelectMany(item => item.Rows)
            .GroupBy(item => item.ProjectName, StringComparer.OrdinalIgnoreCase)
            .Select(group => new ProjectBillableDto(
                group.Key,
                group.Sum(item => item.TotalHours),
                group.Sum(item => item.Billable ? item.TotalHours : 0),
                group.Sum(item => item.EstimatedCost)))
            .OrderByDescending(item => item.BillableHours)
            .Take(8)
            .ToList();

    private static ComplianceDto BuildCompliance(DashboardContext context)
    {
        var submittedEmployeeIds = context.ScopedTimesheets
            .Where(item => !IsDraftStatus(item.RawStatus))
            .Select(item => item.Employee.Id)
            .ToHashSet();

        var lateEmployeeIds = context.ScopedTimesheets
            .Where(item => !IsDraftStatus(item.RawStatus) && !item.SubmittedOnTime)
            .Select(item => item.Employee.Id)
            .ToHashSet();

        var rejectedEmployeeIds = context.ScopedTimesheets
            .Where(item => IsRejectedStatus(item.RawStatus))
            .Select(item => item.Employee.Id)
            .ToHashSet();

        var missingCount = context.ExpectedEmployees.Count(item => !submittedEmployeeIds.Contains(item.Id));

        return new ComplianceDto(
            TotalEmployeesExpected: context.ExpectedEmployees.Count,
            SubmittedOnTime: submittedEmployeeIds.Except(lateEmployeeIds).Count(),
            LateSubmitted: lateEmployeeIds.Count,
            Missing: missingCount,
            RejectedForCorrection: rejectedEmployeeIds.Count);
    }

    private static IReadOnlyList<AlertDto> BuildAlerts(DashboardContext context)
    {
        var compliance = BuildCompliance(context);
        var alerts = new List<AlertDto>();
        var overdueApprovals = context.VisibleTimesheets.Count(item =>
            IsSubmittedStatus(item.RawStatus) &&
            item.Timesheet.UpdatedAtUtc < DateTime.UtcNow.AddDays(-2));

        if (overdueApprovals > 0)
        {
            alerts.Add(new AlertDto(
                "overdue-finance-approvals",
                "overdue_approvals",
                "Overdue finance approvals",
                $"{overdueApprovals} submitted timesheet{Pluralize(overdueApprovals)} have been waiting in the finance queue for more than 2 days.",
                overdueApprovals,
                "high",
                "/admin/timesheets/approved",
                "Open approved timesheets"));
        }

        var payrollBlockedItems = context.VisibleTimesheets.Count(item => IsRejectedStatus(item.RawStatus));
        if (payrollBlockedItems > 0)
        {
            alerts.Add(new AlertDto(
                "payroll-blocked-items",
                "payroll_blockers",
                "Payroll blockers",
                $"{payrollBlockedItems} rejected timesheet{Pluralize(payrollBlockedItems)} are preventing a clean payroll run.",
                payrollBlockedItems,
                "high",
                "/admin/payroll/timesheets",
                "Open payroll queue"));
        }

        if (compliance.Missing > 0)
        {
            alerts.Add(new AlertDto(
                "missing-submissions",
                "missing_submissions",
                "Missing submissions",
                $"{compliance.Missing} employee{Pluralize(compliance.Missing)} have not submitted time in the selected finance window.",
                compliance.Missing,
                "medium",
                "/admin/dashboard/finance",
                "Review compliance"));
        }

        var highOvertimeProjects = context.VisibleTimesheets
            .Where(item => IsApprovedStatus(item.RawStatus) && item.OvertimeHours > 0)
            .GroupBy(item => item.PrimaryProject, StringComparer.OrdinalIgnoreCase)
            .Count(group => group.Sum(item => item.OvertimeHours) >= DailyRegularHours);

        if (highOvertimeProjects > 0)
        {
            alerts.Add(new AlertDto(
                "high-overtime-projects",
                "high_overtime_projects",
                "High overtime exposure",
                $"{highOvertimeProjects} project{Pluralize(highOvertimeProjects)} crossed the high-overtime threshold in the selected period.",
                highOvertimeProjects,
                "medium",
                "/admin/payroll/timesheets",
                "Inspect payroll impact"));
        }

        var abnormalNonBillableProjects = BuildProjectBillable(context.VisibleTimesheets)
            .Count(item => item.ApprovedHours > 0 && ((item.ApprovedHours - item.BillableHours) / item.ApprovedHours) >= 0.45);

        if (abnormalNonBillableProjects > 0)
        {
            alerts.Add(new AlertDto(
                "non-billable-spike",
                "abnormal_non_billable_spike",
                "Non-billable spike detected",
                $"{abnormalNonBillableProjects} project{Pluralize(abnormalNonBillableProjects)} show unusually high non-billable effort for finance follow-up.",
                abnormalNonBillableProjects,
                "low",
                "/admin/reports/billing",
                "Open billing reports"));
        }

        if (alerts.Count == 0)
        {
            alerts.Add(new AlertDto(
                "finance-clear",
                "all_clear",
                "No major finance blockers",
                "No overdue approvals, missing submissions, or overtime spikes are visible in the current scope.",
                0,
                "low",
                "/admin/dashboard/finance",
                "Stay on dashboard"));
        }

        return alerts;
    }

    private static IReadOnlyList<FinanceRecordDto> BuildRecords(IReadOnlyList<FinanceTimesheetSnapshot> timesheets) =>
        timesheets
            .OrderByDescending(item => item.Timesheet.UpdatedAtUtc)
            .ThenByDescending(item => item.TotalHours)
            .Take(80)
            .Select(item => new FinanceRecordDto(
                item.Timesheet.Id.ToString(),
                item.Employee.FullName,
                item.Employee.Department,
                item.PrimaryProject,
                $"{item.Timesheet.WeekStart:dd MMM} - {item.Timesheet.WeekEnd:dd MMM}",
                item.TotalHours,
                item.BillableHours,
                item.NonBillableHours,
                item.ApprovalStatus,
                item.PayrollStatus,
                item.BillingStatus,
                item.OvertimeHours,
                item.Timesheet.UpdatedAtUtc.ToString("dd MMM yyyy", CultureInfo.InvariantCulture)))
            .ToList();

    private static FinanceTimesheetSnapshot CreateSnapshot(
        WeeklyTimesheetEntity timesheet,
        EmployeeEntity employee,
        (DateOnly Start, DateOnly End) dateRange)
    {
        var parsedRows = ParseRows(timesheet.RowsJson, dateRange);
        return CreateSnapshotCore(timesheet, employee, parsedRows);
    }

    private static FinanceTimesheetSnapshot? ApplyProjectFilter(FinanceTimesheetSnapshot snapshot, string? project)
    {
        if (string.IsNullOrWhiteSpace(project))
        {
            return snapshot;
        }

        var filteredRows = snapshot.Rows
            .Select(item => new ParsedFinanceRow(item.ProjectId, item.ProjectName, item.Billable, item.HoursByDate))
            .Where(item => MatchesProject(item, project))
            .ToList();

        return filteredRows.Count == 0
            ? null
            : CreateSnapshotCore(snapshot.Timesheet, snapshot.Employee, filteredRows);
    }

    private static FinanceTimesheetSnapshot CreateSnapshotCore(
        WeeklyTimesheetEntity timesheet,
        EmployeeEntity employee,
        IReadOnlyList<ParsedFinanceRow> parsedRows)
    {
        var payrollProfile = ResolvePayrollProfile(employee);
        var rows = parsedRows
            .Select(item => new FinanceRowSnapshot(
                item.ProjectId,
                item.ProjectName,
                item.Billable,
                item.HoursByDate,
                item.HoursByDate.Values.Sum(),
                (decimal)item.HoursByDate.Values.Sum() * payrollProfile.BaseRate))
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

        return new FinanceTimesheetSnapshot(
            timesheet,
            employee,
            rows,
            dailyTotals,
            totalHours,
            billableHours,
            rows.Where(item => !item.Billable).Sum(item => item.TotalHours),
            overtimeHours,
            (decimal)regularHours * payrollProfile.BaseRate + (decimal)overtimeHours * payrollProfile.OvertimeRate,
            GetPrimaryProject(rows),
            MapApprovalStatus(timesheet.Status),
            MapPayrollStatus(timesheet.Status),
            MapBillingStatus(timesheet.Status, billableHours),
            IsSubmittedOnTime(timesheet));
    }

    private static IReadOnlyList<ParsedFinanceRow> ParseRows(string rowsJson, (DateOnly Start, DateOnly End) dateRange)
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

            var rows = new List<ParsedFinanceRow>();

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

                rows.Add(new ParsedFinanceRow(
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

        var normalizedRole = RoleCatalog.NormalizeRole(employee.Role);
        if (normalizedRole == RoleCatalog.Employee)
        {
            return new PayrollProfile(baseRate, Math.Round(baseRate * 1.5m, 2));
        }

        var elevatedRate = Math.Round(baseRate * 1.25m, 2);
        return new PayrollProfile(elevatedRate, Math.Round(elevatedRate * 1.25m, 2));
    }

    private static decimal GetBucketCost(FinanceTimesheetSnapshot snapshot, DateBucket bucket)
    {
        var payrollProfile = ResolvePayrollProfile(snapshot.Employee);
        decimal bucketCost = 0;

        foreach (var dayTotal in snapshot.DailyTotals.Where(item => BucketContains(bucket, item.Key)))
        {
            var overtimeHours = Math.Max(dayTotal.Value - DailyRegularHours, 0);
            var regularHours = Math.Max(dayTotal.Value - overtimeHours, 0);

            bucketCost +=
                (decimal)regularHours * payrollProfile.BaseRate +
                (decimal)overtimeHours * payrollProfile.OvertimeRate;
        }

        return bucketCost;
    }

    private static double SumRowHours(FinanceRowSnapshot row, DateBucket bucket, bool billableOnly)
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

    private static bool IsSubmittedOnTime(WeeklyTimesheetEntity timesheet)
    {
        if (IsDraftStatus(timesheet.Status))
        {
            return false;
        }

        var dueDate = timesheet.WeekEnd.ToDateTime(TimeOnly.MinValue).AddDays(1);
        return timesheet.UpdatedAtUtc <= dueDate;
    }

    private static string GetPrimaryProject(IReadOnlyList<FinanceRowSnapshot> rows) =>
        rows.Count == 0
            ? "No project tagged"
            : rows
                .OrderByDescending(item => item.TotalHours)
                .ThenBy(item => item.ProjectName, StringComparer.OrdinalIgnoreCase)
                .First()
                .ProjectName;

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

    private static string MapBillingStatus(string status, double billableHours)
    {
        if (billableHours <= 0)
        {
            return "Non-billable";
        }

        return status.Trim().ToLowerInvariant() switch
        {
            "approved" => "Billing Ready",
            "rejected" => "Billing Blocked",
            _ => "Billable Pending"
        };
    }

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

    private static bool MatchesProject(FinanceRowSnapshot row, string project) =>
        string.Equals(row.ProjectId, project, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(row.ProjectName, project, StringComparison.OrdinalIgnoreCase);

    private static bool MatchesProject(ParsedFinanceRow row, string project) =>
        string.Equals(row.ProjectId, project, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(row.ProjectName, project, StringComparison.OrdinalIgnoreCase);

    private static bool MatchesFilter(string value, string? filter) =>
        string.IsNullOrWhiteSpace(filter) || string.Equals(value?.Trim(), filter, StringComparison.OrdinalIgnoreCase);

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

    private static string BuildRangeLabel((DateOnly Start, DateOnly End) dateRange) =>
        $"{dateRange.Start:dd MMM yyyy} - {dateRange.End:dd MMM yyyy}";

    private static int GetStatusSortOrder(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            "draft" => 0,
            "submitted" => 1,
            "approved" => 2,
            "rejected" => 3,
            _ => 10
        };

    private static string Pluralize(int count) => count == 1 ? string.Empty : "s";

    private static string? NormalizeFilterValue(string? value) =>
        string.IsNullOrWhiteSpace(value) || string.Equals(value, "all", StringComparison.OrdinalIgnoreCase)
            ? null
            : value.Trim();

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

    private sealed record DashboardContext(
        (DateOnly Start, DateOnly End) Range,
        IReadOnlyList<EmployeeEntity> ExpectedEmployees,
        IReadOnlyList<FinanceTimesheetSnapshot> ScopedTimesheets,
        IReadOnlyList<FinanceTimesheetSnapshot> VisibleTimesheets,
        FilterOptionsDto Filters,
        DashboardMetaDto Meta);

    private sealed record ParsedFinanceRow(
        string ProjectId,
        string ProjectName,
        bool Billable,
        IReadOnlyDictionary<DateOnly, double> HoursByDate);

    private sealed record FinanceRowSnapshot(
        string ProjectId,
        string ProjectName,
        bool Billable,
        IReadOnlyDictionary<DateOnly, double> HoursByDate,
        double TotalHours,
        decimal EstimatedCost);

    private sealed record FinanceTimesheetSnapshot(
        WeeklyTimesheetEntity Timesheet,
        EmployeeEntity Employee,
        IReadOnlyList<FinanceRowSnapshot> Rows,
        IReadOnlyDictionary<DateOnly, double> DailyTotals,
        double TotalHours,
        double BillableHours,
        double NonBillableHours,
        double OvertimeHours,
        decimal EstimatedPayrollCost,
        string PrimaryProject,
        string ApprovalStatus,
        string PayrollStatus,
        string BillingStatus,
        bool SubmittedOnTime)
    {
        public string RawStatus => Timesheet.Status;
        public DateOnly UpdatedDate => DateOnly.FromDateTime(Timesheet.UpdatedAtUtc);
    }

    private sealed record PayrollProfile(decimal BaseRate, decimal OvertimeRate);
    private sealed record DateBucket(DateOnly Start, DateOnly End, string Label);
}

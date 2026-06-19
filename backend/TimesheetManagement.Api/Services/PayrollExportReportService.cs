using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Common;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Security;
using System.Text;
using System.Xml;

namespace AbhiTimesheet.Api.Services;

public sealed class PayrollExportReportService(AppDbContext dbContext)
{
    private const string DetailQuery = """
        WITH PayrollDetail AS (
            SELECT
                wt.Id AS WeeklyTimesheetId,
                wt.UserId,
                COALESCE(employee.Id, wt.UserId) AS EmployeeId,
                employee.EmployeeCode,
                employee.FullName AS EmployeeName,
                employee.Email AS EmployeeEmail,
                employee.Role AS EmployeeRole,
                employee.Department,
                employee.Designation,
                wt.Status AS TimesheetStatus,
                wt.WeekStart,
                wt.WeekEnd,
                wt.UpdatedAtUtc,
                rowData.ProjectId,
                COALESCE(NULLIF(rowData.ProjectName, N''), project.Name, N'Unassigned') AS ProjectName,
                project.Code AS ProjectCode,
                project.ClientBusinessUnit,
                COALESCE(NULLIF(LTRIM(RTRIM(rowData.TaskName)), N''), N'No task name') AS TaskName,
                CASE WHEN rowData.Billable = 1 THEN N'Billable' ELSE N'Non-billable' END AS BillableLabel,
                CAST(rowData.Billable AS bit) AS IsBillable,
                TRY_CONVERT(date, hours.[key]) AS EntryDate,
                TRY_CONVERT(float, hours.value) AS EntryHours,
                COALESCE(NULLIF(JSON_VALUE(rowData.NotesByDateJson, CONCAT('$."', hours.[key], '"')), N''), NULLIF(rowData.Notes, N''), N'-') AS EntryNote
            FROM WeeklyTimesheets wt
            LEFT JOIN Employees employee ON employee.Id = wt.UserId
            CROSS APPLY OPENJSON(wt.RowsJson)
            WITH (
                ProjectId uniqueidentifier '$.projectId',
                ProjectName nvarchar(200) '$.projectName',
                TaskName nvarchar(200) '$.taskName',
                Notes nvarchar(max) '$.notes',
                NotesByDateJson nvarchar(max) '$.notesByDate' AS JSON,
                Billable bit '$.billable',
                HoursJson nvarchar(max) '$.hours' AS JSON
            ) rowData
            CROSS APPLY OPENJSON(rowData.HoursJson) hours
            LEFT JOIN Projects project ON project.Id = rowData.ProjectId
        )
        SELECT
            EmployeeId,
            EmployeeCode,
            EmployeeName,
            EmployeeEmail,
            EmployeeRole,
            Department,
            Designation,
            TimesheetStatus,
            CAST(WeekStart AS datetime) AS WeekStart,
            CAST(WeekEnd AS datetime) AS WeekEnd,
            CAST(EntryDate AS datetime) AS EntryDate,
            DATENAME(weekday, EntryDate) AS EntryDayName,
            ProjectCode,
            ProjectName,
            ClientBusinessUnit,
            TaskName,
            BillableLabel,
            CAST(EntryHours AS decimal(10,2)) AS EntryHours,
            EntryNote,
            UpdatedAtUtc
        FROM PayrollDetail
        WHERE EntryDate IS NOT NULL
          AND EntryHours IS NOT NULL
          AND EntryHours > 0
          AND (@StartDate IS NULL OR EntryDate >= @StartDate)
          AND (@EndDate IS NULL OR EntryDate <= @EndDate)
          AND (@ProjectFilter IS NULL OR @ProjectFilter = N'' OR @ProjectFilter = N'All'
               OR CONVERT(nvarchar(36), ProjectId) = @ProjectFilter
               OR ProjectCode = @ProjectFilter
               OR ProjectName = @ProjectFilter)
          AND (@EmployeeScope IS NULL OR @EmployeeScope = N'' OR EmployeeEmail IN (SELECT [value] FROM OPENJSON(@EmployeeScope)))
          AND (@StatusFilter IS NULL OR @StatusFilter = N'' OR @StatusFilter = N'All' OR TimesheetStatus = @StatusFilter)
          AND (@EmployeeFilter IS NULL OR @EmployeeFilter = N'' OR @EmployeeFilter = N'All' OR EmployeeEmail = @EmployeeFilter OR EmployeeName = @EmployeeFilter)
          AND (@BillableFilter IS NULL OR @BillableFilter = N'' OR @BillableFilter = N'All'
               OR (@BillableFilter = N'Billable' AND IsBillable = 1)
               OR (@BillableFilter = N'Non-billable' AND IsBillable = 0))
          AND (@SearchTerm IS NULL OR LTRIM(RTRIM(@SearchTerm)) = N''
               OR (CONCAT(ISNULL(EmployeeName,N''), N' ', ISNULL(EmployeeEmail,N''), N' ', ISNULL(ProjectName,N''), N' ', ISNULL(TaskName,N''), N' ', ISNULL(EntryNote,N'')) COLLATE DATABASE_DEFAULT)
                  LIKE ((N'%' + LTRIM(RTRIM(@SearchTerm)) + N'%') COLLATE DATABASE_DEFAULT))
        ORDER BY EntryDate, EmployeeName, ProjectName, TaskName;
        """;

    public async Task<PayrollExportReport> BuildReportAsync(PayrollExportFilter filter, CancellationToken cancellationToken)
    {
        var connectionString = dbContext.Database.GetDbConnection().ConnectionString;
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = DetailQuery;
        command.Parameters.Add(new SqlParameter("@StartDate", filter.StartDate.ToDateTime(TimeOnly.MinValue)));
        command.Parameters.Add(new SqlParameter("@EndDate", filter.EndDate.ToDateTime(TimeOnly.MinValue)));
        command.Parameters.Add(new SqlParameter("@ProjectFilter", string.IsNullOrWhiteSpace(filter.ProjectFilter) ? "All" : filter.ProjectFilter.Trim()));
        command.Parameters.Add(new SqlParameter("@EmployeeScope", string.IsNullOrWhiteSpace(filter.EmployeeScope) ? DBNull.Value : filter.EmployeeScope.Trim()));
        command.Parameters.Add(new SqlParameter("@StatusFilter", string.IsNullOrWhiteSpace(filter.StatusFilter) ? "All" : filter.StatusFilter.Trim()));
        command.Parameters.Add(new SqlParameter("@EmployeeFilter", string.IsNullOrWhiteSpace(filter.EmployeeFilter) ? "All" : filter.EmployeeFilter.Trim()));
        command.Parameters.Add(new SqlParameter("@BillableFilter", string.IsNullOrWhiteSpace(filter.BillableFilter) ? "All" : filter.BillableFilter.Trim()));
        command.Parameters.Add(new SqlParameter("@SearchTerm", filter.SearchTerm?.Trim() ?? string.Empty));

        var rows = new List<PayrollExportRow>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var employeeId = reader.GetGuid(reader.GetOrdinal("EmployeeId"));
            var department = GetStringOrEmpty(reader, "Department");
            var employeeRole = GetStringOrEmpty(reader, "EmployeeRole");
            var entryHours = reader.GetDecimal(reader.GetOrdinal("EntryHours"));
            var payrollProfile = ResolvePayrollProfile(department, employeeRole);

            rows.Add(new PayrollExportRow(
                EmployeeId: employeeId,
                EmployeeCode: GetStringOrEmpty(reader, "EmployeeCode"),
                EmployeeName: GetStringOrEmpty(reader, "EmployeeName"),
                EmployeeEmail: GetStringOrEmpty(reader, "EmployeeEmail"),
                EmployeeRole: employeeRole,
                Department: department,
                Designation: GetStringOrEmpty(reader, "Designation"),
                TimesheetStatus: GetStringOrEmpty(reader, "TimesheetStatus"),
                WeekStart: DateOnly.FromDateTime(reader.GetDateTime(reader.GetOrdinal("WeekStart"))),
                WeekEnd: DateOnly.FromDateTime(reader.GetDateTime(reader.GetOrdinal("WeekEnd"))),
                EntryDate: DateOnly.FromDateTime(reader.GetDateTime(reader.GetOrdinal("EntryDate"))),
                EntryDayName: GetStringOrEmpty(reader, "EntryDayName"),
                ProjectCode: GetStringOrEmpty(reader, "ProjectCode"),
                ProjectName: GetStringOrEmpty(reader, "ProjectName"),
                ClientBusinessUnit: GetStringOrEmpty(reader, "ClientBusinessUnit"),
                TaskName: GetStringOrEmpty(reader, "TaskName"),
                BillableLabel: GetStringOrEmpty(reader, "BillableLabel"),
                EntryHours: entryHours,
                EntryNote: GetStringOrEmpty(reader, "EntryNote"),
                SalaryAmount: entryHours * payrollProfile.BaseRate,
                LeaveLabel: string.Empty,
                LeaveDays: 0m,
                UpdatedAtUtc: reader.GetDateTime(reader.GetOrdinal("UpdatedAtUtc"))));
        }

        var leaves = await LoadApprovedLeavesAsync(rows, filter, cancellationToken);
        var rowsWithLeaves = ApplyLeaveLabels(rows, leaves);
        var reportRows = AddLeaveOnlyRows(rowsWithLeaves, leaves, filter);

        return new PayrollExportReport(filter, BuildSummary(reportRows), reportRows, BuildEmployeeSummaries(reportRows, leaves, filter));
    }

    public PayrollExportReport BuildReportFromSnapshot(PayrollExportFilter filter, IReadOnlyList<PayrollExportSnapshotRow> snapshotRows)
    {
        var rows = snapshotRows
            .Select(MapSnapshotRow)
            .OrderBy(row => row.EntryDate)
            .ThenBy(row => row.EmployeeName)
            .ThenBy(row => row.ProjectName)
            .ThenBy(row => row.TaskName)
            .ToList();

        return new PayrollExportReport(filter, BuildSummary(rows), rows, BuildEmployeeSummaries(rows, [], filter));
    }

    public string RenderHtml(PayrollExportReport report)
    {
        var resultRange = report.Summary.RangeStart is null || report.Summary.RangeEnd is null
            ? "No rows"
            : $"{report.Summary.RangeStart:dd/MMM/yy} - {report.Summary.RangeEnd:dd/MMM/yy}";
        var html = new StringBuilder();
        html.AppendLine("<!DOCTYPE html>");
        html.AppendLine("<html lang=\"en\">");
        html.AppendLine("<head>");
        html.AppendLine("<meta charset=\"utf-8\" />");
        html.AppendLine("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />");
        html.AppendLine("<title>Payroll Export</title>");
        html.AppendLine("""
            <style>
            html,body{margin:0;padding:0;width:100%;min-height:100%;background:#d4d8dd;color:#0f172a;font-family:'Segoe UI',Tahoma,sans-serif;}
            body{padding:0;overflow-x:hidden;}
            .viewer-stage{display:block;width:100%;}
            .report-page{width:100%;min-width:0;background:#fff;border:0;box-shadow:none;}
            .page-header{padding:30px 34px 18px;border-bottom:1px solid #d9e1ea;}
            .branding{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;}
            .brand-mark{display:flex;align-items:center;gap:18px;}
            .monogram{display:flex;align-items:center;justify-content:center;width:96px;height:72px;border:2px solid #0f172a;font-size:34px;font-weight:800;letter-spacing:.08em;}
            .brand-copy h1{margin:0;font-size:32px;letter-spacing:.04em;text-transform:uppercase;}
            .brand-copy p{margin:6px 0 0;font-size:13px;color:#64748b;letter-spacing:.16em;text-transform:uppercase;}
            .period-chip{min-width:280px;border:1px solid #d6deea;background:#f7fafc;padding:14px 16px;border-radius:16px;}
            .period-chip span{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.18em;color:#64748b;}
            .period-chip strong{display:block;margin-top:8px;font-size:18px;color:#0f172a;}
            .meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px;}
            .meta-card{border:1px solid #d6deea;background:#f8fafc;border-radius:14px;padding:14px 16px;}
            .meta-card span{display:block;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#64748b;}
            .meta-card strong{display:block;margin-top:8px;font-size:17px;color:#0f172a;}
            .filters-line{padding:14px 34px;background:#eef4fb;border-top:1px solid #d6deea;border-bottom:1px solid #d6deea;font-size:12px;line-height:1.7;color:#334155;}
            .filters-line strong{margin-right:8px;text-transform:uppercase;letter-spacing:.18em;font-size:11px;color:#475569;}
            .report-table-wrap{padding:22px 22px 28px;overflow-x:auto;}
            .report-table{width:100%;min-width:1120px;border-collapse:collapse;font-size:13px;}
            .employee-detail strong{display:block;font-size:13px;color:#0f172a;}
            .employee-detail span{display:block;margin-top:4px;font-size:11px;color:#64748b;line-height:1.35;}
            .report-table thead tr.group-row th{background:#e4edf8;border:1px solid #ccd7e6;padding:10px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#475569;text-align:center;}
            .report-table thead tr.header-row th{background:#f8fafc;border:1px solid #d9e1ea;padding:11px 10px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#475569;text-align:left;}
            .report-table tbody td{border:1px solid #e2e8f0;padding:10px;vertical-align:top;color:#0f172a;background:#fff;}
            .report-table tbody tr:nth-child(even) td{background:#fbfdff;}
            .report-table tfoot td{border:1px solid #cbd5e1;padding:12px 10px;font-weight:700;background:#eef4fb;color:#0f172a;}
            .center{text-align:center;}
            .number{text-align:right;font-variant-numeric:tabular-nums;}
            .small{font-size:12px;color:#64748b;}
            .empty-state{padding:90px 28px;text-align:center;color:#64748b;font-size:14px;}
            mark.ssrs-highlight{background:#fff3a3;color:#111827;padding:0 2px;border-radius:2px;}
            @media print{body{background:#fff;padding:0;zoom:100% !important;} .report-page{border:none;box-shadow:none;width:auto;}}
            </style>
            """);
        html.AppendLine("</head>");
        html.AppendLine("<body>");
        html.AppendLine("<div class=\"viewer-stage\">");
        html.AppendLine("<article class=\"report-page\" id=\"reportPage\">");
        html.AppendLine("<header class=\"page-header\">");
        html.AppendLine("<div class=\"branding\">");
        html.AppendLine("<div class=\"brand-mark\">");
        html.AppendLine($"<div class=\"monogram\">{BrandingConstants.BrandShort}</div>");
        html.AppendLine("<div class=\"brand-copy\">");
        html.AppendLine($"<h1>{BrandingConstants.BrandName}</h1>");
        html.AppendLine("<p>Payroll Export Statement</p>");
        html.AppendLine("</div>");
        html.AppendLine("</div>");
        html.AppendLine("<div class=\"period-chip\">");
        html.AppendLine("<span>Applied Range</span>");
        html.Append("<strong>");
        html.Append(WebUtility.HtmlEncode($"{report.Filter.StartDate:dd/MMM/yy} - {report.Filter.EndDate:dd/MMM/yy}"));
        html.AppendLine("</strong>");
        html.AppendLine("</div>");
        html.AppendLine("</div>");
        html.AppendLine("<section class=\"meta-grid\">");
        AppendHtmlStatCard(html, "Project", report.Filter.ProjectLabel);
        AppendHtmlStatCard(html, "Visible Entries", report.Summary.VisibleEntries.ToString(CultureInfo.InvariantCulture));
        AppendHtmlStatCard(html, "Visible Hours", report.Summary.VisibleHours.ToString("0.00", CultureInfo.InvariantCulture));
        AppendHtmlStatCard(html, "Employees", report.Summary.Employees.ToString(CultureInfo.InvariantCulture));
        AppendHtmlStatCard(html, "Submitted Rows", report.Summary.SubmittedRows.ToString(CultureInfo.InvariantCulture));
        AppendHtmlStatCard(html, "Result Range", resultRange);
        html.AppendLine("</section>");
        html.AppendLine("</header>");
        html.AppendLine("<div class=\"filters-line\"><strong>Filters</strong>");
        html.Append(WebUtility.HtmlEncode(report.FiltersSummary));
        html.AppendLine("</div>");
        html.AppendLine("<section class=\"report-table-wrap\">");

        if (report.Rows.Count == 0)
        {
            html.AppendLine("<div class=\"empty-state\">No records match the selected filters.</div>");
        }
        else
        {
            html.AppendLine("<table class=\"report-table\">");
            html.AppendLine("<thead>");
            if (report.IsEmployeeSummaryMode)
            {
                html.AppendLine("<tr class=\"group-row\"><th colspan=\"1\">Employee</th><th colspan=\"2\">Approval</th><th colspan=\"4\">Work Summary</th><th colspan=\"2\">Payroll</th><th colspan=\"1\">Audit</th></tr>");
                html.AppendLine("<tr class=\"header-row\"><th>Employee Detail</th><th>Status</th><th>Projects</th><th class=\"number\">Entries</th><th class=\"number\">Hours</th><th class=\"number\">Billable</th><th class=\"number\">Non-billable</th><th class=\"number\">Salary</th><th>Leave</th><th>Updated</th></tr>");
            }
            else
            {
                html.AppendLine("<tr class=\"group-row\"><th colspan=\"1\">Entry</th><th colspan=\"1\">Employee</th><th colspan=\"1\">Approval</th><th colspan=\"3\">Project Allocation</th><th colspan=\"2\">Work Output</th><th colspan=\"2\">Payroll</th><th colspan=\"1\">Audit</th></tr>");
                html.AppendLine("<tr class=\"header-row\"><th>Date</th><th>Employee Detail</th><th>Status</th><th>Project</th><th>Task</th><th>Billable</th><th class=\"number\">Hours</th><th>Note</th><th class=\"number\">Salary</th><th>Leave</th><th>Updated</th></tr>");
            }

            html.AppendLine("</thead>");
            html.AppendLine("<tbody>");

            if (report.IsEmployeeSummaryMode)
            {
                foreach (var row in report.EmployeeSummaries)
                {
                    html.AppendLine("<tr>");
                    AppendEmployeeDetailCell(html, row.EmployeeName, row.EmployeeCode, row.EmployeeEmail, row.Designation, row.Department);
                    AppendReportCell(html, row.Statuses, "center");
                    AppendReportCell(html, row.Projects);
                    AppendReportCell(html, row.Entries.ToString(CultureInfo.InvariantCulture), "number");
                    AppendReportCell(html, row.TotalHours.ToString("0.00", CultureInfo.InvariantCulture), "number");
                    AppendReportCell(html, row.BillableHours.ToString("0.00", CultureInfo.InvariantCulture), "number");
                    AppendReportCell(html, row.NonBillableHours.ToString("0.00", CultureInfo.InvariantCulture), "number");
                    AppendReportCell(html, FormatMoney(row.SalaryAmount), "number");
                    AppendReportCell(html, row.LeaveSummary);
                    AppendReportCell(html, row.UpdatedAtUtc.ToLocalTime().ToString("dd/MMM/yy HH:mm", CultureInfo.InvariantCulture));
                    html.AppendLine("</tr>");
                }
            }
            else
            {
                foreach (var row in report.Rows)
                {
                    html.AppendLine("<tr>");
                    AppendReportCell(html, row.EntryDate.ToString("dd/MMM/yy", CultureInfo.InvariantCulture));
                    AppendEmployeeDetailCell(html, row.EmployeeName, row.EmployeeCode, row.EmployeeEmail, row.Designation, row.Department);
                    AppendReportCell(html, row.TimesheetStatus, "center");
                    AppendReportCell(
                        html,
                        string.IsNullOrWhiteSpace(row.ProjectCode) ? row.ProjectName : $"{row.ProjectName} ({row.ProjectCode})");
                    AppendReportCell(html, row.TaskName);
                    AppendReportCell(html, row.BillableLabel, "center");
                    AppendReportCell(html, row.EntryHours.ToString("0.00", CultureInfo.InvariantCulture), "number");
                    AppendReportCell(html, row.EntryNote);
                    AppendReportCell(html, FormatMoney(row.SalaryAmount), "number");
                    AppendReportCell(html, row.LeaveLabel);
                    AppendReportCell(html, row.UpdatedAtUtc.ToLocalTime().ToString("dd/MMM/yy HH:mm", CultureInfo.InvariantCulture));
                    html.AppendLine("</tr>");
                }
            }

            html.AppendLine("</tbody>");
            html.AppendLine("<tfoot>");
            html.AppendLine("<tr>");
            html.Append(report.IsEmployeeSummaryMode ? "<td colspan=\"4\">" : "<td colspan=\"6\">");
            html.AppendLine("Total visible hours</td>");
            html.Append("<td class=\"number\">");
            html.Append(WebUtility.HtmlEncode(report.Summary.VisibleHours.ToString("0.00", CultureInfo.InvariantCulture)));
            html.AppendLine("</td>");
            html.Append(report.IsEmployeeSummaryMode ? "<td colspan=\"5\">" : "<td colspan=\"4\">");
            html.Append(WebUtility.HtmlEncode($"{report.Summary.VisibleEntries} entries across {report.Summary.Employees} employees"));
            html.AppendLine("</td>");
            html.AppendLine("</tr>");
            html.AppendLine("<tr>");
            html.Append(report.IsEmployeeSummaryMode ? "<td colspan=\"7\">" : "<td colspan=\"8\">");
            html.AppendLine("Total salary</td>");
            html.Append("<td class=\"number\">");
            html.Append(WebUtility.HtmlEncode(FormatMoney(GetReportSalaryTotal(report))));
            html.AppendLine("</td>");
            html.Append("<td colspan=\"2\">");
            html.Append(WebUtility.HtmlEncode("Leave days: " + FormatNumber(GetReportLeaveTotal(report))));
            html.AppendLine("</td>");
            html.AppendLine("</tr>");
            html.AppendLine("</tfoot>");
            html.AppendLine("</table>");
        }

        html.AppendLine("</section>");
        html.AppendLine("</article>");
        html.AppendLine("</div>");
        html.AppendLine("""
            <script>
            (function () {
              const channel = "ssrs-payroll-viewer";
              const reportRoot = document.getElementById("reportPage");
              let lastPageInfo = { currentPage: 1, totalPages: 1 };

              function getPageMetrics() {
                const viewportHeight = Math.max(window.innerHeight || 1, 1);
                const reportHeight = reportRoot ? reportRoot.getBoundingClientRect().height : 0;
                const documentHeight = Math.max(
                  document.body.scrollHeight,
                  document.documentElement.scrollHeight,
                  reportHeight,
                  viewportHeight
                );
                const totalPages = Math.max(1, Math.ceil(documentHeight / viewportHeight));
                const currentPage = Math.min(totalPages, Math.max(1, Math.floor(window.scrollY / viewportHeight) + 1));
                return { currentPage, totalPages, viewportHeight };
              }

              function publishPageInfo(force) {
                const metrics = getPageMetrics();
                if (
                  force ||
                  metrics.currentPage !== lastPageInfo.currentPage ||
                  metrics.totalPages !== lastPageInfo.totalPages
                ) {
                  lastPageInfo = { currentPage: metrics.currentPage, totalPages: metrics.totalPages };
                  window.parent.postMessage({ channel, type: "pageInfo", currentPage: metrics.currentPage, totalPages: metrics.totalPages }, "*");
                }
              }

              function goToPage(page) {
                const metrics = getPageMetrics();
                const targetPage = Math.min(Math.max(Number(page) || 1, 1), metrics.totalPages);
                window.scrollTo({ top: (targetPage - 1) * metrics.viewportHeight, behavior: "smooth" });
                window.setTimeout(() => publishPageInfo(true), 250);
              }

              function unwrapHighlights() {
                document.querySelectorAll("mark.ssrs-highlight").forEach((mark) => {
                  const parent = mark.parentNode;
                  if (!parent) {
                    return;
                  }

                  parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
                  parent.normalize();
                });
              }

              function collectTextNodes() {
                const nodes = [];
                const walker = document.createTreeWalker(reportRoot, NodeFilter.SHOW_TEXT, {
                  acceptNode(node) {
                    if (!node.nodeValue || !node.nodeValue.trim()) {
                      return NodeFilter.FILTER_REJECT;
                    }

                    const parent = node.parentElement;
                    if (!parent || parent.closest("script,style,mark")) {
                      return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                  }
                });

                while (walker.nextNode()) {
                  nodes.push(walker.currentNode);
                }

                return nodes;
              }

              function escapeRegExp(value) {
                return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              }

              function highlightSearch(term) {
                unwrapHighlights();
                const normalized = (term || "").trim();
                if (!normalized) {
                  window.parent.postMessage({ channel, type: "findResult", count: 0 }, "*");
                  return;
                }

                const regex = new RegExp(escapeRegExp(normalized), "gi");
                const matches = [];

                collectTextNodes().forEach((node) => {
                  const text = node.nodeValue || "";
                  regex.lastIndex = 0;

                  let lastIndex = 0;
                  let match = regex.exec(text);
                  if (!match) {
                    return;
                  }

                  const fragment = document.createDocumentFragment();
                  while (match) {
                    if (match.index > lastIndex) {
                      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                    }

                    const mark = document.createElement("mark");
                    mark.className = "ssrs-highlight";
                    mark.textContent = match[0];
                    fragment.appendChild(mark);
                    matches.push(mark);

                    lastIndex = match.index + match[0].length;
                    match = regex.exec(text);
                  }

                  if (lastIndex < text.length) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
                  }

                  node.parentNode.replaceChild(fragment, node);
                });

                if (matches.length > 0) {
                  matches[0].scrollIntoView({ block: "center", behavior: "smooth" });
                }

                window.parent.postMessage({ channel, type: "findResult", count: matches.length }, "*");
              }

              function applyZoom(percent) {
                const numeric = Number(percent);
                if (!Number.isFinite(numeric) || numeric <= 0) {
                  return;
                }

                document.body.style.zoom = numeric + "%";
              }

              window.addEventListener("message", (event) => {
                const data = event.data;
                if (!data || data.channel !== channel) {
                  return;
                }

                switch (data.type) {
                  case "setZoom":
                    applyZoom(data.zoom);
                    break;
                  case "find":
                    highlightSearch(typeof data.term === "string" ? data.term : "");
                    break;
                  case "print":
                    window.print();
                    break;
                  case "goToPage":
                    goToPage(data.page);
                    break;
                  default:
                    break;
                }
              });

              window.addEventListener("scroll", () => publishPageInfo(false), { passive: true });
              window.addEventListener("resize", () => publishPageInfo(true));
              window.parent.postMessage({ channel, type: "ready" }, "*");
              applyZoom(100);
              window.requestAnimationFrame(() => publishPageInfo(true));
            }());
            </script>
            """);
        html.AppendLine("</body>");
        html.AppendLine("</html>");
        return html.ToString();
    }

    public byte[] RenderCsv(PayrollExportReport report)
    {
        var csv = new StringBuilder();
        csv.AppendLine("sep=,");

        if (report.IsEmployeeSummaryMode)
        {
            csv.AppendLine("Employee Detail,Employee Code,Employee,Employee Email,Department,Designation,Status,Projects,Entries,Total Hours,Billable Hours,Non-billable Hours,Salary,Leave Days,Leave Summary,Updated At");

            foreach (var row in report.EmployeeSummaries)
            {
                csv.AppendLine(string.Join(",",
                    EscapeCsv(BuildPlainEmployeeDetail(row.EmployeeName, row.EmployeeCode, row.Designation, row.Department, row.EmployeeEmail)),
                    EscapeCsv(row.EmployeeCode),
                    EscapeCsv(row.EmployeeName),
                    EscapeCsv(row.EmployeeEmail),
                    EscapeCsv(row.Department),
                    EscapeCsv(row.Designation),
                    EscapeCsv(row.Statuses),
                    EscapeCsv(row.Projects),
                    row.Entries.ToString(CultureInfo.InvariantCulture),
                    row.TotalHours.ToString("0.00", CultureInfo.InvariantCulture),
                    row.BillableHours.ToString("0.00", CultureInfo.InvariantCulture),
                    row.NonBillableHours.ToString("0.00", CultureInfo.InvariantCulture),
                    row.SalaryAmount.ToString("0.00", CultureInfo.InvariantCulture),
                    row.LeaveDays.ToString("0.##", CultureInfo.InvariantCulture),
                    EscapeCsv(row.LeaveSummary),
                    EscapeCsv(row.UpdatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture))));
            }
        }
        else
        {
            csv.AppendLine("Entry Date,Day,Employee Detail,Employee Code,Employee,Employee Email,Department,Designation,Status,Week Start,Week End,Project Code,Project Name,Client Business Unit,Task,Billable,Hours,Salary,Leave Days,Leave,Note,Updated At");

            foreach (var row in report.Rows)
            {
                csv.AppendLine(string.Join(",",
                    EscapeCsv(row.EntryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                    EscapeCsv(row.EntryDayName),
                    EscapeCsv(BuildPlainEmployeeDetail(row.EmployeeName, row.EmployeeCode, row.Designation, row.Department, row.EmployeeEmail)),
                    EscapeCsv(row.EmployeeCode),
                    EscapeCsv(row.EmployeeName),
                    EscapeCsv(row.EmployeeEmail),
                    EscapeCsv(row.Department),
                    EscapeCsv(row.Designation),
                    EscapeCsv(row.TimesheetStatus),
                    EscapeCsv(row.WeekStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                    EscapeCsv(row.WeekEnd.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                    EscapeCsv(row.ProjectCode),
                    EscapeCsv(row.ProjectName),
                    EscapeCsv(row.ClientBusinessUnit),
                    EscapeCsv(row.TaskName),
                    EscapeCsv(row.BillableLabel),
                    row.EntryHours.ToString("0.00", CultureInfo.InvariantCulture),
                    row.SalaryAmount.ToString("0.00", CultureInfo.InvariantCulture),
                    row.LeaveDays.ToString("0.##", CultureInfo.InvariantCulture),
                    EscapeCsv(row.LeaveLabel),
                    EscapeCsv(row.EntryNote),
                    EscapeCsv(row.UpdatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture))));
            }
        }

        var encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);
        return encoding.GetPreamble().Concat(encoding.GetBytes(csv.ToString())).ToArray();
    }

    public byte[] RenderXml(PayrollExportReport report)
    {
        using var stream = new MemoryStream();
        var settings = new XmlWriterSettings
        {
            Encoding = new UTF8Encoding(false),
            Indent = true
        };

        using (var writer = XmlWriter.Create(stream, settings))
        {
            writer.WriteStartDocument();
            writer.WriteStartElement("payrollExport");
            writer.WriteAttributeString("generatedAtUtc", DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture));
            writer.WriteAttributeString("mode", report.IsEmployeeSummaryMode ? "employee-summary" : "daily-detail");

            writer.WriteStartElement("filters");
            writer.WriteElementString("startDate", report.Filter.StartDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            writer.WriteElementString("endDate", report.Filter.EndDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            writer.WriteElementString("projectFilter", report.Filter.ProjectFilter);
            writer.WriteElementString("projectLabel", report.Filter.ProjectLabel);
            writer.WriteElementString("statusFilter", report.Filter.StatusFilter);
            writer.WriteElementString("employeeFilter", report.Filter.EmployeeFilter);
            writer.WriteElementString("billableFilter", report.Filter.BillableFilter);
            writer.WriteElementString("searchTerm", report.Filter.SearchTerm);
            writer.WriteElementString("employeeScope", report.Filter.EmployeeScope);
            writer.WriteEndElement();

            writer.WriteStartElement("summary");
            writer.WriteElementString("visibleEntries", report.Summary.VisibleEntries.ToString(CultureInfo.InvariantCulture));
            writer.WriteElementString("visibleHours", report.Summary.VisibleHours.ToString("0.00", CultureInfo.InvariantCulture));
            writer.WriteElementString("employees", report.Summary.Employees.ToString(CultureInfo.InvariantCulture));
            writer.WriteElementString("submittedRows", report.Summary.SubmittedRows.ToString(CultureInfo.InvariantCulture));
            writer.WriteElementString("projects", report.Summary.Projects.ToString(CultureInfo.InvariantCulture));
            writer.WriteElementString("rangeStart", report.Summary.RangeStart?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty);
            writer.WriteElementString("rangeEnd", report.Summary.RangeEnd?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty);
            writer.WriteEndElement();

            if (report.IsEmployeeSummaryMode)
            {
                writer.WriteStartElement("employeeSummaries");
                foreach (var row in report.EmployeeSummaries)
                {
                    writer.WriteStartElement("employeeSummary");
                    writer.WriteElementString("employeeCode", row.EmployeeCode);
                    writer.WriteElementString("employeeName", row.EmployeeName);
                    writer.WriteElementString("employeeEmail", row.EmployeeEmail);
                    writer.WriteElementString("department", row.Department);
                    writer.WriteElementString("designation", row.Designation);
                    writer.WriteElementString("statuses", row.Statuses);
                    writer.WriteElementString("projects", row.Projects);
                    writer.WriteElementString("entries", row.Entries.ToString(CultureInfo.InvariantCulture));
                    writer.WriteElementString("totalHours", row.TotalHours.ToString("0.00", CultureInfo.InvariantCulture));
                    writer.WriteElementString("billableHours", row.BillableHours.ToString("0.00", CultureInfo.InvariantCulture));
                    writer.WriteElementString("nonBillableHours", row.NonBillableHours.ToString("0.00", CultureInfo.InvariantCulture));
                    writer.WriteElementString("salaryAmount", row.SalaryAmount.ToString("0.00", CultureInfo.InvariantCulture));
                    writer.WriteElementString("leaveDays", row.LeaveDays.ToString("0.##", CultureInfo.InvariantCulture));
                    writer.WriteElementString("leaveSummary", row.LeaveSummary);
                    writer.WriteElementString("updatedAtUtc", row.UpdatedAtUtc.ToString("O", CultureInfo.InvariantCulture));
                    writer.WriteEndElement();
                }

                writer.WriteEndElement();
            }
            else
            {
                writer.WriteStartElement("entries");
                foreach (var row in report.Rows)
                {
                    writer.WriteStartElement("entry");
                    writer.WriteElementString("entryDate", row.EntryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                    writer.WriteElementString("entryDayName", row.EntryDayName);
                    writer.WriteElementString("employeeCode", row.EmployeeCode);
                    writer.WriteElementString("employeeName", row.EmployeeName);
                    writer.WriteElementString("employeeEmail", row.EmployeeEmail);
                    writer.WriteElementString("department", row.Department);
                    writer.WriteElementString("designation", row.Designation);
                    writer.WriteElementString("timesheetStatus", row.TimesheetStatus);
                    writer.WriteElementString("weekStart", row.WeekStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                    writer.WriteElementString("weekEnd", row.WeekEnd.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                    writer.WriteElementString("projectCode", row.ProjectCode);
                    writer.WriteElementString("projectName", row.ProjectName);
                    writer.WriteElementString("clientBusinessUnit", row.ClientBusinessUnit);
                    writer.WriteElementString("taskName", row.TaskName);
                    writer.WriteElementString("billableLabel", row.BillableLabel);
                    writer.WriteElementString("entryHours", row.EntryHours.ToString("0.00", CultureInfo.InvariantCulture));
                    writer.WriteElementString("salaryAmount", row.SalaryAmount.ToString("0.00", CultureInfo.InvariantCulture));
                    writer.WriteElementString("leaveDays", row.LeaveDays.ToString("0.##", CultureInfo.InvariantCulture));
                    writer.WriteElementString("leaveLabel", row.LeaveLabel);
                    writer.WriteElementString("entryNote", row.EntryNote);
                    writer.WriteElementString("updatedAtUtc", row.UpdatedAtUtc.ToString("O", CultureInfo.InvariantCulture));
                    writer.WriteEndElement();
                }

                writer.WriteEndElement();
            }

            writer.WriteEndElement();
            writer.WriteEndDocument();
        }

        return stream.ToArray();
    }

    public byte[] RenderXlsx(PayrollExportReport report)
    {
        var summaryRows = new List<IReadOnlyList<SpreadsheetCell>>
        {
            new[] { SpreadsheetCell.Text("Metric"), SpreadsheetCell.Text("Value") },
            new[] { SpreadsheetCell.Text("Filters"), SpreadsheetCell.Text(report.FiltersSummary) },
            new[] { SpreadsheetCell.Text("Visible Entries"), SpreadsheetCell.Number(report.Summary.VisibleEntries) },
            new[] { SpreadsheetCell.Text("Visible Hours"), SpreadsheetCell.Number(report.Summary.VisibleHours) },
            new[] { SpreadsheetCell.Text("Employees"), SpreadsheetCell.Number(report.Summary.Employees) },
            new[] { SpreadsheetCell.Text("Submitted Rows"), SpreadsheetCell.Number(report.Summary.SubmittedRows) },
            new[] { SpreadsheetCell.Text("Projects"), SpreadsheetCell.Number(report.Summary.Projects) },
            new[] { SpreadsheetCell.Text("Total Salary"), SpreadsheetCell.Number(GetReportSalaryTotal(report)) },
            new[] { SpreadsheetCell.Text("Leave Days"), SpreadsheetCell.Number(GetReportLeaveTotal(report)) },
            new[] { SpreadsheetCell.Text("Range Start"), SpreadsheetCell.Text(report.Summary.RangeStart?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty) },
            new[] { SpreadsheetCell.Text("Range End"), SpreadsheetCell.Text(report.Summary.RangeEnd?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty) }
        };

        var detailRows = report.IsEmployeeSummaryMode
            ? BuildEmployeeSummarySpreadsheetRows(report)
            : BuildDailyDetailSpreadsheetRows(report);

        return BuildSpreadsheetPackage(new[]
        {
            new SpreadsheetSheet("Summary", summaryRows),
            new SpreadsheetSheet(report.IsEmployeeSummaryMode ? "Employee Summary" : "Daily Detail", detailRows)
        });
    }

    public byte[] RenderDocx(PayrollExportReport report)
    {
        using var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            WriteZipEntry(archive, "[Content_Types].xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                </Types>
                """);

            WriteZipEntry(archive, "_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
                </Relationships>
                """);

            var document = new StringBuilder();
            document.AppendLine("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""");
            document.AppendLine("""<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">""");
            document.AppendLine("<w:body>");
            AppendWordParagraph(document, "Payroll Export", bold: true, fontSizeHalfPoints: 30);
            AppendWordParagraph(document, report.FiltersSummary);
            AppendWordParagraph(document, $"Visible Entries: {report.Summary.VisibleEntries} | Visible Hours: {report.Summary.VisibleHours:0.00} | Employees: {report.Summary.Employees} | Submitted Rows: {report.Summary.SubmittedRows} | Projects: {report.Summary.Projects}");
            AppendWordParagraph(document, $"Total Salary: {FormatMoney(GetReportSalaryTotal(report))} | Leave Days: {FormatNumber(GetReportLeaveTotal(report))}");

            document.AppendLine("<w:tbl>");
            document.AppendLine("<w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/></w:tblPr>");

            if (report.IsEmployeeSummaryMode)
            {
                AppendWordTableRow(document, new[] { "Employee Detail", "Status", "Projects", "Entries", "Hours", "Salary", "Leave" }, header: true);
                foreach (var row in report.EmployeeSummaries)
                {
                    AppendWordTableRow(document, new[]
                    {
                        BuildPlainEmployeeDetail(row.EmployeeName, row.EmployeeCode, row.Designation, row.Department, row.EmployeeEmail),
                        row.Statuses,
                        row.Projects,
                        row.Entries.ToString(CultureInfo.InvariantCulture),
                        row.TotalHours.ToString("0.00", CultureInfo.InvariantCulture),
                        FormatMoney(row.SalaryAmount),
                        row.LeaveSummary
                    });
                }
            }
            else
            {
                AppendWordTableRow(document, new[] { "Date", "Employee Detail", "Status", "Project", "Task", "Billable", "Hours", "Salary", "Leave", "Note" }, header: true);
                foreach (var row in report.Rows)
                {
                    AppendWordTableRow(document, new[]
                    {
                        row.EntryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        BuildPlainEmployeeDetail(row.EmployeeName, row.EmployeeCode, row.Designation, row.Department, row.EmployeeEmail),
                        row.TimesheetStatus,
                        row.ProjectName,
                        row.TaskName,
                        row.BillableLabel,
                        row.EntryHours.ToString("0.00", CultureInfo.InvariantCulture),
                        FormatMoney(row.SalaryAmount),
                        row.LeaveLabel,
                        row.EntryNote
                    });
                }
            }

            document.AppendLine("</w:tbl>");
            document.AppendLine("<w:sectPr><w:pgSz w:w=\"15840\" w:h=\"12240\" w:orient=\"landscape\"/><w:pgMar w:top=\"720\" w:right=\"720\" w:bottom=\"720\" w:left=\"720\"/></w:sectPr>");
            document.AppendLine("</w:body>");
            document.AppendLine("</w:document>");

            WriteZipEntry(archive, "word/document.xml", document.ToString());
        }

        return stream.ToArray();
    }

    public byte[] RenderPdf(PayrollExportReport report)
    {
        var lines = new List<string>
        {
            "Payroll Export",
            report.FiltersSummary,
            $"Visible Entries: {report.Summary.VisibleEntries} | Visible Hours: {report.Summary.VisibleHours:0.00} | Employees: {report.Summary.Employees} | Submitted Rows: {report.Summary.SubmittedRows} | Projects: {report.Summary.Projects}",
            $"Total Salary: {FormatMoney(GetReportSalaryTotal(report))} | Leave Days: {FormatNumber(GetReportLeaveTotal(report))}",
            string.Empty
        };

        if (report.IsEmployeeSummaryMode)
        {
            lines.Add("Employee             | Status        | Entries | Hours | Salary        | Leave");
            lines.AddRange(report.EmployeeSummaries.Select(row =>
                $"{FitPdfText(row.EmployeeName, 20)} | {FitPdfText(row.Statuses, 13)} | {row.Entries,7} | {row.TotalHours,5:0.##} | {FitPdfText(FormatMoney(row.SalaryAmount), 13)} | {FitPdfText(row.LeaveSummary, 18)}"));
        }
        else
        {
            lines.Add("Date       | Employee             | Status     | Project            | Task               | Billable      | Hours | Salary        | Leave | Note");
            lines.AddRange(report.Rows.Select(row =>
                $"{row.EntryDate:yyyy-MM-dd} | {FitPdfText(row.EmployeeName, 20)} | {FitPdfText(row.TimesheetStatus, 10)} | {FitPdfText(row.ProjectName, 18)} | {FitPdfText(row.TaskName, 18)} | {FitPdfText(row.BillableLabel, 13)} | {row.EntryHours,5:0.##} | {FitPdfText(FormatMoney(row.SalaryAmount), 13)} | {FitPdfText(row.LeaveLabel, 8)} | {FitPdfText(row.EntryNote, 20)}"));
        }

        return BuildPdf(lines);
    }

    private static PayrollExportSummary BuildSummary(IReadOnlyList<PayrollExportRow> rows)
    {
        if (rows.Count == 0)
        {
            return new PayrollExportSummary(0, 0m, 0, 0, 0, null, null);
        }

        var visibleHours = rows.Sum(row => row.EntryHours);
        var employees = rows
            .Select(row => string.IsNullOrWhiteSpace(row.EmployeeEmail) ? row.EmployeeName : row.EmployeeEmail)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();
        var submittedRows = rows.Count(row => string.Equals(row.TimesheetStatus, "Submitted", StringComparison.OrdinalIgnoreCase));
        var projects = rows
            .Select(row => row.ProjectName)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();

        return new PayrollExportSummary(
            VisibleEntries: rows.Count,
            VisibleHours: visibleHours,
            Employees: employees,
            SubmittedRows: submittedRows,
            Projects: projects,
            RangeStart: rows.Min(row => row.EntryDate),
            RangeEnd: rows.Max(row => row.EntryDate));
    }

    private static decimal GetReportSalaryTotal(PayrollExportReport report) =>
        report.IsEmployeeSummaryMode
            ? report.EmployeeSummaries.Sum(row => row.SalaryAmount)
            : report.Rows.Sum(row => row.SalaryAmount);

    private static decimal GetReportLeaveTotal(PayrollExportReport report) =>
        report.IsEmployeeSummaryMode
            ? report.EmployeeSummaries.Sum(row => row.LeaveDays)
            : report.Rows
                .GroupBy(row => new { row.EmployeeKey, row.EntryDate })
                .Sum(group => group.Max(row => row.LeaveDays));

    private static bool IsAllEmployeeFilter(string employeeFilter) =>
        string.IsNullOrWhiteSpace(employeeFilter) ||
        string.Equals(employeeFilter.Trim(), "All", StringComparison.OrdinalIgnoreCase);

    private async Task<IReadOnlyList<PayrollLeaveSnapshot>> LoadApprovedLeavesAsync(
        IReadOnlyList<PayrollExportRow> rows,
        PayrollExportFilter filter,
        CancellationToken cancellationToken)
    {
        var employeeIds = rows
            .Select(row => row.EmployeeId)
            .Where(employeeId => employeeId != Guid.Empty)
            .Distinct()
            .ToList();

        if (employeeIds.Count == 0)
        {
            return [];
        }

        return await dbContext.LeaveRequests
            .AsNoTracking()
            .Where(leave =>
                employeeIds.Contains(leave.EmployeeId) &&
                leave.Status == "Approved" &&
                leave.StartDate <= filter.EndDate &&
                leave.EndDate >= filter.StartDate)
            .Select(leave => new PayrollLeaveSnapshot(
                leave.EmployeeId,
                leave.Type,
                leave.StartDate,
                leave.EndDate,
                leave.Days,
                leave.Status,
                leave.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    private static IReadOnlyList<PayrollExportRow> ApplyLeaveLabels(
        IReadOnlyList<PayrollExportRow> rows,
        IReadOnlyList<PayrollLeaveSnapshot> leaves)
    {
        var leavesByEmployee = leaves
            .GroupBy(leave => leave.EmployeeId)
            .ToDictionary(group => group.Key, group => group.ToList());

        return rows
            .Select(row =>
            {
                var matchingLeaves = leavesByEmployee.TryGetValue(row.EmployeeId, out var employeeLeaves)
                    ? employeeLeaves.Where(leave => leave.StartDate <= row.EntryDate && leave.EndDate >= row.EntryDate).ToList()
                    : [];

                return row with
                {
                    LeaveLabel = BuildLeaveSummary(matchingLeaves, row.EntryDate, row.EntryDate),
                    LeaveDays = matchingLeaves.Sum(leave => CalculateOverlapDays(leave, row.EntryDate, row.EntryDate)),
                    SalaryAmount = matchingLeaves.Count > 0 ? 0m : row.SalaryAmount
                };
            })
            .ToList();
    }

    private static IReadOnlyList<PayrollExportRow> AddLeaveOnlyRows(
        IReadOnlyList<PayrollExportRow> rows,
        IReadOnlyList<PayrollLeaveSnapshot> leaves,
        PayrollExportFilter filter)
    {
        if (IsAllEmployeeFilter(filter.EmployeeFilter) || rows.Count == 0 || leaves.Count == 0)
        {
            return rows;
        }

        var rowsByEmployee = rows
            .Where(row => row.EmployeeId != Guid.Empty)
            .GroupBy(row => row.EmployeeId)
            .ToDictionary(group => group.Key, group => group.OrderBy(row => row.EntryDate).First());
        var existingDates = rows
            .Where(row => row.EmployeeId != Guid.Empty)
            .Select(row => (row.EmployeeId, row.EntryDate))
            .ToHashSet();
        var nextRows = rows.ToList();

        foreach (var leaveGroup in leaves.GroupBy(leave => leave.EmployeeId))
        {
            if (!rowsByEmployee.TryGetValue(leaveGroup.Key, out var template))
            {
                continue;
            }

            var startDate = leaveGroup.Min(leave => leave.StartDate) > filter.StartDate
                ? leaveGroup.Min(leave => leave.StartDate)
                : filter.StartDate;
            var endDate = leaveGroup.Max(leave => leave.EndDate) < filter.EndDate
                ? leaveGroup.Max(leave => leave.EndDate)
                : filter.EndDate;

            for (var date = startDate; date <= endDate; date = date.AddDays(1))
            {
                if (existingDates.Contains((leaveGroup.Key, date)))
                {
                    continue;
                }

                var leavesForDate = leaveGroup
                    .Where(leave => leave.StartDate <= date && leave.EndDate >= date)
                    .ToList();
                if (leavesForDate.Count == 0)
                {
                    continue;
                }

                nextRows.Add(template with
                {
                    TimesheetStatus = "Leave",
                    WeekStart = date,
                    WeekEnd = date,
                    EntryDate = date,
                    EntryDayName = date.DayOfWeek.ToString(),
                    ProjectCode = string.Empty,
                    ProjectName = "-",
                    ClientBusinessUnit = string.Empty,
                    TaskName = "Approved leave",
                    BillableLabel = "-",
                    EntryHours = 0m,
                    EntryNote = BuildLeaveSummary(leavesForDate, date, date),
                    SalaryAmount = 0m,
                    LeaveLabel = BuildLeaveSummary(leavesForDate, date, date),
                    LeaveDays = leavesForDate.Sum(leave => CalculateOverlapDays(leave, date, date)),
                    UpdatedAtUtc = leavesForDate.Max(leave => leave.CreatedAtUtc)
                });
            }
        }

        return nextRows
            .OrderBy(row => row.EntryDate)
            .ThenBy(row => row.EmployeeName)
            .ThenBy(row => row.ProjectName)
            .ThenBy(row => row.TaskName)
            .ToList();
    }

    private static IReadOnlyList<PayrollExportEmployeeSummaryRow> BuildEmployeeSummaries(
        IReadOnlyList<PayrollExportRow> rows,
        IReadOnlyList<PayrollLeaveSnapshot> leaves,
        PayrollExportFilter filter)
    {
        var leavesByEmployee = leaves
            .GroupBy(leave => leave.EmployeeId)
            .ToDictionary(group => group.Key, group => group.ToList());

        return rows
            .GroupBy(row => row.EmployeeKey, StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var first = group
                    .OrderBy(row => row.EmployeeName)
                    .ThenBy(row => row.EmployeeCode)
                    .First();
                var employeeLeaves = leavesByEmployee.TryGetValue(first.EmployeeId, out var foundLeaves) ? foundLeaves : [];
                var leaveDays = employeeLeaves.Sum(leave => CalculateOverlapDays(leave, filter.StartDate, filter.EndDate));

                return new PayrollExportEmployeeSummaryRow(
                    EmployeeId: first.EmployeeId,
                    EmployeeCode: first.EmployeeCode,
                    EmployeeName: first.EmployeeName,
                    EmployeeEmail: first.EmployeeEmail,
                    Department: first.Department,
                    Designation: first.Designation,
                    Statuses: JoinDistinct(group.Select(row => row.TimesheetStatus)),
                    Projects: JoinDistinct(group.Select(row => string.IsNullOrWhiteSpace(row.ProjectCode) ? row.ProjectName : $"{row.ProjectName} ({row.ProjectCode})")),
                    Entries: group.Count(),
                    TotalHours: group.Sum(row => row.EntryHours),
                    BillableHours: group.Where(row => string.Equals(row.BillableLabel, "Billable", StringComparison.OrdinalIgnoreCase)).Sum(row => row.EntryHours),
                    NonBillableHours: group.Where(row => !string.Equals(row.BillableLabel, "Billable", StringComparison.OrdinalIgnoreCase)).Sum(row => row.EntryHours),
                    SalaryAmount: group.Sum(row => row.SalaryAmount),
                    LeaveDays: leaveDays,
                    LeaveSummary: BuildLeaveSummary(employeeLeaves, filter.StartDate, filter.EndDate),
                    UpdatedAtUtc: group.Max(row => row.UpdatedAtUtc));
            })
            .OrderBy(row => row.EmployeeName)
            .ThenBy(row => row.EmployeeCode)
            .ToList();
    }

    private static PayrollProfile ResolvePayrollProfile(string department, string role)
    {
        var baseRate = department.Trim() switch
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

        if (RoleCatalog.NormalizeRole(role) != RoleCatalog.Employee)
        {
            baseRate = Math.Round(baseRate * 1.25m, 2);
        }

        return new PayrollProfile(baseRate);
    }

    private static decimal CalculateOverlapDays(PayrollLeaveSnapshot leave, DateOnly startDate, DateOnly endDate)
    {
        var start = leave.StartDate > startDate ? leave.StartDate : startDate;
        var end = leave.EndDate < endDate ? leave.EndDate : endDate;
        return start > end ? 0m : end.DayNumber - start.DayNumber + 1;
    }

    private static string BuildLeaveSummary(IReadOnlyList<PayrollLeaveSnapshot> leaves, DateOnly startDate, DateOnly endDate)
    {
        var leaveGroups = leaves
            .Select(leave => new
            {
                Type = string.IsNullOrWhiteSpace(leave.Type) ? "Leave" : leave.Type.Trim(),
                Days = CalculateOverlapDays(leave, startDate, endDate)
            })
            .Where(item => item.Days > 0)
            .GroupBy(item => item.Type)
            .Select(group => $"{FormatNumber(group.Sum(item => item.Days))} {group.Key}")
            .ToList();

        return leaveGroups.Count == 0 ? "0" : string.Join(", ", leaveGroups);
    }

    private static string JoinDistinct(IEnumerable<string> values)
    {
        var distinct = values
            .Select(value => value.Trim())
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value)
            .ToList();

        return distinct.Count == 0 ? "-" : string.Join(", ", distinct);
    }

    private static string FormatNumber(decimal value) =>
        value % 1 == 0
            ? value.ToString("0", CultureInfo.InvariantCulture)
            : value.ToString("0.##", CultureInfo.InvariantCulture);

    private static string FormatMoney(decimal value) =>
        $"INR {value.ToString("#,0.00", CultureInfo.InvariantCulture)}";

    private static string BuildPlainEmployeeDetail(
        string employeeName,
        string employeeCode,
        string designation,
        string department,
        string employeeEmail) =>
        string.Join(" | ", new[] { employeeName, employeeCode, designation, department, employeeEmail }
            .Where(value => !string.IsNullOrWhiteSpace(value)));

    private static PayrollExportRow MapSnapshotRow(PayrollExportSnapshotRow row)
    {
        var weekStart = ParseSnapshotDate(row.WeekStart, nameof(row.WeekStart));
        var weekEnd = ParseSnapshotDate(row.WeekEnd, nameof(row.WeekEnd));
        var entryDate = ParseSnapshotDate(row.EntryDate, nameof(row.EntryDate));
        var updatedAtUtc = DateTime.TryParse(
            row.UpdatedAtUtc,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var parsedUpdatedAtUtc)
            ? parsedUpdatedAtUtc
            : DateTime.UtcNow;

        return new PayrollExportRow(
            EmployeeId: Guid.Empty,
            EmployeeCode: row.EmployeeCode?.Trim() ?? string.Empty,
            EmployeeName: row.EmployeeName?.Trim() ?? string.Empty,
            EmployeeEmail: row.EmployeeEmail?.Trim() ?? string.Empty,
            EmployeeRole: row.Designation?.Trim() ?? RoleCatalog.Employee,
            Department: row.Department?.Trim() ?? string.Empty,
            Designation: row.Designation?.Trim() ?? string.Empty,
            TimesheetStatus: string.IsNullOrWhiteSpace(row.TimesheetStatus) ? "Submitted" : row.TimesheetStatus.Trim(),
            WeekStart: weekStart,
            WeekEnd: weekEnd,
            EntryDate: entryDate,
            EntryDayName: entryDate.ToDateTime(TimeOnly.MinValue).ToString("dddd", CultureInfo.InvariantCulture),
            ProjectCode: row.ProjectCode?.Trim() ?? string.Empty,
            ProjectName: string.IsNullOrWhiteSpace(row.ProjectName) ? "Unassigned" : row.ProjectName.Trim(),
            ClientBusinessUnit: row.ClientBusinessUnit?.Trim() ?? string.Empty,
            TaskName: string.IsNullOrWhiteSpace(row.TaskName) ? "No task name" : row.TaskName.Trim(),
            BillableLabel: string.Equals(row.BillableLabel?.Trim(), "Non-billable", StringComparison.OrdinalIgnoreCase) ? "Non-billable" : "Billable",
            EntryHours: row.EntryHours,
            EntryNote: string.IsNullOrWhiteSpace(row.EntryNote) ? "-" : row.EntryNote.Trim(),
            SalaryAmount: row.EntryHours * ResolvePayrollProfile(row.Department?.Trim() ?? string.Empty, row.Designation?.Trim() ?? RoleCatalog.Employee).BaseRate,
            LeaveLabel: "0",
            LeaveDays: 0m,
            UpdatedAtUtc: updatedAtUtc);
    }

    private static DateOnly ParseSnapshotDate(string value, string fieldName)
    {
        if (DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
        {
            return parsedDate;
        }

        throw new ArgumentException($"A valid {fieldName} is required for payroll report snapshot rows.");
    }

    private static string GetStringOrEmpty(SqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    private static void AppendHtmlStatCard(StringBuilder html, string label, string value)
    {
        html.AppendLine("<div class=\"meta-card\">");
        html.Append("<span>");
        html.Append(WebUtility.HtmlEncode(label));
        html.AppendLine("</span>");
        html.Append("<strong>");
        html.Append(WebUtility.HtmlEncode(value));
        html.AppendLine("</strong>");
        html.AppendLine("</div>");
    }

    private static void AppendEmployeeDetailCell(
        StringBuilder html,
        string employeeName,
        string employeeCode,
        string employeeEmail,
        string designation,
        string department)
    {
        html.Append("<td class=\"employee-detail\"><strong>");
        html.Append(WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(employeeName) ? "Unknown employee" : employeeName));
        html.Append("</strong><span>");
        html.Append(WebUtility.HtmlEncode(string.Join(" | ", new[] { employeeCode, designation, department, employeeEmail }
            .Where(value => !string.IsNullOrWhiteSpace(value)))));
        html.AppendLine("</span></td>");
    }

    private static void AppendReportCell(StringBuilder html, string value, string? className = null)
    {
        html.Append("<td");
        if (!string.IsNullOrWhiteSpace(className))
        {
            html.Append(" class=\"");
            html.Append(WebUtility.HtmlEncode(className));
            html.Append('"');
        }

        html.Append('>');
        html.Append(WebUtility.HtmlEncode(value));
        html.AppendLine("</td>");
    }

    private static string EscapeCsv(string value)
    {
        var normalized = value.Replace("\r", " ").Replace("\n", " ");
        if (!normalized.Contains('"') && !normalized.Contains(',') && !normalized.Contains('\n'))
        {
            return normalized;
        }

        return $"\"{normalized.Replace("\"", "\"\"")}\"";
    }

    private static List<IReadOnlyList<SpreadsheetCell>> BuildEmployeeSummarySpreadsheetRows(PayrollExportReport report)
    {
        var rows = new List<IReadOnlyList<SpreadsheetCell>>
        {
            new[]
            {
                SpreadsheetCell.Text("Employee Detail"),
                SpreadsheetCell.Text("Employee Code"),
                SpreadsheetCell.Text("Employee"),
                SpreadsheetCell.Text("Employee Email"),
                SpreadsheetCell.Text("Department"),
                SpreadsheetCell.Text("Designation"),
                SpreadsheetCell.Text("Status"),
                SpreadsheetCell.Text("Projects"),
                SpreadsheetCell.Text("Entries"),
                SpreadsheetCell.Text("Total Hours"),
                SpreadsheetCell.Text("Billable Hours"),
                SpreadsheetCell.Text("Non-billable Hours"),
                SpreadsheetCell.Text("Salary"),
                SpreadsheetCell.Text("Leave Days"),
                SpreadsheetCell.Text("Leave Summary"),
                SpreadsheetCell.Text("Updated At")
            }
        };

        rows.AddRange(report.EmployeeSummaries.Select(row => (IReadOnlyList<SpreadsheetCell>)new[]
        {
            SpreadsheetCell.Text(BuildPlainEmployeeDetail(row.EmployeeName, row.EmployeeCode, row.Designation, row.Department, row.EmployeeEmail)),
            SpreadsheetCell.Text(row.EmployeeCode),
            SpreadsheetCell.Text(row.EmployeeName),
            SpreadsheetCell.Text(row.EmployeeEmail),
            SpreadsheetCell.Text(row.Department),
            SpreadsheetCell.Text(row.Designation),
            SpreadsheetCell.Text(row.Statuses),
            SpreadsheetCell.Text(row.Projects),
            SpreadsheetCell.Number(row.Entries),
            SpreadsheetCell.Number(row.TotalHours),
            SpreadsheetCell.Number(row.BillableHours),
            SpreadsheetCell.Number(row.NonBillableHours),
            SpreadsheetCell.Number(row.SalaryAmount),
            SpreadsheetCell.Number(row.LeaveDays),
            SpreadsheetCell.Text(row.LeaveSummary),
            SpreadsheetCell.Text(row.UpdatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture))
        }));

        return rows;
    }

    private static List<IReadOnlyList<SpreadsheetCell>> BuildDailyDetailSpreadsheetRows(PayrollExportReport report)
    {
        var rows = new List<IReadOnlyList<SpreadsheetCell>>
        {
            new[]
            {
                SpreadsheetCell.Text("Entry Date"),
                SpreadsheetCell.Text("Day"),
                SpreadsheetCell.Text("Employee Detail"),
                SpreadsheetCell.Text("Employee Code"),
                SpreadsheetCell.Text("Employee"),
                SpreadsheetCell.Text("Employee Email"),
                SpreadsheetCell.Text("Department"),
                SpreadsheetCell.Text("Designation"),
                SpreadsheetCell.Text("Status"),
                SpreadsheetCell.Text("Week Start"),
                SpreadsheetCell.Text("Week End"),
                SpreadsheetCell.Text("Project Code"),
                SpreadsheetCell.Text("Project Name"),
                SpreadsheetCell.Text("Client Business Unit"),
                SpreadsheetCell.Text("Task"),
                SpreadsheetCell.Text("Billable"),
                SpreadsheetCell.Text("Hours"),
                SpreadsheetCell.Text("Salary"),
                SpreadsheetCell.Text("Leave Days"),
                SpreadsheetCell.Text("Leave"),
                SpreadsheetCell.Text("Note"),
                SpreadsheetCell.Text("Updated At")
            }
        };

        rows.AddRange(report.Rows.Select(row => (IReadOnlyList<SpreadsheetCell>)new[]
        {
            SpreadsheetCell.Text(row.EntryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
            SpreadsheetCell.Text(row.EntryDayName),
            SpreadsheetCell.Text(BuildPlainEmployeeDetail(row.EmployeeName, row.EmployeeCode, row.Designation, row.Department, row.EmployeeEmail)),
            SpreadsheetCell.Text(row.EmployeeCode),
            SpreadsheetCell.Text(row.EmployeeName),
            SpreadsheetCell.Text(row.EmployeeEmail),
            SpreadsheetCell.Text(row.Department),
            SpreadsheetCell.Text(row.Designation),
            SpreadsheetCell.Text(row.TimesheetStatus),
            SpreadsheetCell.Text(row.WeekStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
            SpreadsheetCell.Text(row.WeekEnd.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
            SpreadsheetCell.Text(row.ProjectCode),
            SpreadsheetCell.Text(row.ProjectName),
            SpreadsheetCell.Text(row.ClientBusinessUnit),
            SpreadsheetCell.Text(row.TaskName),
            SpreadsheetCell.Text(row.BillableLabel),
            SpreadsheetCell.Number(row.EntryHours),
            SpreadsheetCell.Number(row.SalaryAmount),
            SpreadsheetCell.Number(row.LeaveDays),
            SpreadsheetCell.Text(row.LeaveLabel),
            SpreadsheetCell.Text(row.EntryNote),
            SpreadsheetCell.Text(row.UpdatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture))
        }));

        return rows;
    }

    private static byte[] BuildSpreadsheetPackage(IReadOnlyList<SpreadsheetSheet> sheets)
    {
        using var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            WriteZipEntry(archive, "[Content_Types].xml", BuildSpreadsheetContentTypes(sheets.Count));
            WriteZipEntry(archive, "_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>
                """);
            WriteZipEntry(archive, "xl/workbook.xml", BuildWorkbookXml(sheets));
            WriteZipEntry(archive, "xl/_rels/workbook.xml.rels", BuildWorkbookRelationshipsXml(sheets.Count));

            for (var index = 0; index < sheets.Count; index++)
            {
                WriteZipEntry(archive, $"xl/worksheets/sheet{index + 1}.xml", BuildWorksheetXml(sheets[index].Rows));
            }
        }

        return stream.ToArray();
    }

    private static string BuildSpreadsheetContentTypes(int sheetCount)
    {
        var builder = new StringBuilder();
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""");
        builder.AppendLine("""<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">""");
        builder.AppendLine("""  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>""");
        builder.AppendLine("""  <Default Extension="xml" ContentType="application/xml"/>""");
        builder.AppendLine("""  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>""");
        for (var index = 0; index < sheetCount; index++)
        {
            builder.AppendLine($"""  <Override PartName="/xl/worksheets/sheet{index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>""");
        }

        builder.AppendLine("</Types>");
        return builder.ToString();
    }

    private static string BuildWorkbookXml(IReadOnlyList<SpreadsheetSheet> sheets)
    {
        var builder = new StringBuilder();
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""");
        builder.AppendLine("""<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">""");
        builder.AppendLine("<sheets>");
        for (var index = 0; index < sheets.Count; index++)
        {
            builder.AppendLine($"""  <sheet name="{EscapeXmlAttribute(sheets[index].Name)}" sheetId="{index + 1}" r:id="rId{index + 1}"/>""");
        }

        builder.AppendLine("</sheets>");
        builder.AppendLine("</workbook>");
        return builder.ToString();
    }

    private static string BuildWorkbookRelationshipsXml(int sheetCount)
    {
        var builder = new StringBuilder();
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""");
        builder.AppendLine("""<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">""");
        for (var index = 0; index < sheetCount; index++)
        {
            builder.AppendLine($"""  <Relationship Id="rId{index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index + 1}.xml"/>""");
        }

        builder.AppendLine("</Relationships>");
        return builder.ToString();
    }

    private static string BuildWorksheetXml(IReadOnlyList<IReadOnlyList<SpreadsheetCell>> rows)
    {
        var builder = new StringBuilder();
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""");
        builder.AppendLine("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""");
        builder.AppendLine("<sheetData>");
        for (var rowIndex = 0; rowIndex < rows.Count; rowIndex++)
        {
            builder.AppendLine($"""  <row r="{rowIndex + 1}">""");
            var row = rows[rowIndex];
            for (var cellIndex = 0; cellIndex < row.Count; cellIndex++)
            {
                var cellReference = $"{ToSpreadsheetColumnName(cellIndex)}{rowIndex + 1}";
                var cell = row[cellIndex];
                if (cell.IsNumber)
                {
                    builder.AppendLine($"""    <c r="{cellReference}"><v>{EscapeXmlValue(cell.Value)}</v></c>""");
                }
                else
                {
                    builder.AppendLine($"""    <c r="{cellReference}" t="inlineStr"><is><t xml:space="preserve">{EscapeXmlValue(cell.Value)}</t></is></c>""");
                }
            }

            builder.AppendLine("  </row>");
        }

        builder.AppendLine("</sheetData>");
        builder.AppendLine("</worksheet>");
        return builder.ToString();
    }

    private static void WriteZipEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Fastest);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(content);
    }

    private static void AppendWordParagraph(StringBuilder document, string text, bool bold = false, int fontSizeHalfPoints = 22)
    {
        document.Append("<w:p><w:r><w:rPr>");
        if (bold)
        {
            document.Append("<w:b/>");
        }

        document.Append($"""<w:sz w:val="{fontSizeHalfPoints}"/>""");
        document.Append("</w:rPr><w:t xml:space=\"preserve\">");
        document.Append(EscapeXmlValue(text));
        document.AppendLine("</w:t></w:r></w:p>");
    }

    private static void AppendWordTableRow(StringBuilder document, IEnumerable<string> values, bool header = false)
    {
        document.AppendLine("<w:tr>");
        foreach (var value in values)
        {
            document.Append("<w:tc><w:p><w:r><w:rPr>");
            if (header)
            {
                document.Append("<w:b/>");
            }

            document.Append("</w:rPr><w:t xml:space=\"preserve\">");
            document.Append(EscapeXmlValue(value));
            document.AppendLine("</w:t></w:r></w:p></w:tc>");
        }

        document.AppendLine("</w:tr>");
    }

    private static byte[] BuildPdf(IReadOnlyList<string> lines)
    {
        const int linesPerPage = 42;
        var pages = new List<IReadOnlyList<string>>();
        for (var index = 0; index < lines.Count; index += linesPerPage)
        {
            pages.Add(lines.Skip(index).Take(linesPerPage).ToArray());
        }

        var objectContents = new List<string>();
        objectContents.Add("<< /Type /Catalog /Pages 2 0 R >>");

        var pageObjectNumbers = new List<int>();
        var contentObjectNumbers = new List<int>();
        var nextObjectNumber = 4;
        foreach (var _ in pages)
        {
            pageObjectNumbers.Add(nextObjectNumber++);
            contentObjectNumbers.Add(nextObjectNumber++);
        }

        var kids = string.Join(" ", pageObjectNumbers.Select(number => $"{number} 0 R"));
        objectContents.Add($"<< /Type /Pages /Count {pages.Count} /Kids [{kids}] >>");
        objectContents.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

        for (var pageIndex = 0; pageIndex < pages.Count; pageIndex++)
        {
            objectContents.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents {contentObjectNumbers[pageIndex]} 0 R >>");
            var content = BuildPdfPageContent(pages[pageIndex]);
            objectContents.Add($"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}\nendstream");
        }

        using var stream = new MemoryStream();
        using var writer = new StreamWriter(stream, Encoding.ASCII, leaveOpen: true);
        writer.NewLine = "\n";
        writer.Write("%PDF-1.4\n");
        writer.Write("%âãÏÓ\n");
        writer.Flush();

        var offsets = new List<long> { 0 };
        for (var index = 0; index < objectContents.Count; index++)
        {
            offsets.Add(stream.Position);
            writer.Write($"{index + 1} 0 obj\n{objectContents[index]}\nendobj\n");
            writer.Flush();
        }

        var xrefPosition = stream.Position;
        writer.Write($"xref\n0 {objectContents.Count + 1}\n");
        writer.Write("0000000000 65535 f \n");
        for (var index = 1; index < offsets.Count; index++)
        {
            writer.Write($"{offsets[index]:0000000000} 00000 n \n");
        }

        writer.Write($"trailer\n<< /Size {objectContents.Count + 1} /Root 1 0 R >>\nstartxref\n{xrefPosition}\n%%EOF");
        writer.Flush();
        return stream.ToArray();
    }

    private static string BuildPdfPageContent(IReadOnlyList<string> lines)
    {
        var builder = new StringBuilder();
        builder.AppendLine("BT");
        builder.AppendLine("/F1 8 Tf");
        builder.AppendLine("10 TL");
        builder.AppendLine("36 560 Td");
        for (var index = 0; index < lines.Count; index++)
        {
            var sanitized = EscapePdfString(ToAscii(lines[index]));
            builder.Append('(');
            builder.Append(sanitized);
            builder.AppendLine(") Tj");
            if (index < lines.Count - 1)
            {
                builder.AppendLine("T*");
            }
        }

        builder.AppendLine("ET");
        return builder.ToString();
    }

    private static string FitPdfText(string value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty.PadRight(maxLength);
        }

        var normalized = value.Replace("\r", " ").Replace("\n", " ").Trim();
        if (normalized.Length > maxLength)
        {
            normalized = normalized[..Math.Max(0, maxLength - 1)] + "…";
        }

        return normalized.PadRight(maxLength);
    }

    private static string EscapePdfString(string value) =>
        value.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");

    private static string ToAscii(string value) =>
        new(value.Select(character => character <= 127 ? character : '?').ToArray());

    private static string EscapeXmlValue(string value) => SecurityElement.Escape(value) ?? string.Empty;

    private static string EscapeXmlAttribute(string value) => (SecurityElement.Escape(value) ?? string.Empty).Replace("\"", "&quot;");

    private static string ToSpreadsheetColumnName(int index)
    {
        var dividend = index + 1;
        var builder = new StringBuilder();
        while (dividend > 0)
        {
            var modulo = (dividend - 1) % 26;
            builder.Insert(0, (char)('A' + modulo));
            dividend = (dividend - modulo) / 26;
        }

        return builder.ToString();
    }

    private readonly record struct PayrollLeaveSnapshot(
        Guid EmployeeId,
        string Type,
        DateOnly StartDate,
        DateOnly EndDate,
        int Days,
        string Status,
        DateTime CreatedAtUtc);

    private readonly record struct PayrollProfile(decimal BaseRate);

    private readonly record struct SpreadsheetSheet(string Name, IReadOnlyList<IReadOnlyList<SpreadsheetCell>> Rows);

    private readonly record struct SpreadsheetCell(bool IsNumber, string Value)
    {
        public static SpreadsheetCell Text(string value) => new(false, value);

        public static SpreadsheetCell Number<T>(T value) where T : IFormattable =>
            new(true, value.ToString(null, CultureInfo.InvariantCulture));
    }
}

public sealed record PayrollExportFilter(
    DateOnly StartDate,
    DateOnly EndDate,
    string ProjectFilter,
    string ProjectLabel,
    string StatusFilter,
    string EmployeeFilter,
    string BillableFilter,
    string SearchTerm,
    string EmployeeScope);

public sealed record PayrollExportSummary(
    int VisibleEntries,
    decimal VisibleHours,
    int Employees,
    int SubmittedRows,
    int Projects,
    DateOnly? RangeStart,
    DateOnly? RangeEnd);

public sealed record PayrollExportRow(
    Guid EmployeeId,
    string EmployeeCode,
    string EmployeeName,
    string EmployeeEmail,
    string EmployeeRole,
    string Department,
    string Designation,
    string TimesheetStatus,
    DateOnly WeekStart,
    DateOnly WeekEnd,
    DateOnly EntryDate,
    string EntryDayName,
    string ProjectCode,
    string ProjectName,
    string ClientBusinessUnit,
    string TaskName,
    string BillableLabel,
    decimal EntryHours,
    string EntryNote,
    decimal SalaryAmount,
    string LeaveLabel,
    decimal LeaveDays,
    DateTime UpdatedAtUtc)
{
    public string EmployeeKey
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(EmployeeEmail))
            {
                return EmployeeEmail.Trim().ToLowerInvariant();
            }

            if (EmployeeId != Guid.Empty)
            {
                return EmployeeId.ToString("N", CultureInfo.InvariantCulture);
            }

            var fallback = string.Join("|", new[] { EmployeeCode, EmployeeName, Department, Designation }
                .Where(value => !string.IsNullOrWhiteSpace(value)))
                .Trim()
                .ToLowerInvariant();

            return string.IsNullOrWhiteSpace(fallback) ? "unknown-employee" : fallback;
        }
    }
}

public sealed record PayrollExportEmployeeSummaryRow(
    Guid EmployeeId,
    string EmployeeCode,
    string EmployeeName,
    string EmployeeEmail,
    string Department,
    string Designation,
    string Statuses,
    string Projects,
    int Entries,
    decimal TotalHours,
    decimal BillableHours,
    decimal NonBillableHours,
    decimal SalaryAmount,
    decimal LeaveDays,
    string LeaveSummary,
    DateTime UpdatedAtUtc);

public sealed record PayrollExportSnapshotRow(
    string EmployeeCode,
    string EmployeeName,
    string EmployeeEmail,
    string Department,
    string Designation,
    string TimesheetStatus,
    string WeekStart,
    string WeekEnd,
    string EntryDate,
    string ProjectCode,
    string ProjectName,
    string ClientBusinessUnit,
    string TaskName,
    string BillableLabel,
    decimal EntryHours,
    string EntryNote,
    string UpdatedAtUtc);

public sealed record PayrollExportReport(
    PayrollExportFilter Filter,
    PayrollExportSummary Summary,
    IReadOnlyList<PayrollExportRow> Rows,
    IReadOnlyList<PayrollExportEmployeeSummaryRow> EmployeeSummaries)
{
    public bool IsEmployeeSummaryMode =>
        string.IsNullOrWhiteSpace(Filter.EmployeeFilter) ||
        string.Equals(Filter.EmployeeFilter.Trim(), "All", StringComparison.OrdinalIgnoreCase);

    public string FiltersSummary =>
        string.Join(" | ", new[]
        {
            $"Date: {Filter.StartDate:yyyy-MM-dd} to {Filter.EndDate:yyyy-MM-dd}",
            $"Project: {NormalizeProjectLabel(Filter.ProjectFilter, Filter.ProjectLabel)}",
            $"Status: {NormalizeFilter(Filter.StatusFilter, "All")}",
            $"Employee: {NormalizeEmployeeLabel(Filter.EmployeeFilter, Filter.EmployeeScope)}",
            $"Billable: {NormalizeFilter(Filter.BillableFilter, "All")}",
            $"Search: {(string.IsNullOrWhiteSpace(Filter.SearchTerm) ? "Any" : Filter.SearchTerm.Trim())}"
        });

    private static string NormalizeFilter(string value, string fallback) =>
        string.IsNullOrWhiteSpace(value) || string.Equals(value.Trim(), "All", StringComparison.OrdinalIgnoreCase)
            ? fallback
            : value.Trim();

    private static string NormalizeProjectLabel(string filterValue, string label) =>
        string.Equals(filterValue.Trim(), "All", StringComparison.OrdinalIgnoreCase)
            ? "All projects"
            : (string.IsNullOrWhiteSpace(label) ? filterValue.Trim() : label.Trim());

    private static string NormalizeEmployeeLabel(string employeeFilter, string employeeScope) =>
        string.IsNullOrWhiteSpace(employeeFilter) || string.Equals(employeeFilter.Trim(), "All", StringComparison.OrdinalIgnoreCase)
            ? (string.IsNullOrWhiteSpace(employeeScope) ? "All employees" : "All visible employees")
            : employeeFilter.Trim();
}

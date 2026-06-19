namespace AbhiTimesheet.Api.Models;

public sealed class WeeklyTimesheetEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid AdminId { get; set; }
    public string AdminName { get; set; } = string.Empty;
    public DateOnly WeekStart { get; set; }
    public DateOnly WeekEnd { get; set; }
    public string Status { get; set; } = string.Empty;
    public string ManagerApprovalStatus { get; set; } = "Pending";
    public string AdminApprovalStatus { get; set; } = "Pending";
    public string ApprovedBy { get; set; } = string.Empty;
    public string ApprovalFlowType { get; set; } = "Standard";
    public double TotalHours { get; set; }
    public string RowsJson { get; set; } = "[]";
    public DateTime UpdatedAtUtc { get; set; }
}

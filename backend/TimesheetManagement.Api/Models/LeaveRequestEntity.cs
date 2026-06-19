namespace AbhiTimesheet.Api.Models;

public sealed class LeaveRequestEntity
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public Guid AdminId { get; set; }
    public string AdminName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int Days { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string ManagerApprovalStatus { get; set; } = "Pending";
    public string HRApprovalStatus { get; set; } = "Pending";
    public string AdminApprovalStatus { get; set; } = "Pending";
    public string? ApprovedBy { get; set; }
    public string? ApprovalFlowType { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

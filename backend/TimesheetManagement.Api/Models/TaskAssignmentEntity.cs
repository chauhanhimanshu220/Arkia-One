namespace AbhiTimesheet.Api.Models;

public sealed class TaskAssignmentEntity
{
    public Guid Id { get; set; }
    public Guid TaskGroupId { get; set; }
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public Guid AssignedTo { get; set; }
    public string AssignedToName { get; set; } = string.Empty;
    public string TaskCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string WorkBreakdown { get; set; } = string.Empty;
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public double TotalHours { get; set; }
    public int PlannedDays { get; set; }
    public int AssignedDays { get; set; }
    public string Priority { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string AssignmentStatus { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public string RoleInTask { get; set; } = string.Empty;
    public string ExpectedDeliverable { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}

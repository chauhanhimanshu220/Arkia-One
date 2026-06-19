namespace AbhiTimesheet.Api.Contracts.Tasks;

public sealed record TaskCreateRequest(
    string ProjectId,
    string TaskName,
    string Description,
    string WorkBreakdown,
    int PlannedDays,
    double EstimatedHours,
    string Priority,
    string Status,
    string? TaskCode,
    string? TaskGroupId,
    string? ProjectName,
    string? StartDate,
    string? DueDate);

public sealed record TaskAssignmentRequest(
    string TaskId,
    string ProjectId,
    string UserId,
    int AssignedDays,
    double AssignedHours,
    string AssignmentStartDate,
    string AssignmentDueDate,
    string? Notes,
    string? RoleInTask,
    string? ExpectedDeliverable,
    string? AssignedToName);

public sealed class TaskItemDto
{
    public string Id { get; init; } = string.Empty;
    public string TaskGroupId { get; init; } = string.Empty;
    public string ProjectId { get; init; } = string.Empty;
    public string ProjectName { get; init; } = string.Empty;
    public string AssignedTo { get; init; } = string.Empty;
    public string AssignedToName { get; init; } = string.Empty;
    public string TaskCode { get; init; } = string.Empty;
    public string TaskName { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string WorkBreakdown { get; init; } = string.Empty;
    public string? StartDate { get; init; } = string.Empty;
    public string? EndDate { get; init; } = string.Empty;
    public string? DueDate { get; init; } = string.Empty;
    public double TotalHours { get; init; }
    public double EstimatedHours { get; init; }
    public double AssignedHours { get; init; }
    public int PlannedDays { get; init; }
    public int AssignedDays { get; init; }
    public string Priority { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string AssignmentStatus { get; init; } = string.Empty;
    public string Notes { get; init; } = string.Empty;
    public string RoleInTask { get; init; } = string.Empty;
    public string ExpectedDeliverable { get; init; } = string.Empty;
    public bool IsTaskMaster { get; init; }
}

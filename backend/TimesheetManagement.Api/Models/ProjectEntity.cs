namespace AbhiTimesheet.Api.Models;

public sealed class ProjectEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ClientBusinessUnit { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public Guid AdminId { get; set; }
    public string AdminName { get; set; } = string.Empty;
    public Guid ManagerId { get; set; }
    public string ManagerName { get; set; } = string.Empty;
    public bool ManagerRolePromotionApplied { get; set; }
    public string ManagerOriginalRole { get; set; } = string.Empty;
    public string ManagerOriginalRolesJson { get; set; } = "[]";
    public string ProjectLead { get; set; } = string.Empty;
    public string DeliveryModel { get; set; } = string.Empty;
    public string TeamMemberIdsJson { get; set; } = "[]";
    public string TeamMemberNamesJson { get; set; } = "[]";
    public int TeamSize { get; set; }
    public decimal Budget { get; set; }
    public string Priority { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public bool IsBillable { get; set; }
    public string WorkspaceId { get; set; } = "wrk_default";
    public DateTime CreatedAtUtc { get; set; }
}

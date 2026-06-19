using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Services;

public sealed class ProjectManagerRoleService(AppDbContext dbContext)
{
    public async Task SynchronizeProjectManagerRoleAsync(
        ProjectManagerRoleSnapshot? previousProject,
        ProjectEntity currentProject,
        EmployeeEntity currentManager,
        Guid actorUserId)
    {
        if (previousProject is not null &&
            previousProject.ManagerRolePromotionApplied &&
            (previousProject.ManagerId != currentProject.ManagerId || !IsProjectOpen(currentProject.Status)))
        {
            await RestoreOriginalManagerRolesAsync(
                previousProject.ManagerId,
                previousProject.ProjectId,
                previousProject.ManagerOriginalRolesJson,
                previousProject.ManagerOriginalRole,
                actorUserId);
        }

        currentProject.ManagerName = currentManager.FullName;
        currentProject.ProjectLead = currentManager.FullName;

        if (!IsProjectOpen(currentProject.Status))
        {
            ClearPromotionMetadata(currentProject);
            return;
        }

        var baselineRoles = await ResolvePromotionBaselineRolesAsync(previousProject, currentProject, currentManager);
        if (baselineRoles is null)
        {
            ClearPromotionMetadata(currentProject);
            return;
        }

        ApplyPromotedManagerRoles(currentManager, baselineRoles, actorUserId);
        currentProject.ManagerRolePromotionApplied = true;
        currentProject.ManagerOriginalRole = RoleCatalog.GetPrimaryRole(baselineRoles);
        currentProject.ManagerOriginalRolesJson = RoleCatalog.SerializeRoles(baselineRoles);
    }

    public async Task HandleProjectDeletionAsync(ProjectManagerRoleSnapshot project, Guid actorUserId)
    {
        if (!project.ManagerRolePromotionApplied)
        {
            return;
        }

        await RestoreOriginalManagerRolesAsync(
            project.ManagerId,
            project.ProjectId,
            project.ManagerOriginalRolesJson,
            project.ManagerOriginalRole,
            actorUserId);
    }

    private async Task<IReadOnlyList<string>?> ResolvePromotionBaselineRolesAsync(
        ProjectManagerRoleSnapshot? previousProject,
        ProjectEntity currentProject,
        EmployeeEntity currentManager)
    {
        if (previousProject is not null &&
            previousProject.ManagerRolePromotionApplied &&
            previousProject.ManagerId == currentProject.ManagerId)
        {
            return RoleCatalog.ParseRoles(previousProject.ManagerOriginalRolesJson, previousProject.ManagerOriginalRole);
        }

        var otherOpenPromotion = await dbContext.Projects
            .AsNoTracking()
            .Where(item =>
                item.Id != currentProject.Id &&
                item.ManagerId == currentProject.ManagerId &&
                item.ManagerRolePromotionApplied &&
                item.Status != "Completed" &&
                item.Status != "Closed")
            .OrderBy(item => item.CreatedAtUtc)
            .Select(item => new
            {
                item.ManagerOriginalRole,
                item.ManagerOriginalRolesJson
            })
            .FirstOrDefaultAsync();

        if (otherOpenPromotion is not null)
        {
            return RoleCatalog.ParseRoles(otherOpenPromotion.ManagerOriginalRolesJson, otherOpenPromotion.ManagerOriginalRole);
        }

        var currentRoles = RoleCatalog.ParseRoles(currentManager.RolesJson, currentManager.Role);
        return RequiresTemporaryPromotion(currentRoles) ? currentRoles : null;
    }

    private async Task RestoreOriginalManagerRolesAsync(
        Guid managerId,
        Guid closingProjectId,
        string originalRolesJson,
        string originalRole,
        Guid actorUserId)
    {
        var hasOtherOpenPromotion = await dbContext.Projects
            .AsNoTracking()
            .AnyAsync(item =>
                item.Id != closingProjectId &&
                item.ManagerId == managerId &&
                item.ManagerRolePromotionApplied &&
                item.Status != "Completed" &&
                item.Status != "Closed");

        if (hasOtherOpenPromotion)
        {
            return;
        }

        var manager = await dbContext.Employees.FirstOrDefaultAsync(item => item.Id == managerId);
        if (manager is null)
        {
            return;
        }

        var restoredRoles = RoleCatalog.ParseRoles(originalRolesJson, originalRole);
        manager.Role = RoleCatalog.GetPrimaryRole(restoredRoles);
        manager.RolesJson = RoleCatalog.SerializeRoles(restoredRoles);
        manager.UpdatedAtUtc = DateTime.UtcNow;
        manager.UpdatedBy = actorUserId;
    }

    private static bool RequiresTemporaryPromotion(IReadOnlyList<string> roles)
    {
        if (RoleCatalog.HasAnyRole(roles, [RoleCatalog.SystemAdmin, RoleCatalog.FinanceAdmin]))
        {
            return false;
        }

        if (RoleCatalog.HasRole(roles, RoleCatalog.TeamManager))
        {
            return false;
        }

        return RoleCatalog.HasAnyRole(roles, [RoleCatalog.Employee, RoleCatalog.HrManager]);
    }

    private static void ApplyPromotedManagerRoles(EmployeeEntity manager, IReadOnlyList<string> baselineRoles, Guid actorUserId)
    {
        var promotedRoles = RoleCatalog.NormalizeRoles([.. baselineRoles, RoleCatalog.TeamManager]);
        manager.Role = RoleCatalog.GetPrimaryRole(promotedRoles);
        manager.RolesJson = RoleCatalog.SerializeRoles(promotedRoles);
        manager.UpdatedAtUtc = DateTime.UtcNow;
        manager.UpdatedBy = actorUserId;
    }

    private static bool IsProjectOpen(string? status) =>
        !string.Equals(status?.Trim(), "Completed", StringComparison.OrdinalIgnoreCase) &&
        !string.Equals(status?.Trim(), "Closed", StringComparison.OrdinalIgnoreCase);

    private static void ClearPromotionMetadata(ProjectEntity project)
    {
        project.ManagerRolePromotionApplied = false;
        project.ManagerOriginalRole = string.Empty;
        project.ManagerOriginalRolesJson = "[]";
    }
}

public sealed record ProjectManagerRoleSnapshot(
    Guid ProjectId,
    Guid ManagerId,
    bool ManagerRolePromotionApplied,
    string ManagerOriginalRole,
    string ManagerOriginalRolesJson)
{
    public static ProjectManagerRoleSnapshot From(ProjectEntity entity) =>
        new(
            entity.Id,
            entity.ManagerId,
            entity.ManagerRolePromotionApplied,
            entity.ManagerOriginalRole,
            entity.ManagerOriginalRolesJson);
}

using AbhiTimesheet.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/system")]
public sealed class SystemResetController(AppDbContext dbContext, ILogger<SystemResetController> logger) : ControllerBase
{
    [HttpDelete("purge-non-user-data")]
    public async Task<IActionResult> PurgeNonUserData()
    {
        logger.LogInformation("Purging all non-user data from the database as requested by system administrator.");

        // Remove all timesheets
        dbContext.WeeklyTimesheets.RemoveRange(await dbContext.WeeklyTimesheets.ToListAsync());
        dbContext.DailyTimesheets.RemoveRange(await dbContext.DailyTimesheets.ToListAsync());
        dbContext.DailyTimesheetEntries.RemoveRange(await dbContext.DailyTimesheetEntries.ToListAsync());

        // Remove all leaves
        dbContext.LeaveRequests.RemoveRange(await dbContext.LeaveRequests.ToListAsync());

        // Remove all projects & tasks
        dbContext.TaskAssignments.RemoveRange(await dbContext.TaskAssignments.ToListAsync());
        dbContext.Projects.RemoveRange(await dbContext.Projects.ToListAsync());

        // Remove late timesheet requests
        dbContext.LateTimesheetRequestItems.RemoveRange(await dbContext.LateTimesheetRequestItems.ToListAsync());
        dbContext.LateTimesheetRequests.RemoveRange(await dbContext.LateTimesheetRequests.ToListAsync());

        // Remove chat data
        dbContext.ChatMessages.RemoveRange(await dbContext.ChatMessages.ToListAsync());
        dbContext.ChatAttachments.RemoveRange(await dbContext.ChatAttachments.ToListAsync());
        dbContext.ChatReactions.RemoveRange(await dbContext.ChatReactions.ToListAsync());
        dbContext.ChatParticipants.RemoveRange(await dbContext.ChatParticipants.ToListAsync());
        dbContext.ChatThreads.RemoveRange(await dbContext.ChatThreads.ToListAsync());

        // Remove password change requests & audit logs & login activity
        dbContext.PasswordChangeRequests.RemoveRange(await dbContext.PasswordChangeRequests.ToListAsync());
        dbContext.AccountAuditLogs.RemoveRange(await dbContext.AccountAuditLogs.ToListAsync());
        dbContext.UserLoginActivities.RemoveRange(await dbContext.UserLoginActivities.ToListAsync());

        await dbContext.SaveChangesAsync();

        logger.LogInformation("Successfully purged all non-user data from the database.");

        return Ok(new { message = "All non-user data (timesheets, leaves, projects, tasks, chat, logs) has been successfully removed from the database." });
    }
}

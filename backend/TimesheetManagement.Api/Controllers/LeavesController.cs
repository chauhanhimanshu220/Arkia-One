using AbhiTimesheet.Api.Contracts.Leaves;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class LeavesController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("types")]
    public ActionResult<IReadOnlyList<LeaveTypeDto>> GetLeaveTypes() => Ok(LeaveTypeCatalog.All);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LeaveDto>>> GetLeaves([FromQuery] string? employeeId, [FromQuery] int? year)
    {
        var query = dbContext.LeaveRequests
            .AsNoTracking()
            .AsQueryable();

        if (Guid.TryParse(employeeId, out var parsedEmployeeId))
        {
            query = query.Where(item => item.EmployeeId == parsedEmployeeId);
        }

        if (year.HasValue)
        {
            query = query.Where(item => item.StartDate.Year == year.Value || item.EndDate.Year == year.Value);
        }

        var leaves = await query
            .OrderByDescending(item => item.CreatedAtUtc)
            .ToListAsync();

        return Ok(leaves.Select(Map).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<LeaveDto>> CreateLeave([FromBody] LeaveRequestDto request)
    {
        var normalizedType = request.Type.Trim();
        var normalizedReason = request.Reason.Trim();
        var normalizedStatus = string.IsNullOrWhiteSpace(request.Status) ? "Pending" : request.Status.Trim();
        var startDate = request.StartDate.ParseRequiredDate(nameof(request.StartDate));
        var endDate = request.EndDate.ParseRequiredDate(nameof(request.EndDate));

        if (!LeaveTypeCatalog.IsValid(normalizedType))
        {
            return BadRequest(new { message = "Select a valid leave type." });
        }

        if (endDate < startDate)
        {
            return BadRequest(new { message = "End date cannot be earlier than start date." });
        }

        if (request.Days <= 0)
        {
            return BadRequest(new { message = "Total leave days must be greater than zero." });
        }

        if (string.IsNullOrWhiteSpace(normalizedReason))
        {
            return BadRequest(new { message = "Reason is required for a leave request." });
        }

        var employeeId = Guid.Parse(request.EmployeeId);
        var hasOverlap = await dbContext.LeaveRequests.AnyAsync(item =>
            item.EmployeeId == employeeId &&
            item.Status != "Rejected" &&
            item.StartDate <= endDate &&
            item.EndDate >= startDate);

        if (hasOverlap)
        {
            return Conflict(new { message = "A leave request already exists for the selected date range." });
        }

        var entity = new LeaveRequestEntity
        {
            Id = Guid.NewGuid(),
            EmployeeId = employeeId,
            EmployeeName = request.EmployeeName.Trim(),
            Department = request.Department.Trim(),
            AdminId = Guid.Parse(request.AdminId),
            AdminName = request.AdminName.Trim(),
            Type = normalizedType,
            StartDate = startDate,
            EndDate = endDate,
            Days = request.Days,
            Reason = normalizedReason,
            Status = normalizedStatus,
            ManagerApprovalStatus = "Pending",
            HRApprovalStatus = "Pending",
            AdminApprovalStatus = "Pending",
            CreatedAtUtc = DateTime.UtcNow
        };

        dbContext.LeaveRequests.Add(entity);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetLeaves), new { id = entity.Id }, Map(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<LeaveDto>> UpdateLeave(Guid id, [FromBody] LeaveRequestDto request)
    {
        var entity = await dbContext.LeaveRequests.FirstOrDefaultAsync(item => item.Id == id);
        if (entity is null)
        {
            return NotFound(new { message = "Leave request not found." });
        }

        var normalizedType = request.Type.Trim();
        var normalizedReason = request.Reason.Trim();
        var normalizedStatus = string.IsNullOrWhiteSpace(request.Status) ? entity.Status : request.Status.Trim();
        var startDate = request.StartDate.ParseRequiredDate(nameof(request.StartDate));
        var endDate = request.EndDate.ParseRequiredDate(nameof(request.EndDate));

        if (!LeaveTypeCatalog.IsValid(normalizedType))
        {
            return BadRequest(new { message = "Select a valid leave type." });
        }

        if (endDate < startDate)
        {
            return BadRequest(new { message = "End date cannot be earlier than start date." });
        }

        if (request.Days <= 0)
        {
            return BadRequest(new { message = "Total leave days must be greater than zero." });
        }

        if (string.IsNullOrWhiteSpace(normalizedReason))
        {
            return BadRequest(new { message = "Reason is required for a leave request." });
        }

        var employeeId = Guid.Parse(request.EmployeeId);
        var hasOverlap = await dbContext.LeaveRequests.AnyAsync(item =>
            item.Id != id &&
            item.EmployeeId == employeeId &&
            item.Status != "Rejected" &&
            item.StartDate <= endDate &&
            item.EndDate >= startDate);

        if (hasOverlap)
        {
            return Conflict(new { message = "A leave request already exists for the selected date range." });
        }

        entity.EmployeeId = employeeId;
        entity.EmployeeName = request.EmployeeName.Trim();
        entity.Department = request.Department.Trim();
        entity.AdminId = Guid.Parse(request.AdminId);
        entity.AdminName = request.AdminName.Trim();
        entity.Type = normalizedType;
        entity.StartDate = startDate;
        entity.EndDate = endDate;
        entity.Days = request.Days;
        entity.Reason = normalizedReason;

        // Advanced Approval Flow Logic
        if (request.AdminApprovalStatus == "Approved")
        {
            entity.Status = "Approved";
            entity.AdminApprovalStatus = "Approved";
            entity.ManagerApprovalStatus = "Skipped";
            entity.HRApprovalStatus = "Skipped";
            entity.ApprovalFlowType = "Admin Override";
            entity.ApprovedBy = request.AdminName;
        }
        else if (request.HRApprovalStatus == "Approved")
        {
            entity.HRApprovalStatus = "Approved";
            if (entity.ManagerApprovalStatus == "Approved")
            {
                entity.Status = "Approved";
                entity.AdminApprovalStatus = "Auto Approved";
                entity.ApprovalFlowType = "Manager + HR";
                entity.ApprovedBy = "System";
            }
            else
            {
                entity.Status = "HR Approved";
            }
        }
        else if (request.ManagerApprovalStatus == "Approved")
        {
            entity.ManagerApprovalStatus = "Approved";
            entity.Status = "Manager Approved";
        }
        else if (request.Status == "Rejected")
        {
            entity.Status = "Rejected";
        }
        else
        {
            entity.Status = normalizedStatus;
        }

        await dbContext.SaveChangesAsync();

        return Ok(Map(entity));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteLeave(Guid id)
    {
        var entity = await dbContext.LeaveRequests.FirstOrDefaultAsync(item => item.Id == id);
        if (entity is null)
        {
            return NotFound(new { message = "Leave request not found." });
        }

        dbContext.LeaveRequests.Remove(entity);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    private static LeaveDto Map(LeaveRequestEntity entity)
    {
        return new LeaveDto(
            entity.Id.ToString(),
            entity.EmployeeId.ToString(),
            entity.EmployeeName,
            entity.Department,
            entity.AdminId.ToString(),
            entity.AdminName,
            entity.Type,
            entity.StartDate.ToApiString(),
            entity.EndDate.ToApiString(),
            entity.Days,
            entity.Reason,
            entity.Status,
            entity.ManagerApprovalStatus,
            entity.HRApprovalStatus,
            entity.AdminApprovalStatus,
            entity.ApprovedBy,
            entity.ApprovalFlowType,
            entity.CreatedAtUtc.ToString("O"));
    }
}

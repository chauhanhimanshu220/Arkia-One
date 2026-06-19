using System;
using System.Threading.Tasks;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class OnboardingController(AppDbContext dbContext) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("provision")]
    public async Task<IActionResult> Provision([FromBody] ProvisionRequest request)
    {
        try
        {
            if (request is null)
            {
                return BadRequest(new { message = "Provision request details are required." });
            }

            var workspaceSlug = request.WorkspaceName?.Trim().ToLowerInvariant() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(workspaceSlug) || workspaceSlug.Length < 3)
            {
                return BadRequest(new { message = "A valid workspace name of at least 3 characters is required." });
            }

            var ownerEmail = request.OwnerEmail?.Trim().ToLowerInvariant() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(ownerEmail) || !ownerEmail.Contains('@'))
            {
                return BadRequest(new { message = "A valid owner email is required." });
            }

            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            {
                return BadRequest(new { message = "Password must be at least 8 characters long." });
            }

            // Check if workspace slug is taken
            var workspaceExists = await dbContext.Workspaces
                .AnyAsync(w => w.WorkspaceSlug == workspaceSlug);
            if (workspaceExists)
            {
                return Conflict(new { message = $"Workspace '{workspaceSlug}' is already taken." });
            }

            // Check if owner email is taken
            var emailExists = await dbContext.LicenseOwners
                .AnyAsync(o => o.Email == ownerEmail);
            if (emailExists)
            {
                return Conflict(new { message = "Email is already registered for another workspace owner." });
            }

            // Generate owner password credentials
            var credentials = PasswordHasher.HashPassword(request.Password);

            var ownerId = Guid.NewGuid();
            var workspaceId = $"wrk_{workspaceSlug}_{ownerId.ToString("N")[..6]}";

            var licenseOwner = new LicenseOwnerEntity
            {
                Id = ownerId,
                WorkspaceId = workspaceId,
                OwnerName = request.OwnerName?.Trim() ?? "Owner",
                CompanyName = request.CompanyName?.Trim() ?? "My Company",
                Email = ownerEmail,
                PasswordHash = credentials.Hash,
                PasswordSalt = credentials.Salt,
                SubscriptionPlan = request.Plan?.Trim() ?? "starter",
                SubscriptionStatus = "Active",
                SeatLimit = request.Seats >= 10 ? request.Seats : 10,
                CurrentUsage = 0,
                RenewalDate = request.Billing?.ToLower() == "annual" ? DateTime.UtcNow.AddYears(1) : DateTime.UtcNow.AddMonths(1),
                CreatedAt = DateTime.UtcNow
            };

            var workspace = new WorkspaceEntity
            {
                WorkspaceId = workspaceId,
                WorkspaceName = licenseOwner.CompanyName,
                WorkspaceSlug = workspaceSlug,
                OwnerId = ownerId,
                Status = "Active",
                CreatedAt = DateTime.UtcNow
            };

            // Create initial payment subscription history record
            var amount = CalculatePlanAmount(request.Plan, request.Billing, licenseOwner.SeatLimit);
            var tax = Math.Round(amount * 0.18m);
            var totalAmount = amount + tax;

            var subscription = new SubscriptionEntity
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                PlanName = licenseOwner.SubscriptionPlan,
                BillingCycle = request.Billing?.Trim() ?? "annual",
                Amount = totalAmount,
                Status = "Paid",
                InvoiceNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}",
                PaymentMethod = request.PaymentMethod?.Trim() ?? "card",
                TransactionDate = DateTime.UtcNow
            };

            // Save transactional records in DB
            dbContext.LicenseOwners.Add(licenseOwner);
            dbContext.Workspaces.Add(workspace);
            dbContext.Subscriptions.Add(subscription);

            await dbContext.SaveChangesAsync();

            return Ok(new
            {
                message = "Workspace provisioned successfully",
                workspaceId = workspaceId,
                ownerEmail = ownerEmail
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Onboarding Provision Exception] {ex}");
            return StatusCode(500, new
            {
                message = "An error occurred during workspace provisioning.",
                error = ex.Message,
                details = ex.ToString()
            });
        }
    }

    private static decimal CalculatePlanAmount(string? plan, string? billing, int seats)
    {
        var rate = plan?.ToLower() == "professional" ? 75 : 30;
        if (billing?.ToLower() == "annual")
        {
            rate = plan?.ToLower() == "professional" ? 60 : 24;
            return rate * seats * 12; // Annual total amount
        }
        return rate * seats; // Monthly total amount
    }
}

public sealed class ProvisionRequest
{
    public string? Plan { get; set; }
    public string? Billing { get; set; }
    public int Seats { get; set; }
    public string? CompanyName { get; set; }
    public string? WorkspaceName { get; set; }
    public string? OwnerName { get; set; }
    public string? OwnerEmail { get; set; }
    public string? Password { get; set; }
    public string? PaymentMethod { get; set; }
}

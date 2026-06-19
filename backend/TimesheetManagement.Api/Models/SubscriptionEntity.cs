using System;

namespace AbhiTimesheet.Api.Models;

public sealed class SubscriptionEntity
{
    public Guid Id { get; set; }
    public string WorkspaceId { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public string BillingCycle { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public DateTime TransactionDate { get; set; }
}

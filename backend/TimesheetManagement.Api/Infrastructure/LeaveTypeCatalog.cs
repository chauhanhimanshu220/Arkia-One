using AbhiTimesheet.Api.Contracts.Leaves;

namespace AbhiTimesheet.Api.Infrastructure;

public static class LeaveTypeCatalog
{
    public static readonly IReadOnlyList<LeaveTypeDto> All =
    [
        new("casual-leave", "Casual Leave", 6, true, true, true, "Short personal leave for planned needs."),
        new("sick-leave", "Sick Leave", 8, true, true, true, "Use when illness or medical recovery affects availability."),
        new("earned-leave", "Earned Leave", 12, true, true, true, "Longer planned leave from accrued entitlement."),
        new("unpaid-leave", "Unpaid Leave", 0, false, true, true, "Extended leave outside paid entitlement."),
        new("work-from-home", "Work From Home", 24, true, false, true, "Remote-working days tracked through the same request flow.")
    ];

    public static bool IsValid(string? type) =>
        All.Any(item => string.Equals(item.Name, type?.Trim(), StringComparison.OrdinalIgnoreCase));

    public static LeaveTypeDto? Find(string? type) =>
        All.FirstOrDefault(item => string.Equals(item.Name, type?.Trim(), StringComparison.OrdinalIgnoreCase));
}

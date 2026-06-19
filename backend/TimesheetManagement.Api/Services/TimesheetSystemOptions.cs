using AbhiTimesheet.Api.Common;

namespace AbhiTimesheet.Api.Services;

public sealed class TimesheetSystemOptions
{
    public string CompanyName { get; set; } = "Arkia Technology";
    public string PlatformName { get; set; } = BrandingConstants.BrandName;
    public string PortalUrl { get; set; } = string.Empty;
    public string SupportTeamName { get; set; } = "HR & Administration Team";
}

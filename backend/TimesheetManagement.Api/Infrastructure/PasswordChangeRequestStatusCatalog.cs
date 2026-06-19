namespace AbhiTimesheet.Api.Infrastructure;

public static class PasswordChangeRequestStatusCatalog
{
    public const string OtpPending = "OTP Pending";
    public const string PendingHrApproval = "Pending HR Approval";
    public const string Completed = "Completed";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
    public const string Cancelled = "Cancelled";
    public const string Expired = "Expired";
    public const string OtpVerified = "OTP Verified";
}

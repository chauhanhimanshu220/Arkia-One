using System.Net;
using AbhiTimesheet.Api.Models;
using Microsoft.Extensions.Options;
using AbhiTimesheet.Api.Common;

namespace AbhiTimesheet.Api.Services;

public sealed class EmployeeWelcomeEmailService(
    IEmailSender emailSender,
    IOptions<TimesheetSystemOptions> systemOptions,
    ILogger<EmployeeWelcomeEmailService> logger)
{
    public async Task<EmployeeWelcomeEmailDeliveryResult> SendAsync(
        EmployeeEntity employee,
        string temporaryPassword,
        string? preferredPortalUrl,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(employee.Email))
        {
            return EmployeeWelcomeEmailDeliveryResult.Failed(
                "Employee created successfully, but the welcome email was skipped because the employee record has no email address.");
        }

        var options = ResolveEffectiveOptions();
        var portalUrl = ResolvePortalUrl(options, preferredPortalUrl);
        var companyName = string.IsNullOrWhiteSpace(options.CompanyName) ? "Arkia Technology" : options.CompanyName.Trim();
        var platformName = string.IsNullOrWhiteSpace(options.PlatformName)
            ? BrandingConstants.BrandName
            : options.PlatformName.Trim();
        var supportTeamName = string.IsNullOrWhiteSpace(options.SupportTeamName)
            ? "HR & Administration Team"
            : options.SupportTeamName.Trim();

        try
        {
            await emailSender.SendAsync(
                [employee.Email],
                $"Welcome to {companyName}",
                BuildWelcomeEmailBody(
                    employee.FullName,
                    employee.UserId,
                    employee.Email,
                    temporaryPassword,
                    portalUrl,
                    companyName,
                    platformName,
                    supportTeamName),
                cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            logger.LogWarning(
                exception,
                "Welcome email delivery is not configured for employee {EmployeeId} ({EmployeeEmail}).",
                employee.Id,
                employee.Email);

            return EmployeeWelcomeEmailDeliveryResult.Failed(
                $"Employee created successfully, but the welcome email could not be sent: {exception.Message}");
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Welcome email delivery failed for employee {EmployeeId} ({EmployeeEmail}).",
                employee.Id,
                employee.Email);

            return EmployeeWelcomeEmailDeliveryResult.Failed(
                $"Employee created successfully, but the welcome email could not be sent: {exception.Message}");
        }

        return EmployeeWelcomeEmailDeliveryResult.Sent(
            $"Welcome email sent to {employee.Email} with login instructions and temporary credentials.");
    }

    private TimesheetSystemOptions ResolveEffectiveOptions()
    {
        var configured = systemOptions.Value;
        var effective = new TimesheetSystemOptions
        {
            CompanyName = configured.CompanyName,
            PlatformName = configured.PlatformName,
            PortalUrl = configured.PortalUrl,
            SupportTeamName = configured.SupportTeamName
        };

        effective.CompanyName = Environment.GetEnvironmentVariable("TIMESHEET_COMPANY_NAME") ?? effective.CompanyName;
        effective.PlatformName = Environment.GetEnvironmentVariable("TIMESHEET_PLATFORM_NAME") ?? effective.PlatformName;
        effective.PortalUrl = Environment.GetEnvironmentVariable("TIMESHEET_PORTAL_URL") ?? effective.PortalUrl;
        effective.SupportTeamName = Environment.GetEnvironmentVariable("TIMESHEET_SUPPORT_TEAM_NAME") ?? effective.SupportTeamName;

        return effective;
    }

    private static string ResolvePortalUrl(TimesheetSystemOptions options, string? preferredPortalUrl)
    {
        foreach (var candidate in new[] { options.PortalUrl, preferredPortalUrl })
        {
            if (TryNormalizeAbsoluteUrl(candidate, out var normalizedUrl))
            {
                return normalizedUrl;
            }
        }

        return "http://localhost:4173";
    }

    private static bool TryNormalizeAbsoluteUrl(string? value, out string normalizedUrl)
    {
        normalizedUrl = string.Empty;
        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri))
        {
            return false;
        }

        normalizedUrl = uri.ToString().TrimEnd('/');
        return true;
    }

    private static string BuildWelcomeEmailBody(
        string fullName,
        string loginId,
        string email,
        string temporaryPassword,
        string portalUrl,
        string companyName,
        string platformName,
        string supportTeamName)
    {
        var encodedFullName = WebUtility.HtmlEncode(fullName);
        var encodedLoginId = WebUtility.HtmlEncode(loginId);
        var encodedEmail = WebUtility.HtmlEncode(email);
        var encodedTemporaryPassword = WebUtility.HtmlEncode(temporaryPassword);
        var encodedPortalUrl = WebUtility.HtmlEncode(portalUrl);
        var encodedCompanyName = WebUtility.HtmlEncode(companyName);
        var encodedPlatformName = WebUtility.HtmlEncode(platformName);
        var encodedSupportTeamName = WebUtility.HtmlEncode(supportTeamName);

        return $"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Welcome to {encodedCompanyName}</title>
            </head>
            <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Segoe UI,Arial,sans-serif;color:#18181b;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f7fb;">
                <tr>
                  <td align="center" style="padding:32px 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="680" style="width:100%;max-width:680px;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.08);">
                      <tr>
                        <td style="padding:32px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:#ffffff;">
                          <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;opacity:0.82;">{encodedCompanyName}</div>
                          <h1 style="margin:14px 0 12px;font-size:30px;line-height:1.2;">Welcome to {encodedPlatformName}</h1>
                          <p style="margin:0;font-size:15px;line-height:1.7;max-width:540px;">
                            Your account has been successfully created in the {encodedPlatformName}. Access your workspace to manage work records, leaves, and collaboration.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:32px;">
                          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Dear {encodedFullName},</p>
                          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
                            Welcome to {encodedCompanyName}.
                          </p>
                          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
                            We are pleased to have you as part of the organization and look forward to your valuable contributions. Your account has been successfully created in the {encodedPlatformName}, and you can now access the platform using the login credentials provided below.
                          </p>

                          <div style="margin:24px 0;border:1px solid #dbe4f0;border-radius:20px;overflow:hidden;">
                            <div style="padding:16px 20px;background-color:#eff6ff;border-bottom:1px solid #dbe4f0;">
                              <h2 style="margin:0;font-size:18px;color:#0f172a;">Login Details</h2>
                            </div>
                            <div style="padding:20px;">
                              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                  <td style="padding:0 0 14px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">Portal URL</td>
                                </tr>
                                <tr>
                                  <td style="padding:0 0 18px;font-size:15px;line-height:1.7;">
                                    <a href="{encodedPortalUrl}" style="color:#1d4ed8;text-decoration:none;font-weight:600;">{encodedPortalUrl}</a>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding:0 0 14px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">User ID / Login Email</td>
                                </tr>
                                <tr>
                                  <td style="padding:0 0 18px;font-size:16px;font-weight:700;color:#0f172a;">{encodedLoginId}</td>
                                </tr>
                                <tr>
                                  <td style="padding:0 0 14px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">Registered Email</td>
                                </tr>
                                <tr>
                                  <td style="padding:0 0 18px;font-size:15px;color:#0f172a;">{encodedEmail}</td>
                                </tr>
                                <tr>
                                  <td style="padding:0 0 14px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">Temporary Password</td>
                                </tr>
                                <tr>
                                  <td style="padding:0;font-size:20px;font-weight:700;color:#0f172a;letter-spacing:0.04em;">{encodedTemporaryPassword}</td>
                                </tr>
                              </table>
                            </div>
                          </div>

                          <div style="margin:24px 0;padding:20px;border-radius:20px;background-color:#f8fafc;border:1px solid #e2e8f0;">
                            <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Important Security Instructions</h2>
                            <ul style="margin:0;padding-left:20px;color:#334155;font-size:15px;line-height:1.8;">
                              <li>Please change your temporary password after your first login.</li>
                              <li>Keep your login credentials secure and confidential.</li>
                              <li>Do not share your account access with anyone.</li>
                            </ul>
                          </div>

                          <div style="margin:24px 0;padding:20px;border-radius:20px;background-color:#ffffff;border:1px solid #dbe4f0;">
                            <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Portal Features</h2>
                            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#334155;">
                              Using {encodedPlatformName}, you can:
                            </p>
                            <ul style="margin:0;padding-left:20px;color:#334155;font-size:15px;line-height:1.8;">
                              <li>Submit daily or weekly timesheets</li>
                              <li>Apply and manage leave requests</li>
                              <li>Track attendance and approvals</li>
                              <li>View assigned projects and tasks</li>
                              <li>Access team calendars and schedules</li>
                              <li>Communicate with managers and team members</li>
                              <li>Manage your profile and account settings</li>
                            </ul>
                          </div>

                          <div style="margin:24px 0;padding:20px;border-radius:20px;background-color:#fff7ed;border:1px solid #fed7aa;">
                            <h2 style="margin:0 0 12px;font-size:18px;color:#9a3412;">Timesheet Submission Reminder</h2>
                            <p style="margin:0;font-size:15px;line-height:1.7;color:#7c2d12;">
                              Please ensure your timesheets are submitted regularly as per company policy to maintain accurate work records and reporting.
                            </p>
                          </div>

                          <div style="margin:24px 0 0;padding:20px;border-radius:20px;background-color:#f8fafc;border:1px solid #e2e8f0;">
                            <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Need Assistance?</h2>
                            <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">
                              For login issues, password reset requests, or system-related support, please contact the {encodedSupportTeamName}.
                            </p>
                          </div>

                          <div style="margin:28px 0 0;">
                            <a href="{encodedPortalUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background-color:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.02em;">
                              Open Arkia Workspace
                            </a>
                          </div>

                          <p style="margin:28px 0 0;font-size:15px;line-height:1.7;color:#334155;">
                            We wish you a successful and productive experience with {encodedCompanyName}.
                          </p>
                          <p style="margin:20px 0 0;font-size:15px;line-height:1.7;color:#334155;">
                            Best regards,<br />
                            {encodedCompanyName}<br />
                            {encodedSupportTeamName}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
    }
}

public sealed record EmployeeWelcomeEmailDeliveryResult(bool WasSent, string Message)
{
    public static EmployeeWelcomeEmailDeliveryResult Sent(string message) => new(true, message);

    public static EmployeeWelcomeEmailDeliveryResult Failed(string message) => new(false, message);
}

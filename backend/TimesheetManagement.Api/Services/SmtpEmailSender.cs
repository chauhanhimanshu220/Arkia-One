using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace AbhiTimesheet.Api.Services;

public sealed class SmtpEmailSender(IOptions<SmtpOptions> smtpOptions) : IEmailSender
{
    public async Task SendAsync(
        IEnumerable<string> recipients,
        string subject,
        string htmlBody,
        CancellationToken cancellationToken)
    {
        var options = ResolveEffectiveOptions();
        if (!options.IsConfigured)
        {
            throw new InvalidOperationException("SMTP email delivery is not configured. Set Smtp:User and Smtp:Pass, or SMTP_USER and SMTP_PASS environment variables.");
        }

        var distinctRecipients = recipients
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (distinctRecipients.Count == 0)
        {
            throw new InvalidOperationException("No email recipient was provided for the password change notification.");
        }

        using var message = new MailMessage
        {
            From = new MailAddress(
                string.IsNullOrWhiteSpace(options.FromEmail) ? options.User : options.FromEmail,
                string.IsNullOrWhiteSpace(options.FromName) ? "Timesheet Approval System" : options.FromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };

        foreach (var recipient in distinctRecipients)
        {
            message.To.Add(recipient);
        }

        using var client = new SmtpClient(options.Host, options.Port)
        {
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(options.User, options.Pass),
            EnableSsl = options.Secure || options.Port == 587
        };

        cancellationToken.ThrowIfCancellationRequested();
        await client.SendMailAsync(message, cancellationToken);
    }

    private SmtpOptions ResolveEffectiveOptions()
    {
        var configured = smtpOptions.Value;
        var effective = new SmtpOptions
        {
            Host = configured.Host,
            Port = configured.Port,
            Secure = configured.Secure,
            User = configured.User,
            Pass = configured.Pass,
            FromEmail = configured.FromEmail,
            FromName = configured.FromName
        };

        effective.Host = Environment.GetEnvironmentVariable("SMTP_HOST") ?? effective.Host;
        effective.User = Environment.GetEnvironmentVariable("SMTP_USER") ?? effective.User;
        effective.Pass = Environment.GetEnvironmentVariable("SMTP_PASS") ?? effective.Pass;
        effective.FromEmail = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL") ?? effective.FromEmail;
        effective.FromName = Environment.GetEnvironmentVariable("SMTP_FROM_NAME") ?? effective.FromName;

        if (int.TryParse(Environment.GetEnvironmentVariable("SMTP_PORT"), out var port))
        {
            effective.Port = port;
        }

        if (bool.TryParse(Environment.GetEnvironmentVariable("SMTP_SECURE"), out var secure))
        {
            effective.Secure = secure;
        }

        return effective;
    }
}

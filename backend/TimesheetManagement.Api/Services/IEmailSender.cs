namespace AbhiTimesheet.Api.Services;

public interface IEmailSender
{
    Task SendAsync(IEnumerable<string> recipients, string subject, string htmlBody, CancellationToken cancellationToken);
}

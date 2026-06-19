namespace AbhiTimesheet.Api.Services;

public sealed class PasswordChangeWorkflowException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

namespace AbhiTimesheet.Api.Contracts.Auth;

public sealed record LoginRequest(string UserId, string Password, double? Latitude, double? Longitude, double? Accuracy);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record ForgotPasswordRequest(string UserIdOrEmail);

public sealed record VerifyForgotPasswordOtpRequest(string RequestId, string Otp);

public sealed record ResetPasswordRequest(string RequestId, string NewPassword, string ConfirmPassword);

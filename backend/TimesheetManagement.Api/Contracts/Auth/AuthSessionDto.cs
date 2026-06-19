namespace AbhiTimesheet.Api.Contracts.Auth;

public sealed record AuthUserDto(
    string Id,
    string FullName,
    string Email,
    string Role,
    IReadOnlyList<string> Roles,
    string Organization,
    string? ProfilePhotoUrl);

public sealed record AuthSessionDto(string Token, AuthUserDto User);

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace AbhiTimesheet.Api.Services;

public sealed class AuthTokenService(IConfiguration configuration, IWebHostEnvironment environment)
{
    private const string DefaultIssuer = "AbhiTimesheet.Api";
    private const string DefaultAudience = "AbhiTimesheet.Web";
    private const int DefaultExpiryMinutes = 60;

    public string Issuer => configuration["Jwt:Issuer"] ?? DefaultIssuer;
    public string Audience => configuration["Jwt:Audience"] ?? DefaultAudience;

    public SymmetricSecurityKey GetSigningKey()
    {
        var configuredKey = configuration["JWT_SIGNING_KEY"] ?? configuration["Jwt:SigningKey"];
        if (!string.IsNullOrWhiteSpace(configuredKey))
        {
            return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuredKey));
        }

        if (!environment.IsDevelopment())
        {
            throw new InvalidOperationException("JWT signing key is not configured.");
        }

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes("dev-only-timesheet-jwt-signing-key-change-before-production-2026"));
    }

    public string CreateAccessToken(EmployeeEntity employee)
    {
        var roles = RoleCatalog.ParseRoles(employee.RolesJson, employee.Role);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, employee.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, employee.Id.ToString()),
            new(ClaimTypes.Name, employee.FullName),
            new(ClaimTypes.Email, employee.Email),
            new("employee_code", employee.EmployeeCode)
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var credentials = new SigningCredentials(GetSigningKey(), SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(GetExpiryMinutes());
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string CreateAccessToken(LicenseOwnerEntity owner)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, owner.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, owner.Id.ToString()),
            new(ClaimTypes.Name, owner.OwnerName),
            new(ClaimTypes.Email, owner.Email),
            new(ClaimTypes.Role, "License Owner"),
            new("workspace_id", owner.WorkspaceId)
        };

        var credentials = new SigningCredentials(GetSigningKey(), SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(GetExpiryMinutes());
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private int GetExpiryMinutes()
    {
        return int.TryParse(configuration["Jwt:AccessTokenMinutes"], out var minutes) && minutes > 0
            ? minutes
            : DefaultExpiryMinutes;
    }
}

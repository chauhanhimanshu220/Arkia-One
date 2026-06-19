using System.Security.Cryptography;

namespace AbhiTimesheet.Api.Infrastructure;

public static class PasswordHasher
{
    private const int SaltSize = 16;
    private const int KeySize = 32;
    private const int Iterations = 100_000;

    public static (string Hash, string Salt) HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = HashPassword(password, salt);
        return (Convert.ToBase64String(hash), Convert.ToBase64String(salt));
    }

    public static bool VerifyPassword(string password, string? expectedHash, string? expectedSalt)
    {
        if (string.IsNullOrWhiteSpace(expectedHash) || string.IsNullOrWhiteSpace(expectedSalt))
        {
            return false;
        }

        try
        {
            var salt = Convert.FromBase64String(expectedSalt);
            var hash = HashPassword(password, salt);
            var storedHash = Convert.FromBase64String(expectedHash);

            return storedHash.Length == hash.Length && CryptographicOperations.FixedTimeEquals(storedHash, hash);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static byte[] HashPassword(string password, byte[] salt) =>
        Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            KeySize);
}

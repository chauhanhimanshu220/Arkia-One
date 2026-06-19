import { useState } from "react";
import { Icon } from "../../components/Icon";
import { ParticleBackground } from "../../components/ParticleBackground";
import { useAppTheme } from "../../hooks/useAppTheme";
import { ApiError, apiRequest } from "../../services/http";
import { locationService } from "../../services/locationService";
import { BRAND_NAME } from "../../config/branding";

type LoginView = 'login' | 'forgot-password' | 'forgot-password-otp' | 'forgot-password-reset';

type ForgotPasswordResponse = {
  requestId: string;
  message: string;
};

type PasswordResetResponse = {
  message?: string;
};

const getPasswordResetErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return error.message || "Password reset is not available. Make sure the backend API is running on the configured port.";
    }

    return error.message || "Unable to complete the password reset request.";
  }

  if (error instanceof TypeError) {
    return "Unable to reach the backend API. Make sure the ASP.NET server is running.";
  }

  return error instanceof Error ? error.message : "An error occurred.";
};

export const LoginPage = ({
  onLogin,
}: {
  onLogin: (userId: string, password: string) => Promise<unknown>;
}) => {
  const { theme, toggleTheme } = useAppTheme();
  const [view, setView] = useState<LoginView>('login');

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [forgotUserId, setForgotUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);

  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUserId = userId.trim();

    if (!trimmedUserId || !password.trim()) {
      setError("User ID and password are required.");
      return;
    }

    if (/\s/.test(trimmedUserId)) {
      setError("Email or user ID cannot contain spaces. Enter only your email or user ID.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      await onLogin(trimmedUserId, password);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedForgotUserId = forgotUserId.trim();

    if (!trimmedForgotUserId) {
      setError("Email or User ID is required.");
      return;
    }

    if (/\s/.test(trimmedForgotUserId)) {
      setError("Email or user ID cannot contain spaces. Enter only your email or user ID.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiRequest<ForgotPasswordResponse>('/Auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
            userIdOrEmail: forgotUserId.trim()
        })
      });
      
      setRequestId(data.requestId);
      setSuccess(data.message);
      if (data.requestId) {
        setView('forgot-password-otp');
      }
    } catch (err) {
      setError(getPasswordResetErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!otp.trim()) {
      setError("OTP is required.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      await apiRequest<PasswordResetResponse>('/Auth/forgot-password/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
            requestId,
            otp: otp.trim()
        })
      });
      
      setSuccess("OTP verified. Please enter a new password.");
      setView('forgot-password-reset');
    } catch (err) {
      setError(getPasswordResetErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError("New password and confirm password are required.");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      await apiRequest<PasswordResetResponse>('/Auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({
            requestId,
            newPassword,
            confirmPassword
        })
      });
      
      setSuccess("Password reset successful. Please sign in with your new password.");
      setView('login');
      setPassword("");
      setUserId(forgotUserId);
      setForgotUserId("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
    } catch (err) {
      setError(getPasswordResetErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-scene relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <ParticleBackground />
      <button
        type="button"
        onClick={toggleTheme}
        className="login-theme-toggle absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 sm:right-6 sm:top-6"
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      >
        <Icon name={theme === "light" ? "moon" : "sun"} className="h-4 w-4" />
        <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
      </button>
      <div className="login-card relative z-10 w-full max-w-md rounded-[2rem] p-8 backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <h1 className="login-title text-3xl font-bold">{BRAND_NAME}</h1>
          <p className="login-subtitle mt-2 text-sm">
            {view === 'login' && "Sign in to continue"}
            {view === 'forgot-password' && "Reset your password"}
            {view === 'forgot-password-otp' && "Verify OTP"}
            {view === 'forgot-password-reset' && "Create new password"}
          </p>
        </div>

        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} autoComplete="off" className="space-y-5">
            <div>
              <label className="login-label mb-2 block text-sm font-semibold">Email or User ID</label>
              <input
                type="text"
                name="login-userid"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                className="login-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                placeholder="Enter your email or User ID"
              />
            </div>
            <div>
              <label className="login-label mb-2 block text-sm font-semibold">Password</label>
              <div className="relative">
                <input
                  type={passwordVisible ? "text" : "password"}
                  name="login-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="login-input w-full rounded-2xl px-4 py-3 pr-16 text-sm outline-none transition"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((current) => !current)}
                  className="login-input-icon absolute inset-y-0 right-3 flex w-10 items-center justify-center transition"
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  aria-pressed={passwordVisible}
                >
                  <Icon name={passwordVisible ? "eye-off" : "eye"} className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setView('forgot-password'); clearMessages(); }}
                  className="login-forgot-link text-sm font-semibold transition"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {success && <p className="rounded-2xl bg-green-500/10 px-4 py-3 text-sm text-green-500">{success}</p>}
            {error && <p className="login-error rounded-2xl px-4 py-3 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="login-submit w-full rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {view === 'forgot-password' && (
          <form onSubmit={handleForgotPasswordSubmit} autoComplete="off" className="space-y-5">
            <div>
              <label className="login-label mb-2 block text-sm font-semibold">Email or User ID</label>
              <input
                type="text"
                name="forgot-userid"
                value={forgotUserId}
                onChange={(event) => setForgotUserId(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                className="login-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                placeholder="Enter your email or User ID"
              />
            </div>

            {error && <p className="login-error rounded-2xl px-4 py-3 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="login-submit w-full rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Sending OTP..." : "Send OTP"}
            </button>
            <button
              type="button"
              onClick={() => { setView('login'); clearMessages(); }}
              className="w-full text-center text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Back to Sign In
            </button>
          </form>
        )}

        {view === 'forgot-password-otp' && (
          <form onSubmit={handleOtpSubmit} autoComplete="off" className="space-y-5">
            {success && <p className="rounded-2xl bg-green-500/10 px-4 py-3 text-sm text-green-500">{success}</p>}
            
            <div>
              <label className="login-label mb-2 block text-sm font-semibold">One-Time Password</label>
              <input
                type="text"
                name="forgot-otp"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                autoComplete="off"
                required
                className="login-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition text-center tracking-[0.5em]"
                placeholder="000000"
                maxLength={6}
              />
            </div>

            {error && <p className="login-error rounded-2xl px-4 py-3 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="login-submit w-full rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              type="button"
              onClick={() => { setView('forgot-password'); clearMessages(); }}
              className="w-full text-center text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Back
            </button>
          </form>
        )}

        {view === 'forgot-password-reset' && (
          <form onSubmit={handleResetPasswordSubmit} autoComplete="off" className="space-y-5">
            {success && <p className="rounded-2xl bg-green-500/10 px-4 py-3 text-sm text-green-500">{success}</p>}
            
            <div>
              <label className="login-label mb-2 block text-sm font-semibold">New Password</label>
              <div className="relative">
                <input
                  type={newPasswordVisible ? "text" : "password"}
                  name="forgot-new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  className="login-input w-full rounded-2xl px-4 py-3 pr-16 text-sm outline-none transition"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setNewPasswordVisible((current) => !current)}
                  className="login-input-icon absolute inset-y-0 right-3 flex w-10 items-center justify-center transition"
                  aria-label={newPasswordVisible ? "Hide password" : "Show password"}
                >
                  <Icon name={newPasswordVisible ? "eye-off" : "eye"} className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div>
              <label className="login-label mb-2 block text-sm font-semibold">Confirm Password</label>
              <input
                type={newPasswordVisible ? "text" : "password"}
                name="forgot-confirm-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                className="login-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                placeholder="Confirm new password"
              />
            </div>

            {error && <p className="login-error rounded-2xl px-4 py-3 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="login-submit w-full rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Resetting..." : "Reset Password"}
            </button>
            <button
              type="button"
              onClick={() => { setView('login'); clearMessages(); }}
              className="w-full text-center text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

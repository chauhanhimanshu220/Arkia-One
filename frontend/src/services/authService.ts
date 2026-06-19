import type { AuthSession } from "../types/auth";
import { AUTH_STORAGE_KEY } from "../config/auth";
import { getPrimaryUserRole, normalizeUserRoles, tryNormalizeUserRole } from "../types/roles";
import { ApiError, apiRequest } from "./http";
import { locationService } from "./locationService";

const getAuthErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 401 || error.status === 403) {
      return error.message || "Invalid user ID or password.";
    }

    return "Unable to reach the backend API. Make sure the ASP.NET server is running.";
  }

  if (error instanceof TypeError) {
    return "Unable to reach the backend API. Make sure the ASP.NET server is running.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to sign in right now. Please try again.";
};

export const authService = {
  normalizeSession(session: AuthSession, preferredActiveRole?: string | null): AuthSession {
    let roles = normalizeUserRoles(session.user.roles ?? session.user.role);

    if (roles.includes("System Admin") || session.user.account_type === "super_admin") {
      roles = Array.from(
        new Set([
          ...roles,
          "Employee",
          "Team Manager",
          "HR Manager",
          "Finance Admin",
          "System Admin",
        ])
      ) as NonNullable<ReturnType<typeof tryNormalizeUserRole>>[];
    }

    const activeRoleCandidates = [
      preferredActiveRole,
      session.user.role,
    ]
      .map((role) => tryNormalizeUserRole(role))
      .filter((role): role is NonNullable<typeof role> => role !== null);
    const activeRole = activeRoleCandidates.find((role) => roles.includes(role)) ?? getPrimaryUserRole(roles);

    return {
      ...session,
      user: {
        ...session.user,
        roles,
        role: activeRole,
        profilePhotoUrl: session.user.profilePhotoUrl ?? null,
      },
    };
  },

  getStoredSession(): AuthSession | null {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsedSession = JSON.parse(raw) as AuthSession;
      return this.normalizeSession(parsedSession, parsedSession.user.role);
    } catch {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  },

  setStoredSession(session: AuthSession | null) {
    if (!session) {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }

    const normalized = this.normalizeSession(session, session.user.role);
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized));
  },

  async login(userId: string, password: string) {
    this.setStoredSession(null);

    try {
      const location = await locationService.captureRequiredLoginLocation();

      // 1. Try Node.js backend for Super Admins / Management
      try {
        const nodeResponse = await fetch("http://localhost:5300/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userId, password }),
        });

        if (nodeResponse.ok) {
          const data = await nodeResponse.json();
          // Map Node.js response to AuthSession
          const session: AuthSession = {
            token: data.token,
            user: {
              id: data.user.id.toString(),
              fullName: data.user.email, // We use email as full name for Super Admins
              email: data.user.email,
              role: data.user.role,
              roles: [data.user.role],
              organization: "Arkia One",
              account_type: data.user.account_type || "super_admin",
              access_level: data.user.access_level || "full",
            },
          };
          const normalizedSession = this.normalizeSession(session, session.user.role);
          this.setStoredSession(normalizedSession);
          return normalizedSession;
        }
      } catch (nodeError) {
        // Silently ignore and fallback to ASP.NET
      }

      // 2. Fallback to ASP.NET backend for Workspace Users
      const session = await apiRequest<AuthSession>("/Auth/login", {
        method: "POST",
        body: JSON.stringify({
          userId,
          password,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        }),
      });

      const normalizedSession = this.normalizeSession(session, session.user.role);
      this.setStoredSession(normalizedSession);
      return normalizedSession;
    } catch (error) {
      this.setStoredSession(null);
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async refreshStoredSession() {
    const currentSession = this.getStoredSession();
    if (!currentSession) {
      return null;
    }

    try {
      if (currentSession.user.account_type === "super_admin") {
        const nodeResponse = await fetch("http://localhost:5300/api/auth/me", {
          headers: { Authorization: `Bearer ${currentSession.token}` }
        });
        if (nodeResponse.ok) {
          const data = await nodeResponse.json();
          const refreshedSession: AuthSession = {
            token: data.token || currentSession.token,
            user: {
              ...currentSession.user,
              ...data.user,
            }
          };
          const normalizedSession = this.normalizeSession(refreshedSession, currentSession.user.role);
          this.setStoredSession(normalizedSession);
          return normalizedSession;
        }
        // If nodeResponse fails with 401, we want to logout
        if (nodeResponse.status === 401 || nodeResponse.status === 404) {
          this.setStoredSession(null);
          return null;
        }
      }

      const refreshed = await apiRequest<AuthSession>("/Auth/me");
      const normalizedSession = this.normalizeSession({
        ...refreshed,
        token: refreshed.token || currentSession.token,
      }, currentSession.user.role);
      this.setStoredSession(normalizedSession);
      return normalizedSession;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        this.setStoredSession(null);
        return null;
      }

      if (error instanceof TypeError) {
        return currentSession;
      }

      return currentSession;
    }
  },

  async changePassword(currentPassword: string, newPassword: string) {
    try {
      await apiRequest<void>("/Auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(error.message || "Unable to update password. Please try again.");
      }

      if (error instanceof TypeError) {
        throw new Error("Unable to reach the backend API. Make sure the ASP.NET server is running.");
      }

      throw new Error("Unable to update password. Please try again.");
    }
  },

  logout() {
    this.setStoredSession(null);
    window.localStorage.clear();
    window.sessionStorage.clear();
  },
};

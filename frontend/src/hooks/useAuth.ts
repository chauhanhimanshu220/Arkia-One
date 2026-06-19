import React, { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { authService } from "../services/authService";
import type { AuthSession, AuthUser } from "../types/auth";
import type { UserRole } from "../types/roles";

export interface AuthContextType {
  session: AuthSession | null;
  loading: boolean;
  login: (userId: string, password: string) => Promise<AuthSession>;
  logout: () => void;
  refreshSession: () => Promise<AuthSession | null>;
  setActiveRole: (role: UserRole) => void;
  updateSessionUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const restoredSession = await authService.refreshStoredSession();
      if (!active) {
        return;
      }

      setSession(restoredSession);
      setLoading(false);
    };

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (userId: string, password: string) => {
    try {
      const nextSession = await authService.login(userId, password);
      setSession(nextSession);
      return nextSession;
    } catch (error) {
      setSession(null);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setSession(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const refreshedSession = await authService.refreshStoredSession();
    setSession(refreshedSession);
    return refreshedSession;
  }, []);

  const setActiveRole = useCallback((role: UserRole) => {
    setSession((currentSession) => {
      if (!currentSession || currentSession.user.role === role || !currentSession.user.roles.includes(role)) {
        return currentSession;
      }

      const nextSession = authService.normalizeSession({
        ...currentSession,
        user: {
          ...currentSession.user,
          role,
        },
      }, role);

      authService.setStoredSession(nextSession);
      return nextSession;
    });
  }, []);

  const updateSessionUser = useCallback((updates: Partial<AuthUser>) => {
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      const hasChanges = (Object.keys(updates) as Array<keyof AuthUser>).some(
        (key) => currentSession.user[key] !== updates[key],
      );

      if (!hasChanges) {
        return currentSession;
      }

      const nextSession = authService.normalizeSession({
        ...currentSession,
        user: {
          ...currentSession.user,
          ...updates,
        },
      }, currentSession.user.role);

      authService.setStoredSession(nextSession);
      return nextSession;
    });
  }, []);

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        session,
        loading,
        login,
        logout,
        refreshSession,
        setActiveRole,
        updateSessionUser,
      },
    },
    children
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/**
 * Baton Production Authentication Context
 * Manages JWT session state, user profile (/me), demo role transitions,
 * and live synchronization with the FastAPI backend.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  batonApi,
  getStoredToken,
  setStoredToken,
  type Role,
  type UserProfile,
  ApiError,
} from "../api/client";
import { supabase } from "../features/auth/supabase";

export interface ExtendedUser extends UserProfile {
  firstName: string;
  initials: string;
  email: string;
  displayRole: string;
}

export interface AuthContextType {
  user: ExtendedUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  loginDemo: (role: Role) => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
  logout: () => Promise<void>;
  resetDemo: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Human-friendly role metadata for non-technical users
export const ROLE_DETAILS: Record<Role, { title: string; email: string; avatarText: string }> = {
  approver: {
    title: "Project Admin",
    email: "manjiri.relekar47@gmail.com",
    avatarText: "MJ",
  },
  leaver: {
    title: "Departing Lead (Aarav)",
    email: "aarav.lead@baton.internal",
    avatarText: "AR",
  },
  incoming_maintainer: {
    title: "Incoming Maintainer (Meera)",
    email: "meera.maintainer@baton.internal",
    avatarText: "MR",
  },
  incoming_contributor: {
    title: "Incoming Contributor",
    email: "contributor@baton.internal",
    avatarText: "IC",
  },
};

export function formatUser(
  rawUser: UserProfile,
  authenticatedEmail?: string | null,
): ExtendedUser {
  const meta = ROLE_DETAILS[rawUser.role] || {
    title: "Project Member",
    email: `${rawUser.id}@baton.internal`,
    avatarText: rawUser.name.slice(0, 2).toUpperCase(),
  };

  const nameParts = rawUser.name.trim().split(" ");
  const firstName = nameParts[0] || rawUser.name;
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
      : meta.avatarText;

  return {
    ...rawUser,
    firstName,
    initials,
    email: authenticatedEmail || rawUser.email || meta.email,
    displayRole: meta.title,
  };
}

async function getAuthenticatedEmail(): Promise<string | undefined> {
  if (!supabase) return undefined;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email || undefined;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Logs in using a demo role and saves the signed JWT
   */
  const loginDemo = useCallback(async (role: Role = "approver") => {
    setLoading(true);
    setError(null);
    try {
      const response = await batonApi.demoLogin(role);
      setStoredToken(response.token);
      setUser(formatUser(response.user, await getAuthenticatedEmail()));
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "Failed to sign in via demo role";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refetches user profile from GET /me using active JWT
   */
  const refreshProfile = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const [rawUser, authenticatedEmail] = await Promise.all([
        batonApi.getMe(),
        getAuthenticatedEmail(),
      ]);
      setUser(formatUser(rawUser, authenticatedEmail));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStoredToken(null);
        setUser(null);
      } else {
        throw err;
      }
    }
  }, []);

  /**
   * Initializes session on component mount
   */
  useEffect(() => {
    let isMounted = true;
    const initializeAuth = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getStoredToken();
        if (token) {
          try {
            const [raw, authenticatedEmail] = await Promise.all([
              batonApi.getMe(),
              getAuthenticatedEmail(),
            ]);
            if (isMounted) setUser(formatUser(raw, authenticatedEmail));
            return;
          } catch (e) {
            setStoredToken(null);
            if (isMounted) setUser(null);
            if (!(e instanceof ApiError && e.status === 401)) {
              throw e;
            }
          }
        } else {
          if (isMounted) setUser(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to initialize authentication"
          );
          setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Switch between roles seamlessly without reloading
   */
  const switchRole = useCallback(
    async (role: Role) => {
      setError(null);
      try {
        await loginDemo(role);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Role switch failed");
      }
    },
    [loginDemo]
  );

  /**
   * Logout and clear session
   */
  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut({ scope: "local" });
    }
    setStoredToken(null);
    setUser(null);
  }, []);

  /**
   * Reset backend demo database to seed state
   */
  const resetDemo = useCallback(async () => {
    setLoading(true);
    try {
      await batonApi.demoReset();
      await loginDemo("approver");
    } finally {
      setLoading(false);
    }
  }, [loginDemo]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: !!user,
      loginDemo,
      switchRole,
      logout,
      resetDemo,
      refreshProfile,
    }),
    [user, loading, error, loginDemo, switchRole, logout, resetDemo, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;

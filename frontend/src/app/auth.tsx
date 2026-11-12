import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role, User } from "@/shared/types";
import { api, ApiError, getToken, setToken } from "./api";

interface AuthValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  switchRole: (role: Role) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (role: Role) => {
      const data = await api<{ token: string; user: User }>("/auth/demo-login", { method: "POST", body: { role } });
      setToken(data.token);
      queryClient.clear(); // never reuse another role's cached responses
      setUser(data.user);
    },
    [queryClient],
  );

  useEffect(() => {
    (async () => {
      try {
        if (getToken()) {
          try {
            setUser(await api<User>("/me"));
            return;
          } catch (e) {
            if (!(e instanceof ApiError && e.status === 401)) throw e;
            setToken(null);
          }
        }
        await login("approver"); // a judge lands straight in the product: no login screen
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not sign in.");
      } finally {
        setLoading(false);
      }
    })();
  }, [login]);

  const switchRole = useCallback(
    async (role: Role) => {
      setError(null);
      try {
        await login(role);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not switch role.");
      }
    },
    [login],
  );

  const resetDemo = useCallback(async () => {
    await api("/demo/reset", { method: "POST" });
    await login("approver");
  }, [login]);

  return <AuthContext.Provider value={{ user, loading, error, switchRole, resetDemo }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

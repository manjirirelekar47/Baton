import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role, User } from "@/shared/types";
import { api, setToken } from "./api";
import { isSupabaseConfigured, supabase } from "./supabase";

interface AuthValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  switchRole: (role: Role) => Promise<void>;
  enterDemoWorkspace: () => Promise<void>;
  signOut: () => Promise<void>;
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
    if (isSupabaseConfigured && supabase) {
      let active = true;
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          setToken(null);
          queryClient.clear();
          setUser(null);
          setError(null);
        }
      });

      void supabase.auth
        .getSession()
        .then(({ data: sessionData, error: sessionError }) => {
          if (sessionError) throw sessionError;
          if (active && sessionData.session) return login("approver");
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : "Could not restore your session.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    }

    // Start at the sign-in page on every fresh app load. Demo access is an
    // explicit action from that page instead of an implicit demo login.
    setToken(null);
    setLoading(false);
  }, [login]);

  const enterDemoWorkspace = useCallback(async () => {
    setError(null);
    await login("approver");
  }, [login]);

  const signOut = useCallback(async () => {
    if (supabase) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    }
    setToken(null);
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

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

  return <AuthContext.Provider value={{ user, loading, error, switchRole, enterDemoWorkspace, signOut, resetDemo }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

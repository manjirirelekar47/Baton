/**
 * ProtectedRoute.tsx
 * Guards authenticated routes across the Baton platform.
 * 
 * Behavior:
 * - While session initialization / token validation is in-flight, renders a clean loading state.
 * - If user is unauthenticated (isAuthenticated === false && !user), redirects to /login with replace.
 * - If user is authenticated (isAuthenticated === true || user exists), renders children or nested <Outlet />.
 */

import React, { type ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/app/auth";

export interface ProtectedRouteProps {
  children?: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const isAuthed = isAuthenticated ?? !!user;

  // Prevent flash of redirect while validating existing token on mount
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0b0d1b] text-slate-900 dark:text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 dark:border-purple-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
            Verifying session…
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;

/**
 * router.tsx
 * Production Router configuration enforcing strict authentication guards.
 * 
 * Routing Rules:
 * - Root path (/) redirects to /dashboard if authenticated, or /signup if unauthenticated.
 * - Public routes: /login (LoginPage) and /signup (SignUp).
 * - Protected routes: Wrapped in <ProtectedRoute> requiring valid session/JWT before mounting
 *   <Shell> (hosting DashboardLayout) and all sub-routes (Dashboard, Ledger, Risk, Review,
 *   Graph, Access, Audit, Settings, Handover, Sources).
 */

import { createBrowserRouter, Navigate } from "react-router-dom";
import { SignUp } from "@/pages/SignUp";
import { Shell } from "./Shell";
import { Dashboard } from "@/pages/Dashboard";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { GraphPage } from "@/features/graph/pages/GraphPage";
import { AccessPage } from "@/features/access/pages/AccessPage";
import { AuditPage } from "@/features/audit/pages/AuditPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { RouteErrorBoundary } from "@/components/common/RouteErrorBoundary";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/app/auth";
import { featureRoutes } from "./features";
import type { Role } from "@/shared/types";

const roleGuardedFeatureRoutes = featureRoutes
  .filter((r) => r.path !== "dashboard")
  .map((route) => {
    let allowed: Role[] | undefined;
    if (route.path === "sources") allowed = ["approver"];
    else if (route.path === "review") allowed = ["approver", "leaver", "incoming_maintainer", "contributor", "incoming_contributor"];
    else if (route.path === "handover") allowed = ["approver", "incoming_maintainer", "contributor", "incoming_contributor"];
    else if (route.path === "risk") allowed = ["approver", "leaver", "incoming_maintainer"];

    if (allowed) {
      return {
        ...route,
        element: <ProtectedRoute allowedRoles={allowed}>{route.element}</ProtectedRoute>,
      };
    }
    return route;
  });

/**
 * RootRedirect handles intelligent routing for the root path (/):
 * - If user is authenticated -> redirects to /dashboard
 * - If user is unauthenticated -> redirects to /login
 */
function RootRedirect() {
  const { isAuthenticated, user, loading } = useAuth();
  const isAuthed = isAuthenticated ?? !!user;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0b0d1b]">
        <div className="w-8 h-8 border-3 border-indigo-600 dark:border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <Navigate to={isAuthed ? "/dashboard" : "/login"} replace />;
}

export const router = createBrowserRouter([
  // Public Root Route - intelligent redirect based on authentication
  {
    path: "/",
    element: <RootRedirect />,
    errorElement: <RouteErrorBoundary />,
  },

  // Public Authentication Routes (Unified Auth Page for both Login & Sign Up)
  {
    path: "/login",
    element: <SignUp />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/signup",
    element: <SignUp />,
    errorElement: <RouteErrorBoundary />,
  },

  // Protected Routes: Application Shell and all Feature Views
  {
    element: (
      <ProtectedRoute>
        <Shell />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "dashboard", element: <Dashboard /> },

      // Feature preview views with role protections
      {
        path: "graph",
        element: (
          <ProtectedRoute allowedRoles={["approver", "leaver", "incoming_maintainer", "contributor", "incoming_contributor"]}>
            <GraphPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "access",
        element: (
          <ProtectedRoute allowedRoles={["approver"]}>
            <AccessPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "audit",
        element: (
          <ProtectedRoute allowedRoles={["approver", "leaver"]}>
            <AuditPage />
          </ProtectedRoute>
        ),
      },
      { path: "settings", element: <SettingsPage /> },

      // Registered feature routes guarded by role
      ...roleGuardedFeatureRoutes,

      // Friendly 404 page for unmatched routes
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export default router;

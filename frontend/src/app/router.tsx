/**
 * router.tsx
 * Production Router configuration enforcing strict authentication guards.
 * Optimized with React.lazy code-splitting for high-speed initial loads.
 */

import React, { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Shell } from "./Shell";
import { RouteErrorBoundary } from "@/components/common/RouteErrorBoundary";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/app/auth";
import { featureRoutes } from "./features";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import type { Role } from "@/shared/types";

// Lazy-loaded routes for performance & code-splitting
const SignUp = lazy(() => import("@/pages/SignUp").then((m) => ({ default: m.SignUp })));
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const GraphPage = lazy(() => import("@/features/graph/pages/GraphPage").then((m) => ({ default: m.GraphPage })));
const AccessPage = lazy(() => import("@/features/access/pages/AccessPage").then((m) => ({ default: m.AccessPage })));
const AuditPage = lazy(() => import("@/features/audit/pages/AuditPage").then((m) => ({ default: m.AuditPage })));
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

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
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <SignUp />
      </Suspense>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/signup",
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <SignUp />
      </Suspense>
    ),
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
      {
        path: "dashboard",
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <Dashboard />
          </Suspense>
        ),
      },

      // Feature preview views with role protections
      {
        path: "graph",
        element: (
          <ProtectedRoute allowedRoles={["approver", "leaver", "incoming_maintainer", "contributor", "incoming_contributor"]}>
            <Suspense fallback={<PageSkeleton />}>
              <GraphPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "access",
        element: (
          <ProtectedRoute allowedRoles={["approver"]}>
            <Suspense fallback={<PageSkeleton />}>
              <AccessPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "audit",
        element: (
          <ProtectedRoute allowedRoles={["approver", "leaver"]}>
            <Suspense fallback={<PageSkeleton />}>
              <AuditPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "settings",
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <SettingsPage />
          </Suspense>
        ),
      },

      // Registered feature routes guarded by role
      ...roleGuardedFeatureRoutes,

      // Friendly 404 page for unmatched routes
      {
        path: "*",
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <NotFoundPage />
          </Suspense>
        ),
      },
    ],
  },
]);

export default router;

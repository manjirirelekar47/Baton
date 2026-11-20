import React, { Suspense, lazy } from "react";
import type { FeatureModule } from "@/shared/types";
import { PageSkeleton } from "@/components/common/PageSkeleton";

const Dashboard = lazy(() =>
  import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard }))
);

const feature: FeatureModule = {
  routes: [
    {
      path: "dashboard",
      element: (
        <Suspense fallback={<PageSkeleton />}>
          <Dashboard />
        </Suspense>
      ),
    },
  ],
  nav: [{ label: "Dashboard", to: "/dashboard", order: 5 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

import React, { Suspense, lazy } from "react";
import type { FeatureModule } from "@/shared/types";
import { PageSkeleton } from "@/components/common/PageSkeleton";

const RiskPage = lazy(() =>
  import("./pages/RiskPage").then((m) => ({ default: m.RiskPage }))
);

const feature: FeatureModule = {
  routes: [
    {
      path: "risk",
      element: (
        <Suspense fallback={<PageSkeleton />}>
          <RiskPage />
        </Suspense>
      ),
    },
  ],
  nav: [{ label: "Risk", to: "/risk", order: 20 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

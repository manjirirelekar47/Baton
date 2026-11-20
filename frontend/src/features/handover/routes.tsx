import React, { Suspense, lazy } from "react";
import type { FeatureModule } from "@/shared/types";
import { PageSkeleton } from "@/components/common/PageSkeleton";

const HandoverPage = lazy(() =>
  import("./pages/HandoverPage").then((m) => ({ default: m.HandoverPage }))
);

const feature: FeatureModule = {
  routes: [
    {
      path: "handover",
      element: (
        <Suspense fallback={<PageSkeleton />}>
          <HandoverPage />
        </Suspense>
      ),
    },
  ],
  nav: [{ label: "Handover", to: "/handover", order: 50 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

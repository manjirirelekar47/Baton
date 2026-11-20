import React, { Suspense, lazy } from "react";
import type { FeatureModule } from "@/shared/types";
import { PageSkeleton } from "@/components/common/PageSkeleton";

const SourcesPage = lazy(() =>
  import("./pages/SourcesPage").then((m) => ({ default: m.SourcesPage }))
);

const feature: FeatureModule = {
  routes: [
    {
      path: "sources",
      element: (
        <Suspense fallback={<PageSkeleton />}>
          <SourcesPage />
        </Suspense>
      ),
    },
  ],
  nav: [{ label: "Sources", to: "/sources", order: 10 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

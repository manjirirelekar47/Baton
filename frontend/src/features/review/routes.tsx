import React, { Suspense, lazy } from "react";
import type { FeatureModule } from "@/shared/types";
import { PageSkeleton } from "@/components/common/PageSkeleton";

const ReviewPage = lazy(() =>
  import("./pages/ReviewPage").then((m) => ({ default: m.ReviewPage }))
);

const feature: FeatureModule = {
  routes: [
    {
      path: "review",
      element: (
        <Suspense fallback={<PageSkeleton />}>
          <ReviewPage />
        </Suspense>
      ),
    },
  ],
  nav: [{ label: "Review", to: "/review", order: 40 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

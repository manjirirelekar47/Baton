import React, { Suspense, lazy } from "react";
import type { FeatureModule } from "@/shared/types";
import { PageSkeleton } from "@/components/common/PageSkeleton";

const AskPage = lazy(() =>
  import("./pages/AskPage").then((m) => ({ default: m.AskPage }))
);

const feature: FeatureModule = {
  routes: [
    {
      path: "ask",
      element: (
        <Suspense fallback={<PageSkeleton />}>
          <AskPage />
        </Suspense>
      ),
    },
  ],
  nav: [{ label: "Ask Baton", to: "/ask", order: 25 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

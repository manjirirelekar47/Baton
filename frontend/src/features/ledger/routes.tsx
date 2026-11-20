import React, { Suspense, lazy } from "react";
import type { FeatureModule } from "@/shared/types";
import { PageSkeleton } from "@/components/common/PageSkeleton";

const LedgerPage = lazy(() =>
  import("./pages/LedgerPage").then((m) => ({ default: m.LedgerPage }))
);

const feature: FeatureModule = {
  routes: [
    {
      path: "ledger",
      element: (
        <Suspense fallback={<PageSkeleton />}>
          <LedgerPage />
        </Suspense>
      ),
    },
  ],
  nav: [{ label: "Ledger", to: "/ledger", order: 30 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

import type { FeatureModule } from "@/shared/types";
import { LedgerPage } from "./pages/LedgerPage";

const feature: FeatureModule = {
  routes: [{ path: "ledger", element: <LedgerPage /> }],
  nav: [{ label: "Ledger", to: "/ledger", order: 30 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

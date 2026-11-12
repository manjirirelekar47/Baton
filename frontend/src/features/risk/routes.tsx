import type { FeatureModule } from "@/shared/types";
import { RiskPage } from "./pages/RiskPage";

const feature: FeatureModule = {
  routes: [{ path: "risk", element: <RiskPage /> }],
  nav: [{ label: "Risk", to: "/risk", order: 20 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

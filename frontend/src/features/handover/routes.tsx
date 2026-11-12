import type { FeatureModule } from "@/shared/types";
import { HandoverPage } from "./pages/HandoverPage";

const feature: FeatureModule = {
  routes: [{ path: "handover", element: <HandoverPage /> }],
  nav: [{ label: "Handover", to: "/handover", order: 50 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

import type { FeatureModule } from "@/shared/types";
import { Dashboard } from "@/pages/Dashboard";

const feature: FeatureModule = {
  routes: [{ path: "dashboard", element: <Dashboard /> }],
  nav: [{ label: "Dashboard", to: "/dashboard", order: 5 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

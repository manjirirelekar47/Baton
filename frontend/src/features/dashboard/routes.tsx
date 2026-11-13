import type { FeatureModule } from "@/shared/types";
import { DashboardPage } from "./pages/DashboardPage";

const feature: FeatureModule = {
  routes: [{ path: "dashboard", element: <DashboardPage /> }],
  nav: [{ label: "Dashboard", to: "/dashboard", order: 5 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

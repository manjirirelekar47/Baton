import type { FeatureModule } from "@/shared/types";
import { SourcesPage } from "./pages/SourcesPage";

const feature: FeatureModule = {
  routes: [{ path: "sources", element: <SourcesPage /> }],
  nav: [{ label: "Sources", to: "/sources", order: 10 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

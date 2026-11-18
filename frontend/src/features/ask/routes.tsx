import type { FeatureModule } from "@/shared/types";
import { AskPage } from "./pages/AskPage";

const feature: FeatureModule = {
  routes: [{ path: "ask", element: <AskPage /> }],
  nav: [{ label: "Ask Baton", to: "/ask", order: 25 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

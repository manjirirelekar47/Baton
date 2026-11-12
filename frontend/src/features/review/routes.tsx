import type { FeatureModule } from "@/shared/types";
import { ReviewPage } from "./pages/ReviewPage";

const feature: FeatureModule = {
  routes: [{ path: "review", element: <ReviewPage /> }],
  nav: [{ label: "Review", to: "/review", order: 40 }],
};
export const routes = feature.routes;
export const nav = feature.nav;

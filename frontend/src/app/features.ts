/** Route and nav auto-collection. FROZEN after Day 0.
 * Every features/<name>/routes.tsx exports `routes` (and optionally `nav`). Adding a page never touches this file. */
import type { RouteObject } from "react-router-dom";
import type { FeatureModule, NavEntry } from "@/shared/types";

const modules = import.meta.glob<FeatureModule>("../features/*/routes.tsx", { eager: true });
const loaded = Object.values(modules);

export const navEntries: NavEntry[] = loaded.flatMap((m) => m.nav ?? []).sort((a, b) => a.order - b.order);
export const featureRoutes: RouteObject[] = loaded.flatMap((m) => m.routes);

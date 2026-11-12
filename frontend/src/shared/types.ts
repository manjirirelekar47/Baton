import type { RouteObject } from "react-router-dom";

export type Role = "approver" | "leaver" | "incoming_maintainer" | "incoming_contributor";
export type ClaimState = "verified" | "inferred" | "conflicting" | "missing" | "attested";

export interface User {
  id: string;
  name: string;
  role: Role;
  project_id: string;
}

export interface NavEntry {
  label: string;
  to: string;
  order: number;
}

/** Each feature's routes.tsx exports `routes` and optionally `nav` (auto-collected by app/router.tsx). */
export interface FeatureModule {
  routes: RouteObject[];
  nav?: NavEntry[];
}

export const ROLE_LABELS: Record<Role, string> = {
  approver: "Approver",
  leaver: "Leaver (Aarav)",
  incoming_maintainer: "Incoming Maintainer (Meera)",
  incoming_contributor: "Incoming Contributor",
};

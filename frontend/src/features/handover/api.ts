import { api } from "@/app/api";
import type { ClaimState } from "@/shared/types";

export interface EvidenceView {
  chunk_id: string;
  quote: string;
  source_id: string;
  source_title: string;
  event_time: string | null;
}

export interface ClaimView {
  claim_id: string;
  type: string;
  section: string;
  statement: string;
  state: ClaimState;
  access_label: string;
  owner: string | null;
  proposed_owner: string | null;
  proposed_for_me: boolean;
  due_date: string | null;
  blocked_by: string[];
  attested_by: string | null;
  evidence: EvidenceView[];
}

export interface SectionView {
  key: string;
  title: string;
  claims: ClaimView[];
  acknowledged_at: string | null;
}

export interface HandoverView {
  version: { version_id: string; status: string; approved_by: string | null; approved_at: string | null; snapshot_hash: string | null };
  role: string;
  sections: SectionView[];
  hidden: { count: number };
  ownership_responses: Record<string, "accept" | "decline">;
  can_acknowledge: boolean;
  receipt_note: string;
}

export interface PlanItem {
  claim_id: string;
  kind: "unblock" | "confirm_owner" | "next_action";
  title: string;
  state: ClaimState;
  owner: string | null;
  owner_known: boolean;
  proposed_owner: string | null;
  proposed_for_me: boolean;
  due_date: string | null;
  blocked_by: string[];
  cycle: boolean;
  level: number;
  position: number;
  evidence: EvidenceView[];
}

export type PlanBuckets = { day_1: PlanItem[]; week_1: PlanItem[]; month_1: PlanItem[] };
export interface PlanResponse {
  version_id: string;
  role: string;
  plan: PlanBuckets;
  note: string;
}

const base = (versionId: string) => `/handover/${encodeURIComponent(versionId)}`;

export const getView = (versionId: string) => api<HandoverView>(`${base(versionId)}/view`);
export const getPlan = (versionId: string) => api<PlanResponse>(`${base(versionId)}/plan`);
export const acknowledge = (versionId: string, section: string) =>
  api<{ section: string; acknowledged_at: string; note: string }>("/handover/ack", {
    method: "POST",
    body: { version_id: versionId, section },
  });
export const respondOwnership = (versionId: string, claimId: string, response: "accept" | "decline") =>
  api<{ claim_id: string; response: string }>("/handover/ownership", {
    method: "POST",
    body: { version_id: versionId, claim_id: claimId, response },
  });

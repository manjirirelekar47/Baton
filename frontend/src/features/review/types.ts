import type { ClaimState } from "@/shared/types";

export interface EvidenceOut {
  chunk_id: string;
  quote: string;
  acl_label?: string;
  source_id?: string;
  source_title?: string;
  event_time?: string;
}

export type ReviewActionType =
  | "confirm"
  | "edit"
  | "reject"
  | "mark_unknown"
  | "ask_leaver"
  | "resolve_conflict"
  | "accept_uncertainty";

export interface QueueItem {
  claim_id: string;
  claim_type: string;
  entity_key?: string | null;
  attribute?: string | null;
  statement: string;
  state: string; // "Verified" | "Inferred" | "Conflicting" | "Missing" | "Attested" | "Stale"
  review_state: string;
  acl_label: string;
  risk_rank: number;
  risk_reason: string;
  evidence: EvidenceOut[];
  conflict_with: string[];
  suggested_claim_id?: string | null;
  pending: boolean;
  last_action?: ReviewActionType | null;
}

export interface ReviewQueue {
  project_id: string;
  total: number;
  pending: number;
  items: QueueItem[];
}

export interface ReadinessReport {
  ready: boolean;
  unresolved_conflicts: string[];
  unaccepted_inferred: string[];
  pending_count: number;
  included_count: number;
  reasons: string[];
}

export interface ActionRequest {
  action: ReviewActionType;
  note?: string | null;
  edited_statement?: string | null;
  chosen_claim_id?: string | null;
}

export interface ActionResult {
  review: {
    id: string;
    project_id: string;
    claim_id: string;
    reviewer_id: string;
    reviewer_role: string;
    action: ReviewActionType;
    note?: string | null;
    created_at: string;
  };
  claim: QueueItem;
  readiness: ReadinessReport;
}

export interface BulkConfirmResult {
  confirmed: number;
  claim_ids: string[];
  readiness: ReadinessReport;
}

export interface ApproveRequest {
  shared_to_roles?: string[];
  note?: string | null;
}

export interface VersionSummary {
  id: string;
  version_id: string;
  project_id: string;
  version_number: number;
  status: "draft" | "approved";
  approved_by: string;
  approved_at: string | null;
  snapshot_hash: string;
  claim_count: number;
  accepted_uncertainty_count: number;
  shared_roles: string[];
  shared_with: string[];
  created_at: string;
}

export interface SnapshotClaim {
  claim_id: string;
  type: string;
  entity_key?: string | null;
  attribute?: string | null;
  statement: string;
  state: string;
  acl_label: string;
  evidence: EvidenceOut[];
  decision: string;
  note?: string | null;
  owner?: string | null;
  proposed_owner?: string | null;
  proposed_owner_id?: string | null;
  due_date?: string | null;
  blocked_by: string[];
  attested_by?: string | null;
  unknown: boolean;
}

export interface VersionDetail extends VersionSummary {
  claims: SnapshotClaim[];
  hash_valid: boolean;
}

export interface AuditEntry {
  id: string;
  project_id: string;
  actor_id: string;
  actor_role: string;
  event_type: string;
  object_type: string;
  object_id: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface GapItem {
  gap_id: string;
  question: string;
  entity_key?: string | null;
  acl_label: string;
  source: "gap" | "ask_leaver";
  answered: boolean;
  answer?: string | null;
}

export interface GapInterview {
  project_id: string;
  total: number;
  unanswered: number;
  items: GapItem[];
}

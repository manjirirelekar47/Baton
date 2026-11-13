/** API client for the Claim Ledger & Reconstruction features (F3, F4). */
import { api } from "@/app/api";
import type { ClaimState } from "@/shared/types";

export interface EvidenceItem {
  chunk_id: string;
  quote: string;
  source_id?: string;
  source_title?: string;
  acl_label?: string;
  event_time?: string;
}

export interface Claim {
  claim_id: string;
  type: string;
  entity_key: string;
  attribute: string;
  statement: string;
  state: ClaimState;
  acl_label: string;
  owner?: string | null;
  proposed_owner?: string | null;
  proposed_owner_id?: string | null;
  due_date?: string | null;
  blocked_by?: string[];
  attested_by?: string | null;
  conflict_with?: string[];
  evidence: EvidenceItem[];
}

export interface ClaimsResponse {
  claims: Claim[];
  hidden_count: number;
}

export interface Gap {
  gap_id: string;
  question: string;
  reason: string;
  asked_to?: string | null;
  claim_id?: string | null;
}

export interface ReconstructJob {
  job_id: string;
  status: "pending" | "running" | "done" | "failed";
  mode: "replay" | "llm";
  progress: number;
  note?: string;
  claims_count?: number;
  gaps_count?: number;
  error?: string | null;
}

export async function fetchClaims(): Promise<ClaimsResponse> {
  return api<ClaimsResponse>("/claims");
}

export async function fetchClaim(claimId: string): Promise<Claim> {
  return api<Claim>(`/claims/${encodeURIComponent(claimId)}`);
}

export async function fetchGaps(): Promise<Gap[]> {
  return api<Gap[]>("/gaps");
}

export async function triggerReconstruct(): Promise<ReconstructJob> {
  return api<ReconstructJob>("/reconstruct", { method: "POST" });
}

export async function fetchJob(jobId: string): Promise<ReconstructJob> {
  return api<ReconstructJob>(`/jobs/${encodeURIComponent(jobId)}`);
}

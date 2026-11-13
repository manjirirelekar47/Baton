import { api } from "@/app/api";
import type {
  ActionRequest,
  ActionResult,
  ApproveRequest,
  AuditEntry,
  BulkConfirmResult,
  GapInterview,
  QueueItem,
  ReadinessReport,
  ReviewQueue,
  VersionDetail,
  VersionSummary,
} from "./types";

export async function getReviewQueue(): Promise<ReviewQueue> {
  return api<ReviewQueue>("/review/queue");
}

export async function getReadiness(): Promise<ReadinessReport> {
  return api<ReadinessReport>("/review/readiness");
}

export async function postAction(claimId: string, req: ActionRequest): Promise<ActionResult> {
  return api<ActionResult>(`/review/${encodeURIComponent(claimId)}/action`, {
    method: "POST",
    body: req,
  });
}

export async function confirmAllVerified(): Promise<BulkConfirmResult> {
  return api<BulkConfirmResult>("/review/confirm-verified", {
    method: "POST",
  });
}

export async function approveVersion(req: ApproveRequest = {}): Promise<VersionSummary> {
  return api<VersionSummary>("/review/approve", {
    method: "POST",
    body: req,
  });
}

export async function getVersions(): Promise<VersionSummary[]> {
  return api<VersionSummary[]>("/versions");
}

export async function getVersionDetail(versionId: string): Promise<VersionDetail> {
  return api<VersionDetail>(`/versions/${encodeURIComponent(versionId)}`);
}

export async function getAudit(limit = 100, offset = 0): Promise<AuditEntry[]> {
  return api<AuditEntry[]>(`/audit?limit=${limit}&offset=${offset}`);
}

export async function getGapInterview(): Promise<GapInterview> {
  return api<GapInterview>("/review/gap-interview");
}

export async function postGapAnswer(gapId: string, answer: string): Promise<{ gap_id: string; claim_id: string; state: string; redactions: number }> {
  return api<{ gap_id: string; claim_id: string; state: string; redactions: number }>("/review/gap-answers", {
    method: "POST",
    body: { gap_id: gapId, answer },
  });
}

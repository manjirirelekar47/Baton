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
  action_status?: "not_started" | "in_progress" | "blocked" | "completed";
  action_notes?: string | null;
  action_updated_at?: string | null;
  action_updated_by?: string | null;
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

export const updateActionStatus = (
  versionId: string,
  claimId: string,
  status: "not_started" | "in_progress" | "blocked" | "completed",
  notes?: string
) =>
  api<{
    version_id: string;
    claim_id: string;
    status: string;
    notes: string | null;
    updated_at: string;
    updated_by: string;
  }>("/handover/action-status", {
    method: "POST",
    body: { version_id: versionId, claim_id: claimId, status, notes },
  });

export interface CreateTaskPayload {
  version_id: string;
  title: string;
  kind?: string;
  owner?: string | null;
  due_date?: string | null;
  status?: "not_started" | "in_progress" | "blocked" | "completed";
  notes?: string | null;
  blocked_by?: string[];
}

export const createTask = (payload: CreateTaskPayload) =>
  api<PlanItem>("/handover/tasks", {
    method: "POST",
    body: payload,
  });

export interface UpdateTaskPayload {
  version_id: string;
  title?: string;
  owner?: string | null;
  due_date?: string | null;
  status?: "not_started" | "in_progress" | "blocked" | "completed";
  notes?: string | null;
  blocked_by?: string[];
}

export const updateTask = (taskId: string, payload: UpdateTaskPayload) =>
  api<PlanItem>(`/handover/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: payload,
  });

export const deleteTask = (versionId: string, taskId: string) =>
  api<{ status: string; task_id: string }>(`/handover/${encodeURIComponent(versionId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });

export interface ActivityHistoryItem {
  id: string;
  version_id: string;
  project_id: string;
  task_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface ActivityHistoryResponse {
  version_id: string;
  task_id: string;
  history: ActivityHistoryItem[];
}

export const getTaskHistory = (versionId: string, taskId: string) =>
  api<ActivityHistoryResponse>(`/handover/${encodeURIComponent(versionId)}/tasks/${encodeURIComponent(taskId)}/history`);

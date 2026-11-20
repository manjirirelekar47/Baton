/**
 * Baton Production API Client
 * Configured for FastAPI backend with JWT Bearer authentication,
 * automatic error handling, latency monitoring, and strict typing.
 */

const defaultHost =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "localhost";

let activeApiBaseUrl: string = (
  import.meta.env.VITE_API_URL ?? `http://${defaultHost}:8000`
).replace(/\/$/, "");

export function getApiBaseUrl(): string {
  return activeApiBaseUrl;
}

export function setApiBaseUrl(url: string): void {
  activeApiBaseUrl = url.replace(/\/$/, "");
}

export const API_BASE_URL = activeApiBaseUrl;

function getAlternativeUrl(url: string): string | null {
  if (url.includes("//localhost:8000")) {
    return url.replace("//localhost:8000", "//127.0.0.1:8000");
  }
  if (url.includes("//127.0.0.1:8000")) {
    return url.replace("//127.0.0.1:8000", "//127.0.0.1:8001");
  }
  if (url.includes("//localhost:8001")) {
    return url.replace("//localhost:8001", "//127.0.0.1:8001");
  }
  if (url.includes("//127.0.0.1:8001")) {
    return url.replace("//127.0.0.1:8001", "//127.0.0.1:8000");
  }
  if (url.includes("//localhost:")) {
    return url.replace("//localhost:", "//127.0.0.1:");
  }
  if (url.includes("//127.0.0.1:")) {
    return url.replace("//127.0.0.1:", "//localhost:");
  }
  return null;
}

export const TOKEN_STORAGE_KEY = "baton.token";

export type Role =
  | "approver"
  | "leaver"
  | "incoming_maintainer"
  | "contributor"
  | "incoming_contributor";

export type ClaimState =
  | "verified"
  | "inferred"
  | "conflicting"
  | "missing"
  | "attested"
  | "stale";

export type AclLabel = "L1" | "L2" | "L3" | "L4";

/* =========================================================================
   TypeScript Interfaces (matching FastAPI Pydantic Models & OpenAPI Spec)
   ========================================================================= */

export interface UserProfile {
  id: string;
  name: string;
  role: Role;
  project_id: string;
  email?: string;
  is_demo?: boolean;
  avatar_url?: string;
}

export interface RegisterPayload {
  user_id?: string;
  email: string;
  name: string;
  role?: Role;
  invitation_code?: string;
  project_id?: string;
  supabase_token?: string;
}

export interface SessionSyncPayload {
  user_id: string;
  email: string;
  name?: string;
  project_id?: string;
  supabase_token?: string;
}

export interface SessionSyncResponse {
  registered: boolean;
  requires_role?: boolean;
  has_projects?: boolean;
  requires_project?: boolean;
  token?: string;
  user?: UserProfile;
  user_id?: string;
  email?: string;
  projects?: ProjectItem[];
  active_project_id?: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  role: Role;
  owner_id?: string;
  active?: boolean;
}

export interface SwitchProjectResponse {
  token: string;
  user: UserProfile;
  project: ProjectItem;
}

export interface ValidateInvitationResponse {
  valid: boolean;
  role?: Role;
  email?: string;
  detail?: string;
}

export interface InvitationItem {
  id: string;
  project_id: string;
  code: string;
  role: Role;
  email?: string | null;
  status: "active" | "redeemed" | "used" | "revoked" | string;
  created_at: string;
  used_by?: string | null;
  used_by_name?: string | null;
  used_at?: string | null;
  handover_deadline?: string | null;
}

export interface DemoLoginResponse {
  token: string;
  user: UserProfile;
  projects?: ProjectItem[];
  active_project_id?: string;
}

export interface EvidenceItem {
  chunk_id: string;
  quote: string;
  source_id?: string;
  source_title?: string;
  acl_label: AclLabel | string;
  event_time?: string | null;
  char_span?: [number, number];
}

export interface ClaimItem {
  claim_id: string;
  type: string;
  entity_key?: string | null;
  attribute?: string | null;
  statement: string;
  state: ClaimState;
  review_state?: string;
  acl_label: AclLabel;
  owner?: string | null;
  proposed_owner?: string | null;
  proposed_owner_id?: string | null;
  due_date?: string | null;
  blocked_by?: string[];
  attested_by?: string | null;
  evidence: EvidenceItem[];
  conflict_with?: string[];
  suggested_claim_id?: string | null;
  is_transferred?: boolean;
  transferred_from?: string | null;
  original_owner?: string | null;
  transfer_notes?: string | null;
}

export interface ClaimsListResponse {
  claims: ClaimItem[];
  hidden_count: number;
}

export interface QueueItem {
  claim_id: string;
  claim_type: string;
  entity_key?: string | null;
  attribute?: string | null;
  statement: string;
  state: ClaimState;
  review_state: string;
  acl_label: AclLabel;
  risk_rank: number;
  risk_reason: string;
  evidence: EvidenceItem[];
  conflict_with: string[];
  suggested_claim_id?: string | null;
  pending: boolean;
  last_action?: string | null;
}

export interface ReviewQueueResponse {
  project_id: string;
  total: number;
  pending: number;
  items: QueueItem[];
}

export interface RiskModule {
  module: string;
  person: string;
  exclusivity: number;
  dependents: number;
  undocumented_decisions: number;
  account_ties: number;
  work_in_flight: number;
  flagged: boolean;
  reasons: string[];
  evidence_chunk_ids: string[];
}

export interface DeliveryStatusItem {
  id: string;
  title: string;
  owner?: string | null;
  status: string;
  due?: string | null;
  blocked_by: string[];
  is_overdue?: boolean;
}

export interface TimelineEvent {
  time: string;
  title: string;
  type: string;
  author?: string;
  chunk_id?: string;
}

export interface ReadinessReport {
  ready: boolean;
  unresolved_conflicts: string[];
  unaccepted_inferred: string[];
  pending_count: number;
  included_count: number;
  reasons: string[];
}

export interface ReviewActionPayload {
  action: "confirm" | "edit" | "reject" | "mark_unknown" | "ask_leaver" | "resolve_conflict" | "accept_uncertainty";
  note?: string;
  edited_statement?: string;
  chosen_claim_id?: string;
}

export interface ProjectMember {
  id: string;
  name: string;
  email?: string | null;
  role: Role;
  raw_role?: Role | string;
  active: boolean;
  is_demo?: boolean;
  handover_deadline?: string | null;
  handover_status?: string | null;
}

export interface RemainingTaskItem {
  id: string;
  type: "task" | "claim";
  title: string;
  status: string;
  due?: string | null;
  priority?: string | null;
  is_transferred?: boolean;
  transferred_from?: string | null;
  original_owner?: string | null;
  transfer_notes?: string | null;
}

export interface RemainingTasksResponse {
  member_id: string;
  member_name: string;
  role: string;
  tasks_count: number;
  claims_count: number;
  total_count: number;
  tasks: RemainingTaskItem[];
  claims: RemainingTaskItem[];
}

export interface TransferTasksResponse {
  status: string;
  transferred_tasks: number;
  transferred_claims: number;
  target_member_id: string;
  target_member_name: string;
}

export interface SourceItem {
  source_id: string;
  project_id: string;
  title: string;
  type: string;
  acl_label: string;
  status: string;
  chunks: number;
  note?: string | null;
  created_at?: string | null;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "person" | "module" | "task" | "claim" | "source";
  metadata?: {
    status?: string;
    state?: string;
    confidence?: string;
    statement?: string;
    entity_key?: string;
    attribute?: string;
    source_type?: string;
    [key: string]: unknown;
  };
}

export interface GraphEvidence {
  chunk_id?: string;
  quote?: string;
  source_id?: string;
  source_title?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: "OWNS" | "AUTHORED" | "REVIEWED" | "IMPORTS" | "BLOCKS" | "SUPPORTED BY" | string;
  count?: number;
  evidence?: GraphEvidence[];
  evidence_chunk_id?: string;
  evidence_quote?: string;
  source_title?: string;
  source_id?: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    total_nodes: number;
    connections: number;
    people: number;
  };
}

/* =========================================================================
   Token Management
   ========================================================================= */

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable: fallback to memory
  }
}

export const PROJECT_ID_STORAGE_KEY = "baton_active_project_id";

export function getStoredProjectId(userId?: string): string | null {
  try {
    if (userId) {
      const userSpecific = localStorage.getItem(`${PROJECT_ID_STORAGE_KEY}_${userId}`);
      if (userSpecific) return userSpecific;
    }
    return localStorage.getItem(PROJECT_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredProjectId(projectId: string | null, userId?: string): void {
  try {
    if (projectId) {
      localStorage.setItem(PROJECT_ID_STORAGE_KEY, projectId);
      if (userId) {
        localStorage.setItem(`${PROJECT_ID_STORAGE_KEY}_${userId}`, projectId);
      }
    } else {
      localStorage.removeItem(PROJECT_ID_STORAGE_KEY);
      if (userId) {
        localStorage.removeItem(`${PROJECT_ID_STORAGE_KEY}_${userId}`);
      }
    }
  } catch {
    // Storage unavailable
  }
}

/* =========================================================================
   Custom Error Class
   ========================================================================= */

export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: string | string[];

  constructor(status: number, message: string, detail?: string | string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/* =========================================================================
   Core Request Wrapper (Fetch-based Axios-compatible Engine)
   ========================================================================= */

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, timeoutMs = 12000, headers = {}, ...customConfig } = options;

  const currentBase = getApiBaseUrl();
  let url = `${currentBase}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const token = getStoredToken();
  const activeProjectId = getStoredProjectId();
  const isBodyAllowed = customConfig.method && !["GET", "HEAD"].includes(customConfig.method.toUpperCase());
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(isBodyAllowed && customConfig.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeProjectId ? { "X-Project-Id": activeProjectId } : {}),
    ...(headers as Record<string, string>),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    try {
      response = await fetch(url, {
        ...customConfig,
        headers: requestHeaders,
        signal: controller.signal,
      });
    } catch (primaryErr: unknown) {
      if (primaryErr instanceof Error && primaryErr.name === "AbortError") {
        throw primaryErr;
      }
      const altUrl = getAlternativeUrl(url);
      if (altUrl) {
        response = await fetch(altUrl, {
          ...customConfig,
          headers: requestHeaders,
          signal: controller.signal,
        });
        if (altUrl.includes("//127.0.0.1:8000")) {
          setApiBaseUrl(activeApiBaseUrl.replace(/\/\/(localhost|127\.0\.0\.1):(8000|8001)/, "//127.0.0.1:8000"));
        } else if (altUrl.includes("//127.0.0.1:8001")) {
          setApiBaseUrl(activeApiBaseUrl.replace(/\/\/(localhost|127\.0\.0\.1):(8000|8001)/, "//127.0.0.1:8001"));
        } else if (altUrl.includes("//localhost:8000")) {
          setApiBaseUrl(activeApiBaseUrl.replace(/\/\/(localhost|127\.0\.0\.1):(8000|8001)/, "//localhost:8000"));
        } else if (altUrl.includes("//localhost:8001")) {
          setApiBaseUrl(activeApiBaseUrl.replace(/\/\/(localhost|127\.0\.0\.1):(8000|8001)/, "//localhost:8001"));
        }
      } else {
        throw primaryErr;
      }
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(408, "Request timed out connecting to Baton backend.");
    }
    throw new ApiError(
      0,
      "Cannot connect to Baton API. Verify backend is running on " + getApiBaseUrl()
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // 401 Unauthorized handling: notify session expired
  if (response.status === 401) {
    setStoredToken(null);
  }

  if (!response.ok) {
    let errorDetail: string | string[] = response.statusText;
    try {
      const errJson = await response.json();
      if (typeof errJson.detail === "string") {
        errorDetail = errJson.detail;
      } else if (Array.isArray(errJson.detail)) {
        errorDetail = errJson.detail.map((e: { msg?: string }) => e.msg || "Invalid field");
      }
    } catch {
      // Use statusText
    }
    const message = Array.isArray(errorDetail) ? errorDetail.join(", ") : errorDetail;
    throw new ApiError(response.status, message, errorDetail);
  }

  // Parse JSON response
  if (response.status === 204) {
    return {} as T;
  }
  return (await response.json()) as T;
}

/* =========================================================================
   Axios-like REST Client
   ========================================================================= */

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: "GET", ...options }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: "PUT",
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: "DELETE", ...options }),
};

/* =========================================================================
   Domain-Specific API Functions (Direct Backend Mappings)
   ========================================================================= */

export const batonApi = {
  // Core & Auth
  getHealth: () => apiClient.get<{ status: string }>("/health"),
  checkHealth: async (): Promise<{ ok: boolean; status?: string; url: string }> => {
    try {
      const res = await apiClient.get<{ status: string }>("/health", { timeoutMs: 3000 });
      return { ok: true, status: res.status, url: getApiBaseUrl() };
    } catch {
      return { ok: false, url: getApiBaseUrl() };
    }
  },
  getMe: () => apiClient.get<UserProfile>("/me"),
  demoLogin: (role: Role) =>
    apiClient.post<DemoLoginResponse>("/auth/demo-login", { role }),
  register: (payload: RegisterPayload) =>
    apiClient.post<{ token: string; user: UserProfile }>(
      "/auth/register",
      payload,
      payload.supabase_token ? { headers: { Authorization: `Bearer ${payload.supabase_token}` } } : undefined
    ),
  syncSession: (payload: SessionSyncPayload) =>
    apiClient.post<SessionSyncResponse>(
      "/auth/session",
      payload,
      payload.supabase_token ? { headers: { Authorization: `Bearer ${payload.supabase_token}` } } : undefined
    ),
  validateInvitation: (code: string) =>
    apiClient.get<ValidateInvitationResponse>(`/auth/invitations/validate?code=${encodeURIComponent(code)}`),
  createInvitation: (role: Role = "approver", email?: string, projectId?: string, handoverDeadline?: string) =>
    apiClient.post<InvitationItem>(projectId ? `/projects/${projectId}/invitations` : "/auth/invitations", {
      role,
      email,
      handover_deadline: handoverDeadline || undefined,
    }),
  getInvitations: (projectId?: string) =>
    apiClient.get<InvitationItem[]>(projectId ? `/projects/${projectId}/invitations` : "/auth/invitations"),
  revokeInvitation: (id: string) =>
    apiClient.post<{ status: string; id: string }>(`/auth/invitations/${id}/revoke`),
  demoReset: () =>
    apiClient.post<{ status: string; project_id: string }>("/demo/reset"),

  // Projects & Multi-Project
  getProjects: () => apiClient.get<ProjectItem[]>("/projects"),
  getProjectMembers: (projectId: string) =>
    apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`),
  getRemainingTasks: (projectId: string, memberId: string) =>
    apiClient.get<RemainingTasksResponse>(`/projects/${projectId}/members/${memberId}/remaining-tasks`),
  transferMemberTasks: (projectId: string, memberId: string, targetMemberId: string, taskIds?: string[]) =>
    apiClient.post<TransferTasksResponse>(`/projects/${projectId}/members/${memberId}/transfer-tasks`, {
      target_member_id: targetMemberId,
      task_ids: taskIds,
    }),
  completeMemberHandover: (projectId: string, memberId: string) =>
    apiClient.post<{ status: string; member_id: string; active: boolean; handover_status: string }>(
      `/projects/${projectId}/members/${memberId}/complete-handover`
    ),
  createProject: (name: string) =>
    apiClient.post<{ project: ProjectItem; token: string; user: UserProfile }>("/projects", { name }),
  joinProject: (invitation_code: string) =>
    apiClient.post<{ project: ProjectItem; token: string; user: UserProfile }>("/projects/join", { invitation_code }),
  switchProject: (project_id: string) =>
    apiClient.post<SwitchProjectResponse>("/auth/switch-project", { project_id }),

  // Sources & Evidence
  getSources: () => apiClient.get<SourceItem[]>("/sources"),

  // Claims & Ledger
  getClaims: () => apiClient.get<ClaimsListResponse>("/claims"),
  getClaimById: (claimId: string) => apiClient.get<ClaimItem>(`/claims/${claimId}`),
  getGaps: () => apiClient.get<unknown[]>("/gaps"),

  // Review Queue
  getReviewQueue: () => apiClient.get<ReviewQueueResponse>("/review/queue"),
  getReadiness: () => apiClient.get<ReadinessReport>("/review/readiness"),
  postReviewAction: (claimId: string, action: ReviewActionPayload) =>
    apiClient.post<unknown>(`/review/${claimId}/action`, action),
  confirmVerifiedClaims: () =>
    apiClient.post<{ confirmed: number; claim_ids: string[] }>("/review/confirm-verified"),

  // Risk Radar & Timeline
  getRiskRadar: () => apiClient.get<RiskModule[]>("/risk-radar"),
  getTimeline: () => apiClient.get<TimelineEvent[]>("/timeline"),
  getDeliveryStatus: () => apiClient.get<DeliveryStatusItem[]>("/delivery-status"),
  getKnowledgeGraph: () => apiClient.get<KnowledgeGraphData>("/graph"),

  // Live Ping helper for status indicators
  measureLatency: async (): Promise<number> => {
    const start = performance.now();
    try {
      await apiClient.get<{ status: string }>("/health", { timeoutMs: 3000 });
      return Math.round(performance.now() - start);
    } catch {
      return 0;
    }
  },
};

export default apiClient;

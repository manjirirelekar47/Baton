/**
 * Baton Production API Client
 * Configured for FastAPI backend with JWT Bearer authentication,
 * automatic error handling, latency monitoring, and strict typing.
 */

const defaultHost =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "localhost";

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? `http://${defaultHost}:8000`
).replace(/\/$/, "");

export const TOKEN_STORAGE_KEY = "baton.token";

export type Role =
  | "approver"
  | "leaver"
  | "incoming_maintainer"
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
  avatar_url?: string;
}

export interface DemoLoginResponse {
  token: string;
  user: UserProfile;
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

  let url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
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
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string>),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...customConfig,
      headers: requestHeaders,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(408, "Request timed out connecting to Baton backend.");
    }
    throw new ApiError(
      0,
      "Cannot connect to Baton API. Verify backend is running on " + API_BASE_URL
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
  getMe: () => apiClient.get<UserProfile>("/me"),
  demoLogin: (role: Role) =>
    apiClient.post<DemoLoginResponse>("/auth/demo-login", { role }),
  demoReset: () =>
    apiClient.post<{ status: string; project_id: string }>("/demo/reset"),

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

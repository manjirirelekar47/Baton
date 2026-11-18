import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, getToken } from "@/app/api";
import { useAuth } from "@/app/auth";
import { Button, EmptyState, ErrorState, Loading } from "@/shared/ui";
import {
  GitBranch,
  RefreshCw,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Layers,
  KeyRound,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";

interface Source {
  source_id: string;
  title: string;
  type: string;
  acl_label: string;
  consent: boolean;
  status: string;
  chunks: number;
  note?: string | null;
  created_at?: string | null;
}

interface DriftAlert {
  alert_id: string;
  title: string;
  source_type: string;
  acl_label: string;
  previous_chunks: number;
  current_chunks: number;
  status: "open" | "resolved";
  detected_at: string;
}

interface SourceConnection {
  id: string;
  project_id: string;
  provider: "github" | "jira";
  target_name: string;
  acl_label: string;
  status: "connected" | "needs_attention" | "revoked" | "syncing" | "succeeded" | "partial" | "failed";
  auth_status?: "connected" | "needs_attention" | "revoked";
  last_synced_at?: string | null;
  records_added: number;
  records_updated: number;
  records_skipped: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

const ACCEPTED = ".md,.txt,.pdf,.docx,.json,.csv";

async function uploadSource(file: File, consent: boolean, aclLabel: string): Promise<Source> {
  const form = new FormData();
  form.set("file", file);
  form.set("consent", String(consent));
  form.set("acl_label", aclLabel);
  const base = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
  const token = getToken();
  const response = await fetch(`${base}/sources`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // Keep the HTTP status text when the API does not return JSON.
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as Source;
}

export function SourcesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [aclLabel, setAclLabel] = useState("L1");
  const [consent, setConsent] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureBody, setCaptureBody] = useState("");
  const [captureAcl, setCaptureAcl] = useState("L1");
  const [captureConsent, setCaptureConsent] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureSaved, setCaptureSaved] = useState(false);
  const [savingCapture, setSavingCapture] = useState(false);
  const [driftActionError, setDriftActionError] = useState<string | null>(null);

  // Live Sync Connect Modal states
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [connectProvider, setConnectProvider] = useState<"github" | "jira">("github");
  const [connectTarget, setConnectTarget] = useState("");
  const [connectAcl, setConnectAcl] = useState("L1");
  const [connectConsent, setConnectConsent] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null);

  // OAuth return notification banner
  const oauthStatus = searchParams.get("oauth");
  const oauthProvider = searchParams.get("provider");
  const oauthMessage = searchParams.get("message");
  const oauthConnId = searchParams.get("connection_id");

  const [oauthBanner, setOauthBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(() => {
    if (oauthStatus === "success") {
      return {
        type: "success",
        message: `Successfully authorized and connected ${oauthProvider ?? "source"} via OAuth! Per-connection tokens are securely encrypted at rest.`,
      };
    } else if (oauthStatus === "error") {
      return {
        type: "error",
        message: oauthMessage ? decodeURIComponent(oauthMessage) : "OAuth authorization was rejected or canceled.",
      };
    }
    return null;
  });

  useEffect(() => {
    if (oauthStatus) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("oauth");
      newParams.delete("provider");
      newParams.delete("message");
      newParams.delete("connection_id");
      setSearchParams(newParams, { replace: true });
      void queryClient.invalidateQueries({ queryKey: ["source_connections"] });
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
      if (oauthConnId) {
        syncMutation.mutate(oauthConnId);
      }
    }
  }, [oauthStatus, oauthConnId, queryClient, searchParams, setSearchParams]);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["sources", user?.id],
    queryFn: () => api<Source[]>("/sources"),
  });

  const { data: driftAlerts = [], error: driftError, isLoading: driftLoading, refetch: refetchDrift } = useQuery({
    queryKey: ["drift-alerts", user?.id],
    queryFn: async () => {
      if (user?.role === "approver") await api<{ baselined: number; changed: number }>("/drift/scan", { method: "POST" });
      return api<DriftAlert[]>("/drift/alerts");
    },
    enabled: Boolean(user),
  });

  const connectionsQuery = useQuery({
    queryKey: ["source_connections", user?.id],
    queryFn: () => api<SourceConnection[]>("/sources/connections"),
  });

  const syncMutation = useMutation({
    mutationFn: (connectionId: string) =>
      api<SourceConnection>(`/sources/connections/${connectionId}/sync`, { method: "POST" }),
    onMutate: (id) => setActiveSyncId(id),
    onSettled: () => {
      setActiveSyncId(null);
      void queryClient.invalidateQueries({ queryKey: ["source_connections"] });
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (connectionId: string) =>
      api<{ status: string; id: string }>(`/sources/connections/${connectionId}/disconnect`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["source_connections"] });
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : "Failed to disconnect source.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (connectionId: string) =>
      api<SourceConnection>(`/sources/connections/${connectionId}/revoke`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["source_connections"] });
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : "Failed to revoke connection.");
    },
  });

  const reauthorizeMutation = useMutation({
    mutationFn: (connectionId: string) =>
      api<{ authorization_url: string; state: string; provider: string }>(
        `/sources/connections/${connectionId}/reauthorize`,
        { method: "POST" }
      ),
    onSuccess: (res) => {
      window.location.href = res.authorization_url;
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : "Failed to initiate reauthorization.");
    },
  });

  const oauthAuthorizeMutation = useMutation({
    mutationFn: async (payload: {
      provider: "github" | "jira";
      target_name: string;
      acl_label: string;
      consent: boolean;
    }) => {
      const callbackUri = `${window.location.origin}/sources`;
      return api<{ authorization_url: string; state: string; provider: string }>(
        `/sources/oauth/${payload.provider}/authorize`,
        {
          method: "POST",
          body: {
            target_name: payload.target_name,
            acl_label: payload.acl_label,
            consent: payload.consent,
            redirect_uri: callbackUri,
          },
        }
      );
    },
    onSuccess: (res) => {
      setIsConnectOpen(false);
      window.location.href = res.authorization_url;
    },
    onError: (err) => {
      setConnectError(err instanceof Error ? err.message : "Failed to initiate OAuth authorization.");
    },
  });

  const connectDirectMutation = useMutation({
    mutationFn: async (payload: { provider: "github" | "jira"; target_name: string; acl_label: string; consent: boolean }) => {
      const conn = await api<SourceConnection>("/sources/connections", { method: "POST", body: payload });
      await api<SourceConnection>(`/sources/connections/${conn.id}/sync`, { method: "POST" });
      return conn;
    },
    onSuccess: () => {
      setIsConnectOpen(false);
      setConnectTarget("");
      setConnectConsent(false);
      setConnectError(null);
      void queryClient.invalidateQueries({ queryKey: ["source_connections"] });
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (err) => {
      setConnectError(err instanceof Error ? err.message : "Failed to connect source.");
    },
  });

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file || !consent) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadSource(file, consent, aclLabel);
      setFile(null);
      setConsent(false);
      formElement.reset();
      await queryClient.invalidateQueries({ queryKey: ["sources"] });
      await queryClient.invalidateQueries({ queryKey: ["drift-alerts"] });
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "Source upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCapture(true);
    setCaptureError(null);
    setCaptureSaved(false);
    try {
      await api<Source>("/capture", {
        method: "POST",
        body: { title: captureTitle, body: captureBody, acl_label: captureAcl, consent: captureConsent },
      });
      setCaptureTitle("");
      setCaptureBody("");
      setCaptureConsent(false);
      setCaptureSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["sources"] });
      await queryClient.invalidateQueries({ queryKey: ["drift-alerts"] });
    } catch (cause) {
      setCaptureError(cause instanceof Error ? cause.message : "Could not save this note.");
    } finally {
      setSavingCapture(false);
    }
  }

  async function handleResolveAlert(alertId: string) {
    setDriftActionError(null);
    try {
      await api<void>(`/drift/alerts/${encodeURIComponent(alertId)}/resolve`, { method: "POST", body: {} });
      await refetchDrift();
    } catch (cause) {
      setDriftActionError(cause instanceof Error ? cause.message : "Could not resolve this alert.");
    }
  }

  function handleOAuthSubmit(e: FormEvent) {
    e.preventDefault();
    if (!connectTarget.trim() || !connectConsent) return;
    oauthAuthorizeMutation.mutate({
      provider: connectProvider,
      target_name: connectTarget.trim(),
      acl_label: connectAcl,
      consent: connectConsent,
    });
  }

  function handleDirectConnectSubmit() {
    if (!connectTarget.trim() || !connectConsent) return;
    connectDirectMutation.mutate({
      provider: connectProvider,
      target_name: connectTarget.trim(),
      acl_label: connectAcl,
      consent: connectConsent,
    });
  }

  const isApprover = user?.role === "approver";
  const connections = connectionsQuery.data ?? [];

  return (
    <section className="space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full pb-12 animate-in fade-in duration-300 min-w-0">
      {/* Header with High-Contrast Typography */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Connect Sources
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-gray-300 leading-normal">
          Import authorised project records. Per-connection grants are encrypted at rest with Fernet symmetric keys.
        </p>
      </div>

      {/* OAuth Feedback Banner */}
      {oauthBanner && (
        <div
          role="status"
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium animate-in fade-in ${
            oauthBanner.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {oauthBanner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            )}
            <span>{oauthBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setOauthBanner(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* =========================================================================
          COMMITMENT 1: LIVE PROJECT SYNC (GITHUB & JIRA)
         ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 backdrop-blur-2xl p-4 sm:p-6 shadow-sm dark:shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-white/10 pb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                <GitBranch className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Live Source Syncing (GitHub & Jira)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 leading-normal">
              OAuth 2.0 authorized connectors. Grants are encrypted at rest with signed, single-use state verification.
            </p>
          </div>
          {isApprover && (
            <Button
              onClick={() => setIsConnectOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white self-start sm:self-auto flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Connect Live Source
            </Button>
          )}
        </div>

        {/* Connections List / Grid */}
        {connectionsQuery.isLoading ? (
          <Loading label="Loading connections" />
        ) : connections.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/[0.02]">
            <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">
              No live repository or project connections active. Connect GitHub or Jira using OAuth 2.0 to enable incremental syncing.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {connections.map((conn) => {
              const isSyncing = activeSyncId === conn.id || conn.status === "syncing";
              const authStatus = conn.auth_status ?? (conn.status === "failed" ? "needs_attention" : "connected");

              return (
                <div
                  key={conn.id}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] p-4 flex flex-col justify-between gap-3 transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-200">
                          {conn.provider}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                          {conn.acl_label}
                        </span>

                        {/* Connection State Badge */}
                        {authStatus === "connected" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Connected
                          </span>
                        )}
                        {authStatus === "needs_attention" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            Needs attention
                          </span>
                        )}
                        {authStatus === "revoked" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700/50">
                            <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            Revoked
                          </span>
                        )}

                        {/* Secondary Sync Status */}
                        {conn.status === "syncing" && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                            Syncing…
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white font-mono pt-0.5">{conn.target_name}</h3>
                    </div>

                    {isApprover && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Disconnect and remove ${conn.target_name}? Synced evidence will remain preserved.`)) {
                            disconnectMutation.mutate(conn.id);
                          }
                        }}
                        disabled={disconnectMutation.isPending}
                        className="text-slate-400 hover:text-rose-500 transition p-1 cursor-pointer"
                        title="Disconnect source"
                        aria-label="Disconnect source"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Warning Alerts for Needs Attention or Revoked */}
                  {authStatus === "needs_attention" && (
                    <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/70 dark:bg-amber-950/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Authorization requires attention</p>
                        <p className="text-amber-700 dark:text-amber-400 text-[10px]">
                          {conn.error_message ?? "Token expired or permission was rejected. Reauthorize to resume sync."}
                        </p>
                      </div>
                    </div>
                  )}

                  {authStatus === "revoked" && (
                    <div className="p-2.5 rounded-lg border border-rose-200 dark:border-rose-800/40 bg-rose-50/70 dark:bg-rose-950/20 text-[11px] text-rose-800 dark:text-rose-300 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Access grant revoked</p>
                        <p className="text-rose-700 dark:text-rose-400 text-[10px]">
                          This connection cannot sync. Reauthorize to grant new scoped permissions.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 dark:text-gray-400 space-y-1 border-t border-slate-200/60 dark:border-white/5 pt-2">
                    <div className="flex justify-between">
                      <span>Last sync:</span>
                      <span className="font-mono text-slate-700 dark:text-gray-300">
                        {conn.last_synced_at ? new Date(conn.last_synced_at).toLocaleString() : "Never"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Records synced:</span>
                      <span className="font-mono text-slate-700 dark:text-gray-300">
                        {conn.records_added} added, {conn.records_skipped} skipped
                      </span>
                    </div>
                  </div>

                  {/* UI Action Controls for Approvers */}
                  {isApprover && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-white/5">
                      {authStatus === "connected" && (
                        <Button
                          variant="quiet"
                          onClick={() => syncMutation.mutate(conn.id)}
                          disabled={isSyncing}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-purple-600" : ""}`} />
                          {isSyncing ? "Syncing…" : "Sync Now"}
                        </Button>
                      )}

                      {(authStatus === "needs_attention" || authStatus === "revoked") && (
                        <Button
                          onClick={() => reauthorizeMutation.mutate(conn.id)}
                          disabled={reauthorizeMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          {reauthorizeMutation.isPending ? "Connecting…" : "Reauthorize"}
                        </Button>
                      )}

                      {authStatus !== "revoked" && (
                        <Button
                          variant="quiet"
                          onClick={() => {
                            if (confirm(`Revoke OAuth grant for ${conn.target_name}? The connection will no longer sync until reauthorized.`)) {
                              revokeMutation.mutate(conn.id);
                            }
                          }}
                          disabled={revokeMutation.isPending}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-amber-600 dark:text-gray-400 dark:hover:text-amber-400"
                          title="Revoke access grant"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" /> Revoke
                        </Button>
                      )}

                      <Button
                        variant="quiet"
                        onClick={() => {
                          if (confirm(`Disconnect and remove ${conn.target_name}? Preserved records will remain immutable.`)) {
                            disconnectMutation.mutate(conn.id);
                          }
                        }}
                        disabled={disconnectMutation.isPending}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 dark:text-gray-400 dark:hover:text-rose-400"
                        title="Disconnect connection"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Disconnect
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect Source Modal */}
      {isConnectOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121424] p-6 shadow-xl shadow-black/40 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Connect Project Source</h3>
              <button
                type="button"
                onClick={() => setIsConnectOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-sm font-bold active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOAuthSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
                  Provider
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConnectProvider("github")}
                    className={`py-2 px-3 rounded-xl border text-center font-bold active:scale-[0.98] transition-all duration-150 cursor-pointer ${
                      connectProvider === "github"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500"
                        : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    GitHub App
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnectProvider("jira")}
                    className={`py-2 px-3 rounded-xl border text-center font-bold active:scale-[0.98] transition-all duration-150 cursor-pointer ${
                      connectProvider === "jira"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500"
                        : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    Jira Cloud (3LO)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="connect-target" className="block font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
                  {connectProvider === "github" ? "GitHub Repository (owner/repo)" : "Jira Project Key"}
                </label>
                <input
                  id="connect-target"
                  type="text"
                  required
                  placeholder={connectProvider === "github" ? "acme-corp/project-repo" : "CAMPUS"}
                  value={connectTarget}
                  onChange={(e) => setConnectTarget(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="connect-acl" className="block font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
                  Access Classification
                </label>
                <select
                  id="connect-acl"
                  value={connectAcl}
                  onChange={(e) => setConnectAcl(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 p-2.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 focus:outline-none transition-all"
                >
                  <option value="L1">L1 — Team-wide (Public to project)</option>
                  <option value="L2">L2 — Maintainers Only</option>
                  <option value="L3">L3 — Leadership Only</option>
                </select>
              </div>

              <label className="flex items-start gap-2 pt-1 text-slate-600 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={connectConsent}
                  onChange={(e) => setConnectConsent(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600"
                />
                <span>I confirm that I am authorised to connect and sync this GitHub repository or Jira project.</span>
              </label>

              <div className="rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 space-y-1">
                <p className="font-semibold text-indigo-900 dark:text-indigo-300">
                  Secure OAuth 2.0 Authorization
                </p>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-gray-400">
                  You will authorize with {connectProvider === "github" ? "GitHub" : "Atlassian"} on their official sign-in screen.
                  Baton exchanges auth codes on the backend only, encrypts tokens at rest, and never reveals secrets to the browser.
                </p>
              </div>

              {connectError && (
                <p role="alert" className="text-rose-500 font-semibold">{connectError}</p>
              )}

              <div className="flex flex-col sm:flex-row justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <Button
                  variant="quiet"
                  type="button"
                  onClick={handleDirectConnectSubmit}
                  disabled={!connectTarget.trim() || !connectConsent || connectDirectMutation.isPending}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-gray-200"
                  title="Direct connection using configured deployment credentials"
                >
                  {connectDirectMutation.isPending ? "Connecting…" : "Direct Connect (Dev)"}
                </Button>

                <div className="flex gap-2 justify-end">
                  <Button variant="quiet" type="button" onClick={() => setIsConnectOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!connectTarget.trim() || !connectConsent || oauthAuthorizeMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {oauthAuthorizeMutation.isPending
                      ? "Opening OAuth…"
                      : `Authorize with ${connectProvider === "github" ? "GitHub" : "Jira"}`}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Upload Section */}
      {isApprover ? (
        <form onSubmit={handleUpload} className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 backdrop-blur-2xl p-4 sm:p-6 shadow-sm dark:shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex-shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Direct Document Upload</h2>
          </div>
          <div>
            <label htmlFor="source-file" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Source file
            </label>
            <input
              id="source-file"
              type="file"
              accept={ACCEPTED}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-xs text-slate-500 dark:text-gray-400 file:mr-2 sm:file:mr-4 file:rounded-xl file:border-0 file:bg-purple-50 dark:file:bg-purple-950/50 file:px-3 sm:file:px-4 file:py-2 file:text-xs file:font-bold file:text-purple-700 dark:file:text-purple-300 hover:file:bg-purple-100 dark:hover:file:bg-purple-900/60 transition cursor-pointer"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-gray-500">MD, TXT, PDF, DOCX, Git JSON or task CSV. Maximum 10 MB.</p>
          </div>
          <div>
            <label htmlFor="source-access" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Who may see this source?
            </label>
            <select
              id="source-access"
              value={aclLabel}
              onChange={(event) => setAclLabel(event.target.value)}
              className="mt-1.5 w-full sm:w-auto rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/60 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            >
              <option value="L1">L1 — Team-wide</option>
              <option value="L2">L2 — Maintainers</option>
              <option value="L3">L3 — Leadership-only</option>
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">L4 secrets are never accepted as a source.</p>
          </div>
          <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-gray-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-white/20 bg-white dark:bg-black/40 text-purple-600 focus:ring-purple-500 flex-shrink-0"
            />
            <span className="leading-snug">I confirm that I am authorised to connect and process this source for this project.</span>
          </label>
          {uploadError && <p role="alert" className="text-xs font-semibold text-rose-500 dark:text-rose-400">{uploadError}</p>}
          <Button type="submit" disabled={!file || !consent || uploading} className="px-5 py-2.5 font-bold">
            {uploading ? "Uploading…" : "Upload Source"}
          </Button>
        </form>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 backdrop-blur-2xl p-4 sm:p-5 text-xs text-slate-600 dark:text-gray-400 shadow-sm">
          Only the project approver can connect new sources. You can inspect the sources available to your role below.
        </div>
      )}

      {user?.role === "approver" && (
        <form onSubmit={handleCapture} className="space-y-4 rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/10 p-4 sm:p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Capture a decision or handover note</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-gray-400">Notes are redacted, split into evidence chunks, and included in Baton’s normal source and verification workflow.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="capture-title" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">Title</label>
            <input id="capture-title" value={captureTitle} onChange={(event) => setCaptureTitle(event.target.value)} minLength={3} maxLength={120} required className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 focus:outline-none transition-all" placeholder="e.g. Retry worker decision" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="capture-body" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">What should the next team know?</label>
            <textarea id="capture-body" value={captureBody} onChange={(event) => setCaptureBody(event.target.value)} minLength={10} maxLength={8000} required rows={5} className="w-full resize-y rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 focus:outline-none transition-all" placeholder="Record the decision, owner, reason, or next action…" />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-xs font-bold text-slate-700 dark:text-gray-300">Visibility
              <select value={captureAcl} onChange={(event) => setCaptureAcl(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/40 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white">
                <option value="L1">L1 — Team-wide</option><option value="L2">L2 — Maintainers</option><option value="L3">L3 — Leadership-only</option>
              </select>
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-gray-300">
              <input type="checkbox" checked={captureConsent} onChange={(event) => setCaptureConsent(event.target.checked)} className="mt-0.5" />
              <span>I’m authorised to capture and process this project information.</span>
            </label>
            <Button type="submit" disabled={!captureConsent || savingCapture} className="px-5 py-2.5 font-bold">{savingCapture ? "Saving…" : "Save note"}</Button>
          </div>
          {captureError && <p role="alert" className="text-xs font-semibold text-rose-600">{captureError}</p>}
          {captureSaved && <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Note captured and added to Connected Sources.</p>}
        </form>
      )}

      <section className="space-y-3 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/10 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-gray-900 dark:text-white">Source change alerts</h2><p className="text-xs text-slate-600 dark:text-gray-400">Re-import a source with the same name to compare its redacted evidence with the last scan.</p></div>
          <Button variant="quiet" onClick={() => void refetchDrift()}>Check changes</Button>
        </div>
        {driftLoading ? <p role="status" className="text-xs text-slate-600 dark:text-gray-400">Checking the latest source versions…</p> : null}
        {driftError && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">Could not check source changes: {(driftError as Error).message}</p>}
        {driftActionError && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{driftActionError}</p>}
        {!driftLoading && !driftError && driftAlerts.length === 0 ? <p className="text-xs text-slate-600 dark:text-gray-400">No detected source changes.</p> : null}
        {!driftError && driftAlerts.length > 0 ? (
          <ul className="space-y-2">
            {driftAlerts.map((alert) => <li key={alert.alert_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-white/80 dark:bg-black/20 p-3 text-xs">
              <span className="text-slate-800 dark:text-gray-200"><strong>{alert.title}</strong> changed · {alert.previous_chunks} → {alert.current_chunks} chunks · {alert.acl_label}</span>
              {user?.role === "approver" && <Button variant="quiet" onClick={() => void handleResolveAlert(alert.alert_id)}>Resolve</Button>}
            </li>)}
          </ul>
        ) : null}
      </section>

      {/* Connected Sources Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Connected Sources Inventory</h2>
          <Button variant="quiet" onClick={() => void refetch()} className="self-start sm:self-auto">
            Refresh
          </Button>
        </div>
        {isLoading && <Loading label="Loading sources" />}
        {error && <ErrorState title="Could not load sources" detail={(error as Error).message} onRetry={() => void refetch()} />}
        {data && data.length === 0 && (
          <EmptyState title="No sources yet">
            Connect a live repository or upload project records to begin.
          </EmptyState>
        )}
        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 backdrop-blur-2xl shadow-sm dark:shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Chunks</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {data.map((source) => (
                  <tr key={source.source_id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{source.title}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono">{source.type}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20 font-bold text-[10px] font-mono">
                        {source.acl_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400 font-mono">{source.chunks}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold text-[10px]">
                        {source.status}
                        {source.note ? `: ${source.note}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

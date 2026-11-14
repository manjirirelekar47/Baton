import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, getToken } from "@/app/api";
import { useAuth } from "@/app/auth";
import { Button, EmptyState, ErrorState, Loading } from "@/shared/ui";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [aclLabel, setAclLabel] = useState("L1");
  const [consent, setConsent] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["sources", user?.id],
    queryFn: () => api<Source[]>("/sources"),
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
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "Source upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-6 max-w-7xl mx-auto w-full pb-12 animate-in fade-in duration-300">
      {/* Header with Back Navigation and High-Contrast Typography */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-sm transition-all dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 cursor-pointer"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Connect Sources
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-300">
            Import authorised project records. Secrets and contact details are redacted before evidence is stored.
          </p>
        </div>
      </div>

      {user?.role === "approver" ? (
        <form onSubmit={handleUpload} className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 backdrop-blur-2xl p-6 shadow-sm dark:shadow-2xl">
          <div>
            <label htmlFor="source-file" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Source file
            </label>
            <input
              id="source-file"
              type="file"
              accept={ACCEPTED}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-xs text-slate-500 dark:text-gray-400 file:mr-4 file:rounded-xl file:border-0 file:bg-purple-50 dark:file:bg-purple-950/50 file:px-4 file:py-2 file:text-xs file:font-bold file:text-purple-700 dark:file:text-purple-300 hover:file:bg-purple-100 dark:hover:file:bg-purple-900/60 transition cursor-pointer"
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
              className="mt-1.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/60 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
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
              className="mt-0.5 rounded border-slate-300 dark:border-white/20 bg-white dark:bg-black/40 text-purple-600 focus:ring-purple-500"
            />
            <span>I confirm that I am authorised to connect and process this source for this project.</span>
          </label>
          {uploadError && <p role="alert" className="text-xs font-semibold text-rose-500 dark:text-rose-400">{uploadError}</p>}
          <Button type="submit" disabled={!file || !consent || uploading} className="px-5 py-2.5 font-bold">
            {uploading ? "Uploading…" : "Upload Source"}
          </Button>
        </form>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 backdrop-blur-2xl p-5 text-xs text-slate-600 dark:text-gray-400 shadow-sm">
          Only the project approver can connect new sources. You can inspect the sources available to your role below.
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Connected Sources</h2>
          <Button variant="quiet" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>
        {isLoading && <Loading label="Loading sources" />}
        {error && <ErrorState title="Could not load sources" detail={(error as Error).message} onRetry={() => void refetch()} />}
        {data && data.length === 0 && (
          <EmptyState title="No sources yet">
            Upload authorised documents, a Git export or a task CSV to begin.
          </EmptyState>
        )}
        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 backdrop-blur-2xl shadow-sm dark:shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
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
                  <tr key={source.source_id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{source.title}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-gray-300">{source.type}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20 font-bold text-[10px] font-mono">
                        {source.acl_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-gray-300">{source.chunks}</td>
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

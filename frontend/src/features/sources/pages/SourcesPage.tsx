import { useState, type FormEvent } from "react";
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
    <section className="space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Connect Sources</h1>
        <p className="mt-1 text-sm text-slate-500">
          Import authorised project records. Secrets and contact details are redacted before evidence is stored.
        </p>
      </div>

      {user?.role === "approver" ? (
        <form onSubmit={handleUpload} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card-soft">
          <div>
            <label htmlFor="source-file" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Source file
            </label>
            <input
              id="source-file"
              type="file"
              accept={ACCEPTED}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-xs text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-xs file:font-bold file:text-indigo-700 hover:file:bg-indigo-100 transition cursor-pointer"
            />
            <p className="mt-1.5 text-xs text-slate-400">MD, TXT, PDF, DOCX, Git JSON or task CSV. Maximum 10 MB.</p>
          </div>
          <div>
            <label htmlFor="source-access" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Who may see this source?
            </label>
            <select
              id="source-access"
              value={aclLabel}
              onChange={(event) => setAclLabel(event.target.value)}
              className="mt-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
            >
              <option value="L1">L1 — Team-wide</option>
              <option value="L2">L2 — Maintainers</option>
              <option value="L3">L3 — Leadership-only</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">L4 secrets are never accepted as a source.</p>
          </div>
          <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>I confirm that I am authorised to connect and process this source for this project.</span>
          </label>
          {uploadError && <p role="alert" className="text-xs font-semibold text-rose-600">{uploadError}</p>}
          <Button type="submit" disabled={!file || !consent || uploading}>
            {uploading ? "Uploading…" : "Upload Source"}
          </Button>
        </form>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 text-xs text-slate-500 shadow-card-soft">
          Only the project approver can connect new sources. You can inspect the sources available to your role below.
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Connected Sources</h2>
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
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-card-soft">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Chunks</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((source) => (
                  <tr key={source.source_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3 font-semibold text-slate-900">{source.title}</td>
                    <td className="px-4 py-3 text-slate-600">{source.type}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                        {source.acl_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{source.chunks}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
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

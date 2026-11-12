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
    <section className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-olive">Connect sources</h1>
        <p className="mt-1 text-sm text-muted">Import authorised project records. Secrets and contact details are redacted before evidence is stored.</p>
      </div>

      {user?.role === "approver" ? (
        <form onSubmit={handleUpload} className="space-y-4 rounded-lg border border-line bg-card p-4">
          <div>
            <label htmlFor="source-file" className="block text-sm font-semibold">Source file</label>
            <input
              id="source-file"
              type="file"
              accept={ACCEPTED}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-wash file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            <p className="mt-1 text-xs text-muted">MD, TXT, PDF, DOCX, Git JSON or task CSV. Maximum 10 MB.</p>
          </div>
          <div>
            <label htmlFor="source-access" className="block text-sm font-semibold">Who may see this source?</label>
            <select id="source-access" value={aclLabel} onChange={(event) => setAclLabel(event.target.value)} className="mt-1 rounded-md border border-line bg-paper px-3 py-2 text-sm">
              <option value="L1">L1 — Team-wide</option>
              <option value="L2">L2 — Maintainers</option>
              <option value="L3">L3 — Leadership-only</option>
            </select>
            <p className="mt-1 text-xs text-muted">L4 secrets are never accepted as a source.</p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
            <span>I confirm that I am authorised to connect and process this source for this project.</span>
          </label>
          {uploadError && <p role="alert" className="text-sm text-[var(--conflicting)]">{uploadError}</p>}
          <Button type="submit" disabled={!file || !consent || uploading}>
            {uploading ? "Uploading…" : "Upload source"}
          </Button>
        </form>
      ) : (
        <p className="rounded-lg border border-line bg-card p-4 text-sm text-muted">Only the project approver can connect new sources. You can inspect the sources available to your role below.</p>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl text-olive">Connected sources</h2>
          <Button variant="quiet" onClick={() => void refetch()}>Refresh</Button>
        </div>
        {isLoading && <Loading label="Loading sources" />}
        {error && <ErrorState title="Could not load sources" detail={(error as Error).message} onRetry={() => void refetch()} />}
        {data && data.length === 0 && <EmptyState title="No sources yet">Upload authorised documents, a Git export or a task CSV to begin.</EmptyState>}
        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-line bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-wash text-muted"><tr><th className="px-3 py-2">Source</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Access</th><th className="px-3 py-2">Chunks</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody>{data.map((source) => (
                <tr key={source.source_id} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{source.title}</td><td className="px-3 py-2">{source.type}</td><td className="px-3 py-2">{source.acl_label}</td>
                  <td className="px-3 py-2 tabular-nums">{source.chunks}</td><td className="px-3 py-2">{source.status}{source.note ? `: ${source.note}` : ""}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/api";
import { useAuth } from "@/app/auth";
import { EmptyState, ErrorState, Loading } from "@/shared/ui";

interface Source {
  source_id: string;
  title: string;
  type: string;
  acl_label: string;
  status: string;
  chunks: number;
  note?: string;
}

/** STUB (Bhavesh replaces): read-only source inventory. */
export function SourcesPage() {
  const { user } = useAuth();
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ["sources", user?.id], queryFn: () => api<Source[]>("/sources") });
  return (
    <section>
      <h1 className="font-display text-3xl text-olive">Connect sources</h1>
      <p className="mt-1 text-sm text-muted">Stub page. Source upload with consent and access tags is built in the sources feature.</p>
      {isLoading && <Loading />}
      {error && <ErrorState title="Could not load sources" detail={(error as Error).message} onRetry={() => void refetch()} />}
      {data && data.length === 0 && <EmptyState title="No sources yet">Upload documents, a Git export or a task CSV to begin.</EmptyState>}
      {data && data.length > 0 && (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-muted">
            <tr><th className="py-1">Source</th><th>Type</th><th>Access</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.source_id} className="border-t border-line">
                <td className="py-2">{s.title}</td><td>{s.type}</td><td>{s.acl_label}</td><td>{s.status}{s.note ? `: ${s.note}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

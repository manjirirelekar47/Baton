import { useQuery } from "@tanstack/react-query";
import { Button, Loading, ErrorState } from "@/shared/ui";
import { getAudit } from "../api";
import type { AuditEntry } from "../types";

interface AuditTrailModalProps {
  onClose: () => void;
}

export function AuditTrailModal({ onClose }: AuditTrailModalProps) {
  const { data, isLoading, error, refetch } = useQuery<AuditEntry[]>({
    queryKey: ["review", "audit"],
    queryFn: () => getAudit(100),
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Audit Trail"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-line bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="font-display text-2xl text-olive">Audit Trail</h2>
            <p className="mt-0.5 text-xs text-muted">
              Immutable append-only record of every human decision, edit, conflict resolution, and approval.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-wash hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-3">
          {isLoading && <Loading label="Loading audit entries" />}
          {error && (
            <ErrorState
              title="Could not load audit log"
              detail={(error as Error).message}
              onRetry={() => void refetch()}
            />
          )}

          {data && data.length === 0 && (
            <p className="p-8 text-center text-sm text-muted">No audit events recorded yet.</p>
          )}

          {data &&
            data.map((entry) => (
              <div
                key={entry.id}
                className="rounded border border-line bg-paper p-3 text-xs space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-olive px-2 py-0.5 font-mono text-[10px] text-white">
                      {entry.event_type}
                    </span>
                    <span className="font-semibold text-ink">
                      {entry.actor_role} ({entry.actor_id})
                    </span>
                  </div>
                  <span className="text-muted">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-muted">
                  <span>Object:</span>
                  <span className="font-mono text-ink">
                    {entry.object_type}:{entry.object_id}
                  </span>
                </div>

                {(() => {
                  const detail = (entry.detail || {}) as Record<string, unknown>;
                  const priorState = detail.prior_state ?? detail.before;
                  const newState = detail.new_state ?? detail.after;
                  const rationale = detail.rationale || detail.note;
                  const evidenceList = (detail.linked_evidence ?? detail.evidence) as unknown[];

                  if (entry.event_type.startsWith("review.") && (priorState !== undefined || newState !== undefined || detail.action)) {
                    return (
                      <div className="mt-2 space-y-2 rounded bg-card p-2 text-[11px] text-muted">
                        <p><span className="font-semibold text-ink">Decision:</span> {String(detail.action ?? entry.event_type.slice("review.".length))}</p>
                        <p><span className="font-semibold text-ink">Rationale:</span> {rationale ? String(rationale) : "Not provided"}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div><span className="font-semibold text-ink">Prior state:</span> <pre className="mt-1 whitespace-pre-wrap font-mono">{JSON.stringify(priorState ?? {}, null, 2)}</pre></div>
                          <div><span className="font-semibold text-ink">New state:</span> <pre className="mt-1 whitespace-pre-wrap font-mono">{JSON.stringify(newState ?? {}, null, 2)}</pre></div>
                        </div>
                        <div>
                          <span className="font-semibold text-ink">Linked evidence:</span>
                          {Array.isArray(evidenceList) && evidenceList.length > 0 ? (
                            <ul className="mt-1 list-inside list-disc font-mono">
                              {evidenceList.map((evidence, index) => {
                                if (typeof evidence === "string") {
                                  return <li key={`${evidence}-${index}`}>{evidence}</li>;
                                }
                                const item = (evidence || {}) as Record<string, unknown>;
                                return (
                                  <li key={`${String(item.chunk_id ?? index)}-${index}`}>
                                    {String(item.chunk_id ?? "unknown")}
                                    {item.source_id ? ` · ${String(item.source_id)}` : ""}
                                    {item.source_title ? ` · ${String(item.source_title)}` : ""}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : <span> None recorded.</span>}
                        </div>
                      </div>
                    );
                  }

                  if (entry.detail && Object.keys(entry.detail).length > 0) {
                    return (
                      <div className="mt-1 rounded bg-card p-2 text-[11px] font-mono text-muted overflow-x-auto">
                        {JSON.stringify(entry.detail, null, 2)}
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>
            ))}
        </div>

        <div className="mt-4 flex justify-end border-t border-line pt-3">
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

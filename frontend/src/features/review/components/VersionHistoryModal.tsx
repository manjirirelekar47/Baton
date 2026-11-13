import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Loading, ErrorState, StateBadge } from "@/shared/ui";
import type { ClaimState } from "@/shared/types";
import { getVersions, getVersionDetail } from "../api";
import type { VersionSummary, VersionDetail } from "../types";

interface VersionHistoryModalProps {
  onClose: () => void;
}

export function VersionHistoryModal({ onClose }: VersionHistoryModalProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const { data: versions, isLoading, error, refetch } = useQuery<VersionSummary[]>({
    queryKey: ["review", "versions"],
    queryFn: getVersions,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<VersionDetail>({
    queryKey: ["review", "version", selectedVersionId],
    queryFn: () => getVersionDetail(selectedVersionId as string),
    enabled: !!selectedVersionId,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Version History"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-line bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="font-display text-2xl text-olive">Version History</h2>
            <p className="mt-0.5 text-xs text-muted">
              Immutable approved snapshots with cryptographic SHA-256 integrity hashes.
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

        <div className="mt-4 flex flex-1 gap-4 overflow-hidden">
          {/* Version list column */}
          <div className="w-1/3 overflow-y-auto border-r border-line pr-3 space-y-2">
            {isLoading && <Loading label="Loading versions" />}
            {error && (
              <ErrorState
                title="Could not load versions"
                detail={(error as Error).message}
                onRetry={() => void refetch()}
              />
            )}
            {versions && versions.length === 0 && (
              <p className="p-4 text-xs text-muted text-center">No versions approved yet.</p>
            )}
            {versions &&
              versions.map((v) => (
                <button
                  key={v.id || v.version_id}
                  type="button"
                  onClick={() => setSelectedVersionId(v.id || v.version_id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    (selectedVersionId || versions[0]?.id) === (v.id || v.version_id)
                      ? "border-olive bg-paper ring-1 ring-olive"
                      : "border-line bg-card hover:bg-wash"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-base font-semibold text-olive">
                      Version {v.version_id || `v${v.version_number}`}
                    </span>
                    <span className="rounded bg-[var(--verified)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--verified)]">
                      Approved
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {v.claim_count} claims • {v.accepted_uncertainty_count} uncertainty
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {v.approved_at ? new Date(v.approved_at).toLocaleDateString() : "Recently"}
                  </p>
                </button>
              ))}
          </div>

          {/* Version detail column */}
          <div className="flex-1 overflow-y-auto pl-2 space-y-4">
            {detailLoading && <Loading label="Verifying snapshot hash" />}
            {detail && (
              <div className="space-y-4">
                <div className="rounded-lg border border-line bg-paper p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl text-ink">
                      Snapshot {detail.version_id || `v${detail.version_number}`}
                    </h3>
                    {detail.hash_valid ? (
                      <span className="inline-flex items-center gap-1 rounded bg-[var(--verified)] px-2 py-0.5 text-xs font-semibold text-white">
                        ✓ Hash Verified (Tamper-Free)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-[var(--conflicting)] px-2 py-0.5 text-xs font-semibold text-white">
                        ✕ Hash Mismatch
                      </span>
                    )}
                  </div>

                  <div className="text-xs space-y-1 text-muted">
                    <p>
                      <span className="font-semibold text-ink">Approved By:</span> {detail.approved_by}
                    </p>
                    <p>
                      <span className="font-semibold text-ink">Shared With:</span>{" "}
                      {detail.shared_roles?.join(", ") || "None"}
                    </p>
                    <p className="break-all font-mono text-[11px]">
                      <span className="font-sans font-semibold text-ink">Snapshot Hash:</span>{" "}
                      {detail.snapshot_hash}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-display text-base text-olive mb-2">
                    Frozen Claims ({detail.claims.length})
                  </h4>
                  <div className="space-y-2">
                    {detail.claims.map((c) => (
                      <div
                        key={c.claim_id}
                        className="rounded border border-line bg-card p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-muted">{c.claim_id}</span>
                          <StateBadge state={c.state.toLowerCase() as ClaimState} />
                          <span className="font-medium text-olive">{c.type}</span>
                          {c.decision && (
                            <span className="text-muted">({c.decision})</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-ink">{c.statement}</p>
                        {c.evidence && c.evidence.length > 0 && (
                          <p className="italic text-muted">"{c.evidence[0].quote}"</p>
                        )}
                        {c.note && (
                          <p className="text-[11px] text-[var(--inferred)] font-medium">
                            Note: {c.note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!detail && !detailLoading && (
              <p className="p-8 text-center text-sm text-muted">
                Select a version on the left to inspect its frozen snapshot.
              </p>
            )}
          </div>
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

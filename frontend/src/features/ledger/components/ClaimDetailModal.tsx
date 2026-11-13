import { useEffect, useRef } from "react";
import { StateBadge } from "@/shared/ui";
import type { Claim } from "../api";

interface ClaimDetailModalProps {
  claim: Claim;
  onClose: () => void;
  onOpenSource: (chunkId: string, quote: string) => void;
}

export function ClaimDetailModal({ claim, onClose, onOpenSource }: ClaimDetailModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-line bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-muted">{claim.claim_id}</span>
              <span className="rounded bg-wash px-2 py-0.5 text-xs font-medium uppercase text-ink border border-line">
                {claim.type}
              </span>
              <StateBadge state={claim.state} />
              <span className="rounded bg-wash px-2 py-0.5 text-xs font-mono text-muted">
                {claim.acl_label}
              </span>
            </div>
            <h2 id="claim-modal-title" className="font-display text-xl text-olive mt-2">
              {claim.statement}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="rounded border border-line bg-card px-3 py-1.5 text-xs font-medium hover:bg-wash"
          >
            Close
          </button>
        </div>

        {claim.state === "conflicting" && (
          <div className="my-4 rounded-md border border-[var(--conflicting)] bg-[#fff3f3] p-3 text-sm text-[var(--conflicting)]">
            <strong>≠ Conflict Detected:</strong> Contradictory statements exist for{" "}
            <code>{claim.entity_key}</code> ({claim.attribute}).
            {claim.conflict_with && claim.conflict_with.length > 0 && (
              <span className="ml-2">
                Conflicting claim ID(s): {claim.conflict_with.join(", ")}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-line bg-wash p-2">
              <span className="text-muted">Entity:</span>{" "}
              <code className="font-mono text-ink">{claim.entity_key}</code>
            </div>
            <div className="rounded border border-line bg-wash p-2">
              <span className="text-muted">Attribute:</span>{" "}
              <code className="font-mono text-ink">{claim.attribute}</code>
            </div>
            {claim.owner && (
              <div className="rounded border border-line bg-wash p-2">
                <span className="text-muted">Current Owner:</span> <strong>{claim.owner}</strong>
              </div>
            )}
            {claim.proposed_owner && (
              <div className="rounded border border-line bg-wash p-2">
                <span className="text-muted">Proposed Owner:</span> <strong>{claim.proposed_owner}</strong>
              </div>
            )}
            {claim.due_date && (
              <div className="rounded border border-line bg-wash p-2">
                <span className="text-muted">Due Date:</span> {claim.due_date}
              </div>
            )}
            {claim.attested_by && (
              <div className="rounded border border-line bg-wash p-2">
                <span className="text-muted">Attested By:</span> {claim.attested_by}
              </div>
            )}
          </div>

          <div className="mt-5">
            <h3 className="font-display text-base text-olive mb-2">Evidence & Citations</h3>
            {claim.evidence.length === 0 ? (
              <p className="text-xs text-muted italic">
                No verified evidence quote found for this claim. This claim is treated as a knowledge Gap.
              </p>
            ) : (
              <div className="space-y-3">
                {claim.evidence.map((ev, i) => (
                  <div key={i} className="rounded-md border border-line bg-wash p-3">
                    <div className="flex items-center justify-between text-xs text-muted mb-1">
                      <span className="font-mono font-medium text-ink">Chunk {ev.chunk_id}</span>
                      <span>{ev.source_title ?? "Source"}</span>
                    </div>
                    <blockquote className="border-l-2 border-olive pl-3 my-2 text-sm italic text-ink">
                      "{ev.quote}"
                    </blockquote>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenSource(ev.chunk_id, ev.quote)}
                        className="rounded border border-line bg-card px-2.5 py-1 text-xs font-medium text-olive hover:bg-white"
                      >
                        Inspect in Source Drawer ↗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

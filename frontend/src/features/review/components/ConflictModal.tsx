import { useState } from "react";
import { Button } from "@/shared/ui";
import type { QueueItem } from "../types";

interface ConflictModalProps {
  claim: QueueItem;
  allClaims: QueueItem[];
  onResolve: (chosenClaimId: string, note: string) => void;
  onAcceptUncertainty: (note: string) => void;
  onClose: () => void;
  onOpenSource: (chunkId: string, quote: string) => void;
  submitting: boolean;
}

export function ConflictModal({
  claim,
  allClaims,
  onResolve,
  onAcceptUncertainty,
  onClose,
  onOpenSource,
  submitting,
}: ConflictModalProps) {
  // Find all conflicting claims in this conflict group
  const conflictIds = [claim.claim_id, ...(claim.conflict_with || [])];
  const conflictClaims = allClaims.filter((c) =>
    conflictIds.includes(c.claim_id)
  );

  const [chosenId, setChosenId] = useState<string>(
    claim.suggested_claim_id || claim.claim_id
  );
  const [note, setNote] = useState<string>("");
  const [mode, setMode] = useState<"resolve" | "accept">("resolve");

  const handleSubmit = () => {
    if (mode === "resolve") {
      onResolve(chosenId, note);
    } else {
      if (!note.trim()) {
        alert("A rationale note is required to accept known uncertainty.");
        return;
      }
      onAcceptUncertainty(note);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Resolve Conflict"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-line bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--conflicting)] px-2 py-0.5 text-xs font-semibold text-white">
                ≠ Conflicting Claim
              </span>
              <span className="text-sm font-semibold text-olive">
                {claim.entity_key || "Entity"} • {claim.attribute || "attribute"}
              </span>
            </div>
            <h2 className="mt-1 font-display text-2xl text-ink">
              Side-by-Side Conflict Resolution
            </h2>
            <p className="mt-1 text-xs text-muted">
              {conflictClaims.length} sources disagree on this fact. The system
              provides suggestions, but a human must make the authoritative choice.
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

        {/* Side-by-Side Cards */}
        <div className="mt-4 grid grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
          {conflictClaims.map((item) => {
            const isSuggested = item.claim_id === claim.suggested_claim_id;
            const isChosen = chosenId === item.claim_id;
            const ev = item.evidence[0];

            return (
              <div
                key={item.claim_id}
                className={`relative flex flex-col justify-between rounded-lg border p-4 transition-all ${
                  isChosen && mode === "resolve"
                    ? "border-olive bg-paper ring-2 ring-olive"
                    : "border-line bg-card hover:border-olive/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-muted">
                      {item.claim_id}
                    </span>
                    {isSuggested && (
                      <span className="rounded bg-[var(--leaf)] px-2 py-0.5 text-[10px] font-semibold text-olive">
                        Suggested by heuristics
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-base font-medium text-ink">
                    "{item.statement}"
                  </p>

                  {ev && (
                    <div className="mt-4 rounded border border-line bg-card p-3 text-xs">
                      <p className="font-semibold text-muted">Source Citation:</p>
                      <blockquote className="mt-1 italic text-ink">
                        "{ev.quote}"
                      </blockquote>
                      <div className="mt-2 flex items-center justify-between text-muted">
                        <span>Chunk: {ev.chunk_id}</span>
                        <button
                          type="button"
                          onClick={() => onOpenSource(ev.chunk_id, ev.quote)}
                          className="font-medium text-olive underline hover:text-ink"
                        >
                          View Source
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {mode === "resolve" && (
                  <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-line/60 pt-3 text-sm font-medium">
                    <input
                      type="radio"
                      name="chosenClaim"
                      checked={isChosen}
                      onChange={() => setChosenId(item.claim_id)}
                      className="text-olive focus:ring-olive"
                    />
                    Choose this statement as truth
                  </label>
                )}
              </div>
            );
          })}
        </div>

        {/* Decision & Action Controls */}
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-ink">Resolution mode:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="resolutionMode"
                checked={mode === "resolve"}
                onChange={() => setMode("resolve")}
              />
              Select authoritative side
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="resolutionMode"
                checked={mode === "accept"}
                onChange={() => setMode("accept")}
              />
              Accept as known uncertainty
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted">
              {mode === "resolve"
                ? "Resolution rationale note (optional):"
                : "Uncertainty explanation note (required for known uncertainty):"}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "resolve"
                  ? "e.g., Confirmed with latest git commit and team sync"
                  : "e.g., Team actively transitioning responsibility; keep flagged"
              }
              className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-olive"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="quiet" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? "Applying…"
                : mode === "resolve"
                ? "Apply Choice (Reject other side)"
                : "Accept Known Uncertainty"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

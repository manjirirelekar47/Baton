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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl text-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
                {claim.claim_id}
              </span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold uppercase text-slate-700 border border-slate-200">
                {claim.type}
              </span>
              <StateBadge state={claim.state} />
              <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500 border border-slate-200">
                {claim.acl_label}
              </span>
            </div>
            <h2 id="claim-modal-title" className="text-xl font-bold text-slate-900 mt-2.5 leading-snug">
              {claim.statement}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {claim.state === "conflicting" && (
          <div className="my-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 shadow-xs">
            <strong className="text-rose-700 font-bold">≠ Conflict Detected:</strong> Contradictory statements exist for{" "}
            <code className="bg-rose-100 px-1 py-0.5 rounded text-rose-800 font-bold">{claim.entity_key}</code> ({claim.attribute}).
            {claim.conflict_with && claim.conflict_with.length > 0 && (
              <span className="ml-2">
                Conflicting claim ID(s): {claim.conflict_with.join(", ")}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500 font-medium">Entity:</span>{" "}
              <code className="font-mono text-slate-900 font-bold">{claim.entity_key}</code>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500 font-medium">Attribute:</span>{" "}
              <code className="font-mono text-slate-900 font-bold">{claim.attribute}</code>
            </div>
            {claim.owner && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-slate-500 font-medium">Current Owner:</span> <strong className="text-slate-900">{claim.owner}</strong>
              </div>
            )}
            {claim.proposed_owner && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-slate-500 font-medium">Proposed Owner:</span> <strong className="text-purple-700">{claim.proposed_owner}</strong>
              </div>
            )}
            {claim.due_date && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-slate-500 font-medium">Due Date:</span> <span className="text-slate-900 font-semibold">{claim.due_date}</span>
              </div>
            )}
            {claim.attested_by && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-slate-500 font-medium">Attested By:</span> <span className="text-slate-900 font-semibold">{claim.attested_by}</span>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-2">
              Verbatim Evidence ({claim.evidence.length})
            </h3>
            {claim.evidence.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500 italic">
                No citations available. This fact was recorded without verbatim source grounding.
              </div>
            ) : (
              <div className="space-y-2">
                {claim.evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1 hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-mono font-bold text-purple-700">Chunk {ev.chunk_id}</span>
                      <button
                        type="button"
                        onClick={() => onOpenSource(ev.chunk_id, ev.quote)}
                        className="text-sky-700 hover:text-sky-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        Inspect in Source ↗
                      </button>
                    </div>
                    <blockquote className="border-l-2 border-purple-500 pl-2.5 text-slate-700 italic my-1 font-serif">
                      "{ev.quote}"
                    </blockquote>
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

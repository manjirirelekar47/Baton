import { EmptyState } from "@/shared/ui";
import type { Gap } from "../api";

interface GapsListProps {
  gaps: Gap[];
  onSelectClaim?: (claimId: string) => void;
}

export function GapsList({ gaps, onSelectClaim }: GapsListProps) {
  if (gaps.length === 0) {
    return (
      <EmptyState title="No Knowledge Gaps Detected">
        All extracted facts are supported by verified source citations and no unresolved gaps remain.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {gaps.map((gap) => (
        <div
          key={gap.gap_id}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
                  {gap.gap_id}
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-0.5 text-xs font-bold text-amber-700 border border-amber-200 shadow-xs">
                  ? Knowledge Gap
                </span>
                {gap.asked_to && (
                  <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 border border-slate-200">
                    Assigned: <strong className="text-slate-900">{gap.asked_to}</strong>
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">{gap.question}</h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-500">Reason:</strong> {gap.reason}
              </p>
            </div>
            {gap.claim_id && onSelectClaim && (
              <button
                type="button"
                onClick={() => onSelectClaim(gap.claim_id!)}
                className="shrink-0 rounded-xl border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 transition-colors shadow-xs cursor-pointer"
              >
                View Claim {gap.claim_id} →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

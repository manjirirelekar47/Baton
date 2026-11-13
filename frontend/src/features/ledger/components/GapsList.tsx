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
        <div key={gap.gap_id} className="rounded-lg border border-line bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-semibold text-muted">{gap.gap_id}</span>
                <span className="rounded bg-[#fff3e0] px-2 py-0.5 text-xs font-semibold text-[#b26a00] border border-[#ffe0b2]">
                  ? Knowledge Gap
                </span>
                {gap.asked_to && (
                  <span className="rounded bg-wash px-2 py-0.5 text-xs text-muted">
                    Assigned: <strong>{gap.asked_to}</strong>
                  </span>
                )}
              </div>
              <h3 className="font-display text-base text-ink">{gap.question}</h3>
              <p className="mt-1 text-xs text-muted">
                <strong>Reason:</strong> {gap.reason}
              </p>
            </div>
            {gap.claim_id && onSelectClaim && (
              <button
                type="button"
                onClick={() => onSelectClaim(gap.claim_id!)}
                className="shrink-0 rounded border border-line bg-wash px-2.5 py-1 text-xs font-medium hover:bg-card"
              >
                View Claim {gap.claim_id}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

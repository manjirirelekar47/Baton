import { StateBadge, Button } from "@/shared/ui";
import type { ClaimState } from "@/shared/types";
import type { QueueItem } from "../types";

interface QueueItemCardProps {
  item: QueueItem;
  onConfirm: (claimId: string) => void;
  onReject: (claimId: string) => void;
  onMarkUnknown: (claimId: string) => void;
  onOpenEdit: (item: QueueItem) => void;
  onOpenConflict: (item: QueueItem) => void;
  onOpenAcceptUncertainty: (item: QueueItem) => void;
  onOpenAskLeaver: (item: QueueItem) => void;
  onOpenSource: (chunkId: string, quote: string) => void;
  actionLoading: boolean;
}

export function QueueItemCard({
  item,
  onConfirm,
  onReject,
  onMarkUnknown,
  onOpenEdit,
  onOpenConflict,
  onOpenAcceptUncertainty,
  onOpenAskLeaver,
  onOpenSource,
  actionLoading,
}: QueueItemCardProps) {
  const normState = item.state.toLowerCase() as ClaimState;
  const isConflicting = normState === "conflicting";
  const isMissing = normState === "missing";
  const isInferred = normState === "inferred";
  const isStale = (item.state.toLowerCase()) === "stale";
  const isVerified = normState === "verified";
  const isAttested = normState === "attested";

  return (
    <article
      className={`rounded-lg border p-4 transition-all shadow-sm ${
        isConflicting
          ? "border-[var(--conflicting)]/50 bg-[var(--conflicting)]/5"
          : isStale
          ? "border-[var(--inferred)]/50 bg-[var(--inferred)]/5"
          : "border-line bg-card"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-muted">
            {item.claim_id}
          </span>
          <StateBadge state={normState} />
          <span className="rounded bg-wash px-2 py-0.5 text-xs font-medium text-ink">
            {item.acl_label}
          </span>
          <span className="rounded bg-paper px-2 py-0.5 text-xs text-muted">
            {item.claim_type}
          </span>
          {item.entity_key && (
            <span className="text-xs font-semibold text-olive">
              {item.entity_key}
              {item.attribute ? ` • ${item.attribute}` : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {item.pending ? (
            <span className="rounded bg-[var(--inferred)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--inferred)]">
              Pending Action
            </span>
          ) : (
            <span className="rounded bg-[var(--verified)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--verified)]">
              Decided ({item.last_action})
            </span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-base font-medium text-ink">{item.statement}</p>
        <p className="mt-1 text-xs text-muted italic">
          Risk rank {item.risk_rank}: {item.risk_reason}
        </p>
      </div>

      {/* Citations */}
      {item.evidence && item.evidence.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-muted">Evidence quotes:</span>
          {item.evidence.map((ev, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onOpenSource(ev.chunk_id, ev.quote)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-ink hover:bg-wash transition-colors"
              title={`Chunk: ${ev.chunk_id}`}
            >
              <span className="font-mono text-[10px] text-muted">{ev.chunk_id}</span>
              <span className="max-w-[200px] truncate italic">"{ev.quote}"</span>
            </button>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line/60 pt-3">
        {isConflicting ? (
          <>
            <Button
              variant="primary"
              className="text-xs"
              onClick={() => onOpenConflict(item)}
              disabled={actionLoading}
            >
              Resolve Conflict Side-by-Side
            </Button>
            <Button
              variant="quiet"
              className="text-xs"
              onClick={() => onOpenAcceptUncertainty(item)}
              disabled={actionLoading}
            >
              Accept Uncertainty
            </Button>
          </>
        ) : (
          <>
            {(isVerified || isAttested) && (
              <Button
                variant="primary"
                className="text-xs"
                onClick={() => onConfirm(item.claim_id)}
                disabled={actionLoading}
              >
                Confirm as Fact
              </Button>
            )}

            {isInferred && (
              <>
                <Button
                  variant="primary"
                  className="text-xs"
                  onClick={() => onConfirm(item.claim_id)}
                  disabled={actionLoading}
                >
                  Confirm as Fact
                </Button>
                <Button
                  variant="quiet"
                  className="text-xs"
                  onClick={() => onOpenAcceptUncertainty(item)}
                  disabled={actionLoading}
                >
                  Accept Uncertainty
                </Button>
              </>
            )}

            {isMissing && (
              <Button
                variant="primary"
                className="text-xs"
                onClick={() => onOpenAskLeaver(item)}
                disabled={actionLoading}
              >
                Ask Leaver
              </Button>
            )}

            <Button
              variant="quiet"
              className="text-xs"
              onClick={() => onOpenEdit(item)}
              disabled={actionLoading}
            >
              Edit
            </Button>

            <Button
              variant="quiet"
              className="text-xs"
              onClick={() => onMarkUnknown(item.claim_id)}
              disabled={actionLoading}
            >
              Mark Unknown
            </Button>

            {!isMissing && (
              <Button
                variant="quiet"
                className="text-xs text-[var(--conflicting)] hover:bg-[var(--conflicting)]/10"
                onClick={() => onReject(item.claim_id)}
                disabled={actionLoading}
              >
                Reject
              </Button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

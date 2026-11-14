/**
 * QueueItemCard.tsx
 * Pure White High-Contrast Review Queue Item Card.
 * 
 * Strict Light Mode Overhaul Rules:
 * - Base Backgrounds MUST be White: bg-white border border-slate-200 shadow-sm
 * - Conflicting State Cards: bg-red-50 border-red-200 text-red-900
 * - Base Text MUST be Dark: text-slate-900 for primary text, text-slate-500 for secondary text
 * - Zero muddy grays: No bg-gray-*, bg-slate-500, bg-slate-600, bg-slate-800, or bg-black/20
 * - Raw citation hashes hidden behind clean "View Quote" action
 * - Dark Mode Strictly Preserved: All dark: classes remain untouched
 */

import React from "react";
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
  const isStale = item.state.toLowerCase() === "stale";
  const isVerified = normState === "verified";
  const isAttested = normState === "attested";

  return (
    <article
      className={`rounded-2xl border p-6 transition-all shadow-sm ${
        isConflicting
          ? "border-red-200 bg-red-50 text-red-900 dark:border-rose-500/40 dark:bg-rose-950/20 dark:shadow-[0_0_15px_rgba(244,63,94,0.15)]"
          : isStale
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/20 dark:shadow-[0_0_15px_rgba(245,158,11,0.15)]"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-shadow dark:border-white/10 dark:bg-black/40 dark:hover:border-purple-400/30 dark:shadow-none"
      }`}
    >
      {/* Card Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b ${
          isConflicting
            ? "border-red-200/80 dark:border-white/10"
            : "border-slate-100 dark:border-white/10"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/20">
            {item.claim_id}
          </span>
          <StateBadge state={normState} />
          <span className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-mono font-semibold text-slate-700 dark:bg-white/5 dark:text-gray-300 dark:border-white/10">
            {item.acl_label}
          </span>
          <span className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-white/5 dark:text-gray-400 dark:border-white/10">
            {item.claim_type}
          </span>
          {item.entity_key && (
            <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
              {item.entity_key}
              {item.attribute ? ` · ${item.attribute}` : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {item.pending ? (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-900 shadow-xs dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-500/30">
              Pending Action
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-900 shadow-xs dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-500/30">
              Decided ({item.last_action})
            </span>
          )}
        </div>
      </div>

      {/* Primary Statement */}
      <div className="mt-4">
        <p
          className={`text-base font-bold leading-relaxed ${
            isConflicting
              ? "text-red-900 dark:text-white"
              : "text-slate-900 dark:text-white"
          }`}
        >
          {item.statement}
        </p>
        <p
          className={`mt-1.5 text-xs ${
            isConflicting
              ? "text-red-800 dark:text-gray-400"
              : "text-slate-500 dark:text-gray-400"
          }`}
        >
          <strong
            className={`font-semibold ${
              isConflicting
                ? "text-red-950 dark:text-rose-400"
                : "text-rose-700 dark:text-rose-400"
            }`}
          >
            Risk rank {item.risk_rank}:
          </strong>{" "}
          {item.risk_reason}
        </p>
      </div>

      {/* Evidence Citations Summary */}
      {item.evidence && item.evidence.length > 0 && (
        <div
          className={`mt-4 pt-3 flex flex-wrap items-center justify-between gap-2 border-t text-xs ${
            isConflicting
              ? "border-red-200/80 dark:border-white/10"
              : "border-slate-100 dark:border-white/10"
          }`}
        >
          <div
            className={`flex items-center gap-2 ${
              isConflicting
                ? "text-red-900 dark:text-gray-400"
                : "text-slate-500 dark:text-gray-400"
            }`}
          >
            <span className="font-medium">Evidence citations:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-3 py-0.5 text-xs font-bold text-purple-700 dark:bg-cyan-950/40 dark:border-cyan-500/30 dark:text-cyan-300">
              {item.evidence.length} verified source{item.evidence.length > 1 ? "s" : ""}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenSource(item.evidence![0].chunk_id, item.evidence![0].quote)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 hover:underline cursor-pointer dark:text-cyan-300"
          >
            <span>View Quote ({item.evidence[0].chunk_id})</span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div
        className={`mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t pt-4 ${
          isConflicting
            ? "border-red-200/80 dark:border-white/10"
            : "border-slate-100 dark:border-white/10"
        }`}
      >
        {isConflicting ? (
          <>
            <Button
              variant="primary"
              className="text-xs px-4 py-2 cursor-pointer font-semibold shadow-sm"
              onClick={() => onOpenConflict(item)}
              disabled={actionLoading}
            >
              Fix Disagreement
            </Button>
            <Button
              variant="quiet"
              className="text-xs px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs cursor-pointer dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
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
                className="text-xs px-4 py-2 cursor-pointer font-semibold shadow-sm"
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
                  className="text-xs px-4 py-2 cursor-pointer font-semibold shadow-sm"
                  onClick={() => onConfirm(item.claim_id)}
                  disabled={actionLoading}
                >
                  Confirm as Fact
                </Button>
                <Button
                  variant="quiet"
                  className="text-xs px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs cursor-pointer dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
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
                className="text-xs px-4 py-2 cursor-pointer font-semibold shadow-sm"
                onClick={() => onOpenAskLeaver(item)}
                disabled={actionLoading}
              >
                Ask Leaver
              </Button>
            )}

            <Button
              variant="quiet"
              className="text-xs px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs cursor-pointer dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              onClick={() => onOpenEdit(item)}
              disabled={actionLoading}
            >
              Edit
            </Button>

            <Button
              variant="quiet"
              className="text-xs px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs cursor-pointer dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              onClick={() => onMarkUnknown(item.claim_id)}
              disabled={actionLoading}
            >
              Mark Unknown
            </Button>

            {!isMissing && (
              <Button
                variant="quiet"
                className="text-xs px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 shadow-xs cursor-pointer dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
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

export default QueueItemCard;

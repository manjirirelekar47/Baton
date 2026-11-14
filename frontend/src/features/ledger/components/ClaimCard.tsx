/**
 * ClaimCard.tsx
 * Pure White High-Contrast Card for Claim Ledger items.
 * 
 * Strict Light Mode Overhaul Rules:
 * - Base Backgrounds MUST be White: bg-white border border-slate-200 shadow-sm
 * - Conflicting State Cards: bg-red-50 border-red-200 text-red-900
 * - Base Text MUST be Dark: text-slate-900 for primary text, text-slate-500 for secondary text
 * - Zero muddy grays: No bg-gray-*, bg-slate-500, bg-slate-600, bg-slate-800, or bg-black/20
 * - Raw citation hashes hidden behind clean "View Details" action
 * - Dark Mode Strictly Preserved: All dark: classes remain untouched
 */

import React from "react";
import { StateBadge } from "@/shared/ui";
import type { Claim } from "../api";

interface ClaimCardProps {
  claim: Claim;
  onSelectClaim: (claim: Claim) => void;
  onOpenSource: (chunkId: string, quote: string) => void;
}

export const ClaimCard: React.FC<ClaimCardProps> = ({
  claim,
  onSelectClaim,
  onOpenSource,
}) => {
  const isConflicting = claim.state === "conflicting";

  return (
    <article
      className={`rounded-2xl border p-6 transition-all shadow-sm ${
        isConflicting
          ? "border-red-200 bg-red-50 text-red-900 dark:border-rose-500/40 dark:bg-rose-950/20 dark:shadow-[0_0_15px_rgba(244,63,94,0.15)]"
          : "border-slate-200 bg-white hover:shadow-md transition-shadow dark:border-white/10 dark:bg-black/40 dark:backdrop-blur-xl dark:shadow-2xl"
      }`}
    >
      {/* Card Header: State Badge, Type, Entity, and View Details Button */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b ${
          isConflicting
            ? "border-red-200/80 dark:border-white/10"
            : "border-slate-100 dark:border-white/10"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <StateBadge state={claim.state} />
          <span className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-white/5 dark:text-gray-300 dark:border-white/10">
            {claim.type}
          </span>
          <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/20">
            {claim.entity_key}
            {claim.attribute ? ` · ${claim.attribute}` : ""}
          </span>
        </div>

        {/* View Details Action Button */}
        <button
          type="button"
          onClick={() => onSelectClaim(claim)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 shadow-xs transition-colors cursor-pointer dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <span>View Details</span>
          <span aria-hidden="true">→</span>
        </button>
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
          {claim.statement}
        </p>
        {claim.owner && (
          <p
            className={`mt-2 text-xs ${
              isConflicting
                ? "text-red-800 dark:text-gray-400"
                : "text-slate-500 dark:text-gray-400"
            }`}
          >
            Owner:{" "}
            <strong
              className={`font-semibold ${
                isConflicting
                  ? "text-red-950 dark:text-gray-200"
                  : "text-slate-900 dark:text-gray-200"
              }`}
            >
              {claim.owner}
            </strong>
          </p>
        )}
      </div>

      {/* Evidence Citations Footer */}
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
          {claim.evidence && claim.evidence.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-3 py-0.5 text-xs font-bold text-purple-700 dark:bg-cyan-950/40 dark:border-cyan-500/30 dark:text-cyan-300">
              {claim.evidence.length} verified source{claim.evidence.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-slate-500 italic dark:text-gray-500">
              No citations attached
            </span>
          )}
        </div>

        {claim.evidence && claim.evidence.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenSource(claim.evidence[0].chunk_id, claim.evidence[0].quote)}
            className="text-xs font-semibold text-purple-700 hover:text-purple-900 hover:underline cursor-pointer dark:text-cyan-300"
          >
            Inspect Source Quote ↗
          </button>
        )}
      </div>
    </article>
  );
};

export default ClaimCard;

/**
 * RiskCard.tsx
 * Simplified, Scannable Risk Card supporting both Light and Dark modes.
 * 
 * Features:
 * - Bold, simple headline (e.g., "Payments Module — At Risk")
 * - Clear 1-sentence explanation of the knowledge gap
 * - Intuitive status badges (bg-red-50 border-red-200 text-red-900 in Light, bg-red-900/30 border-red-500/30 text-red-200 in Dark)
 * - Breathable whitespace (p-6, gap-4)
 * - Clean "View Metrics & Evidence" disclosure toggle to prevent visual clutter
 */

import React, { useState } from "react";
import type { RiskSignal } from "../public";

interface RiskCardProps {
  signal: RiskSignal;
  isDark?: boolean;
}

export const RiskCard: React.FC<RiskCardProps> = ({ signal, isDark = false }) => {
  const [showDetails, setShowDetails] = useState(false);

  // Derive a succinct 1-sentence explanation of the gap
  const explanation =
    signal.reasons && signal.reasons.length > 0
      ? signal.reasons[0]
      : signal.flagged
      ? `Critical knowledge concentration: ${Math.round(signal.exclusivity * 100)}% of ownership is held by ${signal.person} across ${signal.dependents} dependent components.`
      : `Normal knowledge distribution with active multi-contributor coverage and verified documentation.`;

  return (
    <article
      className={`rounded-2xl transition-all ${
        isDark
          ? "border border-white/10 bg-black/40 backdrop-blur-xl p-6 shadow-2xl hover:border-purple-400/30"
          : "border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
      }`}
    >
      {/* Header: Headline & Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3
              className={`text-xl font-bold tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {signal.module} Module — {signal.flagged ? "At Risk" : "Normal"}
            </h3>
          </div>
          <p
            className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Key Contributor:{" "}
            <strong
              className={`font-semibold ${
                isDark ? "text-purple-300" : "text-purple-700"
              }`}
            >
              {signal.person}
            </strong>
          </p>
        </div>

        {/* Intuitive Status Badge */}
        <span
          className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider border shadow-xs ${
            signal.flagged
              ? isDark
                ? "bg-red-900/30 border-red-500/30 text-red-200 shadow-[0_0_12px_rgba(244,63,94,0.2)]"
                : "bg-red-50 border-red-200 text-red-900"
              : isDark
              ? "bg-emerald-900/30 border-emerald-500/30 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}
        >
          {signal.flagged ? "At Risk" : "Normal"}
        </span>
      </div>

      {/* 1-Sentence Explanation */}
      <p
        className={`mt-3 text-sm leading-relaxed ${
          isDark ? "text-slate-300" : "text-slate-600"
        }`}
      >
        {explanation}
      </p>

      {/* Action Footer: Toggle for Deep Metrics */}
      <div
        className={`mt-4 pt-3 flex flex-wrap items-center justify-between gap-3 border-t ${
          isDark ? "border-white/10" : "border-slate-100"
        }`}
      >
        <div className="flex items-center gap-3 text-xs">
          <span
            className={`font-medium ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Concentration:{" "}
            <strong className={isDark ? "text-white" : "text-slate-900"}>
              {Math.round(signal.exclusivity * 100)}%
            </strong>
          </span>
          <span className={isDark ? "text-white/20" : "text-slate-300"}>•</span>
          <span
            className={`font-medium ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Dependents:{" "}
            <strong className={isDark ? "text-white" : "text-slate-900"}>
              {signal.dependents}
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
            isDark
              ? "border-white/15 bg-white/5 hover:bg-white/10 text-purple-300 hover:text-white"
              : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-purple-700 hover:text-purple-800"
          }`}
        >
          {showDetails ? "Hide Metrics & Evidence ↑" : "View Signal Details ↓"}
        </button>
      </div>

      {/* Collapsible Deep Metrics Panel */}
      {showDetails && (
        <div
          className={`mt-4 pt-4 border-t space-y-3.5 animate-in fade-in duration-200 ${
            isDark ? "border-white/10" : "border-slate-100"
          }`}
        >
          <div
            className={`grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-xl border text-xs ${
              isDark
                ? "bg-black/60 border-white/10"
                : "bg-slate-50 border-slate-200/80"
            }`}
          >
            <div>
              <strong
                className={`text-base font-extrabold block ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {Math.round(signal.exclusivity * 100)}%
              </strong>
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                Concentration
              </span>
            </div>
            <div>
              <strong
                className={`text-base font-extrabold block ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {signal.dependents}
              </strong>
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                Dependents
              </span>
            </div>
            <div>
              <strong
                className={`text-base font-extrabold block ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {signal.undocumented_decisions}
              </strong>
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                Missing rationale
              </span>
            </div>
            <div>
              <strong
                className={`text-base font-extrabold block ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {signal.account_ties}
              </strong>
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                Account ties
              </span>
            </div>
            <div>
              <strong
                className={`text-base font-extrabold block ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {signal.work_in_flight}
              </strong>
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                Work in flight
              </span>
            </div>
          </div>

          {signal.reasons.length > 0 && (
            <ul
              className={`list-disc space-y-1 pl-5 text-xs ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              {signal.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}

          <p
            className={`text-[11px] font-mono ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Evidence Chunks:{" "}
            {signal.evidence_chunk_ids.length
              ? signal.evidence_chunk_ids.join(", ")
              : "No linked chunks"}
          </p>
        </div>
      )}
    </article>
  );
};

export default RiskCard;

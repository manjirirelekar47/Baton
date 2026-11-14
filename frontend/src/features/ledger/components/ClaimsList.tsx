/**
 * ClaimsList.tsx
 * Pure White Modern Claims List for Claim Ledger.
 * 
 * Strict Light Mode Overhaul Rules:
 * - Pure White Cards: bg-white border border-slate-200 shadow-sm
 * - High Contrast: Primary text text-slate-900, secondary text-slate-600.
 * - Zero muddy grays: No bg-gray-400, bg-slate-400, bg-gray-500, bg-slate-500, or bg-black/20.
 * - Zero text-white on light backgrounds.
 * - Modular ClaimCard integration.
 * - Dark Mode Strictly Preserved: All dark: classes remain untouched.
 */

import { useState, useMemo } from "react";
import { EmptyState } from "@/shared/ui";
import type { Claim } from "../api";
import type { ClaimState } from "@/shared/types";
import { ClaimCard } from "./ClaimCard";

interface ClaimsListProps {
  claims: Claim[];
  onSelectClaim: (claim: Claim) => void;
  onOpenSource: (chunkId: string, quote: string) => void;
}

const ALL_STATES: ClaimState[] = ["verified", "inferred", "conflicting", "missing", "attested"];

const ALL_TYPES = [
  "decision",
  "owner",
  "dependency",
  "blocker",
  "risk",
  "recurring_problem",
  "open_question",
  "contact",
  "next_action",
  "timeline_event",
];

export function ClaimsList({ claims, onSelectClaim, onOpenSource }: ClaimsListProps) {
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = useMemo(() => {
    return claims.filter((c) => {
      if (selectedState !== "all" && c.state !== selectedState) return false;
      if (selectedType !== "all" && c.type !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchStmt = c.statement.toLowerCase().includes(q);
        const matchEnt = c.entity_key.toLowerCase().includes(q);
        const matchOwner = (c.owner ?? "").toLowerCase().includes(q);
        if (!matchStmt && !matchEnt && !matchOwner) return false;
      }
      return true;
    });
  }, [claims, selectedState, selectedType, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40 dark:backdrop-blur-xl dark:shadow-2xl">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="font-semibold text-slate-700 dark:text-gray-300">State:</label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-xs transition-colors dark:border-white/15 dark:bg-slate-900 dark:text-white"
          >
            <option value="all">All States</option>
            {ALL_STATES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          <label className="ml-2 font-semibold text-slate-700 dark:text-gray-300">Type:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-xs transition-colors dark:border-white/15 dark:bg-slate-900 dark:text-white"
          >
            <option value="all">All Types</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-auto">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search statement, entity, or owner…"
            className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-xs transition-colors dark:border-white/15 dark:bg-slate-900 dark:text-white dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Spacious Claims List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-black/40 dark:backdrop-blur-xl dark:shadow-2xl">
          <EmptyState title="No claims match your filters">
            Try adjusting the State or Type filters, or clearing the search query.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((claim) => (
            <ClaimCard
              key={claim.claim_id}
              claim={claim}
              onSelectClaim={onSelectClaim}
              onOpenSource={onOpenSource}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ClaimsList;

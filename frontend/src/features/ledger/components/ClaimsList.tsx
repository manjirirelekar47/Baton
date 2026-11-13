import { useState, useMemo } from "react";
import { StateBadge, EmptyState } from "@/shared/ui";
import type { Claim } from "../api";
import type { ClaimState } from "@/shared/types";

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
      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-card p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="font-medium text-muted">State:</label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="rounded border border-line bg-wash px-2 py-1 text-xs text-ink"
          >
            <option value="all">All States</option>
            {ALL_STATES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          <label className="ml-2 font-medium text-muted">Type:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded border border-line bg-wash px-2 py-1 text-xs text-ink"
          >
            <option value="all">All Types</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="search"
            placeholder="Search statement or entity…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-line bg-wash px-3 py-1 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-olive"
          />
        </div>
      </div>

      {/* Claims List Table / Cards */}
      {filtered.length === 0 ? (
        <EmptyState title="No matching claims found">
          Try adjusting your state or type filters, or search query.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-wash text-xs font-semibold text-muted">
              <tr>
                <th className="py-2.5 px-4">State</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Entity & Attribute</th>
                <th className="py-2.5 px-4">Statement</th>
                <th className="py-2.5 px-3">Citations</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((claim) => (
                <tr
                  key={claim.claim_id}
                  className="hover:bg-wash/60 transition-colors cursor-pointer"
                  onClick={() => onSelectClaim(claim)}
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <StateBadge state={claim.state} />
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="rounded bg-wash px-2 py-0.5 text-xs font-mono text-muted border border-line">
                      {claim.type}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-mono text-xs text-ink font-medium">{claim.entity_key}</div>
                    <div className="text-[11px] text-muted">{claim.attribute}</div>
                  </td>
                  <td className="py-3 px-4 max-w-md">
                    <div className="font-medium text-ink">{claim.statement}</div>
                    {claim.owner && (
                      <div className="mt-0.5 text-xs text-muted">Owner: {claim.owner}</div>
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {claim.evidence.length > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const ev = claim.evidence[0];
                          onOpenSource(ev.chunk_id, ev.quote);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-[#eef3f7] px-2 py-0.5 text-xs font-medium text-[#1a4a6e] hover:bg-[#dbe6f0]"
                      >
                        <span>{claim.evidence.length} citation{claim.evidence.length > 1 ? "s" : ""}</span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    ) : (
                      <span className="text-xs text-muted italic">None (Gap)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClaim(claim);
                      }}
                      className="rounded border border-line bg-card px-2.5 py-1 text-xs font-medium text-olive hover:bg-wash"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "@/app/api";
import { useAuth } from "@/app/auth";
import { Button, EmptyState, ErrorState, Loading, StateBadge } from "@/shared/ui";
import { SourceDrawer } from "@/features/sources/public";
import type { ClaimState } from "@/shared/types";

interface Claim {
  claim_id: string;
  statement: string;
  state: ClaimState;
  access_label: string;
  section?: string;
  evidence?: { chunk_id: string; quote: string; source_title?: string }[];
}

interface Gap {
  gap_id: string;
  title: string;
  module?: string;
  impact?: string;
  suggested_action?: string;
}

export function LedgerPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get("view") === "verify" ? "verify" : "ledger";
  const [filterState, setFilterState] = useState<string>("all");
  const [citation, setCitation] = useState<{ chunkId: string; quote: string } | null>(null);

  const claimsQuery = useQuery({
    queryKey: ["claims", user?.id],
    queryFn: () => api<{ claims: Claim[]; hidden_count: number }>("/claims"),
  });

  const gapsQuery = useQuery({
    queryKey: ["gaps", user?.id],
    queryFn: () => api<Gap[]>("/gaps"),
  });

  const claims = claimsQuery.data?.claims ?? [];
  const hiddenCount = claimsQuery.data?.hidden_count ?? 0;

  const filteredClaims =
    filterState === "all"
      ? claims
      : claims.filter((c) => c.state.toLowerCase() === filterState.toLowerCase());

  return (
    <section className="space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {viewMode === "verify" ? "Verification & Evidence Ledger" : "Claim Ledger"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {viewMode === "verify"
              ? "Deterministic verification checks and evidence grounding for extracted project claims."
              : "Reconstruct claims from connected sources, verify quotes, and detect critical knowledge gaps."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setSearchParams({})}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                viewMode === "ledger" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Claims ({claims.length})
            </button>
            <button
              onClick={() => setSearchParams({ view: "verify" })}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                viewMode === "verify" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Verification Mode
            </button>
          </div>
          <Button
            variant="quiet"
            onClick={() => {
              void claimsQuery.refetch();
              void gapsQuery.refetch();
            }}
          >
            Re-run Checks
          </Button>
        </div>
      </div>

      {claimsQuery.isLoading && <Loading label="Loading claims and verification records" />}
      {claimsQuery.error && (
        <ErrorState
          title="Could not load claims"
          detail={(claimsQuery.error as Error).message}
          onRetry={() => void claimsQuery.refetch()}
        />
      )}

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
        {["all", "verified", "inferred", "conflicting", "missing", "attested"].map((st) => (
          <button
            key={st}
            onClick={() => setFilterState(st)}
            className={`px-3 py-1 text-xs font-semibold rounded-xl border transition cursor-pointer capitalize ${
              filterState === st
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Hidden Items Notice */}
      {hiddenCount > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          <span className="font-bold text-slate-700">ℹ Note:</span>
          <span>
            {hiddenCount} claim{hiddenCount === 1 ? "" : "s"} restricted from your role ({user?.role}) by access control policies.
          </span>
        </div>
      )}

      {/* Claims List */}
      <div className="space-y-3">
        {filteredClaims.length === 0 && !claimsQuery.isLoading && (
          <EmptyState title="No claims found">
            {filterState === "all"
              ? "Connect sources or run the reconstruct process to generate verified claims."
              : `No claims match the "${filterState}" filter.`}
          </EmptyState>
        )}

        {filteredClaims.map((claim) => (
          <article
            key={claim.claim_id}
            className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-card-soft hover:border-indigo-200 transition space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <StateBadge state={claim.state} />
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                  {claim.access_label}
                </span>
                {claim.section && (
                  <span className="text-xs text-slate-400 font-medium">Section: {claim.section}</span>
                )}
              </div>
              <span className="text-xs font-mono text-slate-400">{claim.claim_id}</span>
            </div>

            <p className="text-sm font-semibold text-slate-900 leading-relaxed">{claim.statement}</p>

            {claim.evidence && claim.evidence.length > 0 && (
              <div className="mt-2 pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Verbatim Evidence</span>
                {claim.evidence.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    <p className="text-xs italic text-slate-700 truncate mr-3">“{ev.quote}”</p>
                    <button
                      type="button"
                      onClick={() => setCitation({ chunkId: ev.chunk_id, quote: ev.quote })}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 shrink-0"
                    >
                      View Source ({ev.chunk_id}) →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Identified Knowledge Gaps */}
      {gapsQuery.data && gapsQuery.data.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Identified Knowledge Gaps</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gapsQuery.data.map((gap) => (
              <div
                key={gap.gap_id}
                className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 shadow-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">{gap.title}</span>
                  <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                    Gap
                  </span>
                </div>
                {gap.module && <p className="text-xs text-amber-800">Module: {gap.module}</p>}
                {gap.suggested_action && (
                  <p className="text-xs text-slate-600 mt-1">
                    <strong>Recommended Action:</strong> {gap.suggested_action}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source Citation Drawer */}
      {citation && (
        <SourceDrawer
          chunkId={citation.chunkId}
          quote={citation.quote}
          onClose={() => setCitation(null)}
        />
      )}
    </section>
  );
}

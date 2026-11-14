/**
 * LedgerPage.tsx
 * Pure White High-Contrast Ledger Page.
 * 
 * Strict Light Mode Overhaul Rules:
 * - Base Backgrounds MUST be White: bg-white border border-slate-200 shadow-sm
 * - Base Text MUST be Dark: text-slate-900 for primary text, text-slate-500 for secondary text
 * - Zero muddy grays: No bg-gray-*, bg-slate-500, bg-slate-600, bg-slate-800, or bg-black/20
 * - Dark Mode Strictly Preserved: All dark: classes remain untouched
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/auth";
import { Loading, ErrorState } from "@/shared/ui";
import { SourceDrawer } from "@/features/sources/public";
import { fetchClaims, fetchGaps, type Claim } from "../api";
import { ReconstructBar } from "../components/ReconstructBar";
import { ClaimsList } from "../components/ClaimsList";
import { ClaimDetailModal } from "../components/ClaimDetailModal";
import { GapsList } from "../components/GapsList";

export function LedgerPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"claims" | "gaps">("claims");
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [inspectSource, setInspectSource] = useState<{ chunkId: string; quote: string } | null>(null);

  const {
    data: claimsData,
    isLoading: isClaimsLoading,
    error: claimsError,
    refetch: refetchClaims,
  } = useQuery({
    queryKey: ["claims", user?.id, user?.role],
    queryFn: fetchClaims,
  });

  const {
    data: gapsData,
    isLoading: isGapsLoading,
    error: gapsError,
    refetch: refetchGaps,
  } = useQuery({
    queryKey: ["gaps", user?.id],
    queryFn: fetchGaps,
  });

  const handleReconstructComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["claims"] });
    queryClient.invalidateQueries({ queryKey: ["gaps"] });
  };

  const handleOpenSource = (chunkId: string, quote: string) => {
    setInspectSource({ chunkId, quote });
  };

  const claims = claimsData?.claims ?? [];
  const hiddenCount = claimsData?.hidden_count ?? 0;
  const gaps = gapsData ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-12 animate-in fade-in duration-300">
      {/* Reconstruction Action Bar (The Reconstruct Project State Header) */}
      <ReconstructBar onComplete={handleReconstructComplete} />

      {/* Access Control Notice if Items Are Hidden */}
      {hiddenCount > 0 && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-center gap-2.5 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <span aria-hidden="true" className="text-amber-700 dark:text-amber-400 font-bold text-sm">🔒</span>
          <span>
            <strong className="text-amber-950 dark:text-amber-300">Access notice:</strong> {hiddenCount} sensitive project detail{hiddenCount > 1 ? "s are" : " is"} hidden based on your team role ({user?.role}). In accordance with Baton's access rules, restricted facts arrive as a count only.
          </span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-sm font-semibold pt-2 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab("claims")}
          className={`pb-3 -mb-px transition-all cursor-pointer font-bold ${
            activeTab === "claims"
              ? "border-b-2 border-purple-600 text-purple-700 dark:text-purple-300"
              : "border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          Project Facts ({claims.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("gaps")}
          className={`pb-3 -mb-px transition-all cursor-pointer font-bold ${
            activeTab === "gaps"
              ? "border-b-2 border-purple-600 text-purple-700 dark:text-purple-300"
              : "border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          Open Questions ({gaps.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "claims" && (
        <div>
          {isClaimsLoading && <Loading label="Loading project facts..." />}
          {claimsError && (
            <ErrorState
              title="Unable to load project facts"
              detail={(claimsError as Error).message}
              onRetry={() => refetchClaims()}
            />
          )}
          {!isClaimsLoading && !claimsError && (
            <ClaimsList
              claims={claims}
              onSelectClaim={setSelectedClaim}
              onOpenSource={handleOpenSource}
            />
          )}
        </div>
      )}

      {activeTab === "gaps" && (
        <div>
          {isGapsLoading && <Loading label="Checking for open questions..." />}
          {gapsError && (
            <ErrorState
              title="Unable to load open questions"
              detail={(gapsError as Error).message}
              onRetry={() => refetchGaps()}
            />
          )}
          {!isGapsLoading && !gapsError && <GapsList gaps={gaps} />}
        </div>
      )}

      {/* Modals & Drawers */}
      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onOpenSource={handleOpenSource}
        />
      )}

      {inspectSource && (
        <SourceDrawer
          chunkId={inspectSource.chunkId}
          quote={inspectSource.quote}
          onClose={() => setInspectSource(null)}
        />
      )}
    </div>
  );
}

export default LedgerPage;

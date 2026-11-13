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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl text-olive">Claim Ledger & Reconstruction</h1>
        <p className="mt-1 text-sm text-muted">
          Reconstructed project knowledge with deterministic quote verification, honesty state badges, and Gap identification.
        </p>
      </div>

      {/* Reconstruction Action Bar */}
      <ReconstructBar onComplete={handleReconstructComplete} />

      {/* Access Control Notice if Items Are Hidden */}
      {hiddenCount > 0 && (
        <div
          role="status"
          className="rounded-lg border border-[#e0c870] bg-[#fffdf0] p-3 text-xs text-[#705800] flex items-center gap-2"
        >
          <span aria-hidden="true">🔒</span>
          <span>
            <strong>Access notice:</strong> {hiddenCount} restricted claim{hiddenCount > 1 ? "s are" : " is"} hidden for your role ({user?.role}). In accordance with Baton's access rules, restricted facts arrive as a count only.
          </span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-line">
        <button
          type="button"
          onClick={() => setActiveTab("claims")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "claims"
              ? "border-olive text-olive font-semibold"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Claim Ledger ({claims.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("gaps")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "gaps"
              ? "border-olive text-olive font-semibold"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Knowledge Gaps ({gaps.length})
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === "claims" ? (
        <div>
          {isClaimsLoading && <Loading label="Loading claim ledger" />}
          {claimsError && (
            <ErrorState
              title="Could not load claims"
              detail={(claimsError as Error).message}
              onRetry={() => void refetchClaims()}
            />
          )}
          {!isClaimsLoading && !claimsError && (
            <ClaimsList
              claims={claims}
              onSelectClaim={(claim) => setSelectedClaim(claim)}
              onOpenSource={handleOpenSource}
            />
          )}
        </div>
      ) : (
        <div>
          {isGapsLoading && <Loading label="Loading knowledge gaps" />}
          {gapsError && (
            <ErrorState
              title="Could not load gaps"
              detail={(gapsError as Error).message}
              onRetry={() => void refetchGaps()}
            />
          )}
          {!isGapsLoading && !gapsError && (
            <GapsList
              gaps={gaps}
              onSelectClaim={(claimId) => {
                const found = claims.find((c) => c.claim_id === claimId);
                if (found) setSelectedClaim(found);
              }}
            />
          )}
        </div>
      )}

      {/* Claim Detail Modal */}
      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onOpenSource={handleOpenSource}
        />
      )}

      {/* Source Drawer with Highlighted Verbatim Quote */}
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

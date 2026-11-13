import { useEffect, useState } from "react";
import { Button } from "@/shared/ui";
import { triggerReconstruct, fetchJob, type ReconstructJob } from "../api";

interface ReconstructBarProps {
  onComplete: () => void;
}

export function ReconstructBar({ onComplete }: ReconstructBarProps) {
  const [activeJob, setActiveJob] = useState<ReconstructJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const job = await triggerReconstruct();
      setActiveJob(job);
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!activeJob || activeJob.status === "done" || activeJob.status === "failed") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await fetchJob(activeJob.job_id);
        setActiveJob(updated);
        if (updated.status === "done") {
          setIsLoading(false);
          onComplete();
        } else if (updated.status === "failed") {
          setIsLoading(false);
          setError(updated.error || "Reconstruction failed.");
        }
      } catch (err) {
        clearInterval(interval);
        setIsLoading(false);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [activeJob, onComplete]);

  return (
    <div className="rounded-lg border border-line bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg text-olive">Reconstruct Project State</h2>
          <p className="text-sm text-muted">
            Extracts typed claims, identifies conflicts, verifies verbatim quotes, and creates Gaps.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeJob && (
            <span className="rounded bg-wash px-2 py-1 text-xs font-mono text-muted border border-line">
              Mode: {activeJob.mode === "replay" ? "Labelled Replay (Offline Verified)" : "Live LLM"}
            </span>
          )}
          <Button
            variant="primary"
            onClick={handleStart}
            disabled={isLoading || (activeJob?.status === "running" || activeJob?.status === "pending")}
          >
            {isLoading ? "Reconstructing…" : "Reconstruct"}
          </Button>
        </div>
      </div>

      {activeJob && (activeJob.status === "running" || activeJob.status === "pending") && (
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <span>{activeJob.note || "Processing source chunks and validating quotes…"}</span>
            <span>{activeJob.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-wash">
            <div
              className="h-full bg-olive transition-all duration-300"
              style={{ width: `${Math.max(5, activeJob.progress)}%` }}
            />
          </div>
        </div>
      )}

      {activeJob?.status === "done" && (
        <div className="mt-3 rounded border border-[var(--verified)] bg-[#eaf4ea] p-2 text-xs text-[#204a20] flex items-center justify-between">
          <span>
            ✓ Reconstructed successfully: {activeJob.claims_count ?? 0} claims verified, {activeJob.gaps_count ?? 0} gaps recorded. ({activeJob.note})
          </span>
          <span className="font-mono text-[11px] text-muted">Job {activeJob.job_id}</span>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded border border-[var(--conflicting)] bg-[#faeaea] p-2 text-xs text-[var(--conflicting)]">
          {error}
        </div>
      )}
    </div>
  );
}

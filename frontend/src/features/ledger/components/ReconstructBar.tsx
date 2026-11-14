/**
 * ReconstructBar.tsx
 * Pure White Modern Action Bar for Project State Reconstruction.
 * 
 * Strict Light Mode Overhaul Rules:
 * - Base Backgrounds MUST be White: bg-white border border-slate-200 shadow-sm
 * - Header Pill: Clean bg-white border border-slate-200 text-slate-900 text
 * - Base Text MUST be Dark: text-slate-900 for primary text, text-slate-500 for secondary text
 * - Zero muddy grays: No bg-gray-*, bg-slate-500, bg-slate-600, bg-slate-800, or bg-black/20
 * - Dark Mode Strictly Preserved: All dark: classes remain untouched
 */

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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-black/40 dark:backdrop-blur-xl dark:shadow-2xl transition-all">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight dark:text-white">
              Reconstruct Project State
            </h2>
            {activeJob && (
              <span className="rounded-xl bg-white border border-slate-200 px-3 py-1 text-xs font-mono text-slate-900 font-semibold shadow-xs dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/20">
                Mode: {activeJob.mode === "replay" ? "Offline Verified" : "Live LLM"}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 font-normal dark:text-gray-300">
            Review and confirm the project details below before finalizing the handover.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleStart}
            disabled={isLoading || (activeJob?.status === "running" || activeJob?.status === "pending")}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md cursor-pointer"
          >
            {isLoading ? "Reconstructing…" : "Reconstruct"}
          </Button>
        </div>
      </div>

      {activeJob && (activeJob.status === "running" || activeJob.status === "pending") && (
        <div className="mt-5 space-y-2">
          <div className="flex justify-between text-xs text-slate-500 font-medium dark:text-gray-300">
            <span>{activeJob.note || "Processing source chunks and validating quotes…"}</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{activeJob.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 shadow-sm transition-all duration-300"
              style={{ width: `${Math.max(5, activeJob.progress)}%` }}
            />
          </div>
        </div>
      )}

      {activeJob?.status === "done" && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center justify-between shadow-xs dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span>
            ✓ Reconstructed successfully: {activeJob.claims_count ?? 0} claims verified, {activeJob.gaps_count ?? 0} gaps recorded. ({activeJob.note})
          </span>
          <span className="font-mono text-[11px] text-emerald-800 font-semibold dark:text-emerald-400">
            Job {activeJob.job_id}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 flex items-center justify-between shadow-xs dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200">
          <span>⚠ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-semibold text-rose-900 underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export default ReconstructBar;

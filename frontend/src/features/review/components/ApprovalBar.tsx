/**
 * ApprovalBar.tsx
 * Pure White High-Contrast Readiness Gate for Review and Approval.
 * 
 * Strict Light Mode Overhaul Rules:
 * - Base Backgrounds MUST be White: bg-white border border-slate-200 shadow-sm
 * - Base Text MUST be Dark: text-slate-900 for primary text, text-slate-500 for secondary text
 * - Zero muddy grays: No bg-gray-*, bg-slate-500, bg-slate-600, bg-slate-800, or bg-black/20
 * - High-Contrast Status Pills: bg-emerald-50 for Ready, bg-rose-50 for Blocked
 * - Dark Mode Strictly Preserved: All dark: classes remain untouched
 */

import { useState } from "react";
import { Button } from "@/shared/ui";
import type { ReadinessReport } from "../types";

interface ApprovalBarProps {
  readiness?: ReadinessReport;
  loading: boolean;
  onBulkConfirm: () => void;
  bulkConfirmLoading: boolean;
  onApprove: (roles: string[]) => void;
  approveLoading: boolean;
  onOpenVersions: () => void;
  onOpenAudit: () => void;
  onOpenGapInterview: () => void;
  unansweredGapsCount: number;
}

export function ApprovalBar({
  readiness,
  loading,
  onBulkConfirm,
  bulkConfirmLoading,
  onApprove,
  approveLoading,
  onOpenVersions,
  onOpenAudit,
  onOpenGapInterview,
  unansweredGapsCount,
}: ApprovalBarProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([
    "incoming_maintainer",
    "incoming_contributor",
  ]);

  const isReady = readiness?.ready ?? false;

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleApprove = () => {
    onApprove(selectedRoles);
    setShowShareModal(false);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-black/40 dark:backdrop-blur-2xl dark:shadow-2xl transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight dark:text-white">
              Handover Checklist
            </h2>
            {loading ? (
              <span className="text-xs text-purple-700 font-medium dark:text-purple-400">
                Checking checklist status…
              </span>
            ) : isReady ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-900 shadow-xs dark:bg-emerald-950/60 dark:border-emerald-500/40 dark:text-emerald-300">
                <span aria-hidden="true">✓</span> Ready to approve
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-900 shadow-xs dark:bg-rose-950/60 dark:border-rose-500/40 dark:text-rose-300">
                <span aria-hidden="true">⚠</span> Approval blocked
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-300">
            {readiness?.reasons && readiness.reasons.length > 0
              ? readiness.reasons.join(" · ")
              : `${readiness?.unresolved_conflicts.length ?? 0} conflicts remain, ${
                  readiness?.unaccepted_inferred.length ?? 0
                } unaccepted inferred, ${readiness?.pending_count ?? 0} pending.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="quiet"
            onClick={onBulkConfirm}
            disabled={bulkConfirmLoading || loading}
            className="text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs cursor-pointer dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            {bulkConfirmLoading ? "Confirming…" : "Confirm all verified"}
          </Button>

          <Button
            variant="quiet"
            onClick={onOpenVersions}
            className="text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs cursor-pointer dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Version History
          </Button>

          <Button
            variant="quiet"
            onClick={onOpenAudit}
            className="text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs cursor-pointer dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Audit Trail
          </Button>

          {unansweredGapsCount > 0 && (
            <Button
              variant="quiet"
              onClick={onOpenGapInterview}
              className="text-xs border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 shadow-xs cursor-pointer dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              Gaps <span className="ml-1 rounded-full bg-amber-200/60 px-1.5 py-0.5 text-[10px] font-bold">{unansweredGapsCount}</span>
            </Button>
          )}

          <Button
            variant="primary"
            onClick={() => setShowShareModal(true)}
            disabled={!isReady || approveLoading}
            className="text-xs px-5 py-2 font-bold shadow-md shadow-purple-500/20 cursor-pointer"
          >
            {approveLoading ? "Sealing Snapshot…" : "Approve & Share Handover"}
          </Button>
        </div>
      </div>

      {showShareModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in dark:bg-black/70"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900 dark:border-white/15 dark:bg-slate-950 dark:text-white">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight dark:text-white">
              Approve Version & Publish
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed dark:text-gray-400">
              Select which incoming roles will receive access to this sealed version snapshot:
            </p>

            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes("incoming_maintainer")}
                  onChange={() => toggleRole("incoming_maintainer")}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Incoming Maintainer
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-gray-400">
                    Full code, architecture decisions, and active risks
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes("incoming_contributor")}
                  onChange={() => toggleRole("incoming_contributor")}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Incoming Contributor
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-gray-400">
                    Public claims and verified team-wide workflows
                  </div>
                </div>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="quiet"
                onClick={() => setShowShareModal(false)}
                className="text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-gray-200"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleApprove}
                disabled={selectedRoles.length === 0}
                className="text-xs px-4 py-2 font-bold"
              >
                Confirm Approval
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ApprovalBar;

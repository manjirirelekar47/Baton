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
    <section className="rounded-lg border border-line bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg text-olive">Readiness Gate</h2>
            {loading ? (
              <span className="text-xs text-muted">Checking readiness…</span>
            ) : isReady ? (
              <span className="inline-flex items-center gap-1 rounded bg-[var(--verified)] px-2 py-0.5 text-xs font-semibold text-white">
                <span aria-hidden="true">✓</span> Ready to approve
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-[var(--conflicting)] px-2 py-0.5 text-xs font-semibold text-white">
                <span aria-hidden="true">!</span> Approval blocked
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
            {readiness?.included_count ?? 0} confirmed into handover •{" "}
            {readiness?.pending_count ?? 0} pending review
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="quiet"
            onClick={onOpenGapInterview}
            className="relative text-xs"
          >
            Gap Interview
            {unansweredGapsCount > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--inferred)] px-1.5 py-0.2 text-[10px] text-white">
                {unansweredGapsCount}
              </span>
            )}
          </Button>

          <Button variant="quiet" onClick={onOpenAudit} className="text-xs">
            Audit Trail
          </Button>

          <Button variant="quiet" onClick={onOpenVersions} className="text-xs">
            Version History
          </Button>

          <Button
            variant="quiet"
            onClick={onBulkConfirm}
            disabled={bulkConfirmLoading}
            className="text-xs"
          >
            {bulkConfirmLoading ? "Confirming…" : "Confirm all verified"}
          </Button>

          <Button
            variant="primary"
            disabled={!isReady || approveLoading}
            onClick={() => setShowShareModal(true)}
            className="text-xs"
          >
            {approveLoading ? "Approving…" : "Approve & Share Handover"}
          </Button>
        </div>
      </div>

      {!isReady && readiness && readiness.reasons.length > 0 && (
        <div className="mt-3 rounded border border-[var(--conflicting)]/40 bg-[var(--conflicting)]/5 p-3 text-xs text-ink">
          <p className="font-semibold text-[var(--conflicting)]">
            Blockers preventing approval:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
            {readiness.reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {showShareModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-line bg-card p-6 shadow-xl">
            <h3 className="font-display text-xl text-olive">
              Approve Version Snapshot
            </h3>
            <p className="mt-2 text-sm text-muted">
              Approving creates an immutable version with a SHA-256 snapshot hash.
              Select which incoming roles may view this handover version:
            </p>

            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes("incoming_maintainer")}
                  onChange={() => toggleRole("incoming_maintainer")}
                  className="rounded border-line"
                />
                Incoming Maintainer (Meera)
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes("incoming_contributor")}
                  onChange={() => toggleRole("incoming_contributor")}
                  className="rounded border-line"
                />
                Incoming Contributor
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="quiet"
                onClick={() => setShowShareModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={selectedRoles.length === 0 || approveLoading}
                onClick={handleApprove}
              >
                {approveLoading ? "Freezing snapshot…" : "Confirm Approval"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

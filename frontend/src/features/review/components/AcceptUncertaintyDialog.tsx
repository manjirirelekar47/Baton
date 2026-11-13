import { useState } from "react";
import { Button } from "@/shared/ui";
import type { QueueItem } from "../types";

interface AcceptUncertaintyDialogProps {
  claim: QueueItem;
  onConfirm: (note: string) => void;
  onClose: () => void;
  submitting: boolean;
}

export function AcceptUncertaintyDialog({
  claim,
  onConfirm,
  onClose,
  submitting,
}: AcceptUncertaintyDialogProps) {
  const [note, setNote] = useState("");

  const handleConfirm = () => {
    if (!note.trim()) {
      alert("A rationale note is required to accept known uncertainty.");
      return;
    }
    onConfirm(note.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Accept Known Uncertainty"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-line bg-card p-6 shadow-xl">
        <h3 className="font-display text-xl text-olive">
          Accept Known Uncertainty
        </h3>
        <p className="mt-1 text-xs text-muted">
          Claim {claim.claim_id}: "{claim.statement}"
        </p>
        <p className="mt-2 text-sm text-ink">
          Accepting this claim allows it into the handover snapshot with its honest
          label (e.g. Inferred or Conflicting), accompanied by your rationale.
        </p>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-muted">
            Rationale Note (Required):
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Service has no automated failover; documented as known risk"
            className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-olive"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!note.trim() || submitting}>
            {submitting ? "Saving…" : "Accept Uncertainty"}
          </Button>
        </div>
      </div>
    </div>
  );
}

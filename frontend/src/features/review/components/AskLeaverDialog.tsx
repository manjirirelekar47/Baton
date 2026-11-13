import { useState } from "react";
import { Button } from "@/shared/ui";
import type { QueueItem } from "../types";

interface AskLeaverDialogProps {
  claim: QueueItem;
  onSend: (note: string) => void;
  onClose: () => void;
  submitting: boolean;
}

export function AskLeaverDialog({
  claim,
  onSend,
  onClose,
  submitting,
}: AskLeaverDialogProps) {
  const [note, setNote] = useState("");

  const handleSend = () => {
    onSend(note.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ask Leaver"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-line bg-card p-6 shadow-xl">
        <h3 className="font-display text-xl text-olive">Ask the Leaver</h3>
        <p className="mt-1 text-xs text-muted">
          Claim {claim.claim_id}: "{claim.statement}"
        </p>
        <p className="mt-2 text-sm text-ink">
          This question will appear in the Leaver's Gap Interview form. Their response
          will be saved as an Attested claim with secrets redacted.
        </p>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-muted">
            Question / Clarification Note (Optional):
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Please clarify who manages the API credentials and when they expire"
            className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-olive"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSend} disabled={submitting}>
            {submitting ? "Sending…" : "Add to Gap Interview"}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/shared/ui";
import type { QueueItem } from "../types";

interface EditDialogProps {
  claim: QueueItem;
  onSave: (editedStatement: string, note: string) => void;
  onClose: () => void;
  submitting: boolean;
}

export function EditDialog({
  claim,
  onSave,
  onClose,
  submitting,
}: EditDialogProps) {
  const [statement, setStatement] = useState(claim.statement);
  const [note, setNote] = useState("");

  const handleSave = () => {
    if (!statement.trim()) {
      alert("Statement cannot be empty.");
      return;
    }
    if (statement.trim() === claim.statement.trim()) {
      alert("Edited statement is identical to current statement.");
      return;
    }
    onSave(statement.trim(), note.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit Claim Statement"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-lg border border-line bg-card p-6 shadow-xl">
        <h3 className="font-display text-xl text-olive">Edit Claim Statement</h3>
        <p className="mt-1 text-xs text-muted">
          Claim {claim.claim_id} • Editing triggers re-verification and records before/after in the audit trail.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted">Statement:</label>
            <textarea
              rows={3}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-paper p-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-olive"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted">Audit Rationale Note (optional):</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why was this statement edited?"
              className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-olive"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving…" : "Save & Re-verify"}
          </Button>
        </div>
      </div>
    </div>
  );
}

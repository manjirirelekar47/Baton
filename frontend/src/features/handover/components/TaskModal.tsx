import { useState, useEffect } from "react";
import { AlertCircle, Calendar, CheckCircle2, GitCommit, Lock, Trash2, User, X } from "lucide-react";
import type { PlanItem } from "../api";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: PlanItem | null; // null for Create, PlanItem for Edit
  versionId: string;
  allTasks: PlanItem[];
  isApprover: boolean;
  onSave: (data: {
    title?: string;
    owner?: string | null;
    due_date?: string | null;
    status?: "not_started" | "in_progress" | "blocked" | "completed";
    notes?: string | null;
    blocked_by?: string[];
  }) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
}

export function TaskModal({
  isOpen,
  onClose,
  task,
  allTasks,
  isApprover,
  onSave,
  onDelete,
}: TaskModalProps) {
  const isEdit = !!task;

  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"not_started" | "in_progress" | "blocked" | "completed">("not_started");
  const [notes, setNotes] = useState("");
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setOwner(task.owner || "");
      setDueDate(task.due_date || "");
      setStatus(task.action_status || "not_started");
      setNotes(task.action_notes || "");
      setBlockedBy(task.blocked_by || []);
    } else {
      setTitle("");
      setOwner("");
      setDueDate("");
      setStatus("not_started");
      setNotes("");
      setBlockedBy([]);
    }
    setErrorMsg(null);
    setConfirmDelete(false);
  }, [task, isOpen]);

  if (!isOpen) return null;

  // Filter tasks that can be chosen as dependencies (cannot depend on itself)
  const candidateDependencies = allTasks.filter((t) => !task || t.claim_id !== task.claim_id);

  const handleToggleDependency = (depId: string) => {
    if (!isApprover) return;
    setBlockedBy((prev) =>
      prev.includes(depId) ? prev.filter((id) => id !== depId) : [...prev, depId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Task title is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSave({
        title: title.trim(),
        owner: owner.trim() || null,
        due_date: dueDate.trim() || null,
        status,
        notes: notes.trim() || null,
        blocked_by: blockedBy,
      });
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || "Failed to save task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !onDelete) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onDelete(task.claim_id);
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || "Failed to delete task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="task-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                {isEdit ? "Edit Handover Action" : "Create New Handover Action"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {isEdit ? `ID: ${task.claim_id}` : "Add an action item to the handover plan"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {task?.is_transferred && (
            <div
              data-testid="task-transferred-banner"
              className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs shadow-xs"
            >
              <div className="font-bold flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-200 dark:bg-amber-900/80 text-[10px] uppercase font-extrabold tracking-wider border border-amber-300 dark:border-amber-600/40">
                  Transferred from Leaver
                </span>
                {task.transferred_from && <span>Transferred by {task.transferred_from}</span>}
              </div>
              <div className="mt-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                Original owner: <strong className="font-semibold">{task.original_owner || task.transferred_from || "Leaver"}</strong> • Currently assigned to: <strong className="font-semibold">{task.owner || "Contributor"}</strong>
              </div>
              {task.transfer_notes && (
                <div className="mt-1 text-[11px] italic text-amber-700 dark:text-amber-400">
                  Notes: {task.transfer_notes}
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-medium dark:bg-rose-950/50 dark:border-rose-500/40 dark:text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="task-title" className="block text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Action Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isEdit && !isApprover}
              required
              placeholder="e.g. Test failover recovery procedure"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/30 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Owner & Due Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Owner */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="task-owner" className="block text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                  Owner / Assignee
                </label>
                {!isApprover && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> Approver only
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="task-owner"
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  disabled={!isApprover}
                  placeholder="e.g. Meera"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/30 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Due Date */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="task-due-date" className="block text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                  Due Date
                </label>
                {!isApprover && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> Approver only
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={!isApprover}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/30 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label htmlFor="task-status" className="block text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Progress Status
            </label>
            <select
              id="task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/30 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="task-notes" className="block text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Action Notes & Progress Context
            </label>
            <textarea
              id="task-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add progress updates, verification links, or handover notes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/30 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Dependencies / Blocked By */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                Upstream Dependencies (Blocked By)
              </label>
              {!isApprover && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Approver only
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-gray-400 mb-2">
              Select tasks that must be completed before this action can begin. Cycles and self-dependencies are strictly prevented.
            </p>

            <div className="border border-slate-200 dark:border-white/10 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50/30 dark:bg-white/[0.02]">
              {candidateDependencies.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No other tasks in plan to depend on.</p>
              ) : (
                candidateDependencies.map((cand) => {
                  const isChecked = blockedBy.includes(cand.claim_id);
                  return (
                    <label
                      key={cand.claim_id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition select-none ${
                        isChecked
                          ? "bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-semibold"
                          : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-gray-300"
                      } ${!isApprover ? "cursor-not-allowed opacity-75" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!isApprover}
                        onChange={() => handleToggleDependency(cand.claim_id)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex-1 truncate">
                        <span className="font-mono text-[10px] text-slate-400 dark:text-gray-500 mr-1.5">
                          {cand.claim_id}
                        </span>
                        <span>{cand.title}</span>
                      </div>
                      {cand.action_status === "completed" && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Done
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
          <div>
            {isEdit && isApprover && onDelete && (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-gray-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Task</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/10 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/30 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEdit ? "Save Changes" : "Create Action"}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

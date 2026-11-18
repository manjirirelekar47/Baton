import { useQuery } from "@tanstack/react-query";
import { Clock, User, Calendar, FileText, CheckCircle2, Trash2, Plus, GitCommit, X } from "lucide-react";
import { getTaskHistory, type ActivityHistoryItem, type PlanItem } from "../api";

interface ActivityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: PlanItem | null;
  versionId: string;
}

export function ActivityHistoryModal({ isOpen, onClose, task, versionId }: ActivityHistoryModalProps) {
  const taskId = task?.claim_id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["handover", "task-history", versionId, taskId],
    queryFn: () => getTaskHistory(versionId, taskId as string),
    enabled: isOpen && !!taskId,
  });

  if (!isOpen || !task) return null;

  const history = data?.history || [];

  const getActionBadge = (item: ActivityHistoryItem) => {
    switch (item.action) {
      case "created":
        return {
          icon: <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          title: "Task Created",
          desc: `Created as "${item.new_value ?? task.title}"`,
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30",
        };
      case "status_changed":
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
          title: "Status Updated",
          desc: `Changed from ${item.old_value ?? "none"} to ${item.new_value}`,
          bg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30",
        };
      case "owner_changed":
        return {
          icon: <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
          title: "Owner Assigned / Reassigned",
          desc: `Assigned to ${item.new_value ?? "unassigned"} (previously ${item.old_value ?? "unassigned"})`,
          bg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/30",
        };
      case "due_date_changed":
        return {
          icon: <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          title: "Due Date Modified",
          desc: `Updated to ${item.new_value ?? "none"} (previously ${item.old_value ?? "none"})`,
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30",
        };
      case "notes_changed":
        return {
          icon: <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
          title: "Notes Updated",
          desc: item.new_value ? `"${item.new_value}"` : "Notes cleared",
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500/30",
        };
      case "dependencies_changed":
        return {
          icon: <GitCommit className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
          title: "Dependencies Updated",
          desc: `Dependencies updated to: ${item.new_value ?? "[]"}`,
          bg: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-500/30",
        };
      case "deleted":
        return {
          icon: <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
          title: "Task Deleted",
          desc: "Task was deleted from the plan",
          bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/30",
        };
      default:
        return {
          icon: <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />,
          title: item.action.replace("_", " "),
          desc: `${item.old_value ? item.old_value + " → " : ""}${item.new_value ?? ""}`,
          bg: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/10",
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 id="history-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                Task Activity History & Audit Trail
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 truncate max-w-md">
                {task.title} <span className="font-mono text-[11px] text-purple-600 dark:text-purple-400">({task.claim_id})</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            aria-label="Close activity history"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 dark:text-gray-400 space-y-3">
              <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Loading audit history...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-300">
              Failed to load activity history: {(error as Error).message}
            </div>
          )}

          {!isLoading && !error && history.length === 0 && (
            <div className="py-12 text-center text-slate-500 dark:text-gray-400 space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm font-semibold">No recorded mutations yet</p>
              <p className="text-xs text-slate-400 dark:text-gray-500">
                Any changes to owner, due date, status, notes, or dependencies will be logged here.
              </p>
            </div>
          )}

          {!isLoading && history.length > 0 && (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-white/10">
              {history.map((item) => {
                const meta = getActionBadge(item);
                const dateStr = new Date(item.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                });

                return (
                  <div key={item.id} className="relative flex items-start gap-3.5 group">
                    {/* Timeline dot */}
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 bg-purple-600 flex items-center justify-center text-white shadow-sm ring-4 ring-purple-50 dark:ring-purple-950/40">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>

                    <div className="flex-1 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-white/10 p-3.5 shadow-xs transition hover:border-purple-300 dark:hover:border-purple-500/40">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold border ${meta.bg}`}>
                            {meta.icon}
                            {meta.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 dark:text-gray-400">
                          {dateStr}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-slate-800 dark:text-gray-200 font-medium">
                        {meta.desc}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Actor: <strong className="font-semibold text-slate-700 dark:text-gray-300">{item.actor_name}</strong> ({item.actor_id})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/10 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, ClipboardList, Clock, Edit3, Lock, Plus } from "lucide-react";
import { StateBadge } from "@/shared/ui";
import type { EvidenceView, PlanBuckets, PlanItem } from "../api";
import { ActivityHistoryModal } from "./ActivityHistoryModal";
import { CitationChip } from "./CitationChip";
import { TaskModal } from "./TaskModal";

const BUCKETS: { key: keyof PlanBuckets; title: string; hint: string }[] = [
  { key: "day_1", title: "Day 1", hint: "Nothing blocks these. Start here." },
  { key: "week_1", title: "Week 1", hint: "Each waits on a Day 1 item." },
  { key: "month_1", title: "Month 1", hint: "Each waits on a Week 1 item or later." },
];

const KIND_LABEL: Record<PlanItem["kind"], string> = {
  unblock: "Unblock",
  confirm_owner: "Confirm ownership",
  next_action: "Next action",
};

const STATUS_OPTS: { value: "not_started" | "in_progress" | "blocked" | "completed"; label: string; badge: string }[] = [
  { value: "not_started", label: "Not Started", badge: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-white/10 dark:text-gray-300 dark:border-white/20" },
  { value: "in_progress", label: "In Progress", badge: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30" },
  { value: "blocked", label: "Blocked", badge: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30" },
  { value: "completed", label: "Completed", badge: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30" },
];

function PlanSkeleton() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Loading action plan">
      {/* Top action bar skeleton */}
      <div className="h-16 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/60 dark:bg-white/5" />

      {[1, 2].map((bucket) => (
        <section key={bucket} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-5 w-24 rounded-md bg-slate-200 dark:bg-white/10" />
              <div className="h-3 w-48 rounded-md bg-slate-100 dark:bg-white/5" />
            </div>
            <div className="h-4 w-12 rounded-md bg-slate-100 dark:bg-white/5" />
          </div>

          <div className="space-y-3">
            {[1, 2].map((card) => (
              <div
                key={card}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <div className="h-5 w-20 rounded bg-slate-100 dark:bg-white/5" />
                    <div className="h-5 w-16 rounded-full bg-slate-100 dark:bg-white/5" />
                  </div>
                  <div className="h-6 w-24 rounded-lg bg-slate-100 dark:bg-white/5" />
                </div>
                <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
                <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-white/5" />
                <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                  <div className="h-5 w-28 rounded bg-slate-100 dark:bg-white/5" />
                  <div className="h-6 w-20 rounded bg-slate-100 dark:bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PlanPanel({
  plan,
  versionId,
  isLoading,
  isApprover,
  currentUserId,
  currentUserName,
  currentUserRole,
  onOpenCitation,
  onUpdateStatus,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: {
  plan?: PlanBuckets | null;
  versionId: string;
  isLoading?: boolean;
  isApprover: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserRole?: string;
  onOpenCitation?: (e: EvidenceView) => void;
  onUpdateStatus?: (claimId: string, status: "not_started" | "in_progress" | "blocked" | "completed") => Promise<void> | void;
  onCreateTask?: (data: {
    title: string;
    owner?: string | null;
    due_date?: string | null;
    status?: "not_started" | "in_progress" | "blocked" | "completed";
    notes?: string | null;
    blocked_by?: string[];
  }) => Promise<void>;
  onUpdateTask?: (
    taskId: string,
    data: {
      title?: string;
      owner?: string | null;
      due_date?: string | null;
      status?: "not_started" | "in_progress" | "blocked" | "completed";
      notes?: string | null;
      blocked_by?: string[];
    }
  ) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
}) {
  const [historyModalTask, setHistoryModalTask] = useState<PlanItem | null>(null);
  const [editModalTask, setEditModalTask] = useState<PlanItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  if (isLoading) {
    return <PlanSkeleton />;
  }

  // Map of all tasks in the plan by ID for dependency lookup
  const allTasksMap = new Map<string, PlanItem>();
  const allTasksList: PlanItem[] = [];
  if (plan) {
    Object.values(plan).forEach((items) =>
      items.forEach((i) => {
        allTasksMap.set(i.claim_id, i);
        allTasksList.push(i);
      })
    );
  }

  const total = plan ? BUCKETS.reduce((n, b) => n + (plan[b.key]?.length || 0), 0) : 0;

  // Helper to check if task is assigned to current user
  const isTaskAssigned = (item: PlanItem): boolean => {
    if (!currentUserName && !currentUserId) return false;
    const owner = (item.owner || "").toLowerCase().trim();
    const propOwner = (item.proposed_owner || "").toLowerCase().trim();
    const uName = (currentUserName || "").toLowerCase().trim();
    const uId = (currentUserId || "").toLowerCase().trim();
    const uRole = (currentUserRole || "").toLowerCase().replace("_", " ").trim();

    if (owner && (owner === uName || owner === uId || owner === uRole || (owner === "contributor" && (currentUserRole === "contributor" || currentUserRole === "incoming_contributor")))) return true;
    if (propOwner && (propOwner === uName || propOwner === uRole)) return true;
    if (item.proposed_for_me) return true;
    return false;
  };

  // Helper to check if a task is overdue
  const checkIsOverdue = (item: PlanItem): boolean => {
    if (!item.due_date || item.action_status === "completed") return false;
    const dueTime = new Date(item.due_date).getTime();
    if (isNaN(dueTime)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueTime < today.getTime();
  };

  const handleStatusChange = async (
    claimId: string,
    status: "not_started" | "in_progress" | "blocked" | "completed"
  ) => {
    if (!onUpdateStatus || updatingTaskId === claimId) return;
    setUpdatingTaskId(claimId);
    try {
      await onUpdateStatus(claimId, status);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Approver Action Bar */}
      {isApprover && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-blue-50/80 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-blue-950/30 border border-indigo-200/60 dark:border-indigo-500/20 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Action Plan Manager</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Create, assign owners, set target due dates, and manage dependency chains.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs active:scale-[0.98] transition-all duration-150 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Plus className="w-4 h-4" />
            <span>Add Action Item</span>
          </button>
        </div>
      )}

      {!plan || total === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-400 flex items-center justify-center mx-auto border border-slate-200 dark:border-white/10">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Nothing shared yet</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 max-w-md mx-auto">
              The approved handover has no action items or tasks assigned to your role yet.
            </p>
          </div>
          {isApprover && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs active:scale-[0.98] transition-all duration-150 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Task</span>
            </button>
          )}
        </div>
      ) : (
        BUCKETS.map((bucket) => (
          <section key={bucket.key} aria-labelledby={`plan-${bucket.key}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 id={`plan-${bucket.key}`} className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {bucket.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">{bucket.hint}</p>
              </div>
              <span className="text-xs font-bold text-slate-400 dark:text-gray-500">
                {plan[bucket.key]?.length || 0} {(plan[bucket.key]?.length || 0) === 1 ? "task" : "tasks"}
              </span>
            </div>

            {(!plan[bucket.key] || plan[bucket.key].length === 0) ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-gray-500 italic">Nothing planned here.</p>
            ) : (
              <ol className="mt-3.5 space-y-3.5">
                {plan[bucket.key].map((item) => {
                  const currentStatus = item.action_status || "not_started";
                  const statusMeta = STATUS_OPTS.find((s) => s.value === currentStatus) || STATUS_OPTS[0];
                  const isAssigned = isTaskAssigned(item);
                  const canEditStatus = isApprover || isAssigned;
                  const isOverdue = checkIsOverdue(item);
                  const isBusyUpdating = updatingTaskId === item.claim_id;

                  // Dependency analysis
                  const blockerList = item.blocked_by.map((depId) => {
                    const upstream = allTasksMap.get(depId);
                    return {
                      id: depId,
                      title: upstream?.title ?? depId,
                      isCompleted: upstream?.action_status === "completed",
                      status: upstream?.action_status ?? "not_started",
                    };
                  });
                  const hasBlockers = blockerList.length > 0;
                  const allBlockersCompleted = hasBlockers && blockerList.every((b) => b.isCompleted);
                  const pendingBlockers = blockerList.filter((b) => !b.isCompleted);

                  return (
                    <li
                      key={item.claim_id}
                      className={`rounded-xl border p-4 sm:p-5 shadow-xs transition-all ${
                        currentStatus === "completed"
                          ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                          : isOverdue
                          ? "border-rose-300 bg-rose-50/20 dark:border-rose-500/30 dark:bg-rose-950/10"
                          : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/50 dark:backdrop-blur-xl"
                      }`}
                    >
                      {/* Top Bar: Kind / State / Overdue Badge / Status Control */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded border border-purple-200 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-500/20">
                            {item.position}. {KIND_LABEL[item.kind] ?? item.kind}
                          </span>
                          <StateBadge state={item.state} />

                          {/* Provenance Badge for Tasks Transferred from Leaver */}
                          {item.is_transferred && (
                            <span
                              data-testid="transferred-badge"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 dark:text-amber-200 dark:bg-amber-950/70 dark:border-amber-500/40 px-2.5 py-0.5 rounded-full shadow-xs"
                            >
                              <span>Transferred from Leaver{item.transferred_from ? ` (${item.transferred_from})` : ""}</span>
                            </span>
                          )}

                          {/* Visual Indicator for Overdue Tasks */}
                          {isOverdue && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-300 dark:text-rose-300 dark:bg-rose-950/60 dark:border-rose-500/40 px-2.5 py-0.5 rounded-full animate-pulse shadow-xs">
                              <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              <span>Overdue ({item.due_date})</span>
                            </span>
                          )}
                        </div>

                        {/* Interactive or Read-only Status Selector based on RBAC with double-click protection */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                            Status:
                          </span>
                          {canEditStatus && onUpdateStatus ? (
                            <div className="relative">
                              <select
                                value={currentStatus}
                                disabled={isBusyUpdating}
                                onChange={(e) =>
                                  handleStatusChange(
                                    item.claim_id,
                                    e.target.value as "not_started" | "in_progress" | "blocked" | "completed"
                                  )
                                }
                                aria-label={`Update status for ${item.title}`}
                                className={`rounded-lg px-2.5 py-1 text-xs font-bold border cursor-pointer transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${statusMeta.badge}`}
                              >
                                {STATUS_OPTS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {isBusyUpdating && (
                                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                                  <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5" title="Only the assigned owner or approver can update status">
                              <span className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${statusMeta.badge}`}>
                                {statusMeta.label}
                              </span>
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <p
                        className={`mt-2.5 text-base font-semibold ${
                          currentStatus === "completed"
                            ? "line-through text-slate-500 dark:text-gray-400"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {item.title}
                      </p>

                      {/* Owner & Due Date Metadata */}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-gray-400">
                        <span>
                          Owner:{" "}
                          <strong className="font-semibold text-slate-800 dark:text-gray-200">
                            {item.owner_known || item.owner ? item.owner : "Unassigned"}
                          </strong>
                          {item.is_transferred && (
                            <span className="text-[11px] text-slate-500 dark:text-gray-400 ml-1.5 font-normal">
                              (Originally owned by: <span className="font-medium text-slate-700 dark:text-gray-300">{item.original_owner || item.transferred_from || "Leaver"}</span>)
                            </span>
                          )}
                        </span>

                        {item.proposed_for_me && (
                          <span className="text-purple-700 dark:text-purple-300 font-medium">
                            • Proposed for you
                          </span>
                        )}

                        {item.due_date && (
                          <span className={`flex items-center gap-1 font-medium ${isOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : ""}`}>
                            <Calendar className="w-3 h-3" />
                            <span>Due {item.due_date}</span>
                          </span>
                        )}
                      </div>

                      {/* Action Notes */}
                      {item.action_notes && (
                        <p className="mt-2 text-xs text-blue-800 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-200/50 dark:border-blue-500/20">
                          <strong className="font-semibold">Note:</strong> {item.action_notes}
                        </p>
                      )}

                      {/* Dependency Blockers & Upstream Completion Reflection */}
                      {hasBlockers && (
                        <div className="mt-2.5">
                          {allBlockersCompleted ? (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1.5 rounded-xl">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                              <span>All upstream dependencies completed — Unblocked & ready to execute</span>
                            </div>
                          ) : (
                            <div className="text-xs text-amber-900 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 p-2.5 rounded-xl space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Waiting on {pendingBlockers.length} pending upstream {pendingBlockers.length === 1 ? "task" : "tasks"}:</span>
                              </div>
                              <ul className="pl-5 list-disc space-y-0.5">
                                {blockerList.map((b) => (
                                  <li key={b.id} className={b.isCompleted ? "line-through text-slate-400 dark:text-gray-500" : "font-medium"}>
                                    <span className="font-semibold">{b.title}</span>{" "}
                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                                      b.isCompleted
                                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                        : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-gray-300"
                                    }`}>
                                      {b.status.replace("_", " ")}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dependency Cycle Alert */}
                      {item.cycle && (
                        <p
                          role="alert"
                          className="mt-2 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl flex items-center gap-1.5 font-medium"
                        >
                          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                          <span>These items block each other. Approver must decide which executes first.</span>
                        </p>
                      )}

                      {/* Citations & Evidence */}
                      {item.evidence && item.evidence.length > 0 && onOpenCitation && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.evidence.map((e) => (
                            <CitationChip key={`${e.chunk_id}:${e.quote}`} evidence={e} onOpen={onOpenCitation} />
                          ))}
                        </div>
                      )}

                      {/* Card Action Controls: Edit Action & Activity History with Focus Rings */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {/* Activity History Button */}
                          <button
                            type="button"
                            onClick={() => setHistoryModalTask(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all duration-150 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900"
                            aria-label={`View activity history for ${item.title}`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Activity History</span>
                          </button>
                        </div>

                        {/* Edit Action Button */}
                        <button
                          type="button"
                          onClick={() => setEditModalTask(item)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/10 active:scale-[0.98] transition-all duration-150 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{isApprover ? "Edit Action" : isAssigned ? "Update Notes / Progress" : "View Details"}</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        ))
      )}

      {/* Activity History Modal */}
      <ActivityHistoryModal
        isOpen={!!historyModalTask}
        onClose={() => setHistoryModalTask(null)}
        task={historyModalTask}
        versionId={versionId}
      />

      {/* Create / Edit Task Modal */}
      <TaskModal
        isOpen={isCreateOpen || !!editModalTask}
        onClose={() => {
          setIsCreateOpen(false);
          setEditModalTask(null);
        }}
        task={editModalTask}
        versionId={versionId}
        allTasks={allTasksList}
        isApprover={isApprover}
        onSave={async (data) => {
          if (editModalTask && onUpdateTask) {
            await onUpdateTask(editModalTask.claim_id, data);
          } else if (onCreateTask) {
            await onCreateTask(data as any);
          }
        }}
        onDelete={async (taskId) => {
          if (onDeleteTask) {
            await onDeleteTask(taskId);
          }
        }}
      />
    </div>
  );
}

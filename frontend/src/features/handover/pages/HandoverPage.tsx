import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useAuth } from "@/app/auth";
import { useLatestVersion } from "@/features/review/public";
import { SourceDrawer } from "@/features/sources/public";
import { EmptyState, ErrorState, Loading } from "@/shared/ui";
import {
  acknowledge,
  createTask,
  deleteTask,
  getPlan,
  getView,
  respondOwnership,
  updateActionStatus,
  updateTask,
  type EvidenceView,
} from "../api";
import { HiddenPlaceholder } from "../components/HiddenPlaceholder";
import { PlanPanel } from "../components/PlanPanel";
import { SectionBlock } from "../components/SectionBlock";

type Tab = "handover" | "plan";

export function HandoverPage() {
  const { user, activeProject } = useAuth();
  const projectName =
    activeProject?.name ||
    (user?.project_id === "proj-campus-event-portal"
      ? "Campus Event Portal"
      : user?.project_id
        ? user.project_id.replace(/^proj-/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "Project");
  const queryClient = useQueryClient();
  const { version, isLoading: versionLoading, error: versionError, refetch } = useLatestVersion();
  const [tab, setTab] = useState<Tab>("handover");
  const [citation, setCitation] = useState<EvidenceView | null>(null);
  const closeDrawer = useCallback(() => setCitation(null), []);

  const versionId = version?.version_id;
  const view = useQuery({
    queryKey: ["handover", "view", versionId, activeProject?.id || user?.id],
    queryFn: () => getView(versionId as string),
    enabled: !!versionId,
  });
  const plan = useQuery({
    queryKey: ["handover", "plan", versionId, activeProject?.id || user?.id],
    queryFn: () => getPlan(versionId as string),
    enabled: !!versionId && tab === "plan",
  });
  const refreshView = () => queryClient.invalidateQueries({ queryKey: ["handover", "view"] });
  const refreshPlan = () => queryClient.invalidateQueries({ queryKey: ["handover", "plan"] });
  const ack = useMutation({ mutationFn: (section: string) => acknowledge(versionId as string, section), onSuccess: refreshView });
  const respond = useMutation({
    mutationFn: (v: { claimId: string; response: "accept" | "decline" }) => respondOwnership(versionId as string, v.claimId, v.response),
    onSuccess: refreshView,
  });
  const statusMutation = useMutation({
    mutationFn: (v: { claimId: string; status: "not_started" | "in_progress" | "blocked" | "completed" }) =>
      updateActionStatus(versionId as string, v.claimId, v.status),
    onSuccess: refreshPlan,
  });
  const createTaskMutation = useMutation({
    mutationFn: (data: any) => createTask({ ...data, version_id: versionId as string }),
    onSuccess: refreshPlan,
  });
  const updateTaskMutation = useMutation({
    mutationFn: (v: { taskId: string; data: any }) => updateTask(v.taskId, { ...v.data, version_id: versionId as string }),
    onSuccess: refreshPlan,
  });
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(versionId as string, taskId),
    onSuccess: refreshPlan,
  });

  if (versionLoading) return <Loading label="Finding the approved handover" />;
  if (versionError) return <ErrorState title="Could not load versions" detail={versionError.message} onRetry={() => void refetch()} />;
  if (!version) {
    return (
      <EmptyState title="Nothing has been shared yet">
        {user?.role === "approver"
          ? "Approve a version in the Review step and share it with the incoming person."
          : "The approver has not shared a handover with you yet. Nothing appears here until a human approves it."}
      </EmptyState>
    );
  }

  const mutationError = (ack.error ?? respond.error) as Error | null;
  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-12 animate-in fade-in duration-300">
      {/* Header with High-Contrast Typography */}
      <header>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Handover for {projectName}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Version {version.version_id}, approved {version.approved_at ? new Date(version.approved_at).toLocaleDateString() : "recently"}
          {version.snapshot_hash ? `, snapshot ${version.snapshot_hash.replace("sha256:", "").slice(0, 10)}` : ""}.
          Every claim links to its source quote.
        </p>
      </header>

      {view.data && !view.data.can_acknowledge && (
        <p className="text-xs font-medium text-purple-900 dark:text-purple-200 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/30 p-3 sm:p-3.5 rounded-2xl shadow-sm dark:shadow-lg backdrop-blur-xl">
          You are previewing this as the approver. Receipts and owner responses belong to the incoming person.
        </p>
      )}

      <div role="tablist" aria-label="Handover views" className="flex gap-4 border-b border-slate-200 dark:border-white/10 text-sm font-semibold pt-2 overflow-x-auto">
        {(["handover", "plan"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`pb-3 -mb-px transition cursor-pointer font-bold ${
              tab === t
                ? "border-b-2 border-indigo-600 text-indigo-700 dark:text-white dark:border-indigo-500 shadow-[0_4px_12px_rgba(99,102,241,0.25)]"
                : "border-b-2 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {t === "handover" ? "Handover Package" : "Day 1, Week 1, Month 1 Action Plan"}
          </button>
        ))}
      </div>

      {mutationError && <ErrorState title="That did not save" detail={mutationError.message} />}
      {view.isLoading && <Loading />}
      {view.error && <ErrorState title="Could not open this handover" detail={(view.error as Error).message} onRetry={() => void view.refetch()} />}

      {view.data && <HiddenPlaceholder count={view.data.hidden.count} />}

      {view.data && tab === "handover" && (
        <div className="space-y-8">
          {view.data.sections.length === 0 && <EmptyState title="No claims you can see">Everything in this version is restricted for your role.</EmptyState>}
          {view.data.sections.map((section) => (
            <SectionBlock
              key={section.key}
              section={section}
              canAcknowledge={view.data.can_acknowledge}
              responses={view.data.ownership_responses}
              pending={ack.isPending || respond.isPending}
              onAcknowledge={(s) => ack.mutate(s)}
              onRespond={(claim, response) => respond.mutate({ claimId: claim.claim_id, response })}
              onOpenCitation={setCitation}
            />
          ))}
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{view.data.receipt_note}</p>
        </div>
      )}

      {tab === "plan" && (
        <div>
          {plan.error && <ErrorState title="Could not build the plan" detail={(plan.error as Error).message} onRetry={() => void plan.refetch()} />}
          <PlanPanel
            plan={plan.data?.plan}
            versionId={versionId as string}
            isLoading={plan.isLoading}
            isApprover={user?.role === "approver" || user?.role === "leaver"}
            currentUserId={user?.id}
            currentUserName={user?.name}
            currentUserRole={user?.role}
            onOpenCitation={setCitation}
            onUpdateStatus={async (claimId, status) => {
              await statusMutation.mutateAsync({ claimId, status });
            }}
            onCreateTask={async (data) => {
              await createTaskMutation.mutateAsync(data);
            }}
            onUpdateTask={async (taskId, data) => {
              await updateTaskMutation.mutateAsync({ taskId, data });
            }}
            onDeleteTask={async (taskId) => {
              await deleteTaskMutation.mutateAsync(taskId);
            }}
          />
          {plan.data && <p className="mt-6 text-xs text-slate-500 dark:text-slate-400 font-mono">{plan.data.note}</p>}
        </div>
      )}

      {citation && <SourceDrawer chunkId={citation.chunk_id} quote={citation.quote} onClose={closeDrawer} />}
    </div>
  );
}

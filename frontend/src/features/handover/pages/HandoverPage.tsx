import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/auth";
import { useLatestVersion } from "@/features/review/public";
import { SourceDrawer } from "@/features/sources/public";
import { EmptyState, ErrorState, Loading } from "@/shared/ui";
import { acknowledge, getPlan, getView, respondOwnership, type EvidenceView } from "../api";
import { HiddenPlaceholder } from "../components/HiddenPlaceholder";
import { PlanPanel } from "../components/PlanPanel";
import { SectionBlock } from "../components/SectionBlock";

type Tab = "handover" | "plan";

export function HandoverPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { version, isLoading: versionLoading, error: versionError, refetch } = useLatestVersion();
  const [tab, setTab] = useState<Tab>("handover");
  const [citation, setCitation] = useState<EvidenceView | null>(null);
  const closeDrawer = useCallback(() => setCitation(null), []);

  const versionId = version?.version_id;
  const view = useQuery({
    queryKey: ["handover", "view", versionId, user?.id],
    queryFn: () => getView(versionId as string),
    enabled: !!versionId,
  });
  const plan = useQuery({
    queryKey: ["handover", "plan", versionId, user?.id],
    queryFn: () => getPlan(versionId as string),
    enabled: !!versionId && tab === "plan",
  });
  const refreshView = () => queryClient.invalidateQueries({ queryKey: ["handover", "view"] });
  const ack = useMutation({ mutationFn: (section: string) => acknowledge(versionId as string, section), onSuccess: refreshView });
  const respond = useMutation({
    mutationFn: (v: { claimId: string; response: "accept" | "decline" }) => respondOwnership(versionId as string, v.claimId, v.response),
    onSuccess: refreshView,
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
      {/* Header with Back Navigation and High-Contrast Typography */}
      <header className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-sm transition-all dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 cursor-pointer"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Handover for Campus Event Portal
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-300">
            Version {version.version_id}, approved {version.approved_at ? new Date(version.approved_at).toLocaleDateString() : "recently"}
            {version.snapshot_hash ? `, snapshot ${version.snapshot_hash.replace("sha256:", "").slice(0, 10)}` : ""}.
            Every claim links to its source quote.
          </p>
        </div>
      </header>

      {view.data && !view.data.can_acknowledge && (
        <p className="text-xs font-medium text-purple-900 dark:text-purple-200 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/30 p-3.5 rounded-2xl shadow-sm dark:shadow-lg backdrop-blur-xl">
          You are previewing this as the approver. Receipts and owner responses belong to the incoming person.
        </p>
      )}

      <div role="tablist" aria-label="Handover views" className="flex gap-4 border-b border-slate-200 dark:border-white/10 text-sm font-semibold pt-2">
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
                : "border-b-2 border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
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
          <p className="text-xs text-gray-400 font-mono">{view.data.receipt_note}</p>
        </div>
      )}

      {tab === "plan" && (
        <div>
          {plan.isLoading && <Loading label="Building the plan" />}
          {plan.error && <ErrorState title="Could not build the plan" detail={(plan.error as Error).message} onRetry={() => void plan.refetch()} />}
          {plan.data && (
            <>
              <PlanPanel plan={plan.data.plan} onOpenCitation={setCitation} />
              <p className="mt-6 text-xs text-gray-400 font-mono">{plan.data.note}</p>
            </>
          )}
        </div>
      )}

      {citation && <SourceDrawer chunkId={citation.chunk_id} quote={citation.quote} onClose={closeDrawer} />}
    </div>
  );
}

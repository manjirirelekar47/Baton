import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
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
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <header>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Handover for Campus Event Portal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Version {version.version_id}, approved {version.approved_at ? new Date(version.approved_at).toLocaleDateString() : "recently"}
          {version.snapshot_hash ? `, snapshot ${version.snapshot_hash.replace("sha256:", "").slice(0, 10)}` : ""}.
          Every claim links to its source quote.
        </p>
        {view.data && !view.data.can_acknowledge && (
          <p className="mt-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/80 p-3 rounded-xl">
            You are previewing this as the approver. Receipts and owner responses belong to the incoming person.
          </p>
        )}
      </header>

      <div role="tablist" aria-label="Handover views" className="flex gap-2 border-b border-slate-200 text-xs font-semibold">
        {(["handover", "plan"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 transition cursor-pointer ${
              tab === t
                ? "border-b-2 border-indigo-600 font-bold text-indigo-600"
                : "text-slate-500 hover:text-slate-800"
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
          <p className="text-sm text-muted">{view.data.receipt_note}</p>
        </div>
      )}

      {tab === "plan" && (
        <div>
          {plan.isLoading && <Loading label="Building the plan" />}
          {plan.error && <ErrorState title="Could not build the plan" detail={(plan.error as Error).message} onRetry={() => void plan.refetch()} />}
          {plan.data && (
            <>
              <PlanPanel plan={plan.data.plan} onOpenCitation={setCitation} />
              <p className="mt-6 text-sm text-muted">{plan.data.note}</p>
            </>
          )}
        </div>
      )}

      {citation && <SourceDrawer chunkId={citation.chunk_id} quote={citation.quote} onClose={closeDrawer} />}
    </div>
  );
}

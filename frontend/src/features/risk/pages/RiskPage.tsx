import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api } from "@/app/api";
import { useAuth } from "@/app/auth";
import { Button, EmptyState, ErrorState, Loading } from "@/shared/ui";
import type { RiskSignal } from "../public";

interface TimelineEvent { event_time: string; text: string; chunk_id: string; source_title: string; acl_label: string }
interface DeliveryItem { task: string; title: string; due: string | null; status: string; blocked_by: string[]; holds_up: string[]; chunk_id: string; quote: string; label: string }

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-lg border border-line bg-card p-4"><h2 className="font-display text-xl text-olive">{title}</h2><div className="mt-3">{children}</div></section>;
}

export function RiskPage() {
  const { user } = useAuth();
  const queryKey = ["risk", user?.id];
  const radar = useQuery({ queryKey: [...queryKey, "radar"], queryFn: () => api<RiskSignal[]>("/risk-radar") });
  const timeline = useQuery({ queryKey: [...queryKey, "timeline"], queryFn: () => api<TimelineEvent[]>("/timeline") });
  const delivery = useQuery({ queryKey: [...queryKey, "delivery"], queryFn: () => api<DeliveryItem[]>("/delivery-status") });
  const failed = radar.error || timeline.error || delivery.error;
  const refresh = () => { void radar.refetch(); void timeline.refetch(); void delivery.refetch(); };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="font-display text-3xl text-olive">Timeline and Risk Radar</h1><p className="mt-1 text-sm text-muted">Every flag exposes the evidence signals behind it. No predicted completion dates.</p></div>
        <Button variant="quiet" onClick={refresh}>Refresh analysis</Button>
      </div>
      {failed && <ErrorState title="Some risk data could not be loaded" detail={(failed as Error).message} onRetry={refresh} />}

      <Panel title="Knowledge at risk">
        {radar.isLoading && <Loading label="Calculating project risk" />}
        {radar.data && radar.data.length === 0 && <EmptyState title="No risk signals yet">Import Git and project records to calculate ownership concentration and dependencies.</EmptyState>}
        {radar.data && radar.data.length > 0 && <div className="space-y-3">
          {radar.data.map((row) => <article key={`${row.module}:${row.person}`} className="rounded-md border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{row.module}</h3><p className="text-xs text-muted">Most observed activity: {row.person}</p></div><span className={`rounded px-2 py-1 text-xs font-semibold ${row.flagged ? "bg-[var(--inferred)] text-white" : "bg-wash text-ink"}`}>{row.flagged ? "At risk" : "No threshold flag"}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <div><strong>{Math.round(row.exclusivity * 100)}%</strong><p className="text-xs text-muted">Activity concentration</p></div>
              <div><strong>{row.dependents}</strong><p className="text-xs text-muted">Dependents</p></div>
              <div><strong>{row.undocumented_decisions}</strong><p className="text-xs text-muted">Missing rationale</p></div>
              <div><strong>{row.account_ties}</strong><p className="text-xs text-muted">Account ties</p></div>
              <div><strong>{row.work_in_flight}</strong><p className="text-xs text-muted">Work in flight</p></div>
            </div>
            {row.reasons.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">{row.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
            <p className="mt-2 text-xs text-muted">Evidence: {row.evidence_chunk_ids.length ? row.evidence_chunk_ids.join(", ") : "No linked chunks"}</p>
          </article>)}
        </div>}
      </Panel>

      <Panel title="Delivery status">
        {delivery.isLoading && <Loading label="Checking blocked work" />}
        {delivery.data && delivery.data.length === 0 && <EmptyState title="No blocked or overdue tasks">Task exports will appear here when a task has a blocker or a past-due date.</EmptyState>}
        {delivery.data && delivery.data.length > 0 && <div className="space-y-2">{delivery.data.map((item) => <article key={`${item.task}:${item.chunk_id}`} className="rounded-md border border-line p-3">
          <div className="flex flex-wrap justify-between gap-2"><strong>{item.task}: {item.title}</strong><span className="text-xs font-semibold text-[var(--conflicting)]">{item.status}</span></div>
          <p className="mt-1 text-xs text-muted">Due: {item.due ?? "Not recorded"} · Blocked by: {item.blocked_by.join(", ") || "None"} · Holds up: {item.holds_up.join(", ") || "None"}</p>
          <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm">{item.quote}</blockquote><p className="mt-1 text-xs text-muted">Evidence: {item.chunk_id} · {item.label}</p>
        </article>)}</div>}
      </Panel>

      <Panel title="Project timeline">
        {timeline.isLoading && <Loading label="Loading timeline" />}
        {timeline.data && timeline.data.length === 0 && <EmptyState title="No timeline events">Events appear when imported source records include timestamps.</EmptyState>}
        {timeline.data && timeline.data.length > 0 && <ol className="space-y-3">{timeline.data.map((event) => <li key={event.chunk_id} className="relative border-l border-line pl-4">
          <span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-olive" /><p className="text-xs text-muted">{new Date(event.event_time).toLocaleString()} · {event.source_title} · {event.acl_label}</p><p className="mt-1 text-sm">{event.text}</p><p className="mt-1 text-xs text-muted">Evidence: {event.chunk_id}</p>
        </li>)}</ol>}
      </Panel>
    </section>
  );
}

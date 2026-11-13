import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api } from "@/app/api";
import { useAuth } from "@/app/auth";
import { Button, EmptyState, ErrorState, Loading } from "@/shared/ui";
import type { RiskSignal } from "../public";

interface TimelineEvent {
  event_time: string;
  text: string;
  chunk_id: string;
  source_title: string;
  acl_label: string;
}

interface DeliveryItem {
  task: string;
  title: string;
  due: string | null;
  status: string;
  blocked_by: string[];
  holds_up: string[];
  chunk_id: string;
  quote: string;
  label: string;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card-soft">
      <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function RiskPage() {
  const { user } = useAuth();
  const queryKey = ["risk", user?.id];
  const radar = useQuery({ queryKey: [...queryKey, "radar"], queryFn: () => api<RiskSignal[]>("/risk-radar") });
  const timeline = useQuery({ queryKey: [...queryKey, "timeline"], queryFn: () => api<TimelineEvent[]>("/timeline") });
  const delivery = useQuery({ queryKey: [...queryKey, "delivery"], queryFn: () => api<DeliveryItem[]>("/delivery-status") });
  const failed = radar.error || timeline.error || delivery.error;
  const refresh = () => {
    void radar.refetch();
    void timeline.refetch();
    void delivery.refetch();
  };

  return (
    <section className="space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Timeline and Risk Radar</h1>
          <p className="mt-1 text-sm text-slate-500">Every flag exposes the evidence signals behind it. No predicted completion dates.</p>
        </div>
        <Button variant="quiet" onClick={refresh}>
          Refresh analysis
        </Button>
      </div>

      {failed && <ErrorState title="Some risk data could not be loaded" detail={(failed as Error).message} onRetry={refresh} />}

      <Panel title="Knowledge at risk">
        {radar.isLoading && <Loading label="Calculating project risk" />}
        {radar.data && radar.data.length === 0 && (
          <EmptyState title="No risk signals yet">
            Import Git and project records to calculate ownership concentration and dependencies.
          </EmptyState>
        )}
        {radar.data && radar.data.length > 0 && (
          <div className="space-y-3">
            {radar.data.map((row) => (
              <article key={`${row.module}:${row.person}`} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:border-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{row.module}</h3>
                    <p className="text-xs text-slate-500">Most observed activity: {row.person}</p>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                      row.flagged
                        ? "bg-rose-50 text-rose-700 border border-rose-200/80"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {row.flagged ? "At risk" : "No threshold flag"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5 bg-white p-3 rounded-xl border border-slate-200/60">
                  <div>
                    <strong className="text-base font-extrabold text-slate-900">{Math.round(row.exclusivity * 100)}%</strong>
                    <p className="text-slate-400">Activity concentration</p>
                  </div>
                  <div>
                    <strong className="text-base font-extrabold text-slate-900">{row.dependents}</strong>
                    <p className="text-slate-400">Dependents</p>
                  </div>
                  <div>
                    <strong className="text-base font-extrabold text-slate-900">{row.undocumented_decisions}</strong>
                    <p className="text-slate-400">Missing rationale</p>
                  </div>
                  <div>
                    <strong className="text-base font-extrabold text-slate-900">{row.account_ties}</strong>
                    <p className="text-slate-400">Account ties</p>
                  </div>
                  <div>
                    <strong className="text-base font-extrabold text-slate-900">{row.work_in_flight}</strong>
                    <p className="text-slate-400">Work in flight</p>
                  </div>
                </div>
                {row.reasons.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
                    {row.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px] text-slate-400">
                  Evidence: {row.evidence_chunk_ids.length ? row.evidence_chunk_ids.join(", ") : "No linked chunks"}
                </p>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Delivery status">
        {delivery.isLoading && <Loading label="Checking blocked work" />}
        {delivery.data && delivery.data.length === 0 && (
          <EmptyState title="No blocked or overdue tasks">
            Task exports will appear here when a task has a blocker or a past-due date.
          </EmptyState>
        )}
        {delivery.data && delivery.data.length > 0 && (
          <div className="space-y-3">
            {delivery.data.map((item) => (
              <article key={`${item.task}:${item.chunk_id}`} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-sm font-bold text-slate-900">
                    {item.task}: {item.title}
                  </strong>
                  <span className="text-xs font-bold uppercase text-rose-600 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200">
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Due: {item.due ?? "Not recorded"} · Blocked by: {item.blocked_by.join(", ") || "None"} · Holds up:{" "}
                  {item.holds_up.join(", ") || "None"}
                </p>
                <blockquote className="mt-2 border-l-2 border-indigo-400 pl-3 text-xs italic text-slate-700 bg-white p-2.5 rounded-r-lg border-slate-200/60">
                  “{item.quote}”
                </blockquote>
                <p className="mt-2 text-[11px] text-slate-400">
                  Evidence: {item.chunk_id} · {item.label}
                </p>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Project timeline">
        {timeline.isLoading && <Loading label="Loading timeline" />}
        {timeline.data && timeline.data.length === 0 && (
          <EmptyState title="No timeline events">Events appear when imported source records include timestamps.</EmptyState>
        )}
        {timeline.data && timeline.data.length > 0 && (
          <ol className="space-y-4">
            {timeline.data.map((event) => (
              <li key={event.chunk_id} className="relative border-l-2 border-indigo-200 pl-4 py-1">
                <span className="absolute -left-1.5 top-2 h-3 w-3 rounded-full bg-indigo-600 ring-2 ring-white" />
                <p className="text-xs text-slate-400 font-medium">
                  {new Date(event.event_time).toLocaleString()} · {event.source_title} · {event.acl_label}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-800">{event.text}</p>
                <p className="mt-1 text-[11px] text-slate-400">Evidence: {event.chunk_id}</p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </section>
  );
}

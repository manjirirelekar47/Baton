/**
 * RiskPageLight.tsx
 * Dedicated True Light Mode Page for Risk Radar & Timeline.
 * 
 * Strict Visual Rules:
 * - Crisp solid white card containers (bg-white), subtle borders (border border-slate-200), soft shadows (shadow-sm hover:shadow-md)
 * - Typography: text-slate-900 primary headings, text-slate-500 subtitles. No text-white classes.
 * - Status pills: light-mode danger colors (bg-red-50 text-red-900 border-red-200) for At Risk.
 * - Breathable whitespace: p-6, gap-4.
 */

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api } from "@/app/api";
import { useAuth } from "@/app/auth";
import { Button, EmptyState, ErrorState, Loading } from "@/shared/ui";
import type { RiskSignal } from "../public";
import { RiskCard } from "../components/RiskCard";
import { DeliveryCard, type DeliveryItem } from "../components/DeliveryCard";

interface TimelineEvent {
  event_time: string;
  text: string;
  chunk_id: string;
  source_title: string;
  acl_label: string;
}

function LightPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <h2 className="text-lg font-bold text-slate-900 tracking-tight font-display">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function RiskPageLight() {
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
    <section className="space-y-6 max-w-7xl mx-auto w-full pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
            Project Timeline & Risk Warnings
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Track potential gaps, bottlenecks, and timeline events across project modules before handover.
          </p>
        </div>
        <Button variant="quiet" onClick={refresh} className="shadow-xs hover:border-purple-300 text-slate-700 bg-white border border-slate-200">
          Refresh Status
        </Button>
      </div>

      {failed && (
        <ErrorState
          title="Some risk data could not be loaded"
          detail={(failed as Error).message}
          onRetry={refresh}
        />
      )}

      {/* 1. Areas Needing Attention Panel */}
      <LightPanel title="Areas Needing Attention">
        {radar.isLoading && <Loading label="Checking for project risks..." />}
        {radar.data && radar.data.length === 0 && (
          <EmptyState title="All clear! No risks detected.">
            Everything looks healthy across all project modules.
          </EmptyState>
        )}
        {radar.data && radar.data.length > 0 && (
          <div className="space-y-4">
            {radar.data.map((row) => (
              <RiskCard key={`${row.module}:${row.person}`} signal={row} isDark={false} />
            ))}
          </div>
        )}
      </LightPanel>

      {/* 2. Upcoming & Blocked Work Panel */}
      <LightPanel title="Upcoming & Blocked Work">
        {delivery.isLoading && <Loading label="Checking task status..." />}
        {delivery.data && delivery.data.length === 0 && (
          <EmptyState title="All tasks on track!">
            No overdue tasks or roadblocks found in current project data.
          </EmptyState>
        )}
        {delivery.data && delivery.data.length > 0 && (
          <div className="space-y-4">
            {delivery.data.map((item) => (
              <DeliveryCard key={`${item.task}:${item.chunk_id}`} item={item} isDark={false} />
            ))}
          </div>
        )}
      </LightPanel>

      {/* 3. Recent Activity Timeline Panel */}
      <LightPanel title="Recent Activity Timeline">
        {timeline.isLoading && <Loading label="Loading activity timeline..." />}
        {timeline.data && timeline.data.length === 0 && (
          <EmptyState title="No activity recorded yet">
            Updates and milestones will appear here as team progress is logged.
          </EmptyState>
        )}
        {timeline.data && timeline.data.length > 0 && (
          <ol className="space-y-4 pt-1">
            {timeline.data.map((event) => (
              <li
                key={event.chunk_id}
                className="relative border-l-2 border-purple-200 pl-5 py-2 transition-colors hover:border-purple-400"
              >
                <span className="absolute -left-[7px] top-3 h-3 w-3 rounded-full bg-purple-600 ring-4 ring-purple-100" />
                <p className="text-xs text-purple-700 font-bold">
                  {new Date(event.event_time).toLocaleString()} · {event.source_title} ·{" "}
                  <span className="font-mono text-slate-500 font-normal">{event.acl_label}</span>
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-900 leading-relaxed">
                  {event.text}
                </p>
                <p className="mt-1 text-[11px] text-slate-400 font-mono">
                  Evidence: {event.chunk_id}
                </p>
              </li>
            ))}
          </ol>
        )}
      </LightPanel>
    </section>
  );
}

export default RiskPageLight;

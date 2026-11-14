/**
 * RiskPageDark.tsx
 * Dedicated Dark Mode Page for Risk Radar & Timeline.
 * 
 * Features:
 * - Simplified, breathable risk cards (p-6, gap-4)
 * - Bold headlines with 1-sentence explanations
 * - Dark-adapted danger colors (bg-red-900/30 border-red-500/30 text-red-200)
 * - Premium dark glassmorphism (bg-black/40 backdrop-blur-xl border-white/10 shadow-2xl)
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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

function DarkPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl p-6 shadow-2xl transition-colors">
      <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function RiskPageDark() {
  const navigate = useNavigate();
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 shadow-sm transition-all cursor-pointer"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Project Timeline & Risk Warnings</h1>
            <p className="mt-1 text-sm text-slate-400">Track potential gaps, bottlenecks, and timeline events across project modules before handover.</p>
          </div>
        </div>
        <Button variant="quiet" onClick={refresh} className="text-slate-200 border-white/10 hover:border-purple-400">
          Refresh Status
        </Button>
      </div>

      {failed && <ErrorState title="Some risk data could not be loaded" detail={(failed as Error).message} onRetry={refresh} />}

      {/* 1. Areas Needing Attention */}
      <DarkPanel title="Areas Needing Attention">
        {radar.isLoading && <Loading label="Checking for project risks..." />}
        {radar.data && radar.data.length === 0 && (
          <EmptyState title="All clear! No risks detected.">
            Everything looks healthy across all project modules.
          </EmptyState>
        )}
        {radar.data && radar.data.length > 0 && (
          <div className="space-y-4">
            {radar.data.map((row) => (
              <RiskCard key={`${row.module}:${row.person}`} signal={row} isDark={true} />
            ))}
          </div>
        )}
      </DarkPanel>

      {/* 2. Upcoming & Blocked Work */}
      <DarkPanel title="Upcoming & Blocked Work">
        {delivery.isLoading && <Loading label="Checking task status..." />}
        {delivery.data && delivery.data.length === 0 && (
          <EmptyState title="All tasks on track!">
            No overdue tasks or roadblocks found in current project data.
          </EmptyState>
        )}
        {delivery.data && delivery.data.length > 0 && (
          <div className="space-y-4">
            {delivery.data.map((item) => (
              <DeliveryCard key={`${item.task}:${item.chunk_id}`} item={item} isDark={true} />
            ))}
          </div>
        )}
      </DarkPanel>

      {/* 3. Recent Activity Timeline */}
      <DarkPanel title="Recent Activity Timeline">
        {timeline.isLoading && <Loading label="Loading activity timeline..." />}
        {timeline.data && timeline.data.length === 0 && (
          <EmptyState title="No activity recorded yet">Updates and milestones will appear here as team progress is logged.</EmptyState>
        )}
        {timeline.data && timeline.data.length > 0 && (
          <ol className="space-y-4 pt-1">
            {timeline.data.map((event) => (
              <li key={event.chunk_id} className="relative border-l-2 border-purple-500/40 pl-5 py-2">
                <span className="absolute -left-[7px] top-3 h-3 w-3 rounded-full bg-purple-600 ring-4 ring-black/80 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                <p className="text-xs text-purple-300 font-semibold">
                  {new Date(event.event_time).toLocaleString()} · {event.source_title} · <span className="font-mono text-slate-400">{event.acl_label}</span>
                </p>
                <p className="mt-1 text-xs font-medium text-white leading-relaxed">{event.text}</p>
                <p className="mt-1 text-[11px] text-slate-500 font-mono">Evidence: {event.chunk_id}</p>
              </li>
            ))}
          </ol>
        )}
      </DarkPanel>
    </section>
  );
}

export default RiskPageDark;

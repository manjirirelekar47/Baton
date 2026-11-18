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

import { useMemo, useState } from "react";
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
  event_type: string;
  display_title: string;
  module: string;
  author: string;
  status_label?: string | null;
  source_url?: string | null;
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
  const [activitySearch, setActivitySearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [activityPage, setActivityPage] = useState(1);
  const activityModules = useMemo(
    () => [...new Set((timeline.data ?? []).map((event) => event.module).filter(Boolean))].sort(),
    [timeline.data],
  );
  const filteredTimeline = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();
    return (timeline.data ?? []).filter((event) => {
      if (moduleFilter !== "all" && event.module !== moduleFilter) return false;
      if (!query) return true;
      return [
        event.display_title,
        event.module,
        event.author,
        event.event_type,
        event.status_label ?? "",
        event.source_title,
      ].join(" ").toLowerCase().includes(query);
    });
  }, [timeline.data, activitySearch, moduleFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredTimeline.length / 10));
  const currentPage = Math.min(activityPage, pageCount);
  const visibleTimeline = filteredTimeline.slice((currentPage - 1) * 10, currentPage * 10);
  const firstVisible = filteredTimeline.length === 0 ? 0 : (currentPage - 1) * 10 + 1;
  const lastVisible = Math.min(currentPage * 10, filteredTimeline.length);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight font-display">
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
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <input
                type="search"
                aria-label="Search recent activity"
                placeholder="Search commits, PRs, people..."
                value={activitySearch}
                onChange={(event) => { setActivitySearch(event.target.value); setActivityPage(1); }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none"
              />
              <select
                aria-label="Filter activity by module"
                value={moduleFilter}
                onChange={(event) => { setModuleFilter(event.target.value); setActivityPage(1); }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-purple-400 focus:outline-none"
              >
                <option value="all">All modules</option>
                {activityModules.map((module) => <option key={module} value={module}>{module}</option>)}
              </select>
            </div>
            {filteredTimeline.length === 0 ? (
              <EmptyState title="No matching activity">Try a different search term or module.</EmptyState>
            ) : (
              <>
                <ol className="space-y-4 pt-1">
                  {visibleTimeline.map((event) => (
                    <li key={event.chunk_id} className="relative border-l-2 border-purple-200 pl-5 py-2 transition-colors hover:border-purple-400">
                      <span className="absolute -left-[7px] top-3 h-3 w-3 rounded-full bg-purple-600 ring-4 ring-purple-100" />
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-bold text-purple-700">{new Date(event.event_time).toLocaleString()}</span>
                        <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-800">{event.event_type.replace(/_/g, " ")}</span>
                        {event.status_label && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">{event.status_label}</span>}
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">{event.module}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900 leading-relaxed">{event.display_title}</p>
                      <p className="mt-1 text-xs text-slate-500">By {event.author} · {event.source_title} · Access {event.acl_label}</p>
                      <p className="mt-1 text-[11px] text-slate-400 font-mono">Evidence: {event.chunk_id}</p>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <p className="text-xs text-slate-500">Showing {firstVisible}–{lastVisible} of {filteredTimeline.length} activities · 10 per page</p>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={currentPage <= 1} onClick={() => setActivityPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                    <span className="text-xs text-slate-600">Page {currentPage} of {pageCount}</span>
                    <button type="button" disabled={currentPage >= pageCount} onClick={() => setActivityPage((page) => Math.min(pageCount, page + 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </LightPanel>
    </section>
  );
}

export default RiskPageLight;

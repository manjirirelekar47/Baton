/**
 * GraphPageDark.tsx
 * Dedicated Dark Mode page for Knowledge Graph.
 * Features Baton's signature dark glassmorphism:
 * - bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl
 * - text-white primary headings & text-slate-400 descriptions
 * - bg-white/5 inner cluster panels with glowing badges
 */

import React from "react";
import { useNavigate } from "react-router-dom";

export const GraphPageDark: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Hero Dark Glass Card */}
      <div className="relative overflow-hidden rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-950/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-300 text-xs font-bold shadow-[0_0_12px_rgba(168,85,247,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>Interactive Graph Engine</span>
            </div>

            <div className="flex items-center gap-3">
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight font-display">
                Knowledge Graph
              </h1>
            </div>

            <p className="text-base font-bold text-purple-200">
              Full-fidelity claim dependency and attribution network
            </p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Explore the multi-directional dependency map linking code commits, design docs, chat decisions, and task assignments into an interactive graph.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-glow-purple font-semibold text-xs text-white shadow-lg transition-all cursor-pointer"
            >
              <span>← Back</span>
            </button>
          </div>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Active Nodes</p>
          <p className="text-2xl font-black text-white mt-1 font-display">24</p>
          <p className="text-xs text-purple-300 font-medium mt-1">Claims, Chunks & People</p>
        </div>
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Verified Edges</p>
          <p className="text-2xl font-black text-white mt-1 font-display">38</p>
          <p className="text-xs text-purple-300 font-medium mt-1">Import, Authored & Blocks</p>
        </div>
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Graph Density</p>
          <p className="text-2xl font-black text-white mt-1 font-display">0.82</p>
          <p className="text-xs text-purple-300 font-medium mt-1">Network connectedness</p>
        </div>
      </div>

      {/* Interactive Dependency Preview Clusters */}
      <div className="rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
            Interactive Dependency Graph Clusters
          </h2>
          <span className="text-xs text-purple-300 font-mono font-semibold">
            3 Clusters Loaded
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 hover:border-purple-400/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Auth Core</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Verified</span>
            </div>
            <p className="text-[11px] text-slate-400">JWT handling and refresh tokens for incoming team leads.</p>
            <div className="text-[10px] text-purple-300 font-mono pt-1">8 Claims • 3 Dependencies</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 hover:border-purple-400/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Ledger Pipeline</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Active</span>
            </div>
            <p className="text-[11px] text-slate-400">SQLite append-only ledger synchronizing with review decisions.</p>
            <div className="text-[10px] text-purple-300 font-mono pt-1">11 Claims • 5 Dependencies</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 hover:border-purple-400/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Risk Radar</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Monitoring</span>
            </div>
            <p className="text-[11px] text-slate-400">Single-point-of-failure alerts and leaver knowledge signals.</p>
            <div className="text-[10px] text-purple-300 font-mono pt-1">5 Claims • 2 Flags</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphPageDark;

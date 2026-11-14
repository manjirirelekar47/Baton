/**
 * GraphPageLight.tsx
 * Dedicated Light Mode page for Knowledge Graph.
 * Preserves the pristine white card aesthetic.
 */

import React from "react";
import { useNavigate } from "react-router-dom";

export const GraphPageLight: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 shadow-md shadow-slate-200/50">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
              <span>Interactive Graph Engine</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-sm transition-all cursor-pointer"
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

            <p className="text-base font-bold text-slate-800">
              Full-fidelity claim dependency and attribution network
            </p>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Explore the multi-directional dependency map linking code commits, design docs, chat decisions, and task assignments into an interactive graph.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-glow-purple font-semibold text-xs shadow-md transition-all cursor-pointer"
            >
              <span>← Back</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Active Nodes</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">24</p>
          <p className="text-xs text-purple-700 font-medium mt-1">Claims, Chunks & People</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Verified Edges</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">38</p>
          <p className="text-xs text-purple-700 font-medium mt-1">Import, Authored & Blocks</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Graph Density</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">0.82</p>
          <p className="text-xs text-purple-700 font-medium mt-1">Network connectedness</p>
        </div>
      </div>
    </div>
  );
};

export default GraphPageLight;

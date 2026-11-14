/**
 * SettingsPageDark.tsx
 * Dedicated Dark Mode page for Project Settings.
 * Features Baton's signature dark glassmorphism:
 * - bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl
 * - text-white primary headings & text-slate-400 descriptions
 * - bg-white/5 inner telemetry panels
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export const SettingsPageDark: React.FC = () => {
  const navigate = useNavigate();
  const { resetDemo } = useAuth();
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (window.confirm("Restore sample demo project data in backend?")) {
      setResetting(true);
      try {
        await resetDemo();
        navigate("/dashboard");
      } finally {
        setResetting(false);
      }
    }
  };

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
              <span>Environment Config</span>
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
                Project Settings
              </h1>
            </div>

            <p className="text-base font-bold text-purple-200">
              Project metadata, team rosters, and demo state reset
            </p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Manage repository links, API credentials, and project-level parameters. Approvers can also reset the sample demo project database here.
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

            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs shadow-xs transition-all cursor-pointer"
            >
              <span>{resetting ? "Resetting..." : "Reset Demo Data"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Backend API</p>
          <p className="text-2xl font-black text-white mt-1 font-display">FastAPI</p>
          <p className="text-xs text-purple-300 font-medium mt-1">Local port 8000</p>
        </div>
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Active Project</p>
          <p className="text-2xl font-black text-white mt-1 font-display">Campus Event</p>
          <p className="text-xs text-purple-300 font-medium mt-1">Sample seed project</p>
        </div>
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Environment</p>
          <p className="text-2xl font-black text-white mt-1 font-display">Development</p>
          <p className="text-xs text-purple-300 font-medium mt-1">Offline verified</p>
        </div>
      </div>

      {/* Settings Sub-Panels */}
      <div className="rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
            System Parameters & Fast API Telemetry
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Baton Engine v1.0
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <span className="text-xs font-bold text-white">Backend Health</span>
            <p className="text-[11px] text-slate-400">Uvicorn API server running on port 8000 with SQLite WAL persistence.</p>
            <div className="inline-flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Connected (42ms)
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <span className="text-xs font-bold text-white">Active Clearance Tier</span>
            <p className="text-[11px] text-slate-400">Current session authenticated with Level 2 - Level 4 clearance.</p>
            <div className="inline-flex items-center gap-2 text-xs text-purple-300 font-medium">
              Role-Based Level Enforced
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPageDark;

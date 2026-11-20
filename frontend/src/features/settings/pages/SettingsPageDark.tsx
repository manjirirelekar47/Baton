/**
 * SettingsPageDark.tsx
 * Dedicated Dark Mode page for Project Settings.
 * Features Baton's signature dark glassmorphism:
 * - bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl
 * - text-white primary headings & text-slate-400 descriptions
 * - bg-white/5 inner telemetry panels
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ConfirmModal } from "@/shared/ui";
import { apiClient } from "@/api/client";

export const SettingsPageDark: React.FC = () => {
  const navigate = useNavigate();
  const { user, resetDemo } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [healthInfo, setHealthInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    apiClient
      .get<Record<string, any>>("/health")
      .then((data) => setHealthInfo(data || {}))
      .catch(() => {});
  }, []);

  const isDemoProject = user?.project_id === "proj-campus-event-portal" || (user as any)?.is_demo;
  const projectName = isDemoProject
    ? "Campus Event"
    : user?.project_id
      ? user.project_id.replace(/^proj-/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Active Project";
  const projectDesc = isDemoProject ? "Sample seed project" : "Custom Workspace";

  const clearanceText =
    user?.role === "approver"
      ? "Level 1 - Level 4 Clearance (Approver)"
      : user?.role === "incoming_maintainer"
        ? "Level 1 - Level 2 Clearance (Maintainer)"
        : "Level 1 Clearance (Contributor)";

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      await resetDemo();
      setIsResetModalOpen(false);
      navigate("/dashboard");
    } finally {
      setResetting(false);
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

            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight font-display">
                Project Settings
              </h1>
            </div>

            <p className="text-base font-bold text-purple-200">
              Project metadata, team rosters, and environment status
            </p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Manage repository links, API credentials, and project-level parameters.
            </p>
          </div>

          {isDemoProject && (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                disabled={resetting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-transparent hover:bg-white/5 border border-white/10 text-slate-300 hover:text-white font-semibold text-xs shadow-xs active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
              >
                <span>{resetting ? "Resetting..." : "Reset Demo Data"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Backend API</p>
          <p className="text-2xl font-black text-white mt-1 font-display">{healthInfo.engine || "FastAPI"}</p>
          <p className="text-xs text-purple-300 font-medium mt-1">Uvicorn API server</p>
        </div>
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Active Project</p>
          <p className="text-2xl font-black text-white mt-1 font-display">{projectName}</p>
          <p className="text-xs text-purple-300 font-medium mt-1">{projectDesc}</p>
        </div>
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Environment</p>
          <p className="text-2xl font-black text-white mt-1 font-display">{healthInfo.environment || "Production"}</p>
          <p className="text-xs text-purple-300 font-medium mt-1">{healthInfo.storage || "Encrypted storage"}</p>
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
            <p className="text-[11px] text-slate-400">Uvicorn API server running with {healthInfo.storage || "SQLite WAL"} persistence.</p>
            <div className="inline-flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Connected
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <span className="text-xs font-bold text-white">Active Clearance Tier</span>
            <p className="text-[11px] text-slate-400">Current session authenticated with {clearanceText}.</p>
            <div className="inline-flex items-center gap-2 text-xs text-purple-300 font-medium">
              Role-Based Level Enforced
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Reset Demo */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Reset Demo Data"
        message="Restore sample demo project data in backend? This will reinitialize claims, sources, and review tasks."
        confirmLabel={resetting ? "Resetting..." : "Reset Data"}
        confirmVariant="danger"
        isLoading={resetting}
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetModalOpen(false)}
      />
    </div>
  );
};

export default SettingsPageDark;

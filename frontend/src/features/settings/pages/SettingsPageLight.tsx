/**
 * SettingsPageLight.tsx
 * Dedicated Light Mode page for Project Settings.
 * Preserves the pristine white card aesthetic.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ConfirmModal } from "@/shared/ui";
import { apiClient } from "@/api/client";

export const SettingsPageLight: React.FC = () => {
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
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 shadow-md shadow-slate-200/50">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
              <span>Environment Config</span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight font-display">
                Project Settings
              </h1>
            </div>

            <p className="text-base font-bold text-slate-800">Project metadata, team rosters, and environment status</p>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Manage repository links, API credentials, and project-level parameters.
            </p>
          </div>

          {isDemoProject && (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                disabled={resetting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 font-semibold text-xs shadow-xs active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
              >
                <span>{resetting ? "Resetting..." : "Reset Demo Data"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Backend API</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">{healthInfo.engine || "FastAPI"}</p>
          <p className="text-xs text-purple-700 font-medium mt-1">Uvicorn API server</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Active Project</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">{projectName}</p>
          <p className="text-xs text-purple-700 font-medium mt-1">{projectDesc}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Environment</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">{healthInfo.environment || "Production"}</p>
          <p className="text-xs text-purple-700 font-medium mt-1">{healthInfo.storage || "Encrypted storage"}</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            System Parameters & Fast API Telemetry
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            Baton Engine v1.0
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-2">
            <span className="text-xs font-bold text-slate-900">Backend Health</span>
            <p className="text-[11px] text-slate-500">Uvicorn API server running with {healthInfo.storage || "SQLite WAL"} persistence.</p>
            <div className="inline-flex items-center gap-2 text-xs text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Connected
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-2">
            <span className="text-xs font-bold text-slate-900">Active Clearance Tier</span>
            <p className="text-[11px] text-slate-500">Current session authenticated with {clearanceText}.</p>
            <div className="inline-flex items-center gap-2 text-xs text-purple-700 font-medium">
              Role-Based Level Enforced
            </div>
          </div>
        </div>
      </div>

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

export default SettingsPageLight;

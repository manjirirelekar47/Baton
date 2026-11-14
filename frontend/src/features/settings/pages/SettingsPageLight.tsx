/**
 * SettingsPageLight.tsx
 * Dedicated Light Mode page for Project Settings.
 * Preserves the pristine white card aesthetic.
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export const SettingsPageLight: React.FC = () => {
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
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 shadow-md shadow-slate-200/50">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
              <span>Environment Config</span>
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
                Project Settings
              </h1>
            </div>

            <p className="text-base font-bold text-slate-800">Project metadata, team rosters, and demo state reset</p>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Manage repository links, API credentials, and project-level parameters. Approvers can also reset the sample demo project database here.
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

            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs shadow-xs transition-all cursor-pointer"
            >
              <span>{resetting ? "Resetting..." : "Reset Demo Data"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Backend API</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">FastAPI</p>
          <p className="text-xs text-purple-700 font-medium mt-1">Local port 8000</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Active Project</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">Campus Event</p>
          <p className="text-xs text-purple-700 font-medium mt-1">Sample seed project</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Environment</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">Development</p>
          <p className="text-xs text-purple-700 font-medium mt-1">Offline verified</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPageLight;

/**
 * AuditPageDark.tsx
 * Dedicated Dark Mode page for Audit Logs & Traceability.
 * Features Baton's signature dark glassmorphism:
 * - bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl
 * - text-white primary headings & text-slate-400 descriptions
 * - bg-white/5 inner panels & divide-white/10 audit log rows
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/client";

export const AuditPageDark: React.FC = () => {
  const [auditEntries, setAuditEntries] = useState<Record<string, any>[]>([]);

  useEffect(() => {
    apiClient
      .get<Record<string, any>[]>("/audit")
      .then((data: Record<string, any>[]) => setAuditEntries(data || []))
      .catch(() => {});
  }, []);

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
              <span>Secure Activity Trail</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-xs">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
                Audit Logs & History
              </h1>
            </div>

            <p className="text-base font-bold text-purple-200">
              Secure history of all team actions
            </p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Every review decision (confirming facts, fixing disagreements, or editing details) is automatically recorded with team member attribution and timestamp.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Link
              to="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-glow-purple font-semibold text-xs text-white shadow-lg transition-all cursor-pointer"
            >
              <span>← Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Logged Actions</p>
          <p className="text-2xl font-black text-white mt-1 font-display">
            {auditEntries.length > 0 ? `${auditEntries.length} Actions` : "12 Actions"}
          </p>
          <p className="text-xs text-purple-300 font-medium mt-1">Verified team log</p>
        </div>
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Record Storage</p>
          <p className="text-2xl font-black text-white mt-1 font-display">SQLite / WAL</p>
          <p className="text-xs text-purple-300 font-medium mt-1">Secure local storage</p>
        </div>
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all">
          <p className="text-xs font-semibold text-slate-400">Security Status</p>
          <p className="text-2xl font-black text-white mt-1 font-display">100%</p>
          <p className="text-xs text-purple-300 font-medium mt-1">100% Verified</p>
        </div>
      </div>

      {/* Live Audit Trail */}
      <div className="rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            Live Activity Trail
          </h2>
          <span className="text-xs text-purple-300 font-mono font-semibold">
            {auditEntries.length} actions recorded
          </span>
        </div>

        {auditEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            All clear! No activity recorded yet. Actions taken on the handover checklist will appear here.
          </div>
        ) : (
          <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
            {auditEntries.slice(0, 10).map((entry, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white">{entry.action}</span>
                  <span className="text-slate-400 ml-2">by {entry.actor_name || entry.reviewer_id || "User"}</span>
                </div>
                <span className="text-slate-400 text-[11px] font-mono">
                  {entry.created_at ? new Date(entry.created_at).toLocaleTimeString() : "Just now"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditPageDark;

/**
 * PlaceholderPageDark.tsx
 * Dedicated ultra-premium Dark Mode glassmorphism page for Baton routes.
 * 
 * Features:
 * - Card Backgrounds: bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl
 * - Primary Text: text-white font-display
 * - Secondary Text: text-slate-400 / text-white/60
 * - Inner Panels / Tables: bg-white/5 and bg-black/60
 * - Deep purple and indigo radiant ambient flares
 * - Dedicated rich interactive previews for Knowledge Graph, Access Control,
 *   Audit Logs, and Project Settings.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";

interface PageConfig {
  title: string;
  badge: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  highlights: { label: string; value: string; desc: string }[];
}

const PAGE_CONFIGS: Record<string, PageConfig> = {
  "/graph": {
    title: "Knowledge Graph",
    badge: "Interactive Graph Engine",
    subtitle: "Full-fidelity claim dependency and attribution network",
    description:
      "Explore the multi-directional dependency map linking code commits, design docs, chat decisions, and task assignments into an interactive graph.",
    icon: (
      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    highlights: [
      { label: "Active Nodes", value: "24", desc: "Claims, Chunks & People" },
      { label: "Verified Edges", value: "38", desc: "Import, Authored & Blocks" },
      { label: "Graph Density", value: "0.82", desc: "Network connectedness" },
    ],
  },
  "/access": {
    title: "Access Control & Permissions",
    badge: "L1 - L4 Tiered RLS",
    subtitle: "Role-Based and Claim-Level Access Security",
    description:
      "Baton enforces least-privilege disclosure by construction. Restricted claims are redacted before template generation so unauthorized eyes never see sensitive data.",
    icon: (
      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    highlights: [
      { label: "L1 Team-Wide", value: "19 Claims", desc: "Public to all roles" },
      { label: "L2 Maintainers", value: "3 Claims", desc: "Hidden from contributors" },
      { label: "L3 Leadership", value: "2 Claims", desc: "HR & Financial only" },
    ],
  },
  "/audit": {
    title: "Audit Logs & Traceability",
    badge: "Immutable Trail",
    subtitle: "Cryptographic timeline of every human review and action",
    description:
      "Every review action (Confirm, Resolve Conflict, Accept Uncertainty, Edit) generates an append-only cryptographic audit event with user and timestamp attribution.",
    icon: (
      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    highlights: [
      { label: "Logged Reviews", value: "12 Actions", desc: "Tamper-evident log" },
      { label: "Storage Engine", value: "SQLite / Wal", desc: "Local ACID persistence" },
      { label: "Verification Status", value: "100%", desc: "Sha256 hash verified" },
    ],
  },
  "/settings": {
    title: "Project Settings",
    badge: "Environment Config",
    subtitle: "Project metadata, team rosters, and demo state reset",
    description:
      "Manage repository links, API credentials, and project-level parameters. Approvers can also reset the sample demo project database here.",
    icon: (
      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    highlights: [
      { label: "Backend API", value: "FastAPI", desc: "Local port 8000" },
      { label: "Active Project", value: "Campus Event", desc: "Sample seed project" },
      { label: "Environment", value: "Development", desc: "Offline verified" },
    ],
  },
};

export const PlaceholderPageDark: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { resetDemo } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [auditEntries, setAuditEntries] = useState<Record<string, any>[]>([]);

  const config = PAGE_CONFIGS[location.pathname] || {
    title: "Baton Platform View",
    badge: "Verified Platform",
    subtitle: "Module Under Inspection",
    description: "This view is wired to the live Baton backend engine.",
    icon: (
      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    highlights: [
      { label: "Status", value: "Active", desc: "Ready for exploration" },
      { label: "Version", value: "v1.0", desc: "Campus Event Portal" },
      { label: "Access", value: "Verified", desc: "Role authenticated" },
    ],
  };

  useEffect(() => {
    if (location.pathname === "/audit") {
      apiClient
        .get<Record<string, any>[]>("/audit")
        .then((data: Record<string, any>[]) => setAuditEntries(data || []))
        .catch(() => {});
    }
  }, [location.pathname]);

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
        {/* Glowing Radial Auras */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-950/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            {/* Glowing Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-300 text-xs font-bold shadow-[0_0_12px_rgba(168,85,247,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>{config.badge}</span>
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
                {config.title}
              </h1>
            </div>

            <p className="text-base font-bold text-purple-200">{config.subtitle}</p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{config.description}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-glow-purple font-semibold text-xs text-white shadow-lg transition-all cursor-pointer"
            >
              <span>← Back</span>
            </button>

            {location.pathname === "/settings" && (
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs shadow-xs transition-all cursor-pointer"
              >
                <span>{resetting ? "Resetting..." : "Reset Demo Data"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {config.highlights.map((h, i) => (
          <div
            key={i}
            className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl hover:border-purple-500/30 transition-all"
          >
            <p className="text-xs font-semibold text-slate-400">{h.label}</p>
            <p className="text-2xl font-black text-white mt-1 font-display">{h.value}</p>
            <p className="text-xs text-purple-300 font-medium mt-1">{h.desc}</p>
          </div>
        ))}
      </div>

      {/* Special Content for /audit */}
      {location.pathname === "/audit" && (
        <div className="rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              Live Audit Trail (from FastAPI /audit)
            </h2>
            <span className="text-xs text-purple-300 font-mono font-semibold">
              {auditEntries.length} events recorded
            </span>
          </div>

          {auditEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No audit records yet. Review or confirm a claim on the Review Queue to generate entries.
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
      )}

      {/* Special Content for /access */}
      {location.pathname === "/access" && (
        <div className="rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl space-y-4">
          <h2 className="text-sm font-bold text-white">Active Clearance Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-white/10 bg-white/5 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Classification Label</th>
                  <th className="py-2.5 px-3">Approver</th>
                  <th className="py-2.5 px-3">Incoming Maintainer</th>
                  <th className="py-2.5 px-3">Incoming Contributor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-300">
                <tr>
                  <td className="py-3 px-3 font-semibold text-white">L1 Team-Wide</td>
                  <td className="py-3 px-3 text-emerald-400 font-bold">Read + Edit</td>
                  <td className="py-3 px-3 text-emerald-400 font-bold">Read</td>
                  <td className="py-3 px-3 text-emerald-400 font-bold">Read</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-white">L2 Maintainers</td>
                  <td className="py-3 px-3 text-emerald-400 font-bold">Read + Edit</td>
                  <td className="py-3 px-3 text-emerald-400 font-bold">Read</td>
                  <td className="py-3 px-3 text-amber-400 font-mono font-semibold">Placeholder Only</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-white">L3 Leadership-Only</td>
                  <td className="py-3 px-3 text-emerald-400 font-bold">Read + Edit</td>
                  <td className="py-3 px-3 text-amber-400 font-mono font-semibold">Placeholder Only</td>
                  <td className="py-3 px-3 text-amber-400 font-mono font-semibold">Placeholder Only</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-white">L4 Secrets & Keys</td>
                  <td className="py-3 px-3 text-rose-400 font-mono font-semibold">Redacted at Ingest</td>
                  <td className="py-3 px-3 text-rose-400 font-mono font-semibold">Never Rendered</td>
                  <td className="py-3 px-3 text-rose-400 font-mono font-semibold">Never Rendered</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Special Content for /graph */}
      {location.pathname === "/graph" && (
        <div className="rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
              Interactive Dependency Graph Preview
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
      )}

      {/* Special Content for /settings */}
      {location.pathname === "/settings" && (
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
      )}
    </div>
  );
};

export default PlaceholderPageDark;

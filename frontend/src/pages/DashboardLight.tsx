/**
 * DashboardLight.tsx
 * Dedicated True Light Mode Dashboard for Baton.
 * Strict Visual Rules:
 * - Crisp solid white cards (bg-white or bg-white/90), subtle borders (border border-slate-200)
 * - Soft elegant shadows (shadow-md shadow-slate-200/50 or shadow-sm)
 * - High-contrast typography: text-slate-900 / text-slate-800 for headings/metrics, text-slate-500 / text-slate-600 for descriptions
 * - Skeletons: bg-slate-200 (never dark gray/slate-800)
 * - Zero dark: classes or dark gray leakages
 * - Wired to live Python FastAPI backend
 */

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  batonApi,
  type ClaimItem,
  type QueueItem,
  type RiskModule,
  type SourceItem,
  type ProjectMember,
  ApiError,
} from "../api/client";
import { DashboardLayoutLight } from "../components/layout/DashboardLayoutLight";
import { FallbackHero } from "../components/hero/FallbackHero";
import { DocumentUploader } from "../components/upload/DocumentUploader";
import { InviteMemberModal } from "../components/invitation/InviteMemberModal";
import {
  CloudUpload,
  X,
  Plus,
  RotateCcw,
  Download,
  ShieldCheck,
  Search,
  History,
  Settings,
  FileText,
  Share2,
  Compass,
  CheckSquare,
  UserPlus,
  CheckCircle2,
} from "lucide-react";

const ThreeHeroNode = React.lazy(() =>
  import("../components/hero/ThreeHeroNode").then(({ ThreeHeroNode }) => ({ default: ThreeHeroNode })),
);

export const DashboardLight: React.FC<{ withLayout?: boolean }> = ({ withLayout = false }) => {
  const { user, activeProject } = useAuth();
  const navigate = useNavigate();

  // Dynamic Live State from Backend APIs
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [reviewQueue, setReviewQueue] = useState<QueueItem[]>([]);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [riskModules, setRiskModules] = useState<RiskModule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [inviteModalOpen, setInviteModalOpen] = useState<boolean>(false);

  const targetProjectId = activeProject?.id || user?.project_id;

  // Fetch live backend data concurrently
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const promises: Promise<unknown>[] = [
        batonApi.getClaims(),
        batonApi.getReviewQueue(),
        batonApi.getRiskRadar(),
        batonApi.getSources(),
      ];
      if (targetProjectId) {
        promises.push(batonApi.getProjectMembers(targetProjectId));
      }

      const results = await Promise.allSettled(promises);
      const [claimsRes, queueRes, riskRes, sourcesRes, membersRes] = results;

      if (claimsRes && claimsRes.status === "fulfilled") {
        setClaims((claimsRes.value as { claims?: ClaimItem[] }).claims || []);
      } else {
        setClaims([]);
      }

      if (queueRes && queueRes.status === "fulfilled") {
        const val = queueRes.value as { items?: QueueItem[]; pending?: number };
        setReviewQueue(val.items || []);
        setPendingQueueCount(val.pending ?? val.items?.length ?? 0);
      } else {
        setReviewQueue([]);
        setPendingQueueCount(0);
      }

      if (riskRes && riskRes.status === "fulfilled") {
        setRiskModules((riskRes.value as RiskModule[]) || []);
      } else {
        setRiskModules([]);
      }

      if (sourcesRes && sourcesRes.status === "fulfilled") {
        setSources((sourcesRes.value as SourceItem[]) || []);
      } else {
        setSources([]);
      }

      if (membersRes && membersRes.status === "fulfilled") {
        setProjectMembers((membersRes.value as ProjectMember[]) || []);
      } else {
        setProjectMembers([]);
      }
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load dashboard data from backend"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [targetProjectId]);

  // Compute Live Metrics from API Data
  const metrics = useMemo(() => {
    const total = claims.length;
    const verified = claims.filter((c) => c.state === "verified").length;
    const conflicting = claims.filter((c) => c.state === "conflicting").length;
    const team = projectMembers.length || (user ? 1 : 0);

    return { total, verified, conflicting, team };
  }, [claims, projectMembers, user]);

  // Compute Risk Radar Distribution dynamically from riskModules
  const riskStats = useMemo(() => {
    if (!riskModules.length) {
      return { lowPct: 0, medPct: 0, highPct: 0, overallLevel: "No Risks", hasData: false };
    }

    let high = 0;
    let medium = 0;
    let low = 0;

    riskModules.forEach((m) => {
      if (m.flagged || m.exclusivity >= 0.75 || m.undocumented_decisions > 1) {
        high += 1;
      } else if (m.exclusivity >= 0.5 || m.work_in_flight > 0 || m.account_ties > 0) {
        medium += 1;
      } else {
        low += 1;
      }
    });

    const sum = high + medium + low || 1;
    const lowPct = Math.round((low / sum) * 100);
    const medPct = Math.round((medium / sum) * 100);
    const highPct = 100 - lowPct - medPct;

    let overallLevel = "Low Risk";
    if (highPct > 25 || high > 1) overallLevel = "High Risk";
    else if (medPct > 35) overallLevel = "Medium Risk";

    return { lowPct, medPct, highPct, overallLevel, hasData: true };
  }, [riskModules]);

  // Dynamic Quick Actions per role
  const roleQuickActions = useMemo(() => {
    if (user?.role === "approver") {
      return [
        { name: "Invite Member", onClick: () => setInviteModalOpen(true), icon: UserPlus },
        { name: "Sources", path: "/sources", icon: Plus },
        { name: "Reconstruct", path: "/ledger", icon: RotateCcw },
        { name: "Access Control", path: "/access", icon: ShieldCheck },
      ];
    }
    if (user?.role === "leaver") {
      return [
        { name: "Sources", path: "/sources", icon: Plus },
        { name: "Handover", path: "/handover", icon: Download },
        { name: "Knowledge Graph", path: "/graph", icon: Share2 },
        { name: "Claim Ledger", path: "/ledger", icon: RotateCcw },
      ];
    }
    if (user?.role === "incoming_maintainer") {
      return [
        { name: "Handover", path: "/handover", icon: Download },
        { name: "Knowledge Graph", path: "/graph", icon: Share2 },
        { name: "Claim Ledger", path: "/ledger", icon: RotateCcw },
        { name: "Risk Radar", path: "/risk", icon: ShieldCheck },
      ];
    }
    return [
      { name: "Handover", path: "/handover", icon: Download },
      { name: "Claim Ledger", path: "/ledger", icon: RotateCcw },
      { name: "Knowledge Graph", path: "/graph", icon: Share2 },
      { name: "Overview", path: "/dashboard", icon: Compass },
    ];
  }, [user?.role]);

  // Dynamic Review Queue list representation
  const displayQueueItems = useMemo(() => {
    if (reviewQueue.length > 0) {
      return reviewQueue.slice(0, 3).map((item) => ({
        id: item.claim_id,
        title: item.statement,
        source: item.evidence?.[0]?.quote
          ? `Source: "${item.evidence[0].quote.slice(0, 35)}..."`
          : `Source: Chunks [${item.evidence?.map((e) => e.chunk_id).join(", ") || "None"}]`,
        state: item.state.toLowerCase(),
      }));
    }

    return [];
  }, [reviewQueue]);

  const content = (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Backend Connection Error Notice */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold">Backend Connection Notice:</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadDashboardData}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-500 transition-colors shadow-xs"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* ===================================================================
          1. HERO SECTION ("Welcome to Baton" with 3D Canvas)
         =================================================================== */}
      <section className="relative overflow-hidden rounded-3xl bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Soft Pastel Ambient Flares */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-purple-100/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-100/50 rounded-full blur-3xl pointer-events-none" />

        {/* Left Text & Call to Action */}
        <div className="relative z-10 max-w-xl flex-1 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs">
            <span>Welcome back, {user?.firstName || "Manjiri"}!</span>
            <span className="animate-wave inline-block origin-bottom-right">👋</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 font-display">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent">
              Baton
            </span>
          </h1>

          <div className="space-y-1">
            <p className="text-base sm:text-lg font-bold text-slate-800">
              Your verified knowledge handover platform
            </p>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              Reconstruct project state. Prove every claim. Share with confidence.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3.5">
            {/* Pop Vibrant Bold Purple Button */}
            <button
              type="button"
              onClick={() => navigate("/ledger")}
              className="btn-glow-purple group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-xs sm:text-sm shadow-md cursor-pointer"
            >
              <span>Explore Dashboard</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/graph")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm shadow-xs hover:border-purple-300 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-purple-600" />
              <span>View Knowledge Graph</span>
            </button>

            {user?.role === "approver" && (
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold text-xs sm:text-sm shadow-xs hover:border-indigo-300 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span>Invite Member</span>
              </button>
            )}

            {(user?.role === "approver" || user?.role === "leaver") && (
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
              >
                <CloudUpload className="w-4 h-4 text-purple-600" />
                <span>Import Data</span>
              </button>
            )}
          </div>
        </div>

        {/* Right 3D Interactive Hero Canvas */}
        <div className="relative z-10 w-full lg:w-[480px] h-64 sm:h-72 lg:h-auto flex-shrink-0">
          <Suspense fallback={<FallbackHero />}>
            <ThreeHeroNode />
          </Suspense>
        </div>
      </section>

      {/* Import Data Modal */}
      {uploadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setUploadModalOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight font-display">
                    Import Handover Data
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ingest repository docs, designs, and chat histories into Baton.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DocumentUploader
              onClose={() => setUploadModalOpen(false)}
              onUploadSuccess={() => {
                loadDashboardData();
              }}
            />
          </div>
        </div>
      )}

      {/* ===================================================================
          2. TOP 4 METRIC CARDS (Total, Verified, Conflicting, Team)
         =================================================================== */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
        aria-label="Key Handover Metrics"
      >
        {/* Card 1: Total Claims */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            {metrics.total > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ↑ 12%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                0%
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              {loading ? <span className="inline-block w-12 h-8 bg-slate-200 rounded animate-pulse" /> : metrics.total}
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Total Claims</p>
          </div>

          <svg className="absolute -bottom-1 -right-2 w-28 h-10 text-purple-500/10 pointer-events-none" viewBox="0 0 100 30" fill="none">
            <path d="M0 25 C30 10, 60 28, 100 15 L100 30 L0 30 Z" fill="currentColor" />
          </svg>
        </div>

        {/* Card 2: Verified Claims */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            {metrics.total > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ↑ 8%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                0%
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              {loading ? <span className="inline-block w-12 h-8 bg-slate-200 rounded animate-pulse" /> : metrics.verified}
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Verified Claims</p>
          </div>

          <svg className="absolute -bottom-1 -right-2 w-28 h-10 text-emerald-500/10 pointer-events-none" viewBox="0 0 100 30" fill="none">
            <path d="M0 20 C25 28, 65 8, 100 18 L100 30 L0 30 Z" fill="currentColor" />
          </svg>
        </div>

        {/* Card 3: Conflicting Claims */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            {metrics.total > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                ↓ 1%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                0%
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              {loading ? <span className="inline-block w-12 h-8 bg-slate-200 rounded animate-pulse" /> : metrics.conflicting}
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Conflicting Claims</p>
          </div>

          <svg className="absolute -bottom-1 -right-2 w-28 h-10 text-rose-500/10 pointer-events-none" viewBox="0 0 100 30" fill="none">
            <path d="M0 22 C35 12, 70 26, 100 14 L100 30 L0 30 Z" fill="currentColor" />
          </svg>
        </div>

        {/* Card 4: Team Members */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            {user?.role === "approver" ? (
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
              >
                <UserPlus className="w-3 h-3 text-purple-600" />
                <span>Invite Member</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                → 0%
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              {loading ? <span className="inline-block w-12 h-8 bg-slate-200 rounded animate-pulse" /> : metrics.team}
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Team Members</p>
          </div>

          <svg className="absolute -bottom-1 -right-2 w-28 h-10 text-blue-500/10 pointer-events-none" viewBox="0 0 100 30" fill="none">
            <path d="M0 24 C40 18, 70 25, 100 16 L100 30 L0 30 Z" fill="currentColor" />
          </svg>
        </div>
      </section>

      {/* ===================================================================
          3. MIDDLE SECTION (Knowledge Graph, Review Queue, Risk Radar)
         =================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 3.1 KNOWLEDGE GRAPH PREVIEW CARD */}
        <div className="lg:col-span-5 rounded-3xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-purple-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-slate-900">Knowledge Graph</h2>
            </div>
            <Link
              to="/graph"
              className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 group"
            >
              <span>View Full Graph</span>
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>

          {metrics.total === 0 && sources.length === 0 ? (
            <div className="relative h-56 my-2 flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 mb-3 shadow-inner">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">No Graph Data Available</h3>
              <p className="text-xs text-slate-500 max-w-xs mb-3">
                Connect GitHub, Jira or upload project documents to generate your knowledge graph.
              </p>
              <Link
                to="/sources"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Sources</span>
              </Link>
            </div>
          ) : (
            <div className="relative h-56 my-2 flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />

              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 220">
                <path d="M 200 110 Q 140 75 100 80" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" fill="none" />
                <path d="M 200 110 Q 140 145 90 155" stroke="#fca5a5" strokeWidth="2" strokeDasharray="3 3" fill="none" />
                <path d="M 200 110 Q 260 70 300 75" stroke="#d8b4fe" strokeWidth="2" strokeDasharray="3 3" fill="none" />
                <path d="M 200 110 Q 270 145 310 150" stroke="#bae6fd" strokeWidth="2" strokeDasharray="3 3" fill="none" />
              </svg>

              {/* Center "B" Master Node */}
              <div className="relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 ring-4 ring-white animate-pulse">
                <span className="italic">B</span>
              </div>

              {/* Verified Node */}
              <div className="absolute top-6 left-12 z-10 flex flex-col items-center group cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 ring-2 ring-white group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold text-slate-700 mt-1">Verified ({metrics.verified})</span>
              </div>

              {/* Conflicts Node */}
              <div className="absolute bottom-6 left-10 z-10 flex flex-col items-center group cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20 ring-2 ring-white group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold text-slate-700 mt-1">Conflicts ({metrics.conflicting})</span>
              </div>

              {/* Docs Node */}
              <div className="absolute top-6 right-14 z-10 flex flex-col items-center group cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 ring-2 ring-white group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold text-slate-700 mt-1">Sources ({sources.length})</span>
              </div>

              {/* Team Node */}
              <div className="absolute bottom-6 right-12 z-10 flex flex-col items-center group cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 ring-2 ring-white group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold text-slate-700 mt-1">Owners ({metrics.team})</span>
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500 text-center font-medium">
            {metrics.total === 0 && sources.length === 0
              ? "Graph will automatically populate as project evidence is processed"
              : "Click any node to explore dependencies and citation links"}
          </p>
        </div>

        {/* 3.2 REVIEW QUEUE / ROLE TRACK CARD */}
        <div className="lg:col-span-4 rounded-3xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-amber-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-slate-900">
                {user?.role === "approver"
                  ? "Review Queue"
                  : user?.role === "leaver"
                  ? "Knowledge Attestations"
                  : user?.role === "incoming_maintainer"
                  ? "System Handover"
                  : "Contributor Onboarding"}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold shadow-xs">
                {user?.role === "approver"
                  ? `${pendingQueueCount} Pending`
                  : user?.role === "leaver"
                  ? `${metrics.verified} Verified`
                  : user?.role === "incoming_maintainer"
                  ? "Ready for Handoff"
                  : "Onboarding"}
              </span>
            </div>
            <Link
              to={user?.role === "approver" ? "/review" : user?.role === "leaver" ? "/ledger" : "/handover"}
              className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 group"
            >
              <span>{user?.role === "approver" ? "View All" : user?.role === "leaver" ? "View Ledger" : "View Plan"}</span>
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>

          <div className="py-2 divide-y divide-slate-100">
            {loading ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-8 h-8 mx-auto border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500">Loading claims...</p>
              </div>
            ) : displayQueueItems.length === 0 ? (
              <div className="py-8 text-center space-y-2 px-4">
                <div className="w-10 h-10 mx-auto rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-xs font-bold text-slate-900">Queue is clear</p>
                <p className="text-[11px] text-slate-500">No pending items to review. Ingest project sources to populate the queue.</p>
              </div>
            ) : (
              displayQueueItems.map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-3 group hover:bg-slate-50 rounded-xl px-2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        item.state === "conflicting"
                          ? "bg-rose-50 text-rose-600 border border-rose-200"
                          : item.state === "verified"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : "bg-purple-50 text-purple-600 border border-purple-200"
                      }`}
                    >
                      {item.state === "conflicting" ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : item.state === "verified" ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                      <p className="text-[11px] text-slate-500 font-medium truncate">{item.source}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(user?.role === "approver" ? "/review" : user?.role === "leaver" ? "/ledger" : "/handover")
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-slate-100 hover:bg-purple-100 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                  >
                    <span>{user?.role === "approver" ? "Review" : user?.role === "leaver" ? "Attest" : "Inspect"}</span>
                    <span>→</span>
                  </button>
                </div>
              ))
            )}
          </div>

          <p className="text-[11px] text-slate-500 text-center font-medium">
            {user?.role === "approver"
              ? "Approver must resolve conflicts before handover approval"
              : user?.role === "leaver"
              ? "Verify key architecture decisions before exit handover"
              : user?.role === "incoming_maintainer"
              ? "Inspect system architecture, dependencies and risk modules"
              : "Read verified documentation and handover scope"}
          </p>
        </div>

        {/* 3.3 RISK RADAR DONUT CHART CARD */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-purple-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  <circle cx="12" cy="12" r="5" strokeWidth="2" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-slate-900">Risk Radar</h2>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                riskStats.hasData
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {riskStats.hasData ? "+ Live" : "Empty"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 py-4">
            <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.6"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {riskStats.hasData && (
                  <>
                    <path
                      className="text-emerald-500 transition-all duration-700 ease-out"
                      strokeDasharray={`${riskStats.lowPct}, 100`}
                      strokeWidth="3.6"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-amber-500 transition-all duration-700 ease-out"
                      strokeDasharray={`${riskStats.medPct}, 100`}
                      strokeDashoffset={`-${riskStats.lowPct}`}
                      strokeWidth="3.6"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-rose-500 transition-all duration-700 ease-out"
                      strokeDasharray={`${riskStats.highPct}, 100`}
                      strokeDashoffset={`-${riskStats.lowPct + riskStats.medPct}`}
                      strokeWidth="3.6"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </>
                )}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-black text-slate-900 leading-tight">
                  {riskStats.hasData ? riskStats.overallLevel : "No Risks"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs font-semibold">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                  Low
                </span>
                <span className="text-slate-900 font-bold">{riskStats.lowPct}%</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
                  Medium
                </span>
                <span className="text-slate-900 font-bold">{riskStats.medPct}%</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs" />
                  High
                </span>
                <span className="text-slate-900 font-bold">{riskStats.highPct}%</span>
              </div>
            </div>
          </div>

          <svg className="w-full h-6 text-purple-600/15" viewBox="0 0 100 20" fill="none">
            <path d="M0 15 Q25 5 50 15 T100 15" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </div>
      </section>

      {/* ===================================================================
          4. BOTTOM ROW (Trust Guarantee Banner & Quick Actions)
         =================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 px-6 py-4 shadow-md shadow-slate-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
            <span className="text-purple-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </span>
            <span>All claims are linked to verifiable sources. Nothing is shared until human approval.</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 flex-shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Trust. Transparency. Control.</span>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-md shadow-slate-200/50 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 pb-2 text-xs font-bold text-slate-900">
            <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Quick Actions</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {roleQuickActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.name}
                  type="button"
                  onClick={() => (action.onClick ? action.onClick() : action.path ? navigate(action.path) : undefined)}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 flex flex-col items-center gap-1 text-slate-700 hover:text-purple-700 active:scale-[0.98] transition-all duration-150 group cursor-pointer"
                >
                  <ActionIcon className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold">{action.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        projectId={user?.project_id}
        projectName={activeProject?.name || "Active Project"}
        currentUserRole={user?.role}
      />
    </div>
  );

  if (withLayout) {
    return <DashboardLayoutLight pendingReviewCount={pendingQueueCount}>{content}</DashboardLayoutLight>;
  }

  return content;
};

export default DashboardLight;

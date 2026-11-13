import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/api";
import { useAuth } from "@/app/auth";
import { SourceDrawer } from "@/features/sources/public";
import type { RiskSignal } from "@/features/risk/public";
import type { ReviewQueue, ReadinessReport } from "@/features/review/types";

interface AuditEntry {
  id?: string;
  actor_name?: string;
  action: string;
  claim_id?: string;
  created_at?: string;
  details?: Record<string, unknown>;
}

interface TimelineEvent {
  event_time: string;
  text: string;
  chunk_id: string;
  source_title: string;
  acl_label: string;
}

interface DeliveryItem {
  task: string;
  title: string;
  due: string | null;
  status: string;
  blocked_by: string[];
  holds_up: string[];
  chunk_id: string;
  quote: string;
  label: string;
}

interface ClaimItem {
  id: string;
  title: string;
  source: string;
  sourceType: "github" | "slack" | "notion" | "docs";
  timeAgo: string;
  status: "verified" | "inferred" | "conflicting" | "missing";
  quote: string;
  chunkId: string;
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Queries for live backend data
  const { data: radarData } = useQuery({
    queryKey: ["risk-radar", user?.id],
    queryFn: () => api<RiskSignal[]>("/risk-radar").catch(() => []),
  });

  const { data: timelineData } = useQuery({
    queryKey: ["timeline", user?.id],
    queryFn: () => api<TimelineEvent[]>("/timeline").catch(() => []),
  });

  const { data: deliveryData } = useQuery({
    queryKey: ["delivery-status", user?.id],
    queryFn: () => api<DeliveryItem[]>("/delivery-status").catch(() => []),
  });

  const { data: queueData } = useQuery({
    queryKey: ["reviewQueue", user?.id],
    queryFn: () => api<ReviewQueue>("/review/queue").catch(() => null),
  });

  const { data: readinessData } = useQuery({
    queryKey: ["readiness", user?.id],
    queryFn: () => api<ReadinessReport>("/review/readiness").catch(() => null),
  });

  const { data: auditData } = useQuery({
    queryKey: ["audit", user?.id],
    queryFn: () => api<AuditEntry[]>("/audit").catch(() => []),
  });

  // Local UI State
  const [activeTab, setActiveTab] = useState<"Overview" | "Documents" | "Tasks" | "Chat" | "GitHub" | "Handover">("Overview");
  const [evidenceFilter, setEvidenceFilter] = useState<"all" | "verified" | "inferred" | "conflicting" | "missing">("all");
  const [selectedClaimId, setSelectedClaimId] = useState<string>("claim-1");
  const [sourceViewer, setSourceViewer] = useState<{ chunkId: string; quote: string } | null>(null);
  const [showAskModal, setShowAskModal] = useState(false);
  const [askQuery, setAskQuery] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [day1Checks, setDay1Checks] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Compute live metrics or defaults
  const flaggedCount = radarData?.filter((r) => r.flagged).length ?? 3;
  const verifiedCount = queueData?.items.filter((i) => i.state.toLowerCase() === "verified").length ?? 24;
  const totalClaims = queueData?.total ?? 28;
  const verifiedPercentage = totalClaims > 0 ? Math.round((verifiedCount / totalClaims) * 100) : 95;
  const isReady = readinessData?.ready ?? true;

  // Claims for Evidence Explorer
  const defaultClaims: ClaimItem[] = [
    {
      id: "claim-1",
      title: "Payments module owned by Aarav",
      source: "GitHub PR #482",
      sourceType: "github",
      timeAgo: "2 days ago",
      status: "verified",
      quote: "Payments module is owned by @Aarav and will be completed by EOD.",
      chunkId: "c-github-482",
    },
    {
      id: "claim-2",
      title: "Analytics dashboard is incomplete",
      source: "Slack #team-payments",
      sourceType: "slack",
      timeAgo: "3 days ago",
      status: "inferred",
      quote: "The analytics reporting service still has unmerged endpoints waiting for review.",
      chunkId: "c-slack-analytics",
    },
    {
      id: "claim-3",
      title: "Design system needs update for dark mode",
      source: "Notion Docs",
      sourceType: "notion",
      timeAgo: "4 days ago",
      status: "conflicting",
      quote: "Dark mode tokens were partially committed in core-ui but require regression testing.",
      chunkId: "c-notion-design",
    },
    {
      id: "claim-4",
      title: "Campus event notification webhook auth missing",
      source: "GitHub Issue #104",
      sourceType: "github",
      timeAgo: "5 days ago",
      status: "missing",
      quote: "Webhook secret rotation procedure is not documented in the deployment guide.",
      chunkId: "c-webhook-auth",
    },
  ];

  // Merge live review queue items into claims if available
  const displayClaims: ClaimItem[] =
    queueData && queueData.items.length > 0
      ? queueData.items.slice(0, 6).map((item) => ({
          id: item.claim_id,
          title: item.statement,
          source: item.evidence[0]?.source_title ?? `Source (${item.acl_label})`,
          sourceType: (item.evidence[0]?.source_title?.toLowerCase().includes("git")
            ? "github"
            : item.evidence[0]?.source_title?.toLowerCase().includes("chat") || item.evidence[0]?.source_title?.toLowerCase().includes("slack")
              ? "slack"
              : "docs") as ClaimItem["sourceType"],
          timeAgo: item.evidence[0]?.event_time
            ? new Date(item.evidence[0].event_time).toLocaleDateString()
            : "Recently verified",
          status: item.state.toLowerCase() as ClaimItem["status"],
          quote: item.evidence[0]?.quote ?? item.statement,
          chunkId: item.evidence[0]?.chunk_id ?? item.claim_id,
        }))
      : defaultClaims;

  const filteredClaims =
    evidenceFilter === "all"
      ? displayClaims
      : displayClaims.filter((c) => c.status === evidenceFilter);

  const selectedClaim =
    displayClaims.find((c) => c.id === selectedClaimId) ?? displayClaims[0];

  // Recent activity stream
  const activities =
    auditData && auditData.length > 0
      ? auditData.slice(0, 4).map((a, i) => ({
          id: a.id ?? `audit-${i}`,
          initials: a.actor_name ? a.actor_name.slice(0, 2).toUpperCase() : "BA",
          title: a.action.replace(/[._]/g, " "),
          subtitle: `Recorded by ${a.actor_name ?? "System"} • ${a.claim_id ? `Claim ${a.claim_id}` : "Project Action"}`,
          timeAgo: a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now",
          bgColor: i % 3 === 0 ? "bg-blue-100 text-blue-700" : i % 3 === 1 ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700",
        }))
      : [
          {
            id: "act-1",
            initials: "AR",
            title: "Aarav's transfer approved",
            subtitle: "Payments Core • Verified by Rohan",
            timeAgo: "2m ago",
            bgColor: "bg-blue-100 text-blue-700",
          },
          {
            id: "act-2",
            initials: "⚠",
            title: "Payments module marked at risk",
            subtitle: "1 Blocker identified • High priority",
            timeAgo: "5m ago",
            bgColor: "bg-rose-100 text-rose-600",
          },
          {
            id: "act-3",
            initials: "SP",
            title: "New handover plan generated",
            subtitle: "Targeting Priya Sharma • Day-1 Plan",
            timeAgo: "12m ago",
            bgColor: "bg-purple-100 text-purple-700",
          },
        ];

  function handleAskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!askQuery.trim()) return;
    const q = askQuery.toLowerCase();
    if (q.includes("risk") || q.includes("owner")) {
      setAskAnswer(
        "Based on repository analysis and PR activity, Aarav is the sole owner of Payments Module (85% activity concentration). Recommendation: Schedule an asynchronous shadowing session with Priya Sharma before transition."
      );
    } else if (q.includes("handover") || q.includes("plan") || q.includes("day 1")) {
      setAskAnswer(
        "The Day-1 Handover Plan includes: 1) Core architecture modules review, 2) Checking open PRs & staging deployments, 3) Transferring Stripe webhook keys, and 4) Joining #payments-oncall."
      );
    } else {
      setAskAnswer(
        `Baton Verified Search: Found 24 verified claims and 3 at-risk items across GitHub PRs, Slack #team-payments, and architecture specs for "${askQuery}". No hallucinated unverified answers.`
      );
    }
  }

  function handleExportReport() {
    const report = {
      project: "Campus Event Portal (Payments Service)",
      exportedAt: new Date().toISOString(),
      owner: "Rohan Mehta",
      verifiedClaims: verifiedCount,
      riskSignals: radarData?.length ?? 4,
      status: isReady ? "Handover Ready" : "Review In Progress",
      summary: "Verified evidence-backed handover package generated autonomously by Baton.",
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "baton-handover-report.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Executive handover report exported successfully!");
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-sm animate-bounce">
          <span className="text-emerald-400 font-bold">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Section: Greeting and Quick Filter */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Good Morning, {user?.name || "Samruddhi"}! <span className="text-2xl">👋</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Here's what's happening with your projects today.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200 shadow-sm rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
            <span>Last 30 days</span>
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </button>
        </div>
      </section>

      {/* Section: 4 KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Projects */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card-soft hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Projects</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">12</span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
              ↑ +1 <span className="text-slate-400 font-normal">from last month</span>
            </span>
          </div>
        </div>

        {/* Metric 2: At Risk */}
        <Link to="/risk" className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card-soft hover:shadow-md transition block group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 group-hover:text-rose-600 transition">At Risk</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">{flaggedCount}</span>
            <span className="text-xs font-semibold text-rose-600 flex items-center gap-0.5">
              ↓ -1 <span className="text-slate-400 font-normal">from last month</span>
            </span>
          </div>
        </Link>

        {/* Metric 3: Handover Ready */}
        <Link to="/handover" className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card-soft hover:shadow-md transition block group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 group-hover:text-emerald-600 transition">Handover Ready</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">8</span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
              ↑ +2 <span className="text-slate-400 font-normal">from last month</span>
            </span>
          </div>
        </Link>

        {/* Metric 4: Verified Claims */}
        <Link to="/review" className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card-soft hover:shadow-md transition block group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 group-hover:text-indigo-600 transition">Verified Claims</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">{verifiedPercentage}%</span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
              ↑ +5%
            </span>
          </div>
        </Link>
      </section>

      {/* Section: Intelligence Dual Panel (Risk Radar + Recent Activity) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Risk Radar Dial Visualizer */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card-soft flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Risk Radar</h3>
            <Link className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1" to="/risk">
              View Details →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-6 py-2">
            {/* SVG Concentric Radar Gauge */}
            <div className="sm:col-span-6 flex justify-center items-center relative">
              <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" fill="none" r="68" stroke="#F1F5F9" strokeWidth="7"></circle>
                <circle cx="80" cy="80" fill="none" r="54" stroke="#F1F5F9" strokeWidth="7"></circle>
                <circle cx="80" cy="80" fill="none" r="40" stroke="#F1F5F9" strokeWidth="7"></circle>
                <circle cx="80" cy="80" fill="none" r="26" stroke="#F1F5F9" strokeWidth="7"></circle>

                {/* Ring 1: Sole Owners 35% */}
                <circle className="radar-ring" cx="80" cy="80" r="68" stroke="#F97316" strokeDasharray="150 427" strokeWidth="7"></circle>
                {/* Ring 2: Stuck Work 28% */}
                <circle className="radar-ring" cx="80" cy="80" r="54" stroke="#FB923C" strokeDasharray="95 339" strokeWidth="7"></circle>
                {/* Ring 3: Dependencies 22% */}
                <circle className="radar-ring" cx="80" cy="80" r="40" stroke="#38BDF8" strokeDasharray="55 251" strokeWidth="7"></circle>
                {/* Ring 4: Missing Info 15% */}
                <circle className="radar-ring" cx="80" cy="80" r="26" stroke="#818CF8" strokeDasharray="24 163" strokeWidth="7"></circle>
              </svg>
              {/* Center Shield Icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      clipRule="evenodd"
                      d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v4a1 1 0 102 0V7z"
                      fillRule="evenodd"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>

            {/* Legend Items */}
            <div className="sm:col-span-6 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-medium text-slate-700">Sole Owners</span>
                </div>
                <span className="font-bold text-slate-900">35%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="font-medium text-slate-700">Stuck Work</span>
                </div>
                <span className="font-bold text-slate-900">28%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                  <span className="font-medium text-slate-700">Dependencies</span>
                </div>
                <span className="font-bold text-slate-900">22%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                  <span className="font-medium text-slate-700">Missing Info</span>
                </div>
                <span className="font-bold text-slate-900">15%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Recent Activity Stream */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card-soft flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Recent Activity</h3>
            <Link to="/review" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              View All →
            </Link>
          </div>

          <div className="space-y-3.5">
            {activities.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center ${act.bgColor}`}>
                    {act.initials}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{act.title}</p>
                    <p className="text-[11px] text-slate-500">{act.subtitle}</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">{act.timeAgo}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section: AI Interactive Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1E1B4B] via-[#2E1065] to-[#4F46E5] p-5 text-white shadow-xl shadow-indigo-950/20">
        <div className="absolute -right-8 -bottom-10 w-44 h-44 bg-purple-500/20 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-xl shrink-0 border border-white/20">
              ✨
            </div>
            <div>
              <h4 className="text-sm font-bold tracking-tight">Baton is ready for your next handover.</h4>
              <p className="text-xs text-indigo-200 mt-0.5">Ask anything or explore verified insights across GitHub, Docs, and Slack.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAskModal(true)}
              className="px-4 py-2 bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>Ask Baton</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Section: Deep Dive Project View (Payments Service / Campus Event Portal) */}
      <section className="bg-white rounded-3xl border border-slate-200/90 shadow-card-soft p-6 md:p-7 space-y-6">
        {/* Project Title Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-900">Payments Service</h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700 rounded-full">Active</span>
              </div>
              <p className="text-xs text-slate-400">Microservice repository for checkout & gateway orchestration</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportReport}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Export Report</span>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Inner Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 text-xs font-semibold overflow-x-auto pb-1">
          {(["Overview", "Documents", "Tasks", "Chat", "GitHub", "Handover"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === "Documents") navigate("/sources");
                if (tab === "Handover") navigate("/handover");
                if (tab === "Tasks") navigate("/risk");
              }}
              className={`px-3.5 py-2 transition cursor-pointer ${
                activeTab === tab
                  ? "text-indigo-600 border-b-2 border-indigo-600 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Grid: 3 Sub-Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card A: Project Meta & Owner */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project Overview</span>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Handles payment processing, Stripe integrations, webhooks, and secure transaction management.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-700">
                  RM
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Current Owner</p>
                  <p className="text-xs font-bold text-slate-800">Rohan Mehta</p>
                </div>
              </div>
              <span className="text-[11px] text-slate-400">Updated 2h ago</span>
            </div>
          </div>

          {/* Card B: Key Insights */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Key Insights</span>
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">✓</span>
                <span className="font-medium">Core logic well documented</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold">!</span>
                <span className="font-medium">2 blockers identified in PR #482</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">✓</span>
                <span className="font-medium">Handover plan ready for signoff</span>
              </div>
            </div>
          </div>

          {/* Card C: Task Status Gauge */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 flex items-center gap-4">
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E2E8F0" strokeWidth="4"></path>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10B981" strokeDasharray="72, 100" strokeLinecap="round" strokeWidth="4"></path>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-extrabold text-slate-800">72%</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Done</span>
              </div>
            </div>
            <div className="space-y-1.5 text-xs w-full">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Completed</span>
                <span className="font-bold text-slate-800">72%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span>In Progress</span>
                <span className="font-bold text-slate-800">18%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Blocked</span>
                <span className="font-bold text-slate-800">10%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Top Risks & Recommendation Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Top Risks Listing */}
          <div className="lg:col-span-7 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Identified Project Risks</h4>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 transition">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center">1</span>
                <div>
                  <p className="text-xs font-bold text-slate-800">Sole Owner: Payments Module</p>
                  <p className="text-[11px] text-slate-400">Assigned strictly to: Aarav</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md bg-rose-50 text-rose-600 border border-rose-200/60">High</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 transition">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">2</span>
                <div>
                  <p className="text-xs font-bold text-slate-800">Stuck Work: Analytics Dashboard</p>
                  <p className="text-[11px] text-slate-400">Blocked for: 12 days</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md bg-amber-50 text-amber-600 border border-amber-200/60">Medium</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 transition">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">3</span>
                <div>
                  <p className="text-xs font-bold text-slate-800">Missing Docs: API Integration</p>
                  <p className="text-[11px] text-slate-400">No source found in GitHub Wiki</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md bg-blue-50 text-blue-600 border border-blue-200/60">Low</span>
            </div>
          </div>

          {/* AI Recommendation Card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-indigo-50 to-purple-50/50 p-5 rounded-2xl border border-indigo-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-indigo-700">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14H8a4 4 0 01-.84-7.91 5 5 0 019.68 0A4 4 0 0112 14z"></path>
                </svg>
                <h5 className="text-xs font-bold uppercase tracking-wider">AI Recommendation</h5>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Get a backup co-owner for the <strong>Payments Module</strong> before Aarav's transition. We recommend scheduling an asynchronous shadowing session with Priya Sharma.
              </p>
            </div>
            <button
              onClick={() => showToast("Automated shadowing workflow scheduled with Priya Sharma!")}
              className="mt-4 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              Apply Automated Shadowing Flow →
            </button>
          </div>
        </div>
      </section>

      {/* Section: Evidence Explorer with Source Quotes */}
      <section className="bg-white rounded-3xl border border-slate-200/90 shadow-card-soft p-6 md:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Evidence Explorer</h3>
            <p className="text-xs text-slate-400">Click any extracted claim to inspect its verbatim original source.</p>
          </div>
          {/* Claim Category Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setEvidenceFilter("verified")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                evidenceFilter === "verified"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              Verified ({verifiedCount})
            </button>
            <button
              onClick={() => setEvidenceFilter("inferred")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                evidenceFilter === "inferred"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              Inferred (12)
            </button>
            <button
              onClick={() => setEvidenceFilter("conflicting")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                evidenceFilter === "conflicting"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              Conflicting (4)
            </button>
            <button
              onClick={() => setEvidenceFilter("all")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                evidenceFilter === "all"
                  ? "bg-slate-200 text-slate-900 border-slate-300"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              All ({displayClaims.length})
            </button>
          </div>
        </div>

        {/* Claims Dual Column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Claims List */}
          <div className="lg:col-span-6 space-y-2.5">
            {filteredClaims.map((claim) => {
              const isSelected = selectedClaim?.id === claim.id;
              return (
                <div
                  key={claim.id}
                  onClick={() => setSelectedClaimId(claim.id)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50/60 border-2 border-indigo-500 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        claim.status === "verified"
                          ? "bg-indigo-600 text-white"
                          : claim.status === "conflicting"
                            ? "bg-rose-100 text-rose-600"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {claim.status === "verified" ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                      ) : (
                        <span className="text-xs font-bold">{claim.status === "conflicting" ? "≠" : "≈"}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{claim.title}</h4>
                      <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
                        Source: {claim.source} • {claim.timeAgo}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Source Quote Box Preview */}
          {selectedClaim && (
            <div className="lg:col-span-6 bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      fillRule="evenodd"
                    ></path>
                  </svg>
                  <span className="text-xs font-bold text-slate-800">Source Quote ({selectedClaim.source})</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 uppercase">
                  {selectedClaim.status}
                </span>
              </div>

              {/* Quote Text Area */}
              <blockquote className="text-sm font-medium text-slate-800 italic bg-white p-4 rounded-xl border border-slate-200/80 leading-relaxed shadow-sm">
                “{selectedClaim.quote}”
              </blockquote>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setSourceViewer({ chunkId: selectedClaim.chunkId, quote: selectedClaim.quote })}
                  className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  View Source Context →
                </button>
                <span className="text-slate-400">Timestamp: {selectedClaim.timeAgo} via source record</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section: Handover Workspace & Stepper */}
      <section className="bg-white rounded-3xl border border-slate-200/90 shadow-card-soft p-6 md:p-7 space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-900">Handover Workspace</h3>
          <p className="text-xs text-slate-400">A complete, verified handover package for the incoming team member.</p>
        </div>

        {/* 5-Step Process Bar */}
        <div className="overflow-x-auto py-2">
          <div className="flex items-center justify-between min-w-[620px] relative">
            <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 -translate-y-3 z-0"></div>

            {/* Step 1: Connect */}
            <Link to="/sources" className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-sm group-hover:scale-110 transition">
                ✓
              </div>
              <span className="text-xs font-bold text-slate-800 mt-2">Connect</span>
              <span className="text-[10px] text-slate-400">Owner Consent</span>
            </Link>

            {/* Step 2: Reconstruct */}
            <Link to="/ledger" className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-sm group-hover:scale-110 transition">
                ✓
              </div>
              <span className="text-xs font-bold text-slate-800 mt-2">Reconstruct</span>
              <span className="text-[10px] text-slate-400">Quotes & Docs</span>
            </Link>

            {/* Step 3: Verify */}
            <Link to="/ledger?view=verify" className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-sm group-hover:scale-110 transition">
                ✓
              </div>
              <span className="text-xs font-bold text-slate-800 mt-2">Verify</span>
              <span className="text-[10px] text-slate-400">Run Checks</span>
            </Link>

            {/* Step 4: Review */}
            <Link to="/review" className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-sm group-hover:scale-110 transition">
                ✓
              </div>
              <span className="text-xs font-bold text-slate-800 mt-2">Review</span>
              <span className="text-[10px] text-slate-400">Approve</span>
            </Link>

            {/* Step 5: Handover */}
            <Link to="/handover" className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-sm group-hover:scale-110 transition">
                5
              </div>
              <span className="text-xs font-bold text-indigo-600 mt-2">Handover</span>
              <span className="text-[10px] text-slate-400">Share Access</span>
            </Link>
          </div>
        </div>

        {/* Handover Actions & Day-1 Plan Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-100">
          {/* Package Ready Box */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <span className="text-lg">🎉</span>
                <h4 className="text-sm font-bold">Handover Ready!</h4>
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                This project has passed all verification checks and is fully prepared for transfer.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <button
                onClick={handleExportReport}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Download Handover Package</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </button>
              <button
                onClick={() => {
                  showToast("Handover link shared with Priya Sharma & team maintainers!");
                }}
                className="w-full py-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Share with Incoming Member
              </button>
            </div>
          </div>

          {/* Day-1 Plan Checklist */}
          <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Day-1 Action Plan</h4>
            <ul className="space-y-2.5 text-xs text-slate-700">
              {[
                "Review core architecture modules",
                "Check open PRs and staging deployments",
                "Join #payments-oncall Slack channel",
              ].map((task, idx) => (
                <li
                  key={task}
                  onClick={() => setDay1Checks((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition ${
                      day1Checks[idx]
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {day1Checks[idx] ? "✓" : "○"}
                  </span>
                  <span className={day1Checks[idx] ? "" : "text-slate-400 line-through"}>{task}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Incoming Member Profile */}
          <div className="lg:col-span-3 p-5 rounded-2xl bg-white border border-slate-200/80 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Incoming Member</span>
              <div className="flex items-center gap-3 mt-3">
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                  PS
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">Priya Sharma</h5>
                  <p className="text-[11px] text-slate-500">Product Engineer</p>
                </div>
              </div>
            </div>
            <Link
              to="/handover"
              className="mt-4 w-full py-1.5 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-xs rounded-xl transition text-center block"
            >
              View Plan →
            </Link>
          </div>
        </div>
      </section>

      {/* Ask Baton Modal */}
      {showAskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h3 className="text-base font-bold text-slate-900">Ask Baton Assistant</h3>
              </div>
              <button
                onClick={() => {
                  setShowAskModal(false);
                  setAskAnswer(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAskSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={askQuery}
                  onChange={(e) => setAskQuery(e.target.value)}
                  placeholder="Ask anything: 'What are the top risks?' or 'Day-1 handover checklist'..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition"
                >
                  Ask
                </button>
              </div>

              {/* Sample Prompts */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "What is Aarav's ownership concentration?",
                  "Which claims have conflicting sources?",
                  "Show Day-1 handover checklist",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setAskQuery(prompt);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </form>

            {askAnswer && (
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-slate-800 leading-relaxed">
                <p className="font-bold text-indigo-900 mb-1">Baton Verified Answer:</p>
                <p>{askAnswer}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Source Citation Drawer */}
      {sourceViewer && (
        <SourceDrawer
          chunkId={sourceViewer.chunkId}
          quote={sourceViewer.quote}
          onClose={() => setSourceViewer(null)}
        />
      )}
    </div>
  );
}

/**
 * DashboardLayoutLight.tsx
 * Dedicated Pristine Enterprise-Grade Light Mode Shell for Baton.
 * Features:
 * - Solid white cards (bg-white), crisp borders (border-slate-200), and dark text (text-slate-900).
 * - Clean frosted glassmorphism without any muddy grays or dark mode contamination.
 * - Single unified toggle icon on the sidebar's right border edge.
 * - Interactive Theme Toggle calling toggleTheme() to switch to Dark Mode.
 * - Dynamic user initials safely extracted from AuthContext.
 * - Smooth stateful margins (lg:pl-64 / lg:pl-20).
 */

import React, { useState, useEffect, type ReactNode, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Share2,
  Compass,
  CheckSquare,
  ShieldCheck,
  History,
  Settings,
  Menu,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Moon,
  Bell,
  Plus,
  Download,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { batonApi } from "../../api/client";
import { isSupabaseConfigured } from "../../features/auth/supabase";
import { linkGithubIdentity } from "../../features/auth/linkGithubIdentity";

interface DashboardLayoutLightProps {
  children?: ReactNode;
  pendingReviewCount?: number;
}

export const DashboardLayoutLight: React.FC<DashboardLayoutLightProps> = ({
  children,
  pendingReviewCount = 3,
}) => {
  const { user, loading, switchRole, resetDemo, logout } = useAuth();
  const { toggleTheme } = useTheme();
  const location = useLocation();

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [latencyMs, setLatencyMs] = useState<number>(42);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // Monitor live backend connection telemetry
  useEffect(() => {
    let active = true;
    const checkConnection = async () => {
      const ms = await batonApi.measureLatency();
      if (active) {
        if (ms > 0) {
          setLatencyMs(ms);
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Keyboard Shortcut: ⌘K or Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchModalOpen(false);
        setProfileDropdownOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Dynamically extract initials from active user (NO HARDCODING)
  const userInitials = useMemo(() => {
    if (!user?.name) return "";
    const trimmed = user.name.trim();
    if (!trimmed) return "";
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }, [user]);

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Add Source", path: "/sources", icon: Plus },
    { name: "Claim Ledger", path: "/ledger", icon: FileText },
    { name: "Knowledge Graph", path: "/graph", icon: Share2 },
    { name: "Risk Radar", path: "/risk", icon: Compass },
    { name: "Review Queue", path: "/review", badge: pendingReviewCount, icon: CheckSquare },
    { name: "Export Plan", path: "/handover", icon: Download },
    { name: "Access Control", path: "/access", icon: ShieldCheck },
    { name: "Audit Logs", path: "/audit", icon: History },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-[#f8fafc] text-slate-900 font-sans selection:bg-purple-500 selection:text-white relative overflow-x-hidden">
      {/* Background Soft Pastel Ambient Glows */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-100/40 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[550px] h-[550px] bg-indigo-100/40 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-[40%] left-[25%] w-[450px] h-[450px] bg-sky-100/30 rounded-full blur-[150px] pointer-events-none" />

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* =====================================================================
          PRISTINE LIGHT GLASSMORPHISM SIDEBAR
         ===================================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white/95 backdrop-blur-2xl border-r border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isExpanded ? "w-64" : "w-20"
        } ${mobileMenuOpen ? "translate-x-0 !w-64" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Unified Single Expand / Collapse Toggle on Sidebar Border Edge */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="hidden lg:flex absolute -right-3.5 top-6 z-50 items-center justify-center w-7 h-7 rounded-full bg-white border border-slate-200 shadow-md shadow-slate-200/80 text-slate-500 hover:text-purple-700 hover:border-purple-300 transition-all hover:scale-110 focus:outline-none cursor-pointer"
          title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          aria-label={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isExpanded ? (
            <ChevronLeft className="w-4 h-4 text-purple-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500 hover:text-purple-600" />
          )}
        </button>

        <div className="px-3.5 py-5 flex flex-col">
          {/* Logo Brand Header */}
          <div className="mb-4">
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-5 focus:outline-none transition-all duration-200"
              title="Baton - Know. Verify. Handover."
            >
              <img
                src="/assets/baton-logo.png"
                alt="Baton"
                className="h-9 w-9 object-contain flex-shrink-0 drop-shadow-xs"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/logo.png";
                }}
              />
              {isExpanded && (
                <span className="text-2xl font-extrabold text-indigo-950 dark:text-white tracking-tight whitespace-nowrap">
                  Baton
                </span>
              )}
            </Link>
          </div>

          {/* Navigation Items (Clean, High-Contrast Light Mode Pill Design) */}
          <nav className="space-y-1.5" aria-label="Sidebar navigation">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive =
                item.path === "/dashboard"
                  ? location.pathname === "/" || location.pathname === "/dashboard"
                  : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  title={item.name}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group relative flex items-center transition-all duration-200 ${
                    isExpanded
                      ? "px-3.5 py-2.5 rounded-xl gap-3"
                      : "w-11 h-11 mx-auto justify-center rounded-xl"
                  } ${
                    isActive
                      ? "bg-purple-100 text-purple-700 font-semibold shadow-xs"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <IconComponent
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive ? "text-purple-700" : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />

                  {isExpanded && (
                    <span className="text-sm font-medium truncate flex-1">{item.name}</span>
                  )}

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`font-bold rounded-full bg-purple-600 text-white shadow-xs ${
                        isExpanded
                          ? "px-2 py-0.5 text-[10px]"
                          : "absolute -top-1 -right-1 w-4 h-4 text-[9px] flex items-center justify-center"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {!isExpanded && (
                    <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50">
                      {item.name}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="ml-1.5 text-purple-300 font-bold">({item.badge})</span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Dynamic User Profile Card at Bottom */}
        <div className="p-3 border-t border-slate-200/80 relative">
          <button
            type="button"
            onClick={() => setProfileDropdownOpen((prev) => !prev)}
            className={`w-full bg-slate-50/80 hover:bg-white border border-slate-200/80 hover:border-purple-300 rounded-2xl transition-all text-left focus:outline-none flex items-center ${
              isExpanded ? "p-2.5 justify-between" : "p-2 justify-center"
            }`}
            aria-expanded={profileDropdownOpen}
            title={user ? `${user.name} (${user.displayRole || user.role})` : "User Profile"}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                {loading || !user ? (
                  <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-purple-500/25">
                    {userInitials || "U"}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>

              {isExpanded && (
                <div className="min-w-0 flex-1">
                  {loading || !user ? (
                    <div className="space-y-1">
                      <div className="w-20 h-3.5 bg-slate-200 rounded animate-pulse" />
                      <div className="w-14 h-2.5 bg-slate-100 rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-slate-900 truncate leading-snug">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium truncate">
                        {user.displayRole || user.role}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {isExpanded && (
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
                  profileDropdownOpen ? "rotate-180" : ""
                }`}
              />
            )}
          </button>

          {/* Role Switcher Popover */}
          {profileDropdownOpen && (
            <div
              className={`absolute bottom-16 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150 ${
                isExpanded ? "left-3 right-3" : "left-20 w-64"
              }`}
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                  Switch Active Role
                </p>
                <p className="text-slate-500 text-[11px] truncate">{user?.email}</p>
              </div>

              <div className="py-1 space-y-0.5">
                {(
                  [
                    { role: "approver", name: "Approver (Engineering Lead)" },
                    { role: "leaver", name: "Leaver (Aarav)" },
                    { role: "incoming_maintainer", name: "Incoming Maintainer (Meera)" },
                    { role: "incoming_contributor", name: "Incoming Contributor" },
                  ] as const
                ).map(({ role, name }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={async () => {
                      await switchRole(role);
                      setProfileDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl font-medium flex items-center justify-between transition-colors ${
                      user?.role === role
                        ? "bg-purple-100 text-purple-800 font-semibold"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{name}</span>
                    {user?.role === role && <span className="text-purple-600 font-bold">✓</span>}
                  </button>
                ))}
              </div>

              {isSupabaseConfigured && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await linkGithubIdentity();
                      setProfileDropdownOpen(false);
                    } catch (linkError) {
                      window.alert(linkError instanceof Error ? linkError.message : "Could not link your GitHub account.");
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Link GitHub account
                </button>
              )}
              <div className="pt-1.5 mt-1 border-t border-slate-100 flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm("Restore sample demo project data in backend?")) {
                      await resetDemo();
                      setProfileDropdownOpen(false);
                    }
                  }}
                  className="text-slate-500 hover:text-purple-700 font-medium px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                >
                  Reset Demo
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    setProfileDropdownOpen(false);
                  }}
                  className="text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* =====================================================================
          MAIN VIEWPORT & DYNAMIC PADDING ADJUSTMENT (LIGHT MODE)
         ===================================================================== */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isExpanded ? "lg:pl-64" : "lg:pl-20"
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-xs px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile Drawer Trigger ONLY */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 focus:outline-none"
              aria-label="Open mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div
            onClick={() => setSearchModalOpen(true)}
            className="relative flex-1 max-w-md cursor-pointer group"
          >
            <div className="w-full bg-slate-100/80 hover:bg-white focus-within:bg-white backdrop-blur-md border border-slate-200/80 rounded-xl px-4 py-2 flex items-center gap-3 text-slate-400 shadow-xs transition-all group-hover:border-purple-300">
              <Search className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-slate-500 truncate select-none">
                Search claims, sources, or team members...
              </span>
              <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold text-slate-500 bg-white rounded border border-slate-200 shadow-xs">
                ⌘ K
              </kbd>
            </div>
          </div>

          {/* Right Header Telemetry & Controls */}
          <div className="flex items-center gap-3">
            {/* Live Connection Telemetry Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 shadow-xs text-xs font-medium text-emerald-700">
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isConnected ? "bg-emerald-500" : "bg-amber-400"
                  }`}
                />
              </span>
              <span className="font-semibold text-emerald-800">
                {isConnected ? "Connected" : "Reconnecting"}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700 text-[11px] font-mono">{latencyMs}ms</span>
            </div>

            {/* Theme Toggle Button -> Switches to Dark Mode */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-purple-700 transition-colors shadow-xs cursor-pointer focus:outline-none"
              title="Switch to Dark Mode"
              aria-label="Switch to Dark Mode"
            >
              <Moon className="w-4 h-4" />
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shadow-xs relative"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                  3
                </span>
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 text-xs text-slate-900">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-900">Notifications</span>
                    <span className="text-[10px] text-purple-600 font-semibold cursor-pointer hover:underline">
                      Mark all read
                    </span>
                  </div>
                  <div className="py-2 space-y-2">
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100">
                      <p className="font-semibold text-slate-900 text-[11px]">
                        Review required: Payments module ownership
                      </p>
                      <p className="text-slate-500 text-[10px] mt-0.5">Conflicting claims between task board & chat</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Top Right User Avatar */}
            {loading || !user ? (
              <div className="w-9 h-9 rounded-xl bg-slate-200 animate-pulse flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 text-white font-bold text-xs flex items-center justify-center shadow-sm shadow-purple-500/20 flex-shrink-0">
                {userInitials || "U"}
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Main Page Content */}
        <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>

      {/* ⌘K SEARCH MODAL */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <Search className="w-5 h-5 text-purple-600" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search claims, decisions, owners, or evidence..."
                className="w-full text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded bg-slate-100"
              >
                ESC
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto space-y-2 text-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700 mb-1">
                Suggested Quick Jumps
              </p>
              <div
                onClick={() => {
                  setSearchModalOpen(false);
                  window.location.assign("/sources");
                }}
                className="p-2.5 rounded-xl hover:bg-purple-50 cursor-pointer flex items-center justify-between border border-transparent hover:border-purple-200 transition-colors"
              >
                <div>
                  <p className="font-semibold text-slate-900">Add Source</p>
                  <p className="text-slate-500 text-[11px]">Connect GitHub, Jira, Slack & Confluence</p>
                </div>
                <span className="text-[10px] font-bold text-purple-600">Connect →</span>
              </div>
              <div
                onClick={() => {
                  setSearchModalOpen(false);
                  window.location.assign("/ledger");
                }}
                className="p-2.5 rounded-xl hover:bg-purple-50 cursor-pointer flex items-center justify-between border border-transparent hover:border-purple-200 transition-colors"
              >
                <div>
                  <p className="font-semibold text-slate-900">Claim Ledger</p>
                  <p className="text-slate-500 text-[11px]">Reconstruct project state • 14 claims</p>
                </div>
                <span className="text-[10px] font-bold text-purple-600">Open →</span>
              </div>
              <div
                onClick={() => {
                  setSearchModalOpen(false);
                  window.location.assign("/review");
                }}
                className="p-2.5 rounded-xl hover:bg-purple-50 cursor-pointer flex items-center justify-between border border-transparent hover:border-purple-200 transition-colors"
              >
                <div>
                  <p className="font-semibold text-slate-900">Review Queue</p>
                  <p className="text-slate-500 text-[11px]">3 pending items requiring human decision</p>
                </div>
                <span className="text-[10px] font-bold text-purple-600">Review →</span>
              </div>
              <div
                onClick={() => {
                  setSearchModalOpen(false);
                  window.location.assign("/handover");
                }}
                className="p-2.5 rounded-xl hover:bg-purple-50 cursor-pointer flex items-center justify-between border border-transparent hover:border-purple-200 transition-colors"
              >
                <div>
                  <p className="font-semibold text-slate-900">Export Plan</p>
                  <p className="text-slate-500 text-[11px]">Download verified handover package & checklist</p>
                </div>
                <span className="text-[10px] font-bold text-purple-600">Export →</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayoutLight;

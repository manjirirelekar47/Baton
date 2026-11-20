/**
 * DashboardLayoutDark.tsx
 * Dedicated Premium Dark Mode Shell for Baton.
 * Features:
 * - Deep glowing purple radial gradient backdrop & pure dark glassmorphism (bg-black/40 border-white/10).
 * - Vibrant glowing purple highlights, crisp white headings, and lavender accents.
 * - Single unified toggle icon on the sidebar's right border edge.
 * - Interactive Theme Toggle calling toggleTheme() to switch to Light Mode.
 * - Dynamic user initials safely extracted from AuthContext.
 * - Smooth stateful margins (lg:pl-64 / lg:pl-20).
 */

import React, { useState, useEffect, type ReactNode, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { OptimizedImage } from "@/components/common/OptimizedImage";
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
  Sun,
  Plus,
  Download,
  X,
} from "lucide-react";
import { useAuth, formatUserDropdownRole } from "../../context/AuthContext";
import { TopHeaderUserMenu } from "./TopHeaderUserMenu";
import { ProfileMenuContent } from "./ProfileMenuContent";
import { useTheme } from "../../context/ThemeContext";
import { batonApi } from "../../api/client";
import { isSupabaseConfigured } from "../../features/auth/supabase";
import { linkGithubIdentity } from "../../features/auth/linkGithubIdentity";
import { ConfirmModal } from "../../shared/ui";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { NotificationsMenu } from "./NotificationsMenu";

interface DashboardLayoutDarkProps {
  children?: ReactNode;
  pendingReviewCount?: number;
}

export const DashboardLayoutDark: React.FC<DashboardLayoutDarkProps> = ({
  children,
  pendingReviewCount = 3,
}) => {
  const { user, loading, switchRole, resetDemo, logout } = useAuth();
  const { toggleTheme } = useTheme();
  const location = useLocation();

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const showLabels = isExpanded || mobileMenuOpen;
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);
  const sidebarProfileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (sidebarProfileRef.current && !sidebarProfileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [profileDropdownOpen]);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [latencyMs, setLatencyMs] = useState<number>(42);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);

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

  // Keyboard Shortcut: ⌘K on macOS or Ctrl+K on Windows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchModalOpen(false);
        setProfileDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Dynamic Document Title based on active page route
  useEffect(() => {
    const titleMap: Record<string, string> = {
      "/": "Dashboard | Baton",
      "/dashboard": "Dashboard | Baton",
      "/sources": "Sources | Baton",
      "/ledger": "Claim Ledger | Baton",
      "/graph": "Knowledge Graph | Baton",
      "/risk": "Risk Radar | Baton",
      "/review": "Review Queue | Baton",
      "/handover": "Handover | Baton",
      "/access": "Access Control | Baton",
      "/audit": "Audit Logs | Baton",
      "/settings": "Settings | Baton",
      "/ask": "Ask Baton | Baton",
    };
    document.title = titleMap[location.pathname] || "Baton";
  }, [location.pathname]);

  const isMac = typeof navigator !== "undefined" && /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent);
  const searchShortcut = isMac ? "⌘ K" : "Ctrl K";

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

  const roleNavAllowed: Record<string, string[]> = {
    approver: ["/dashboard", "/sources", "/ledger", "/graph", "/risk", "/review", "/handover", "/access", "/audit", "/settings"],
    leaver: ["/dashboard", "/ledger", "/graph", "/risk", "/review", "/audit", "/settings"],
    incoming_maintainer: ["/dashboard", "/ledger", "/graph", "/risk", "/review", "/handover", "/settings"],
    contributor: ["/dashboard", "/ledger", "/graph", "/review", "/handover", "/settings"],
    incoming_contributor: ["/dashboard", "/ledger", "/graph", "/review", "/handover", "/settings"],
  };

  const navItems = useMemo(() => {
    const all = [
      { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { name: "Sources", path: "/sources", icon: Plus },
      { name: "Claim Ledger", path: "/ledger", icon: FileText },
      { name: "Knowledge Graph", path: "/graph", icon: Share2 },
      { name: "Risk Radar", path: "/risk", icon: Compass },
      { name: "Review Queue", path: "/review", badge: pendingReviewCount, icon: CheckSquare },
      { name: "Handover", path: "/handover", icon: Download },
      { name: "Access Control", path: "/access", icon: ShieldCheck },
      { name: "Audit Logs", path: "/audit", icon: History },
      { name: "Settings", path: "/settings", icon: Settings },
    ];
    if (!user?.role) return all;
    const allowed = roleNavAllowed[user.role] || roleNavAllowed.approver;
    return all.filter((item) => allowed.includes(item.path));
  }, [user?.role, pendingReviewCount]);

  return (
    <div className="min-h-screen flex bg-transparent text-white font-sans selection:bg-purple-500 selection:text-white relative overflow-x-hidden">
      {/* Hidden Skip to main content link for screen readers */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-xl focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white active:scale-[0.98] transition-all duration-150"
      >
        Skip to main content
      </a>
      {/* Deep Purple / Magenta Ambient Flares */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-900/30 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[550px] h-[550px] bg-indigo-950/40 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-[40%] left-[25%] w-[450px] h-[450px] bg-fuchsia-950/25 rounded-full blur-[150px] pointer-events-none" />

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* =====================================================================
          DARK GLASSMORPHISM SIDEBAR
         ===================================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-black/60 backdrop-blur-2xl border-r border-white/10 shadow-[0_0_35px_rgba(0,0,0,0.7)] flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isExpanded ? "w-64" : "w-20"
        } ${mobileMenuOpen ? "translate-x-0 !w-64" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Unified Single Expand / Collapse Toggle on Sidebar Border Edge */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="hidden lg:flex absolute -right-3.5 top-6 z-50 items-center justify-center w-7 h-7 rounded-full bg-slate-900 border border-white/20 shadow-md text-purple-300 hover:text-white hover:border-purple-500 transition-all hover:scale-110 focus:outline-none cursor-pointer"
          title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          aria-label={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isExpanded ? (
            <ChevronLeft className="w-4 h-4 text-purple-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-purple-300 hover:text-white" />
          )}
        </button>

        <div className="px-3.5 py-5 flex flex-col">
          {/* Logo Brand Header & Mobile Close */}
          <div className="mb-4 flex items-center justify-between">
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 focus:outline-none transition-all duration-200"
              aria-label="Baton Dashboard"
            >
              <OptimizedImage
                src="/assets/baton-logo.png"
                alt="Baton"
                width={36}
                height={36}
                priority
                className="h-9 w-9 object-contain flex-shrink-0 brightness-110 drop-shadow-[0_0_12px_rgba(168,85,247,0.4)]"
              />
              {showLabels && (
                <span className="text-2xl font-extrabold text-indigo-950 dark:text-white tracking-tight whitespace-nowrap">
                  Baton
                </span>
              )}
            </Link>
            {mobileMenuOpen && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 focus:outline-none transition-colors"
                aria-label="Close mobile menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation Items (Glowing Dark Mode Pill Design) */}
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
                  aria-label={item.name}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group relative flex items-center transition-all duration-200 active:scale-[0.98] ${
                    showLabels
                      ? "px-3.5 py-2.5 rounded-xl gap-3"
                      : "w-11 h-11 mx-auto justify-center rounded-xl"
                  } ${
                    isActive
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)] font-semibold"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <IconComponent
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                    }`}
                  />

                  {showLabels && (
                    <span className="text-sm font-medium truncate flex-1">{item.name}</span>
                  )}

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`font-bold rounded-full bg-purple-600 text-white shadow-xs ${
                        showLabels
                          ? "px-2 py-0.5 text-[10px]"
                          : "absolute -top-1 -right-1 w-4 h-4 text-[9px] flex items-center justify-center"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {!showLabels && (
                    <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-black/90 border border-white/20 text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50">
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
        <div className="p-3 border-t border-white/10 relative" ref={sidebarProfileRef}>
          <button
            type="button"
            onClick={() => setProfileDropdownOpen((prev) => !prev)}
            className={`w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 rounded-2xl transition-all text-left focus:outline-none flex items-center ${
              showLabels ? "p-2.5 justify-between" : "p-2 justify-center"
            }`}
            aria-expanded={profileDropdownOpen}
            title={user ? formatUserDropdownRole(user) : "User Profile"}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                {loading || !user ? (
                  <div className="w-10 h-10 rounded-xl bg-slate-800 animate-pulse" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-purple-500/25">
                    {userInitials || "U"}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
              </div>

              {showLabels && (
                <div className="min-w-0 flex-1">
                  {loading || !user ? (
                    <div className="space-y-1">
                      <div className="w-20 h-3.5 bg-slate-800 rounded animate-pulse" />
                      <div className="w-14 h-2.5 bg-slate-700 rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-white truncate leading-snug">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-purple-300 font-medium truncate">
                        {user.displayRole || user.role}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {showLabels && (
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
                  profileDropdownOpen ? "rotate-180" : ""
                }`}
              />
            )}
          </button>

          {/* Role Switcher Popover */}
          {profileDropdownOpen && (
            <ProfileMenuContent
              theme="dark"
              onClose={() => setProfileDropdownOpen(false)}
              onOpenResetModal={() => setIsResetModalOpen(true)}
              className={`absolute bottom-16 ${showLabels ? "left-3 right-3" : "left-20 w-64"}`}
            />
          )}
        </div>
      </aside>

      {/* =====================================================================
          MAIN VIEWPORT & DYNAMIC PADDING ADJUSTMENT (DARK MODE)
         ===================================================================== */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isExpanded ? "lg:pl-64" : "lg:pl-20"
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-black/40 backdrop-blur-xl border-b border-white/10 shadow-xs px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 w-full max-w-full">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Mobile Drawer Trigger ONLY */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/20 focus:outline-none"
              aria-label="Open mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div
            onClick={() => setSearchModalOpen(true)}
            className="relative flex-1 max-w-md cursor-pointer group min-w-0"
          >
            <div className="w-full bg-white/5 hover:bg-white/10 focus-within:bg-white/10 backdrop-blur-md border border-white/10 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-3 text-gray-400 shadow-xs transition-all group-hover:border-purple-500/50">
              <Search className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span className="text-xs text-gray-400 truncate select-none hidden sm:inline">
                Search claims, sources, or team members...
              </span>
              <span className="text-xs text-gray-400 truncate select-none sm:hidden">
                Search...
              </span>
              <kbd className="ml-auto hidden md:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold text-gray-300 bg-white/10 rounded border border-white/10 shadow-xs">
                {searchShortcut}
              </kbd>
            </div>
          </div>

          {/* Right Header Telemetry & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Live Connection Telemetry Pill */}
            <div
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 shadow-xs text-xs font-medium text-emerald-300"
              title={`${isConnected ? "Connected" : "Reconnecting"} (${latencyMs}ms)`}
            >
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
              <span className="font-semibold text-emerald-200 hidden sm:inline">
                {isConnected ? "Connected" : "Reconnecting"}
              </span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-emerald-400 text-[10px] sm:text-[11px] font-mono">{latencyMs}ms</span>
            </div>

            {/* Project Switcher */}
            <ProjectSwitcher />

            {/* Theme Toggle Button -> Switches to Light Mode */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-amber-300 transition-colors shadow-xs cursor-pointer focus:outline-none flex-shrink-0"
              title="Switch to Light Mode"
              aria-label="Switch to Light Mode"
            >
              <Sun className="w-4 h-4 text-amber-400" />
            </button>

            <NotificationsMenu theme="dark" />

            {/* Top Right User Avatar (hidden on mobile header; profile is in drawer/bottom nav) */}
            <div className="hidden sm:block">
              <TopHeaderUserMenu
                theme="dark"
                userInitials={userInitials}
                onOpenResetModal={() => setIsResetModalOpen(true)}
              />
            </div>
          </div>
        </header>

        {/* Dynamic Main Page Content */}
        <main id="main-content" className="flex-1 p-3 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-[1600px] w-full mx-auto min-w-0">{children}</main>

        {/* Mobile Persistent Bottom Navigation Bar */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 flex items-center justify-around shadow-2xl"
          aria-label="Mobile quick navigation"
        >
          <Link
            to="/dashboard"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition-colors ${
              location.pathname === "/" || location.pathname === "/dashboard"
                ? "text-purple-400 font-semibold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Dashboard</span>
          </Link>

          <Link
            to="/sources"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition-colors ${
              location.pathname.startsWith("/sources")
                ? "text-purple-400 font-semibold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Plus className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Sources</span>
          </Link>

          <Link
            to="/ledger"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition-colors ${
              location.pathname.startsWith("/ledger")
                ? "text-purple-400 font-semibold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FileText className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Ledger</span>
          </Link>

          <Link
            to="/handover"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition-colors ${
              location.pathname.startsWith("/handover")
                ? "text-purple-400 font-semibold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Download className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Handover</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center py-1 px-2 rounded-xl text-gray-400 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">More</span>
          </button>
        </nav>
      </div>

      {/* ⌘K SEARCH MODAL */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
          <div className="w-full max-w-xl bg-slate-950 rounded-3xl shadow-xl shadow-black/40 border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-white">
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <Search className="w-5 h-5 text-purple-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search claims, decisions, owners, or evidence..."
                className="w-full text-sm text-white placeholder-gray-500 bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/10 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                ESC
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto space-y-2 text-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">
                Suggested Quick Jumps
              </p>
              <div
                onClick={() => {
                  setSearchModalOpen(false);
                  window.location.assign("/sources");
                }}
                className="p-2.5 rounded-xl hover:bg-white/5 cursor-pointer flex items-center justify-between border border-transparent hover:border-purple-500/30 transition-colors"
              >
                <div>
                  <p className="font-semibold text-white">Sources</p>
                  <p className="text-gray-400 text-[11px]">Connect GitHub, Jira, Slack & Confluence</p>
                </div>
                <span className="text-[10px] font-bold text-purple-400">Connect →</span>
              </div>
              <div
                onClick={() => {
                  setSearchModalOpen(false);
                  window.location.assign("/ledger");
                }}
                className="p-2.5 rounded-xl hover:bg-white/5 cursor-pointer flex items-center justify-between border border-transparent hover:border-purple-500/30 transition-colors"
              >
                <div>
                  <p className="font-semibold text-white">Claim Ledger</p>
                  <p className="text-gray-400 text-[11px]">Reconstruct project state • 14 claims</p>
                </div>
                <span className="text-[10px] font-bold text-purple-400">Open →</span>
              </div>
              <div
                onClick={() => {
                  setSearchModalOpen(false);
                  window.location.assign("/review");
                }}
                className="p-2.5 rounded-xl hover:bg-white/5 cursor-pointer flex items-center justify-between border border-transparent hover:border-purple-500/30 transition-colors"
              >
                <div>
                  <p className="font-semibold text-white">Review Queue</p>
                  <p className="text-gray-400 text-[11px]">3 pending items requiring human decision</p>
                </div>
                <span className="text-[10px] font-bold text-purple-400">Review →</span>
              </div>
              <div
                onClick={() => {
                  setSearchModalOpen(false);
                  window.location.assign("/handover");
                }}
                className="p-2.5 rounded-xl hover:bg-white/5 cursor-pointer flex items-center justify-between border border-transparent hover:border-purple-500/30 transition-colors"
              >
                <div>
                  <p className="font-semibold text-white">Handover</p>
                  <p className="text-gray-400 text-[11px]">Download verified handover package & checklist</p>
                </div>
                <span className="text-[10px] font-bold text-purple-400">Export →</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reset Demo */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Reset Demo Data"
        message="Restore sample demo project data in backend? This will reinitialize claims, sources, and review tasks."
        confirmLabel={resetting ? "Resetting..." : "Reset Data"}
        confirmVariant="danger"
        isLoading={resetting}
        onConfirm={async () => {
          setResetting(true);
          try {
            await resetDemo();
          } finally {
            setResetting(false);
            setIsResetModalOpen(false);
          }
        }}
        onCancel={() => setIsResetModalOpen(false)}
      />
    </div>
  );
};

export default DashboardLayoutDark;

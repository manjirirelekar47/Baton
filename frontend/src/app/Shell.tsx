import { useState, useEffect } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { ErrorState, Loading } from "@/shared/ui";
import { useAuth } from "./auth";
import { ProgressBar } from "./ProgressBar";
import { RoleSwitcher } from "./RoleSwitcher";
import { ROLE_LABELS, type Role } from "@/shared/types";

export function Shell() {
  const { user, loading, error, resetDemo, switchRole } = useAuth();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Keyboard shortcut ⌘K or Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function reset() {
    if (!window.confirm("Reset the demo project? Receipts, owner responses and the audit trail will be cleared.")) return;
    setResetting(true);
    try {
      await resetDemo();
      window.location.assign("/");
    } finally {
      setResetting(false);
    }
  }

  // Helper for human-readable role subtitle
  const roleSubtitle =
    user?.role === "approver"
      ? "Engineering Lead"
      : user?.role === "leaver"
        ? "Lead Engineer (Leaver)"
        : user?.role === "incoming_maintainer"
          ? "Incoming Maintainer"
          : "Incoming Contributor";

  return (
    <div className="min-h-screen flex bg-[#F1F5F9] text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* BEGIN: LeftSidebar */}
      <aside
        className={`w-64 bg-[#0B0F19] text-slate-300 flex-shrink-0 flex flex-col justify-between border-r border-slate-800/80 fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-6">
          {/* Logo */}
          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 mb-8 group focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white font-extrabold text-2xl tracking-tighter group-hover:scale-105 transition-transform">
              B
            </div>
            <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1">
              Baton
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1.5" aria-label="Main sidebar navigation">
            <NavLink
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`
              }
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/sources"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`
              }
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Connect Sources</span>
            </NavLink>

            <NavLink
              to="/risk"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`
              }
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Risk Radar</span>
            </NavLink>

            <NavLink
              to="/review"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`
              }
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Review Queue</span>
            </NavLink>

            <NavLink
              to="/handover"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`
              }
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Handover Package</span>
            </NavLink>

            <NavLink
              to="/ledger"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`
              }
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Claim Ledger</span>
            </NavLink>
          </nav>
        </div>

        {/* Bottom Promo / Mission Card */}
        <div className="p-4 m-4 rounded-2xl bg-gradient-to-b from-[#181D33] to-[#121626] border border-slate-700/60 shadow-xl relative overflow-hidden">
          <div className="absolute -right-3 -top-3 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl"></div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center justify-center p-1 rounded bg-indigo-500/20 text-indigo-400">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
              </svg>
            </span>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Pro Enterprise</span>
          </div>
          <h4 className="text-sm font-semibold text-white">Built for Better Transitions</h4>
          <p className="text-xs text-slate-400 mt-1">Autonomous verified handover engine enabled.</p>
        </div>
      </aside>
      {/* END: LeftSidebar */}

      {/* BEGIN: MainContentWrapper */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0 min-h-screen">
        {/* BEGIN: TopBar */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-200/90 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 w-full max-w-xl">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 md:hidden"
              aria-label="Open mobile navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
            </button>

            {/* Search Bar */}
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={() => setShowSearchModal(true)}
                className="w-full pl-10 pr-12 py-2 text-sm bg-slate-100/80 hover:bg-slate-100 focus:bg-white border-transparent focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl transition placeholder:text-slate-400 text-slate-700"
                placeholder="Search projects, claims, or people..."
                type="text"
              />
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded">
                  ⌘K
                </kbd>
              </span>
            </div>
          </div>

          {/* Action items */}
          <div className="flex items-center gap-3">
            {/* Role Switcher Pill */}
            <div className="hidden sm:block">
              <RoleSwitcher />
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                aria-label="Notifications"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full ring-2 ring-white"></span>
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-800">Notifications</span>
                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-100">
                      <p className="font-semibold text-slate-800">Handover Package ready for signoff</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">Campus Event Portal passed 24 verification checks.</p>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-100">
                      <p className="font-semibold text-slate-800">1 Blocker identified in PR #482</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">High priority review action recommended.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Badge & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2.5 pl-2 border-l border-slate-200 cursor-pointer focus:outline-none"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-900 text-indigo-100 font-bold text-sm flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-slate-200">
                  {user?.name ? user.name.charAt(0).toUpperCase() : "S"}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight">
                    {user?.name || "Samruddhi"}
                  </p>
                  <p className="text-[11px] text-slate-400">{roleSubtitle}</p>
                </div>
                <svg className="w-4 h-4 text-slate-400 hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 text-xs space-y-2">
                  <div className="pb-2 border-b border-slate-100 px-2 pt-1">
                    <p className="font-bold text-slate-900 text-sm">{user?.name || "Samruddhi"}</p>
                    <p className="text-slate-400 text-[11px]">Role: {user?.role ? ROLE_LABELS[user.role] : "Approver"}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="px-2 pt-1 font-semibold text-slate-400 uppercase text-[10px]">Switch Demo Persona</p>
                    {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          setShowProfileMenu(false);
                          void switchRole(r);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg transition ${
                          user?.role === r
                            ? "bg-indigo-50 text-indigo-700 font-bold"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <button
                      disabled={resetting}
                      onClick={() => {
                        setShowProfileMenu(false);
                        void reset();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition flex items-center justify-between"
                    >
                      <span>Reset Demo Project</span>
                      {resetting && <span className="text-[10px] text-indigo-600">Resetting...</span>}
                    </button>
                    <Link
                      to="/login"
                      onClick={() => setShowProfileMenu(false)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition block"
                    >
                      Sign In / Switch Account
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        {/* END: TopBar */}

        {/* Five-step progress bar */}
        <ProgressBar />

        {/* Main Page Area */}
        <main className="p-6 md:p-8 flex-1">
          {loading && <Loading label="Connecting to Baton verified handover engine" />}
          {!loading && error && (
            <ErrorState title="Could not load project" detail={error} onRetry={() => window.location.reload()} />
          )}
          {!loading && !error && <Outlet />}
        </main>

        {/* BEGIN: Footer */}
        <footer className="border-t border-slate-200/80 py-6 px-8 text-center text-xs text-slate-400 bg-white">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© 2025 Baton Inc. AI-Powered Project Continuity & Handover Engine.</p>
            <div className="flex items-center gap-4">
              <a className="hover:text-slate-600 transition" href="#privacy">
                Privacy Policy
              </a>
              <a className="hover:text-slate-600 transition" href="#security">
                SOC2 Certified
              </a>
              <a className="hover:text-slate-600 transition" href="#terms">
                Terms of Service
              </a>
              <a className="hover:text-slate-600 transition" href="#help">
                Support Center
              </a>
            </div>
          </div>
        </footer>
        {/* END: Footer */}
      </div>

      {/* Global ⌘K Search Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search claims, people, risk signals, or docs..."
                className="w-full text-sm outline-none placeholder:text-slate-400"
                autoFocus
              />
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-500 font-semibold"
              >
                ESC
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Quick Jump</p>
              <div
                onClick={() => {
                  setShowSearchModal(false);
                  navigate("/risk");
                }}
                className="p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer border border-transparent hover:border-slate-100"
              >
                <span className="font-medium text-slate-800">Risk Radar: Payments Module single owner flag</span>
                <span className="text-slate-400">/risk</span>
              </div>
              <div
                onClick={() => {
                  setShowSearchModal(false);
                  navigate("/review");
                }}
                className="p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer border border-transparent hover:border-slate-100"
              >
                <span className="font-medium text-slate-800">Review Queue: 24 verified claims, 3 blockers</span>
                <span className="text-slate-400">/review</span>
              </div>
              <div
                onClick={() => {
                  setShowSearchModal(false);
                  navigate("/handover");
                }}
                className="p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer border border-transparent hover:border-slate-100"
              >
                <span className="font-medium text-slate-800">Handover Workspace: Day-1 Plan for Priya Sharma</span>
                <span className="text-slate-400">/handover</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Button, ErrorState, Loading } from "@/shared/ui";
import { useAuth } from "./auth";
import { ProgressBar } from "./ProgressBar";
import { RoleSwitcher } from "./RoleSwitcher";
import { navEntries } from "./features";

export function Shell() {
  const { user, loading, error, resetDemo } = useAuth();
  const [resetting, setResetting] = useState(false);

  async function reset() {
    if (!window.confirm("Reset the demo project? Receipts, owner responses and the audit trail are cleared.")) return;
    setResetting(true);
    try {
      await resetDemo();
      window.location.assign("/");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-olive text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl">Baton</span>
            <span className="hidden text-sm text-[var(--leaf)] sm:inline">Campus Event Portal (synthetic demo data)</span>
          </div>
          <div className="flex items-center gap-3">
            <RoleSwitcher />
            <Button variant="quiet" onClick={() => void reset()} disabled={resetting}>
              {resetting ? "Resetting" : "Reset demo"}
            </Button>
          </div>
        </div>
        <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 pb-2 text-sm">
          {navEntries.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              className={({ isActive }) => (isActive ? "font-semibold underline underline-offset-4" : "text-[var(--leaf)] hover:text-white")}
            >
              {entry.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <ProgressBar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {loading && <Loading label="Signing in" />}
        {!loading && error && <ErrorState title="Could not sign in" detail={error} onRetry={() => window.location.reload()} />}
        {!loading && !error && user && <Outlet />}
      </main>
    </div>
  );
}

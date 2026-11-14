import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ClaimState } from "./types";

interface StateVisual {
  lightClass: string;
  darkClass: string;
  mark: string;
}

const STATE_CONFIG: Record<ClaimState, StateVisual> = {
  verified: {
    lightClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    darkClass: "dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30 dark:shadow-[0_0_10px_rgba(16,185,129,0.2)]",
    mark: "✓",
  },
  inferred: {
    lightClass: "bg-amber-50 text-amber-800 border-amber-200",
    darkClass: "dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30 dark:shadow-[0_0_10px_rgba(245,158,11,0.2)]",
    mark: "☆",
  },
  conflicting: {
    lightClass: "bg-rose-50 text-rose-700 border-rose-200",
    darkClass: "dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/30 dark:shadow-[0_0_10px_rgba(244,63,94,0.2)]",
    mark: "⚠",
  },
  missing: {
    lightClass: "bg-slate-50 text-slate-600 border-slate-200",
    darkClass: "dark:bg-white/5 dark:text-slate-300 dark:border-white/10",
    mark: "?",
  },
  attested: {
    lightClass: "bg-purple-50 text-purple-700 border-purple-200",
    darkClass: "dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/30 dark:shadow-[0_0_10px_rgba(168,85,247,0.2)]",
    mark: "✎",
  },
};

/** Text label plus a symbol: state is never conveyed by colour alone. Matches clean light and dark themes. */
export function StateBadge({ state }: { state: ClaimState }) {
  const config = STATE_CONFIG[state] ?? STATE_CONFIG.missing;
  const name = STATE_CONFIG[state] ? state : "missing";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border shadow-xs transition-all ${config.lightClass} ${config.darkClass}`}
    >
      <span aria-hidden="true" className="font-extrabold">{config.mark}</span>
      <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" }) {
  const base =
    "rounded-xl px-4 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer";
  const look =
    variant === "primary"
      ? "btn-glow-purple text-white shadow-sm"
      : "border border-slate-200/90 dark:border-white/15 bg-white dark:bg-white/5 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white shadow-xs";
  return (
    <button type="button" {...props} className={`${base} ${look} ${className}`}>
      {children}
    </button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/15 bg-white/80 dark:bg-black/40 backdrop-blur-xl p-8 text-center shadow-xs">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-300 mb-3 text-lg font-bold shadow-xs">
        📋
      </div>
      <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-prose text-xs text-slate-500 dark:text-gray-400 leading-relaxed">{children}</div>}
    </div>
  );
}

export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/40 backdrop-blur-xl p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-rose-600 dark:text-rose-400 font-bold">⚠</span>
        <h2 className="text-base font-bold text-rose-900 dark:text-rose-200">{title}</h2>
      </div>
      {detail && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{detail}</p>}
      {onRetry && (
        <Button variant="quiet" className="mt-4 border-rose-200 dark:border-rose-500/40 bg-white dark:bg-rose-950/60 hover:bg-rose-50 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="p-8 flex items-center justify-center gap-3 text-xs font-semibold text-slate-500 dark:text-purple-300">
      <svg className="animate-spin h-5 w-5 text-purple-600 dark:text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>{label}…</span>
    </div>
  );
}

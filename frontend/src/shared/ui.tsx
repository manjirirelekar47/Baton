import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ClaimState } from "./types";

interface StateVisual {
  badgeClass: string;
  mark: string;
}

const STATE_CONFIG: Record<ClaimState, StateVisual> = {
  verified: {
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    mark: "✓",
  },
  inferred: {
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    mark: "☆",
  },
  conflicting: {
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    mark: "⚠",
  },
  missing: {
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    mark: "?",
  },
  attested: {
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    mark: "✎",
  },
};

/** Text label plus a symbol: state is never conveyed by colour alone. Matches clean tinted-glass dark and light themes. */
export function StateBadge({ state }: { state: ClaimState }) {
  const config = STATE_CONFIG[state] ?? STATE_CONFIG.missing;
  const name = STATE_CONFIG[state] ? state : "missing";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-xs transition-all ${config.badgeClass}`}
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
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" }) {
  const base =
    "rounded-xl px-4 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-2.5 leading-none cursor-pointer";
  const look =
    variant === "primary"
      ? "btn-glow-purple text-white shadow-sm"
      : "bg-transparent hover:bg-white/5 border border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-xs";
  return (
    <button type="button" disabled={disabled} {...props} className={`${base} ${look} ${className}`}>
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  children,
  actionLabel,
  onAction,
}: {
  title: string;
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-white/80 dark:bg-black/40 backdrop-blur-xl p-8 text-center shadow-xl shadow-black/20">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-300 mb-3 text-lg font-bold shadow-xs">
        📋
      </div>
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      {children && (
        <div className="mx-auto mt-2 max-w-prose text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {children}
        </div>
      )}
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
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

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/40 border border-slate-300/30 dark:border-white/5 ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 p-5 space-y-3 animate-pulse shadow-sm">
      <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
      <div className="h-3 w-3/4 bg-slate-200/70 dark:bg-slate-800/60 rounded" />
      <div className="h-3 w-1/2 bg-slate-200/50 dark:bg-slate-800/40 rounded" />
    </div>
  );
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  isLoading = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 shadow-xl shadow-black/40 bg-white dark:bg-[#121424] p-6 space-y-4 text-slate-900 dark:text-slate-100">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
          <Button variant="quiet" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isLoading}
            className={
              confirmVariant === "danger"
                ? "bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-rose-500/20"
                : "bg-purple-600 hover:bg-purple-700 text-white font-bold"
            }
          >
            {isLoading ? "Processing…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

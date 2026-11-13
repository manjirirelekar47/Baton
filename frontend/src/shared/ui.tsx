import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ClaimState } from "./types";

const STATE_STYLE: Record<ClaimState, { bg: string; mark: string; border: string; text: string }> = {
  verified: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", mark: "✓" },
  inferred: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", mark: "≈" },
  conflicting: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", mark: "≠" },
  missing: { bg: "#f8fafc", border: "#e2e8f0", text: "#475569", mark: "?" },
  attested: { bg: "#faf5ff", border: "#e9d5ff", text: "#6b21a8", mark: "✎" },
};

/** Text label plus a symbol: state is never conveyed by colour alone. */
export function StateBadge({ state }: { state: ClaimState }) {
  const style = STATE_STYLE[state] ?? STATE_STYLE.missing;
  const name = STATE_STYLE[state] ? state : "missing";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider border shadow-xs"
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text,
      }}
    >
      <span aria-hidden="true" className="font-extrabold">{style.mark}</span>
      {name.charAt(0).toUpperCase() + name.slice(1)}
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
      ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs";
  return (
    <button type="button" {...props} className={`${base} ${look} ${className}`}>
      {children}
    </button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-card-soft">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 text-lg font-bold">
        📋
      </div>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-prose text-xs text-slate-500 leading-relaxed">{children}</div>}
    </div>
  );
}

export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 shadow-card-soft">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-rose-600 font-bold">⚠</span>
        <h2 className="text-base font-bold text-rose-900">{title}</h2>
      </div>
      {detail && <p className="mt-1 text-xs text-rose-700 leading-relaxed">{detail}</p>}
      {onRetry && (
        <Button variant="quiet" className="mt-4 border-rose-200 bg-white hover:bg-rose-50 text-rose-800" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="p-8 flex items-center justify-center gap-3 text-xs font-semibold text-slate-500">
      <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>{label}…</span>
    </div>
  );
}

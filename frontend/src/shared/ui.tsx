import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ClaimState } from "./types";

const STATE_STYLE: Record<ClaimState, { bg: string; mark: string }> = {
  verified: { bg: "var(--verified)", mark: "✓" },
  inferred: { bg: "var(--inferred)", mark: "≈" },
  conflicting: { bg: "var(--conflicting)", mark: "≠" },
  missing: { bg: "var(--missing)", mark: "?" },
  attested: { bg: "var(--attested)", mark: "✎" },
};

/** Text label plus a symbol: state is never conveyed by colour alone. */
export function StateBadge({ state }: { state: ClaimState }) {
  const style = STATE_STYLE[state] ?? STATE_STYLE.missing;
  const name = STATE_STYLE[state] ? state : "missing";
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: style.bg }}
    >
      <span aria-hidden="true">{style.mark}</span>
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
    "rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const look =
    variant === "primary" ? "bg-olive text-white hover:bg-[#3d4a20]" : "border border-line bg-card text-ink hover:bg-wash";
  return (
    <button type="button" {...props} className={`${base} ${look} ${className}`}>
      {children}
    </button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-card p-8 text-center">
      <h2 className="font-display text-xl text-olive">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-prose text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-[var(--conflicting)] bg-card p-6">
      <h2 className="font-display text-lg text-[var(--conflicting)]">{title}</h2>
      {detail && <p className="mt-1 text-sm">{detail}</p>}
      {onRetry && (
        <Button variant="quiet" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="p-6 text-sm text-muted">
      {label}…
    </p>
  );
}

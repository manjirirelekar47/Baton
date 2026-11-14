/** Restricted items arrive as a count only: no title, quote, type or source. */
export function HiddenPlaceholder({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div
      role="note"
      className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-950/30 backdrop-blur-xl px-4 py-3 text-xs text-amber-200 flex items-center gap-2.5 shadow-lg"
    >
      <span aria-hidden="true" className="text-amber-400 font-bold text-sm">🔒</span>
      <span>
        <strong className="text-amber-300">{count} {count === 1 ? "item is" : "items are"}</strong> hidden because of access level. Ask the approver if you need {count === 1 ? "it" : "them"}.
      </span>
    </div>
  );
}

/** Restricted items arrive as a count only: no title, quote, type or source. */
export function HiddenPlaceholder({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p role="note" className="rounded-md border border-dashed border-line bg-wash px-3 py-2 text-sm">
      {count} {count === 1 ? "item is" : "items are"} hidden because of access level. Ask the approver if you need {count === 1 ? "it" : "them"}.
    </p>
  );
}

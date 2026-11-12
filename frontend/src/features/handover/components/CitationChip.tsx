import type { EvidenceView } from "../api";

export function CitationChip({ evidence, onOpen }: { evidence: EvidenceView; onOpen: (e: EvidenceView) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(evidence)}
      aria-label={`Open source ${evidence.chunk_id} with the quote highlighted`}
      className="inline-flex max-w-full items-center gap-1 rounded border border-line bg-paper px-2 py-0.5 text-xs text-ink hover:bg-wash"
    >
      <span className="font-semibold">{evidence.chunk_id}</span>
      <span className="truncate text-muted">{evidence.source_title}</span>
    </button>
  );
}

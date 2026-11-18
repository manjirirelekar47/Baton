import type { EvidenceView } from "../api";

export function CitationChip({ evidence, onOpen }: { evidence: EvidenceView; onOpen: (e: EvidenceView) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(evidence)}
      aria-label={`Open source ${evidence.chunk_id} with the quote highlighted`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-200 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/40 px-3 py-1 text-xs text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors shadow-xs active:scale-[0.98] transition-all duration-150 cursor-pointer"
    >
      <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400">{evidence.chunk_id}</span>
      <span className="truncate text-cyan-900 dark:text-cyan-200/80">{evidence.source_title}</span>
      <span aria-hidden="true" className="text-cyan-700 dark:text-cyan-400">↗</span>
    </button>
  );
}

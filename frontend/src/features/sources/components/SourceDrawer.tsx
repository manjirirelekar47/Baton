import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "@/app/api";
import { useAuth } from "@/app/auth";
import { ErrorState, Loading } from "@/shared/ui";
import { splitAroundQuote } from "../highlight";

interface Chunk {
  chunk_id: string;
  source_title: string;
  author: string;
  event_time: string;
  acl_label: string;
  text: string;
}

/** STUB (Bhavesh replaces). Contract: SourceDrawer({ chunkId, quote, onClose }) opens the chunk with the quote highlighted. */
export function SourceDrawer({ chunkId, quote, onClose }: { chunkId: string; quote: string; onClose: () => void }) {
  const { user } = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["chunk", chunkId, user?.id],
    queryFn: () => api<Chunk>(`/chunks/${encodeURIComponent(chunkId)}`),
  });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parts = data ? splitAroundQuote(data.text, quote) : null;
  return (
    <aside role="dialog" aria-modal="true" aria-label="Source" className="fixed inset-y-0 right-0 z-20 w-full max-w-md overflow-y-auto border-l border-line bg-card p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl text-olive">Source {chunkId}</h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-md border border-line bg-card px-3 py-1.5 text-sm font-medium hover:bg-wash"
        >
          Close
        </button>
      </div>
      {isLoading && <Loading label="Opening source" />}
      {error && <ErrorState title="Could not open this source" detail={(error as Error).message} onRetry={() => void refetch()} />}
      {data && parts && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-muted">
            {data.source_title}, written by {data.author} on {new Date(data.event_time).toLocaleDateString()}. Access {data.acl_label}.
          </p>
          <p className="whitespace-pre-wrap rounded-md border border-line bg-paper p-3 leading-relaxed">
            {parts.before}
            {parts.found && <mark>{parts.match}</mark>}
            {parts.after}
          </p>
          {!parts.found && (
            <p role="alert" className="text-[var(--conflicting)]">
              The quoted text was not found in this source passage. Treat this claim as unverified.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

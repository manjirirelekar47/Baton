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
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Source"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white/95 backdrop-blur-2xl p-6 shadow-2xl text-slate-900"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
            Source Chunk
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">{chunkId}</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
      {isLoading && <Loading label="Opening source" />}
      {error && <ErrorState title="Could not open this source" detail={(error as Error).message} onRetry={() => void refetch()} />}
      {data && parts && (
        <div className="mt-4 space-y-4 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700 space-y-1">
            <div className="font-bold text-slate-900 text-sm">{data.source_title}</div>
            <div className="text-slate-500">
              Author: <span className="text-slate-800 font-medium">{data.author}</span> • Date:{" "}
              <span className="text-slate-800 font-medium">{new Date(data.event_time).toLocaleDateString()}</span>
            </div>
            <div className="text-slate-500">
              Classification: <span className="font-mono font-bold text-purple-700">{data.acl_label}</span>
            </div>
          </div>
          <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 leading-relaxed max-h-[60vh] overflow-y-auto shadow-inner">
            {parts.before}
            {parts.found && (
              <mark className="bg-purple-100 text-purple-900 border-b-2 border-purple-600 px-1 py-0.5 rounded font-semibold">
                {parts.match}
              </mark>
            )}
            {parts.after}
          </div>
          {!parts.found && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
              The quoted text was not found in this source passage. Treat this claim as unverified.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

import React from "react";
import {
  X,
  User,
  Box,
  CheckSquare,
  ShieldCheck,
  FileText,
  ExternalLink,
  GitCommit,
  GitPullRequest,
  ArrowRight,
  Info,
} from "lucide-react";
import { GraphNode, GraphEdge } from "@/api/client";

interface NodeDetailsPanelProps {
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  connectedEdges: GraphEdge[];
  nodesMap: Map<string, GraphNode>;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onInspectEvidence: (chunkId: string, quote: string) => void;
  isDark: boolean;
}

const typeConfig: Record<
  string,
  { label: string; icon: React.FC<{ className?: string }>; badgeDark: string; badgeLight: string }
> = {
  person: {
    label: "Person",
    icon: User,
    badgeDark: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    badgeLight: "bg-blue-50 text-blue-700 border-blue-200",
  },
  module: {
    label: "Module",
    icon: Box,
    badgeDark: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    badgeLight: "bg-purple-50 text-purple-700 border-purple-200",
  },
  task: {
    label: "Task",
    icon: CheckSquare,
    badgeDark: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    badgeLight: "bg-amber-50 text-amber-700 border-amber-200",
  },
  claim: {
    label: "Claim",
    icon: ShieldCheck,
    badgeDark: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    badgeLight: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  source: {
    label: "Source",
    icon: FileText,
    badgeDark: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    badgeLight: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
};

export const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
  selectedNode,
  selectedEdge,
  connectedEdges,
  nodesMap,
  onClose,
  onSelectNode,
  onInspectEvidence,
  isDark,
}) => {
  if (!selectedNode && !selectedEdge) return null;

  // If user selected an edge
  if (selectedEdge && !selectedNode) {
    const sourceNode = nodesMap.get(selectedEdge.source);
    const targetNode = nodesMap.get(selectedEdge.target);

    return (
      <aside
        className={`w-full lg:w-96 rounded-2xl p-5 border flex flex-col max-h-[600px] overflow-y-auto transition-all ${
          isDark
            ? "bg-slate-900/90 backdrop-blur-xl border-white/10 text-white shadow-2xl"
            : "bg-white border-slate-200 text-slate-900 shadow-lg"
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
              Relationship Inspector
            </span>
            <h3 className="text-base font-bold flex items-center gap-1.5 mt-0.5">
              <span>{selectedEdge.relation}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg ${
              isDark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500"
            }`}
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 py-4 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="truncate flex-1">
              <span className="text-[10px] text-slate-400 block">From</span>
              <button
                type="button"
                onClick={() => sourceNode && onSelectNode(sourceNode.id)}
                className="font-bold hover:underline truncate text-left"
              >
                {sourceNode?.label || selectedEdge.source}
              </button>
            </div>
            <ArrowRight className="w-4 h-4 text-purple-400 mx-2 shrink-0" />
            <div className="truncate flex-1 text-right">
              <span className="text-[10px] text-slate-400 block">To</span>
              <button
                type="button"
                onClick={() => targetNode && onSelectNode(targetNode.id)}
                className="font-bold hover:underline truncate text-right"
              >
                {targetNode?.label || selectedEdge.target}
              </button>
            </div>
          </div>

          {selectedEdge.evidence && selectedEdge.evidence.length > 0 ? (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Supporting Evidence ({selectedEdge.evidence.length})
              </span>
              {selectedEdge.evidence.map((ev, idx) => (
                <div
                  key={`${ev.chunk_id || idx}`}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1.5"
                >
                  {ev.quote && (
                    <blockquote className="italic text-[11px] text-slate-600 dark:text-slate-300 border-l-2 border-purple-400 pl-2">
                      "{ev.quote}"
                    </blockquote>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-purple-600 dark:text-purple-300 truncate">
                      {ev.source_title || ev.chunk_id || "Evidence Record"}
                    </span>
                    {ev.chunk_id && (
                      <button
                        type="button"
                        onClick={() => onInspectEvidence(ev.chunk_id!, ev.quote || "")}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200 cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-xs italic">
              Direct relationship inferred from verified project data.
            </p>
          )}
        </div>
      </aside>
    );
  }

  // User selected a node
  if (!selectedNode) return null;

  const nodeType = typeConfig[selectedNode.type] || typeConfig.module;
  const TypeIcon = nodeType.icon;

  // Group connected entities by relationship
  const relationships: Record<
    string,
    { relation: string; otherNode: GraphNode; edge: GraphEdge; direction: "outgoing" | "incoming" }[]
  > = {};

  connectedEdges.forEach((edge) => {
    const isSource = edge.source === selectedNode.id;
    const otherId = isSource ? edge.target : edge.source;
    const other = nodesMap.get(otherId);
    if (!other) return;

    const relKey = edge.relation;
    if (!relationships[relKey]) {
      relationships[relKey] = [];
    }
    relationships[relKey].push({
      relation: edge.relation,
      otherNode: other,
      edge,
      direction: isSource ? "outgoing" : "incoming",
    });
  });

  // Extract all related evidence from connected edges
  const allEvidence: { chunk_id?: string; quote?: string; source_title?: string }[] = [];
  connectedEdges.forEach((edge) => {
    if (edge.evidence) {
      edge.evidence.forEach((ev) => {
        if (ev.chunk_id || ev.quote) {
          if (!allEvidence.some((x) => x.chunk_id === ev.chunk_id && x.quote === ev.quote)) {
            allEvidence.push(ev);
          }
        }
      });
    } else if (edge.evidence_chunk_id || edge.evidence_quote) {
      if (
        !allEvidence.some(
          (x) => x.chunk_id === edge.evidence_chunk_id && x.quote === edge.evidence_quote
        )
      ) {
        allEvidence.push({
          chunk_id: edge.evidence_chunk_id,
          quote: edge.evidence_quote,
          source_title: edge.source_title,
        });
      }
    }
  });

  return (
    <aside
      className={`w-full lg:w-96 rounded-2xl p-5 border flex flex-col max-h-[600px] overflow-y-auto transition-all ${
        isDark
          ? "bg-slate-900/95 backdrop-blur-xl border-white/10 text-white shadow-2xl"
          : "bg-white border-slate-200 text-slate-900 shadow-lg"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-white/10 gap-2">
        <div className="space-y-1 min-w-0">
          <div className="inline-flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                isDark ? nodeType.badgeDark : nodeType.badgeLight
              }`}
            >
              <TypeIcon className="w-3 h-3" />
              <span>{nodeType.label}</span>
            </span>
            {selectedNode.metadata?.status && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                {String(selectedNode.metadata.status)}
              </span>
            )}
            {selectedNode.metadata?.state && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  selectedNode.metadata.state === "verified"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}
              >
                {String(selectedNode.metadata.state)}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold truncate tracking-tight">{selectedNode.label}</h3>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-lg shrink-0 ${
            isDark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500"
          }`}
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-5 py-4 text-xs">
        {/* Metadata info */}
        {selectedNode.metadata?.statement && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">
              Knowledge Statement
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              {String(selectedNode.metadata.statement)}
            </p>
          </div>
        )}

        {/* Connected Entities */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Connected Entities</span>
            <span className="text-[10px] text-slate-400 font-normal">
              {connectedEdges.length} connections
            </span>
          </h4>

          {Object.keys(relationships).length === 0 ? (
            <p className="text-slate-400 text-xs italic">No direct connections recorded.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(relationships).map(([rel, items]) => (
                <div key={rel} className="space-y-1.5">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-purple-600 dark:text-purple-400 block">
                    {rel} ({items.length})
                  </span>
                  <div className="space-y-1">
                    {items.map(({ otherNode, direction }, i) => {
                      const otherType = typeConfig[otherNode.type] || typeConfig.module;
                      const OtherIcon = otherType.icon;
                      return (
                        <button
                          key={`${otherNode.id}-${i}`}
                          type="button"
                          onClick={() => onSelectNode(otherNode.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            isDark
                              ? "bg-white/5 hover:bg-white/10 border-white/5 text-slate-200"
                              : "bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <OtherIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold truncate">{otherNode.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                            {direction === "outgoing" ? "→" : "←"} {otherType.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related Evidence */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span>Supporting Evidence</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              {allEvidence.length} {allEvidence.length === 1 ? "record" : "records"}
            </span>
          </div>

          {allEvidence.length === 0 ? (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center">
              <p className="text-slate-400 text-xs italic">
                Derived deterministically from project data.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {allEvidence.slice(0, 5).map((ev, idx) => (
                <div
                  key={`${ev.chunk_id || idx}`}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1.5"
                >
                  {ev.quote && (
                    <blockquote className="italic text-[11px] text-slate-600 dark:text-slate-300 border-l-2 border-purple-400 pl-2 line-clamp-2">
                      "{ev.quote}"
                    </blockquote>
                  )}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-purple-600 dark:text-purple-300 truncate">
                      {ev.source_title || ev.chunk_id || "Source Evidence"}
                    </span>
                    {ev.chunk_id && (
                      <button
                        type="button"
                        onClick={() => onInspectEvidence(ev.chunk_id!, ev.quote || "")}
                        className="inline-flex items-center gap-1 font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200 cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

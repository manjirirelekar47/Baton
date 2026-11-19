/**
 * GraphPage.tsx
 * Knowledge Graph: Simple, user-friendly UI for Baton.
 * Follows Baton Knowledge Graph UI Recommendations specification exactly:
 * 1. Page Header (Title & Description)
 * 2. Summary Cards (Total Nodes, Connections, People - NO graph density!)
 * 3. Search ("Search people, modules, tasks...")
 * 4. Filters (All, People, Modules, Tasks, Claims)
 * 5. Interactive Graph (Cytoscape canvas with pan, zoom, drag, node/edge selection)
 * 6. Node Details (Compact side panel with connected entities & evidence)
 * 7. Evidence Links (Links to supporting claim & original source via SourceDrawer)
 */

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { batonApi, GraphNode, GraphEdge, KnowledgeGraphData } from "@/api/client";
import { GraphSummaryCards } from "../components/GraphSummaryCards";
import { GraphControls, NodeFilterType } from "../components/GraphControls";
import { KnowledgeGraphCanvas } from "../components/KnowledgeGraphCanvas";
import { NodeDetailsPanel } from "../components/NodeDetailsPanel";
import { SourceDrawer } from "@/features/sources/components/SourceDrawer";

export const GraphPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<NodeFilterType>("all");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // Evidence drawer state
  const [inspectingEvidence, setInspectingEvidence] = useState<{
    chunkId: string;
    quote: string;
  } | null>(null);

  // Query graph data from live backend
  const {
    data: graphData,
    isLoading,
    isError,
    refetch,
  } = useQuery<KnowledgeGraphData>({
    queryKey: ["knowledge-graph"],
    queryFn: async () => {
      return batonApi.getKnowledgeGraph();
    },
    staleTime: 30000,
  });

  const nodes = useMemo(() => graphData?.nodes || [], [graphData]);
  const edges = useMemo(() => graphData?.edges || [], [graphData]);

  // Lookup map for fast node retrieval
  const nodesMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Summary counts
  const summary = useMemo(() => {
    return {
      totalNodes: graphData?.summary?.total_nodes ?? nodes.length,
      connections: graphData?.summary?.connections ?? edges.length,
      people: graphData?.summary?.people ?? nodes.filter((n) => n.type === "person").length,
    };
  }, [graphData, nodes, edges]);

  // Node counts by filter
  const nodeCounts = useMemo(() => {
    return {
      all: nodes.length,
      person: nodes.filter((n) => n.type === "person").length,
      module: nodes.filter((n) => n.type === "module").length,
      task: nodes.filter((n) => n.type === "task").length,
      claim: nodes.filter((n) => n.type === "claim").length,
    };
  }, [nodes]);

  // Connected edges for the currently selected node
  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );
  }, [selectedNode, edges]);

  const handleSelectNode = (node: GraphNode | null) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const handleSelectEdge = (edge: GraphEdge | null) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const handleSelectNodeById = (nodeId: string) => {
    const target = nodesMap.get(nodeId);
    if (target) {
      setSelectedNode(target);
      setSelectedEdge(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-7xl mx-auto px-2 sm:px-4">
      {/* 1. Page Header */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 transition-all ${
          isDark
            ? "bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl"
            : "bg-white border border-slate-200 shadow-md shadow-slate-200/50"
        }`}
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 dark:bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-950/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h1
              className={`text-2xl sm:text-3xl font-bold tracking-tight font-display ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Knowledge Graph
            </h1>

            <p
              className={`text-sm sm:text-base leading-relaxed ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              Explore how people, code modules, tasks, and project knowledge are connected.
            </p>
          </div>

          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
            <button
              type="button"
              onClick={() => refetch()}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isDark
                  ? "border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              }`}
              title="Refresh graph data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Summary Cards (Total Nodes, Connections, People) */}
      <GraphSummaryCards
        totalNodes={summary.totalNodes}
        connections={summary.connections}
        people={summary.people}
        isDark={isDark}
      />

      {/* 3. Search & 4. Filters */}
      <GraphControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        nodeCounts={nodeCounts}
        isDark={isDark}
      />

      {/* 5. Interactive Graph & 6. Node Details */}
      {isLoading ? (
        <div
          className={`flex flex-col items-center justify-center p-16 rounded-2xl border ${
            isDark
              ? "bg-black/40 border-white/10 text-white"
              : "bg-white border-slate-200 text-slate-700"
          }`}
        >
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
          <p className="text-sm font-semibold">Loading Knowledge Graph...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting project claims, modules, and evidence</p>
        </div>
      ) : isError ? (
        <div
          className={`flex flex-col items-center justify-center p-12 rounded-2xl border text-center ${
            isDark
              ? "bg-rose-950/20 border-rose-900/30 text-rose-300"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          <p className="text-sm font-bold">Failed to load Knowledge Graph data.</p>
          <p className="text-xs mt-1 text-slate-400">
            Please verify network connectivity and reload.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : nodes.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center p-16 rounded-2xl border text-center ${
            isDark
              ? "bg-black/40 border-white/10 text-slate-400"
              : "bg-white border-slate-200 text-slate-500"
          }`}
        >
          <p className="text-base font-bold text-slate-300 dark:text-slate-200">
            No graph data available.
          </p>
          <p className="text-xs mt-1 max-w-sm">
            Ingest project documents, Git repositories, or task boards to build the knowledge graph.
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Main Graph Canvas */}
          <div className="w-full flex-1 min-w-0">
            <KnowledgeGraphCanvas
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNode?.id || null}
              selectedEdgeId={selectedEdge?.id || null}
              onSelectNode={handleSelectNode}
              onSelectEdge={handleSelectEdge}
              searchQuery={searchQuery}
              selectedFilter={selectedFilter}
              isDark={isDark}
            />
          </div>

          {/* 6. Node Details Panel */}
          {(selectedNode || selectedEdge) && (
            <NodeDetailsPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              connectedEdges={connectedEdges}
              nodesMap={nodesMap}
              onClose={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
              onSelectNode={handleSelectNodeById}
              onInspectEvidence={(chunkId, quote) => {
                setInspectingEvidence({ chunkId, quote });
              }}
              isDark={isDark}
            />
          )}
        </div>
      )}

      {/* 7. Evidence Drawer (Modal Source Inspection) */}
      {inspectingEvidence && (
        <SourceDrawer
          chunkId={inspectingEvidence.chunkId}
          quote={inspectingEvidence.quote}
          onClose={() => setInspectingEvidence(null)}
        />
      )}
    </div>
  );
};

export default GraphPage;

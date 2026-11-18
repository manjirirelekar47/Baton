import React, { useEffect, useRef, useState } from "react";
import cytoscape, { Core, EventObject } from "cytoscape";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import { GraphNode, GraphEdge } from "@/api/client";
import { NodeFilterType } from "./GraphControls";

interface KnowledgeGraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (node: GraphNode | null) => void;
  onSelectEdge: (edge: GraphEdge | null) => void;
  searchQuery: string;
  selectedFilter: NodeFilterType;
  isDark: boolean;
}

export const KnowledgeGraphCanvas: React.FC<KnowledgeGraphCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  searchQuery,
  selectedFilter,
  isDark,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    // Filter elements based on selected filter
    let visibleNodes = nodes;
    if (selectedFilter !== "all") {
      visibleNodes = nodes.filter((n) => n.type === selectedFilter);
    }
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

    // Visible edges connecting visible nodes (or when all is selected, all edges)
    const visibleEdges = edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    const elements = [
      ...visibleNodes.map((n) => ({
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          raw: n,
        },
      })),
      ...visibleEdges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.relation,
          count: e.count || 1,
          raw: e,
        },
      })),
    ];

    // Cytoscape styles based on theme
    const textColor = isDark ? "#f8fafc" : "#0f172a";
    const textOutline = isDark ? "#09090b" : "#ffffff";
    const edgeColor = isDark ? "#64748b" : "#94a3b8";
    const edgeLabelColor = isDark ? "#cbd5e1" : "#475569";

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      autounselectify: false,
      wheelSensitivity: 0.25,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-valign": "bottom",
            "text-margin-y": 6,
            "font-size": "10px",
            "font-weight": 600,
            color: textColor,
            "text-outline-color": textOutline,
            "text-outline-width": 2,
            "text-max-width": "120px",
            "text-wrap": "ellipsis",
            width: 38,
            height: 38,
            "border-width": 2,
            "border-color": "#ffffff",
            "transition-property": "opacity, transform, border-width, border-color",
            "transition-duration": 200,
          },
        },
        // Node Type Styles
        {
          selector: "node[type = 'person']",
          style: {
            shape: "ellipse",
            "background-color": "#3b82f6",
            "border-color": "#60a5fa",
          },
        },
        {
          selector: "node[type = 'module']",
          style: {
            shape: "round-rectangle",
            "background-color": "#8b5cf6",
            "border-color": "#a78bfa",
          },
        },
        {
          selector: "node[type = 'task']",
          style: {
            shape: "cut-rectangle",
            "background-color": "#f59e0b",
            "border-color": "#fbbf24",
          },
        },
        {
          selector: "node[type = 'claim']",
          style: {
            shape: "hexagon",
            "background-color": "#10b981",
            "border-color": "#34d399",
          },
        },
        {
          selector: "node[type = 'source']",
          style: {
            shape: "round-tag",
            "background-color": "#06b6d4",
            "border-color": "#22d3ee",
          },
        },
        // Edge styles
        {
          selector: "edge",
          style: {
            width: 1.8,
            "line-color": edgeColor,
            "target-arrow-color": edgeColor,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.8,
            label: "data(label)",
            "font-size": "8px",
            "font-weight": 700,
            color: edgeLabelColor,
            "text-outline-color": textOutline,
            "text-outline-width": 2,
            "text-rotation": "autorotate",
            "text-margin-y": -6,
            "transition-property": "opacity, line-color, width",
            "transition-duration": 200,
          },
        },
        // Highlight & Dim States
        {
          selector: ".highlighted",
          style: {
            opacity: 1,
            "border-width": 3,
            "border-color": "#a855f7",
            "line-color": "#a855f7",
            "target-arrow-color": "#a855f7",
            width: 2.8,
            "z-index": 999,
          },
        },
        {
          selector: "node.selected",
          style: {
            "border-width": 4,
            "border-color": "#ec4899",
            width: 44,
            height: 44,
            "z-index": 1000,
          },
        },
        {
          selector: "edge.selected",
          style: {
            "line-color": "#ec4899",
            "target-arrow-color": "#ec4899",
            width: 3,
            "z-index": 1000,
          },
        },
        {
          selector: ".search-matched",
          style: {
            opacity: 1,
            "border-width": 4,
            "border-color": "#f59e0b",
            "z-index": 1000,
          },
        },
        {
          selector: ".dimmed",
          style: {
            opacity: 0.18,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        padding: 50,
        nodeOverlap: 20,
        idealEdgeLength: () => 100,
        edgeElasticity: () => 100,
        nodeRepulsion: () => 400000,
      },
    });

    cyRef.current = cy;

    // Track zoom
    const updateZoom = () => {
      setZoomLevel(Math.round(cy.zoom() * 100));
    };
    cy.on("zoom", updateZoom);

    // Node click
    cy.on("tap", "node", (evt: EventObject) => {
      const node = evt.target;
      const rawData = node.data("raw") as GraphNode;
      onSelectNode(rawData);
      onSelectEdge(null);
    });

    // Edge click
    cy.on("tap", "edge", (evt: EventObject) => {
      const edge = evt.target;
      const rawData = edge.data("raw") as GraphEdge;
      onSelectEdge(rawData);
      onSelectNode(null);
    });

    // Background click to clear
    cy.on("tap", (evt: EventObject) => {
      if (evt.target === cy) {
        onSelectNode(null);
        onSelectEdge(null);
      }
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [nodes, edges, selectedFilter, isDark, onSelectNode, onSelectEdge]);

  // Handle Selection Highlighting & Dimming
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass("highlighted dimmed selected");

    if (selectedNodeId) {
      const selectedCyNode = cy.$id(selectedNodeId);
      if (selectedCyNode.length > 0) {
        selectedCyNode.addClass("selected");
        const neighborhood = selectedCyNode.neighborhood();
        neighborhood.addClass("highlighted");
        cy.elements().not(selectedCyNode.add(neighborhood)).addClass("dimmed");
      }
    } else if (selectedEdgeId) {
      const selectedCyEdge = cy.$id(selectedEdgeId);
      if (selectedCyEdge.length > 0) {
        selectedCyEdge.addClass("selected");
        const sourceNode = selectedCyEdge.source();
        const targetNode = selectedCyEdge.target();
        sourceNode.addClass("highlighted");
        targetNode.addClass("highlighted");
        cy.elements().not(selectedCyEdge.add(sourceNode).add(targetNode)).addClass("dimmed");
      }
    }
  }, [selectedNodeId, selectedEdgeId]);

  // Handle Search Highlighting
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass("search-matched");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matched = cy.nodes().filter((node) => {
        const label = (node.data("label") || "").toLowerCase();
        const id = (node.data("id") || "").toLowerCase();
        return label.includes(q) || id.includes(q);
      });

      if (matched.length > 0) {
        matched.addClass("search-matched");
        if (!selectedNodeId && !selectedEdgeId) {
          cy.elements().not(matched).addClass("dimmed");
        }
      }
    } else if (!selectedNodeId && !selectedEdgeId) {
      cy.elements().removeClass("dimmed");
    }
  }, [searchQuery, selectedNodeId, selectedEdgeId]);

  // Control button actions
  const handleZoomIn = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({
      level: cy.zoom() * 1.25,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    });
  };

  const handleZoomOut = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({
      level: cy.zoom() / 1.25,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    });
  };

  const handleFit = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.fit(undefined, 50);
  };

  const handleResetLayout = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.layout({
      name: "cose",
      animate: true,
      animationDuration: 400,
      padding: 50,
      nodeOverlap: 20,
      idealEdgeLength: () => 100,
      edgeElasticity: () => 100,
      nodeRepulsion: () => 400000,
    }).run();
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border transition-all ${
        isDark
          ? "bg-black/50 backdrop-blur-xl border-white/10 shadow-2xl"
          : "bg-slate-50 border-slate-200 shadow-md"
      }`}
    >
      {/* Floating Canvas Controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-lg">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleFit}
          title="Fit Canvas"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
          aria-label="Fit to screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetLayout}
          title="Reset Layout"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
          aria-label="Reset layout"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-mono px-2 py-0.5 font-bold text-slate-500 dark:text-slate-400">
          {zoomLevel}%
        </span>
      </div>

      {/* Floating Legend */}
      <div className="absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-lg text-[11px] font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-slate-700 dark:text-slate-300">People</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
          <span className="text-slate-700 dark:text-slate-300">Modules</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rotate-45 bg-amber-500" />
          <span className="text-slate-700 dark:text-slate-300">Tasks</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
          <span className="text-slate-700 dark:text-slate-300">Claims</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500" />
          <span className="text-slate-700 dark:text-slate-300">Sources</span>
        </div>
      </div>

      {/* Main Cytoscape Canvas */}
      <div
        ref={containerRef}
        className="w-full h-[580px] sm:h-[620px] cursor-grab active:cursor-grabbing outline-none"
      />
    </div>
  );
};

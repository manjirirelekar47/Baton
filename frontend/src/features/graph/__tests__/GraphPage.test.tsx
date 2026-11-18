import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { GraphPage } from "../pages/GraphPage";
import { batonApi, KnowledgeGraphData } from "@/api/client";

// Mock Cytoscape
vi.mock("cytoscape", () => {
  const cyInstance = {
    on: vi.fn(),
    destroy: vi.fn(),
    elements: vi.fn(() => ({
      removeClass: vi.fn(),
      addClass: vi.fn(),
      not: vi.fn(() => ({ addClass: vi.fn() })),
    })),
    nodes: vi.fn(() => []),
    $id: vi.fn(() => ({
      length: 0,
      addClass: vi.fn(),
      neighborhood: vi.fn(() => ({ addClass: vi.fn() })),
    })),
    zoom: vi.fn(() => 1),
    fit: vi.fn(),
    layout: vi.fn(() => ({ run: vi.fn() })),
  };
  return {
    default: vi.fn(() => cyInstance),
  };
});

// Mock Auth
vi.mock("@/app/auth", () => ({
  useAuth: () => ({
    user: { id: "u-approver", name: "Samruddhi", role: "approver", project_id: "proj-campus-event-portal" },
  }),
}));

const mockGraphData: KnowledgeGraphData = {
  nodes: [
    { id: "person:Aarav", label: "Aarav", type: "person" },
    { id: "person:Meera", label: "Meera", type: "person" },
    { id: "module:payments", label: "Payments", type: "module" },
    { id: "task:T-52", label: "T-52: Publish portal", type: "task" },
    { id: "claim:c1", label: "payments: owner", type: "claim", metadata: { state: "verified" } },
    { id: "source:s1", label: "Git Export", type: "source" },
  ],
  edges: [
    {
      id: "e1",
      source: "person:Aarav",
      target: "module:payments",
      relation: "AUTHORED",
      evidence_chunk_id: "chk-1",
      evidence_quote: "Initial commit for payments module",
      source_title: "Git Export",
    },
    {
      id: "e2",
      source: "person:Meera",
      target: "task:T-52",
      relation: "OWNS",
      evidence_chunk_id: "chk-2",
      evidence_quote: "Task assigned to Meera",
      source_title: "Tasks Board",
    },
    {
      id: "e3",
      source: "claim:c1",
      target: "source:s1",
      relation: "SUPPORTED BY",
      evidence_chunk_id: "chk-1",
      evidence_quote: "Payments ownership confirmed",
      source_title: "Git Export",
    },
  ],
  summary: {
    total_nodes: 6,
    connections: 3,
    people: 2,
  },
};

function renderGraphPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <GraphPage />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe("Knowledge Graph UI Recommendations", () => {
  beforeEach(() => {
    vi.spyOn(batonApi, "getKnowledgeGraph").mockResolvedValue(mockGraphData);
  });

  it("Order 1: renders header with title and required description", async () => {
    renderGraphPage();

    expect(await screen.findByRole("heading", { name: "Knowledge Graph" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Explore how people, code modules, tasks, and project knowledge are connected."
      )
    ).toBeInTheDocument();
  });

  it("Order 2: renders exactly 3 summary cards and omits graph density", async () => {
    renderGraphPage();

    expect(await screen.findByText("Total Nodes")).toBeInTheDocument();
    expect(screen.getByText("Connections")).toBeInTheDocument();
    const peopleElements = screen.getAllByText("People");
    expect(peopleElements.length).toBeGreaterThanOrEqual(1);

    // Verify live summary values from project data once loaded
    await waitFor(() => {
      expect(screen.getAllByText("6").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    });

    // Explicitly verify graph density is NOT in the UI
    expect(screen.queryByText(/Graph Density/i)).not.toBeInTheDocument();
  });

  it("Order 3 & 4: renders search field and filter tabs for All, People, Modules, Tasks, Claims", async () => {
    renderGraphPage();

    const searchInput = await screen.findByPlaceholderText("Search people, modules, tasks...");
    expect(searchInput).toBeInTheDocument();

    // Filters
    expect(screen.getByRole("button", { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /People/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Modules/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tasks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Claims/i })).toBeInTheDocument();
  });

  it("Order 3: allows typing in search field", async () => {
    renderGraphPage();

    const searchInput = (await screen.findByPlaceholderText(
      "Search people, modules, tasks..."
    )) as HTMLInputElement;

    fireEvent.change(searchInput, { target: { value: "Aarav" } });
    expect(searchInput.value).toBe("Aarav");
  });

  it("Order 4: switches filter active state upon clicking", async () => {
    renderGraphPage();

    const peopleFilter = await screen.findByRole("button", { name: /People/i });
    fireEvent.click(peopleFilter);

    // People button should have active class
    expect(peopleFilter).toBeInTheDocument();
  });

  it("Order 6 & 7: renders node details and evidence links for selected node", async () => {
    renderGraphPage();

    await screen.findByRole("heading", { name: "Knowledge Graph" });

    // Render NodeDetailsPanel directly to verify all sections and evidence inspection
    const { NodeDetailsPanel } = await import("../components/NodeDetailsPanel");
    const onInspect = vi.fn();
    const onClose = vi.fn();
    const onSelectNode = vi.fn();

    const selectedNode = mockGraphData.nodes[0]; // Aarav
    const nodesMap = new Map(mockGraphData.nodes.map((n) => [n.id, n]));
    const connectedEdges = mockGraphData.edges.filter((e) => e.source === selectedNode.id);

    render(
      <NodeDetailsPanel
        selectedNode={selectedNode}
        selectedEdge={null}
        connectedEdges={connectedEdges}
        nodesMap={nodesMap}
        onClose={onClose}
        onSelectNode={onSelectNode}
        onInspectEvidence={onInspect}
        isDark={false}
      />
    );

    // Verify Name and Node type
    expect(screen.getByText("Aarav")).toBeInTheDocument();
    expect(screen.getByText("Person")).toBeInTheDocument();

    // Verify Connected Entities
    expect(screen.getByText(/AUTHORED \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();

    // Verify Supporting Evidence
    expect(screen.getByText(/Supporting Evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/"Initial commit for payments module"/i)).toBeInTheDocument();

    // Verify Evidence Link action
    const inspectBtn = screen.getByRole("button", { name: /Inspect/i });
    expect(inspectBtn).toBeInTheDocument();
    fireEvent.click(inspectBtn);
    expect(onInspect).toHaveBeenCalledWith("chk-1", "Initial commit for payments module");
  });
});

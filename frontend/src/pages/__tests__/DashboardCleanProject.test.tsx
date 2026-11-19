import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { DashboardDark } from "../DashboardDark";
import { DashboardLight } from "../DashboardLight";
import { batonApi } from "@/api/client";

// Mock useAuth
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u-real-owner",
      name: "Alex Project Owner",
      role: "approver",
      project_id: "proj-clean-new-id",
    },
    activeProject: {
      id: "proj-clean-new-id",
      name: "Brand New Clean Project",
      role: "approver",
    },
  }),
}));

function renderDashboardDark() {
  return render(
    <BrowserRouter>
      <DashboardDark />
    </BrowserRouter>
  );
}

function renderDashboardLight() {
  return render(
    <BrowserRouter>
      <DashboardLight />
    </BrowserRouter>
  );
}

describe("Dashboard - Clean New Project (Empty State)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock API returning zero data (empty newly created project)
    vi.spyOn(batonApi, "getClaims").mockResolvedValue({ claims: [], hidden_count: 0 });
    vi.spyOn(batonApi, "getReviewQueue").mockResolvedValue({
      project_id: "proj-clean-new-id",
      total: 0,
      pending: 0,
      items: [],
    });
    vi.spyOn(batonApi, "getRiskRadar").mockResolvedValue([]);
    vi.spyOn(batonApi, "getSources").mockResolvedValue([]);
    vi.spyOn(batonApi, "getProjectMembers").mockResolvedValue([
      { id: "u-real-owner", name: "Alex Project Owner", role: "approver", active: true },
    ]);
  });

  it("Dark Dashboard renders 0 for claims, 1 for team member, and clean empty states", async () => {
    renderDashboardDark();

    // Top metrics must start at 0, not hardcoded 24, 18, 3
    await waitFor(() => {
      expect(screen.getByText("Total Claims")).toBeInTheDocument();
    });

    const zeros = screen.getAllByText("0");
    // At least 3 cards show '0' (Total, Verified, Conflicting)
    expect(zeros.length).toBeGreaterThanOrEqual(3);

    // Hardcoded demo numbers must NOT be present
    expect(screen.queryByText("24")).not.toBeInTheDocument();
    expect(screen.queryByText("18")).not.toBeInTheDocument();

    // Team Members should reflect 1 member
    expect(screen.getByText("1")).toBeInTheDocument();

    // Knowledge Graph empty state
    expect(screen.getByText("No Graph Data Available")).toBeInTheDocument();
    expect(
      screen.getByText(/Connect GitHub, Jira or upload project documents to generate your knowledge graph/i)
    ).toBeInTheDocument();

    // Review Queue empty state - NO mock items like "API Integration Details"
    expect(screen.getByText("Queue is clear")).toBeInTheDocument();
    expect(screen.queryByText("API Integration Details")).not.toBeInTheDocument();
    expect(screen.queryByText("Budget Estimation")).not.toBeInTheDocument();
    expect(screen.queryByText("Deployment Timeline")).not.toBeInTheDocument();

    // Risk Radar empty state - NO fake 65%, 22%, 13%
    expect(screen.getByText("No Risks")).toBeInTheDocument();
    expect(screen.queryByText("65%")).not.toBeInTheDocument();
    expect(screen.queryByText("22%")).not.toBeInTheDocument();
    expect(screen.queryByText("13%")).not.toBeInTheDocument();
  });

  it("Light Dashboard renders 0 for claims, 1 for team member, and clean empty states", async () => {
    renderDashboardLight();

    await waitFor(() => {
      expect(screen.getByText("Total Claims")).toBeInTheDocument();
    });

    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(3);

    expect(screen.queryByText("24")).not.toBeInTheDocument();
    expect(screen.queryByText("18")).not.toBeInTheDocument();

    expect(screen.getByText("1")).toBeInTheDocument();

    expect(screen.getByText("No Graph Data Available")).toBeInTheDocument();
    expect(screen.getByText("Queue is clear")).toBeInTheDocument();
    expect(screen.queryByText("API Integration Details")).not.toBeInTheDocument();
    expect(screen.queryByText("Budget Estimation")).not.toBeInTheDocument();
    expect(screen.queryByText("Deployment Timeline")).not.toBeInTheDocument();

    expect(screen.getByText("No Risks")).toBeInTheDocument();
    expect(screen.queryByText("65%")).not.toBeInTheDocument();
    expect(screen.queryByText("22%")).not.toBeInTheDocument();
    expect(screen.queryByText("13%")).not.toBeInTheDocument();
  });
});

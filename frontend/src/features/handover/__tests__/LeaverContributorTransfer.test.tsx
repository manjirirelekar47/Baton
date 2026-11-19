import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlanPanel } from "../components/PlanPanel";
import { TaskModal } from "../components/TaskModal";
import type { PlanBuckets, PlanItem } from "../api";

describe("Leaver to Contributor Work Transfer UI", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const transferredItem: PlanItem = {
    claim_id: "claim-tf-1",
    kind: "next_action",
    title: "Update Staging Deployment Keys",
    state: "verified",
    owner: "Priya (Contributor)",
    owner_known: true,
    proposed_owner: null,
    proposed_for_me: false,
    due_date: "2026-12-05",
    blocked_by: [],
    cycle: false,
    level: 1,
    position: 1,
    action_status: "in_progress",
    evidence: [],
    is_transferred: true,
    transferred_from: "Aarav",
    original_owner: "Aarav",
    transfer_notes: "Transferred during handover",
  };

  const plan: PlanBuckets = {
    day_1: [transferredItem],
    week_1: [],
    month_1: [],
  };

  it("renders 'Transferred from Leaver' badge and original owner in PlanPanel", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PlanPanel
          plan={plan}
          versionId="v-1"
          isApprover={false}
          currentUserName="Priya (Contributor)"
          currentUserRole="contributor"
        />
      </QueryClientProvider>
    );

    // Title
    expect(screen.getByText("Update Staging Deployment Keys")).toBeInTheDocument();

    // Transferred from Leaver badge
    const badge = screen.getByTestId("transferred-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Transferred from Leaver (Aarav)");

    // Owner and original owner metadata
    expect(screen.getByText("Priya (Contributor)")).toBeInTheDocument();
    expect(screen.getByText(/Originally owned by:/i)).toBeInTheDocument();
    expect(screen.getByText("Aarav")).toBeInTheDocument();
  });

  it("renders transfer provenance banner in TaskModal", () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={vi.fn()}
        task={transferredItem}
        versionId="v-1"
        allTasks={[transferredItem]}
        isApprover={false}
        onSave={vi.fn()}
      />
    );

    const banner = screen.getByTestId("task-transferred-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("Transferred from Leaver");
    expect(banner).toHaveTextContent("Transferred by Aarav");
    expect(banner).toHaveTextContent("Original owner: Aarav");
    expect(banner).toHaveTextContent("Currently assigned to: Priya (Contributor)");
    expect(banner).toHaveTextContent("Notes: Transferred during handover");
  });
});

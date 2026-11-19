import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewPage } from "../pages/ReviewPage";
import * as reviewApi from "../api";
import type { QueueItem, ReadinessReport, ReviewQueue } from "../types";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u-approver",
      name: "Approver User",
      role: "approver",
      email: "approver@company.com",
    },
    loading: false,
  }),
}));

const mockItem: QueueItem = {
  claim_id: "claim-test-ask",
  claim_type: "decision",
  entity_key: "auth_service",
  attribute: "owner",
  statement: "Aarav is the owner of auth service",
  state: "missing",
  review_state: "pending",
  acl_label: "L1",
  risk_rank: 20,
  risk_reason: "Needs confirmation",
  evidence: [],
  conflict_with: [],
  pending: true,
};

const mockQueue: ReviewQueue = {
  project_id: "proj-1",
  total: 1,
  pending: 1,
  items: [mockItem],
};

const mockReadiness: ReadinessReport = {
  ready: false,
  reasons: ["1 pending review"],
  unresolved_conflicts: [],
  unaccepted_inferred: [],
  pending_count: 1,
  included_count: 0,
};

function renderReviewPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ReviewPage — Ask Leaver Modal Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(reviewApi, "getReviewQueue").mockResolvedValue(mockQueue);
    vi.spyOn(reviewApi, "getReadiness").mockResolvedValue(mockReadiness);
    vi.spyOn(reviewApi, "getGapInterview").mockResolvedValue({
      project_id: "proj-1",
      total: 0,
      unanswered: 0,
      items: [],
    });
  });

  it("automatically closes the Ask Leaver modal after successful submission and shows success toast", async () => {
    const postActionSpy = vi.spyOn(reviewApi, "postAction").mockResolvedValue({
      claim: {
        ...mockItem,
        pending: true,
      },
      review: {
        id: "rev-1",
        claim_id: "claim-test-ask",
        project_id: "proj-1",
        action: "ask_leaver",
        reviewer_id: "u-approver",
        reviewer_role: "approver",
        note: "Who configured this?",
        created_at: "2026-11-19T00:00:00",
      },
      readiness: mockReadiness,
    });

    renderReviewPage();

    // Wait for the queue item to render
    expect(await screen.findByText("Aarav is the owner of auth service")).toBeInTheDocument();

    // Click Ask Leaver button on the card
    const askButton = screen.getByRole("button", { name: /Ask Leaver/i });
    fireEvent.click(askButton);

    // Modal should now be open
    expect(screen.getByRole("dialog", { name: "Ask Leaver" })).toBeInTheDocument();

    // Fill in question
    const textarea = screen.getByPlaceholderText(/Please clarify who manages the API credentials/i);
    fireEvent.change(textarea, { target: { value: "Who configured this?" } });

    // Click Add to Gap Interview
    const submitBtn = screen.getByRole("button", { name: "Add to Gap Interview" });
    fireEvent.click(submitBtn);

    // Verify postAction called
    await waitFor(() => {
      expect(postActionSpy).toHaveBeenCalledWith("claim-test-ask", {
        action: "ask_leaver",
        note: "Who configured this?",
      });
    });

    // Modal should automatically close
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Ask Leaver" })).not.toBeInTheDocument();
    });

    // Success status message displayed
    expect(screen.getByText(/Claim claim-test-ask action saved/i)).toBeInTheDocument();
  });

  it("keeps the Ask Leaver modal open when submission fails so user can retry", async () => {
    vi.spyOn(reviewApi, "postAction").mockRejectedValue(new Error("Network connection error"));

    renderReviewPage();

    expect(await screen.findByText("Aarav is the owner of auth service")).toBeInTheDocument();

    const askButton = screen.getByRole("button", { name: /Ask Leaver/i });
    fireEvent.click(askButton);

    expect(screen.getByRole("dialog", { name: "Ask Leaver" })).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Please clarify who manages the API credentials/i);
    fireEvent.change(textarea, { target: { value: "Retry question" } });

    const submitBtn = screen.getByRole("button", { name: "Add to Gap Interview" });
    fireEvent.click(submitBtn);

    // Error message appears
    expect(await screen.findByText("Network connection error")).toBeInTheDocument();

    // Modal remains open
    expect(screen.getByRole("dialog", { name: "Ask Leaver" })).toBeInTheDocument();
  });
});

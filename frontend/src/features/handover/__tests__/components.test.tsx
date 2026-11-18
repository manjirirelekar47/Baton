import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StateBadge } from "@/shared/ui";
import type { ClaimView, PlanBuckets, PlanItem } from "../api";
import { ClaimCard } from "../components/ClaimCard";
import { HiddenPlaceholder } from "../components/HiddenPlaceholder";
import { PlanPanel } from "../components/PlanPanel";

const ownerClaim: ClaimView = {
  claim_id: "c-002",
  type: "owner",
  section: "ownership",
  statement: "The check-in kiosk module has no recorded owner",
  state: "inferred",
  access_label: "L1",
  owner: null,
  proposed_owner: "Incoming Contributor",
  proposed_for_me: true,
  due_date: null,
  blocked_by: [],
  attested_by: null,
  evidence: [{ chunk_id: "S4-150", quote: "nobody has claimed it yet", source_id: "S4", source_title: "Chat export", event_time: null }],
};

const noop = () => undefined;

const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe("HiddenPlaceholder", () => {
  it("shows a bare count and nothing else", () => {
    render(<HiddenPlaceholder count={2} />);
    expect(screen.getByRole("note")).toHaveTextContent("2 items are hidden because of access level");
  });
  it("uses singular wording for one item", () => {
    render(<HiddenPlaceholder count={1} />);
    expect(screen.getByRole("note")).toHaveTextContent("1 item is hidden");
  });
  it("renders nothing when there is nothing hidden", () => {
    const { container } = render(<HiddenPlaceholder count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StateBadge", () => {
  it("always shows a text label, never colour alone", () => {
    render(<StateBadge state="conflicting" />);
    expect(screen.getByText("Conflicting")).toBeInTheDocument();
  });
});

describe("ClaimCard ownership", () => {
  it("shows an unknown owner as Unknown and never invents one", () => {
    render(<ClaimCard claim={ownerClaim} canRespond response={undefined} onRespond={noop} onOpenCitation={noop} />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
  it("lets the proposed person accept or decline", () => {
    const onRespond = vi.fn();
    render(<ClaimCard claim={ownerClaim} canRespond onRespond={onRespond} onOpenCitation={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept ownership" }));
    expect(onRespond).toHaveBeenCalledWith("accept");
  });
  it("hides the buttons when the proposal is for someone else", () => {
    render(<ClaimCard claim={{ ...ownerClaim, proposed_for_me: false, proposed_owner: "Meera" }} canRespond onRespond={noop} onOpenCitation={noop} />);
    expect(screen.queryByRole("button", { name: "Accept ownership" })).not.toBeInTheDocument();
    expect(screen.getByText("Meera")).toBeInTheDocument();
  });
  it("opens the cited source", () => {
    const onOpen = vi.fn();
    render(<ClaimCard claim={ownerClaim} canRespond={false} onRespond={noop} onOpenCitation={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /Open source S4-150/ }));
    expect(onOpen).toHaveBeenCalledWith(ownerClaim.evidence[0]);
  });
});

describe("PlanPanel D3 features", () => {
  const upstreamTask: PlanItem = {
    claim_id: "task-upstream",
    kind: "next_action",
    title: "Database migration script",
    state: "verified",
    owner: "Meera",
    owner_known: true,
    proposed_owner: null,
    proposed_for_me: false,
    due_date: "2020-01-01", // in past -> overdue
    blocked_by: [],
    cycle: false,
    level: 0,
    position: 1,
    action_status: "not_started",
    evidence: [],
  };

  const downstreamTask: PlanItem = {
    claim_id: "task-downstream",
    kind: "next_action",
    title: "Deploy API to production",
    state: "verified",
    owner: "Incoming Contributor",
    owner_known: true,
    proposed_owner: null,
    proposed_for_me: false,
    due_date: "2030-01-01",
    blocked_by: ["task-upstream"],
    cycle: false,
    level: 1,
    position: 1,
    action_status: "not_started",
    evidence: [],
  };

  const mockPlan: PlanBuckets = {
    day_1: [upstreamTask],
    week_1: [downstreamTask],
    month_1: [],
  };

  it("renders overdue indicator for tasks past due date and not completed", () => {
    render(
      <QueryClientProvider client={testQueryClient}>
        <PlanPanel
          plan={mockPlan}
          versionId="v1"
          isApprover={true}
          onOpenCitation={noop}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Overdue \(2020-01-01\)/i)).toBeInTheDocument();
  });

  it("renders pending blockers and reflects when upstream task is completed", () => {
    const { rerender } = render(
      <QueryClientProvider client={testQueryClient}>
        <PlanPanel
          plan={mockPlan}
          versionId="v1"
          isApprover={true}
          onOpenCitation={noop}
        />
      </QueryClientProvider>
    );

    // Initial state: upstream is not_started -> downstream is blocked
    expect(screen.getByText(/Waiting on 1 pending upstream task/i)).toBeInTheDocument();

    // Now upstream task is completed
    const completedPlan: PlanBuckets = {
      day_1: [{ ...upstreamTask, action_status: "completed" }],
      week_1: [downstreamTask],
      month_1: [],
    };

    rerender(
      <QueryClientProvider client={testQueryClient}>
        <PlanPanel
          plan={completedPlan}
          versionId="v1"
          isApprover={true}
          onOpenCitation={noop}
        />
      </QueryClientProvider>
    );

    // Automatically reflects unblocked state
    expect(screen.getByText(/All upstream dependencies completed — Unblocked/i)).toBeInTheDocument();
  });

  it("hides Add Action Item button for non-approver and locks unassigned task editing", () => {
    render(
      <QueryClientProvider client={testQueryClient}>
        <PlanPanel
          plan={mockPlan}
          versionId="v1"
          isApprover={false}
          currentUserName="Other Person"
          currentUserId="u-other"
          onOpenCitation={noop}
        />
      </QueryClientProvider>
    );

    expect(screen.queryByRole("button", { name: /Add Action Item/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("View Details").length).toBeGreaterThan(0);
  });

  it("shows Add Action Item button and Edit Action for approver", () => {
    render(
      <QueryClientProvider client={testQueryClient}>
        <PlanPanel
          plan={mockPlan}
          versionId="v1"
          isApprover={true}
          onOpenCitation={noop}
        />
      </QueryClientProvider>
    );

    expect(screen.getByRole("button", { name: /Add Action Item/i })).toBeInTheDocument();
    expect(screen.getAllByText("Edit Action").length).toBe(2);
  });
});

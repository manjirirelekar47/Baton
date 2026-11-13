import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClaimsList } from "../components/ClaimsList";
import { GapsList } from "../components/GapsList";
import type { Claim, Gap } from "../api";

const mockClaims: Claim[] = [
  {
    claim_id: "c-001",
    type: "owner",
    entity_key: "module:payments",
    attribute: "owner",
    statement: "Rohan owns the payments module",
    state: "verified",
    acl_label: "L1",
    owner: "Rohan",
    evidence: [
      {
        chunk_id: "S4-212",
        quote: "Rohan took payments over",
        source_title: "Chat export",
      },
    ],
  },
  {
    claim_id: "c-002",
    type: "owner",
    entity_key: "module:payments",
    attribute: "owner",
    statement: "Aarav owns the payments module",
    state: "conflicting",
    acl_label: "L1",
    owner: "Aarav",
    conflict_with: ["c-001"],
    evidence: [],
  },
  {
    claim_id: "c-003",
    type: "open_question",
    entity_key: "registrar",
    attribute: "login",
    statement: "Who holds the domain registrar login?",
    state: "missing",
    acl_label: "L1",
    evidence: [],
  },
];

const mockGaps: Gap[] = [
  {
    gap_id: "g-001",
    question: "Who holds the domain registrar login?",
    reason: "No source mentions it",
    asked_to: "Aarav",
  },
];

describe("ClaimsList", () => {
  it("renders all claims with their honesty state badges", () => {
    const onSelectClaim = vi.fn();
    const onOpenSource = vi.fn();

    render(
      <ClaimsList
        claims={mockClaims}
        onSelectClaim={onSelectClaim}
        onOpenSource={onOpenSource}
      />
    );

    expect(screen.getByText("Rohan owns the payments module")).toBeInTheDocument();
    expect(screen.getByText("Aarav owns the payments module")).toBeInTheDocument();
    expect(screen.getAllByText("Verified").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Conflicting").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Missing").length).toBeGreaterThanOrEqual(1);
  });

  it("filters claims by state selection", () => {
    render(
      <ClaimsList
        claims={mockClaims}
        onSelectClaim={vi.fn()}
        onOpenSource={vi.fn()}
      />
    );

    const comboboxes = screen.getAllByRole("combobox");
    const stateSelect = comboboxes[0];
    fireEvent.change(stateSelect, { target: { value: "conflicting" } });

    expect(screen.getByText("Aarav owns the payments module")).toBeInTheDocument();
    expect(screen.queryByText("Rohan owns the payments module")).not.toBeInTheDocument();
  });

  it("calls onSelectClaim when details button is clicked", () => {
    const onSelectClaim = vi.fn();
    render(
      <ClaimsList
        claims={mockClaims}
        onSelectClaim={onSelectClaim}
        onOpenSource={vi.fn()}
      />
    );

    const detailButtons = screen.getAllByRole("button", { name: /details/i });
    fireEvent.click(detailButtons[0]);
    expect(onSelectClaim).toHaveBeenCalledWith(mockClaims[0]);
  });
});

describe("GapsList", () => {
  it("renders gaps with question and assigned owner", () => {
    render(<GapsList gaps={mockGaps} />);
    expect(screen.getByText("Who holds the domain registrar login?")).toBeInTheDocument();
    expect(screen.getByText("No source mentions it")).toBeInTheDocument();
    expect(screen.getByText("Aarav")).toBeInTheDocument();
  });

  it("renders empty state when no gaps exist", () => {
    render(<GapsList gaps={[]} />);
    expect(screen.getByText("No Knowledge Gaps Detected")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApprovalBar } from "../components/ApprovalBar";
import { QueueItemCard } from "../components/QueueItemCard";
import { ConflictModal } from "../components/ConflictModal";
import { EditDialog } from "../components/EditDialog";
import { AcceptUncertaintyDialog } from "../components/AcceptUncertaintyDialog";
import { AskLeaverDialog } from "../components/AskLeaverDialog";
import type { QueueItem, ReadinessReport } from "../types";

const mockItem: QueueItem = {
  claim_id: "claim-test-01",
  claim_type: "owner",
  entity_key: "auth_service",
  attribute: "owner",
  statement: "Aarav is the owner of auth service",
  state: "verified",
  review_state: "pending",
  acl_label: "L1",
  risk_rank: 50,
  risk_reason: "Verified by 2 sources",
  evidence: [
    {
      chunk_id: "C-101",
      quote: "Aarav owns auth service",
      acl_label: "L1",
      source_title: "Architecture Doc",
    },
  ],
  conflict_with: [],
  pending: true,
};

const mockConflictItem: QueueItem = {
  claim_id: "claim-conflict-01",
  claim_type: "owner",
  entity_key: "payments",
  attribute: "owner",
  statement: "Priya owns payments service",
  state: "conflicting",
  review_state: "pending",
  acl_label: "L1",
  risk_rank: 10,
  risk_reason: "Contradicted by claim-conflict-02",
  evidence: [
    {
      chunk_id: "C-201",
      quote: "Priya took over payments in March",
      acl_label: "L1",
    },
  ],
  conflict_with: ["claim-conflict-02"],
  suggested_claim_id: "claim-conflict-02",
  pending: true,
};

const mockConflictItem2: QueueItem = {
  claim_id: "claim-conflict-02",
  claim_type: "owner",
  entity_key: "payments",
  attribute: "owner",
  statement: "Kiran owns payments service",
  state: "conflicting",
  review_state: "pending",
  acl_label: "L1",
  risk_rank: 11,
  risk_reason: "Contradicted by claim-conflict-01",
  evidence: [
    {
      chunk_id: "C-202",
      quote: "Kiran handles payments since April",
      acl_label: "L1",
    },
  ],
  conflict_with: ["claim-conflict-01"],
  pending: true,
};

describe("ApprovalBar component", () => {
  const readyReport: ReadinessReport = {
    ready: true,
    unresolved_conflicts: [],
    unaccepted_inferred: [],
    pending_count: 0,
    included_count: 12,
    reasons: [],
  };

  const blockedReport: ReadinessReport = {
    ready: false,
    unresolved_conflicts: ["claim-conflict-01"],
    unaccepted_inferred: ["claim-inferred-01"],
    pending_count: 3,
    included_count: 5,
    reasons: ["1 unresolved conflict: claim-conflict-01", "1 unaccepted inferred claim"],
  };

  it("renders blocked state and disables approve button", () => {
    render(
      <ApprovalBar
        readiness={blockedReport}
        loading={false}
        onBulkConfirm={vi.fn()}
        bulkConfirmLoading={false}
        onApprove={vi.fn()}
        approveLoading={false}
        onOpenVersions={vi.fn()}
        onOpenAudit={vi.fn()}
        onOpenGapInterview={vi.fn()}
        unansweredGapsCount={2}
      />
    );

    expect(screen.getByText("Approval blocked")).toBeInTheDocument();
    expect(screen.getByText(/1 unresolved conflict/)).toBeInTheDocument();
    const approveBtn = screen.getByRole("button", { name: "Approve & Share Handover" });
    expect(approveBtn).toBeDisabled();
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 unanswered gaps badge
  });

  it("renders ready state and enables approve button", () => {
    const onApprove = vi.fn();
    render(
      <ApprovalBar
        readiness={readyReport}
        loading={false}
        onBulkConfirm={vi.fn()}
        bulkConfirmLoading={false}
        onApprove={onApprove}
        approveLoading={false}
        onOpenVersions={vi.fn()}
        onOpenAudit={vi.fn()}
        onOpenGapInterview={vi.fn()}
        unansweredGapsCount={0}
      />
    );

    expect(screen.getByText("Ready to approve")).toBeInTheDocument();
    const approveBtn = screen.getByRole("button", { name: "Approve & Share Handover" });
    expect(approveBtn).not.toBeDisabled();
  });

  it("handles bulk confirm click", () => {
    const onBulkConfirm = vi.fn();
    render(
      <ApprovalBar
        readiness={readyReport}
        loading={false}
        onBulkConfirm={onBulkConfirm}
        bulkConfirmLoading={false}
        onApprove={vi.fn()}
        approveLoading={false}
        onOpenVersions={vi.fn()}
        onOpenAudit={vi.fn()}
        onOpenGapInterview={vi.fn()}
        unansweredGapsCount={0}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm all verified" }));
    expect(onBulkConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("QueueItemCard component", () => {
  it("renders item details and triggers actions", () => {
    const onConfirm = vi.fn();
    const onReject = vi.fn();
    const onOpenEdit = vi.fn();

    render(
      <QueueItemCard
        item={mockItem}
        onConfirm={onConfirm}
        onReject={onReject}
        onMarkUnknown={vi.fn()}
        onOpenEdit={onOpenEdit}
        onOpenConflict={vi.fn()}
        onOpenAcceptUncertainty={vi.fn()}
        onOpenAskLeaver={vi.fn()}
        onOpenSource={vi.fn()}
        actionLoading={false}
      />
    );

    expect(screen.getByText("Aarav is the owner of auth service")).toBeInTheDocument();
    expect(screen.getByText("claim-test-01")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onOpenEdit).toHaveBeenCalledTimes(1);
  });

  it("opens source citation on click", () => {
    const onOpenSource = vi.fn();
    render(
      <QueueItemCard
        item={mockItem}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
        onMarkUnknown={vi.fn()}
        onOpenEdit={vi.fn()}
        onOpenConflict={vi.fn()}
        onOpenAcceptUncertainty={vi.fn()}
        onOpenAskLeaver={vi.fn()}
        onOpenSource={onOpenSource}
        actionLoading={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /C-101/ }));
    expect(onOpenSource).toHaveBeenCalledWith("C-101", "Aarav owns auth service");
  });
});

describe("ConflictModal component", () => {
  it("shows conflicting claims side-by-side and allows resolution", () => {
    const onResolve = vi.fn();
    const onClose = vi.fn();

    render(
      <ConflictModal
        claim={mockConflictItem}
        allClaims={[mockConflictItem, mockConflictItem2]}
        onResolve={onResolve}
        onAcceptUncertainty={vi.fn()}
        onClose={onClose}
        onOpenSource={vi.fn()}
        submitting={false}
      />
    );

    expect(screen.getByText("Side-by-Side Conflict Resolution")).toBeInTheDocument();
    expect(screen.getByText(/Priya owns payments service/)).toBeInTheDocument();
    expect(screen.getByText(/Kiran owns payments service/)).toBeInTheDocument();

    // Select the first winner radio button for claim-conflict-01
    const radios = screen.getAllByLabelText("Choose this statement as truth");
    fireEvent.click(radios[0]);

    // Click Apply Choice
    fireEvent.click(screen.getByRole("button", { name: /Apply Choice/ }));
    expect(onResolve).toHaveBeenCalledWith("claim-conflict-01", "");
  });
});

describe("EditDialog component", () => {
  it("allows modifying the statement and saving with a note", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <EditDialog
        claim={mockItem}
        onSave={onSave}
        onClose={onClose}
        submitting={false}
      />
    );

    const textarea = screen.getByDisplayValue(mockItem.statement);
    fireEvent.change(textarea, { target: { value: "Aarav is the former owner of auth service" } });

    const noteInput = screen.getByPlaceholderText("Why was this statement edited?");
    fireEvent.change(noteInput, { target: { value: "Updated to clarify past role" } });

    fireEvent.click(screen.getByRole("button", { name: "Save & Re-verify" }));
    expect(onSave).toHaveBeenCalledWith(
      "Aarav is the former owner of auth service",
      "Updated to clarify past role"
    );
  });
});

describe("AcceptUncertaintyDialog component", () => {
  it("requires a rationale note to submit", () => {
    const onConfirm = vi.fn();

    render(
      <AcceptUncertaintyDialog
        claim={mockItem}
        onConfirm={onConfirm}
        onClose={vi.fn()}
        submitting={false}
      />
    );

    // Save button disabled when empty note
    const submitBtn = screen.getByRole("button", { name: "Accept Uncertainty" });
    expect(submitBtn).toBeDisabled();

    const noteInput = screen.getByPlaceholderText(/documented as known risk/);
    fireEvent.change(noteInput, { target: { value: "Verified with lead engineer" } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);
    expect(onConfirm).toHaveBeenCalledWith("Verified with lead engineer");
  });
});

describe("AskLeaverDialog component", () => {
  it("allows submitting question for the leaver", () => {
    const onSend = vi.fn();

    render(
      <AskLeaverDialog
        claim={mockItem}
        onSend={onSend}
        onClose={vi.fn()}
        submitting={false}
      />
    );

    const noteInput = screen.getByPlaceholderText(/Please clarify who manages the API credentials/);
    fireEvent.change(noteInput, { target: { value: "Can you confirm if anyone else works on auth?" } });

    fireEvent.click(screen.getByRole("button", { name: "Add to Gap Interview" }));
    expect(onSend).toHaveBeenCalledWith("Can you confirm if anyone else works on auth?");
  });
});

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { InviteMemberModal } from "../InviteMemberModal";
import { batonApi, type InvitationItem, type ProjectMember } from "../../../api/client";

vi.mock("../../../api/client", () => ({
  batonApi: {
    createInvitation: vi.fn(),
    getInvitations: vi.fn(),
    revokeInvitation: vi.fn(),
    getProjectMembers: vi.fn(),
    getRemainingTasks: vi.fn(),
    transferMemberTasks: vi.fn(),
    completeMemberHandover: vi.fn(),
  },
}));

describe("InviteMemberModal", () => {
  const mockInvitations: InvitationItem[] = [
    {
      id: "inv-1",
      project_id: "proj-1",
      code: "INV-LEAVER-A1B2C3D4",
      role: "leaver",
      email: "departing@example.com",
      status: "active",
      created_at: "2026-11-18T10:00:00Z",
      handover_deadline: "2026-12-01",
    },
    {
      id: "inv-2",
      project_id: "proj-1",
      code: "INV-MAINTAINER-E5F6G7H8",
      role: "incoming_maintainer",
      email: null,
      status: "used",
      created_at: "2026-11-17T10:00:00Z",
      used_by: "user-2",
      used_by_name: "Sarah Chen",
      used_at: "2026-11-17T12:00:00Z",
    },
    {
      id: "inv-3",
      project_id: "proj-1",
      code: "INV-APPROVER-X9Y8Z7W6",
      role: "approver",
      email: null,
      status: "revoked",
      created_at: "2026-11-16T10:00:00Z",
    },
  ];

  const mockMembers: ProjectMember[] = [
    {
      id: "usr-approver",
      name: "Engineering Lead",
      role: "approver",
      active: true,
    },
    {
      id: "usr-leaver",
      name: "Aarav Lead",
      role: "leaver",
      active: true,
      handover_deadline: "2026-12-01",
      handover_status: "active",
    },
    {
      id: "usr-contrib",
      name: "Priya Contributor",
      role: "contributor",
      active: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(batonApi.getInvitations).mockResolvedValue(mockInvitations);
    vi.mocked(batonApi.getProjectMembers).mockResolvedValue(mockMembers);
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <InviteMemberModal isOpen={false} onClose={vi.fn()} projectId="proj-1" projectName="Baton Core" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders role selection with Contributor and allows selecting a role", async () => {
    render(
      <InviteMemberModal isOpen={true} onClose={vi.fn()} projectId="proj-1" projectName="Baton Core" />
    );

    // Dialog title and bound project name
    expect(screen.getByText(/Project Invitations & Members/i)).toBeInTheDocument();
    expect(screen.getByText("Baton Core")).toBeInTheDocument();

    // Verify all 4 roles are displayed with updated Contributor label
    expect(screen.getByText(/Approver \(Engineering Lead\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^Leaver$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Incoming Maintainer$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Contributor$/i)).toBeInTheDocument();

    // Select "Approver" role
    const approverRoleBtn = screen.getByText(/Approver \(Engineering Lead\)/i).closest("button")!;
    fireEvent.click(approverRoleBtn);
  });

  it("creates an invitation code with selected role and optional email", async () => {
    const newInvitation: InvitationItem = {
      id: "inv-new",
      project_id: "proj-1",
      code: "INV-APPROVER-9988776655443322",
      role: "approver",
      email: "newlead@company.com",
      status: "active",
      created_at: "2026-11-18T12:00:00Z",
    };
    vi.mocked(batonApi.createInvitation).mockResolvedValueOnce(newInvitation);

    render(
      <InviteMemberModal isOpen={true} onClose={vi.fn()} projectId="proj-1" projectName="Baton Core" />
    );

    // Select role
    const approverBtn = screen.getByText(/Approver \(Engineering Lead\)/i).closest("button")!;
    fireEvent.click(approverBtn);

    // Enter email
    const emailInput = screen.getByLabelText(/Invitee Email/i);
    fireEvent.change(emailInput, { target: { value: "newlead@company.com" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Generate Single-Use Code/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(batonApi.createInvitation).toHaveBeenCalledWith(
        "approver",
        "newlead@company.com",
        "proj-1",
        undefined
      );
    });

    // Success screen shows code and ready-to-share message
    await waitFor(() => {
      expect(screen.getByText("INV-APPROVER-9988776655443322")).toBeInTheDocument();
      expect(screen.getByText(/Invitation Code Generated Successfully/i)).toBeInTheDocument();
    });

    // Test Copy Code
    const copyCodeBtn = screen.getByRole("button", { name: /Copy Code/i });
    fireEvent.click(copyCodeBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("INV-APPROVER-9988776655443322");
  });

  it("allows setting handover deadline when creating a Leaver invitation", async () => {
    const newLeaverInv: InvitationItem = {
      id: "inv-leaver",
      project_id: "proj-1",
      code: "INV-LEAVER-77665544",
      role: "leaver",
      email: "leaving@company.com",
      status: "active",
      handover_deadline: "2026-12-15",
      created_at: "2026-11-18T12:00:00Z",
    };
    vi.mocked(batonApi.createInvitation).mockResolvedValueOnce(newLeaverInv);

    render(
      <InviteMemberModal isOpen={true} onClose={vi.fn()} projectId="proj-1" projectName="Baton Core" />
    );

    // Select Leaver role
    const leaverBtn = screen.getByText(/^Leaver$/i).closest("button")!;
    fireEvent.click(leaverBtn);

    // Deadline input should now appear
    const deadlineInput = screen.getByLabelText(/Handover Deadline/i);
    expect(deadlineInput).toBeInTheDocument();
    fireEvent.change(deadlineInput, { target: { value: "2026-12-15" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Generate Single-Use Code/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(batonApi.createInvitation).toHaveBeenCalledWith(
        "leaver",
        undefined,
        "proj-1",
        "2026-12-15"
      );
    });
  });

  it("displays members and allows transferring tasks from Leaver to Contributor", async () => {
    vi.mocked(batonApi.getRemainingTasks).mockResolvedValueOnce({
      member_id: "usr-leaver",
      member_name: "Aarav Lead",
      role: "leaver",
      tasks_count: 2,
      claims_count: 1,
      total_count: 3,
      tasks: [
        { id: "ht-1", type: "task", title: "Document deployment pipeline", status: "not_started" },
        { id: "ht-2", type: "task", title: "Hand over AWS root credentials", status: "in_progress" },
      ],
      claims: [
        { id: "cl-1", type: "claim", title: "Architecture Diagram verified", status: "inferred" },
      ],
    });

    vi.mocked(batonApi.transferMemberTasks).mockResolvedValueOnce({
      status: "transferred",
      transferred_tasks: 2,
      transferred_claims: 1,
      target_member_id: "usr-contrib",
      target_member_name: "Priya Contributor",
    });

    render(
      <InviteMemberModal isOpen={true} onClose={vi.fn()} projectId="proj-1" projectName="Baton Core" />
    );

    // Switch to Members & Handover tab
    const membersTab = screen.getByRole("button", { name: /Members & Handover/i });
    fireEvent.click(membersTab);

    await waitFor(() => {
      expect(screen.getByText("Aarav Lead")).toBeInTheDocument();
      expect(screen.getByText("Priya Contributor")).toBeInTheDocument();
    });

    // Click "Transfer Work" on Leaver
    const transferBtn = screen.getByRole("button", { name: /Transfer Work/i });
    fireEvent.click(transferBtn);

    await waitFor(() => {
      expect(batonApi.getRemainingTasks).toHaveBeenCalledWith("proj-1", "usr-leaver");
      expect(screen.getByText("Document deployment pipeline")).toBeInTheDocument();
    });

    // Confirm transfer
    const confirmBtn = screen.getByRole("button", { name: /Confirm Transfer/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(batonApi.transferMemberTasks).toHaveBeenCalledWith("proj-1", "usr-leaver", "usr-contrib");
      expect(screen.getByText(/Successfully transferred 3 item\(s\) to Priya Contributor/i)).toBeInTheDocument();
    });
  });

  it("allows completing handover for a Leaver", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(batonApi.completeMemberHandover).mockResolvedValueOnce({
      status: "completed",
      member_id: "usr-leaver",
      active: false,
      handover_status: "completed",
    });

    render(
      <InviteMemberModal isOpen={true} onClose={vi.fn()} projectId="proj-1" projectName="Baton Core" />
    );

    // Switch to Members & Handover tab
    fireEvent.click(screen.getByRole("button", { name: /Members & Handover/i }));

    await waitFor(() => {
      expect(screen.getByText("Aarav Lead")).toBeInTheDocument();
    });

    // Complete handover
    const completeBtn = screen.getByRole("button", { name: /Complete Handover/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(batonApi.completeMemberHandover).toHaveBeenCalledWith("proj-1", "usr-leaver");
      expect(screen.getByText(/Handover completed/i)).toBeInTheDocument();
    });
  });
});

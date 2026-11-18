import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { InviteMemberModal } from "../InviteMemberModal";
import { batonApi, type InvitationItem } from "../../../api/client";

vi.mock("../../../api/client", () => ({
  batonApi: {
    createInvitation: vi.fn(),
    getInvitations: vi.fn(),
    revokeInvitation: vi.fn(),
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(batonApi.getInvitations).mockResolvedValue(mockInvitations);
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

  it("renders role selection with all 4 roles and allows selecting a role", async () => {
    render(
      <InviteMemberModal isOpen={true} onClose={vi.fn()} projectId="proj-1" projectName="Baton Core" />
    );

    // Dialog title and bound project name
    expect(screen.getByText("Project Invitations")).toBeInTheDocument();
    expect(screen.getByText("Baton Core")).toBeInTheDocument();

    // Verify all 4 roles are displayed
    expect(screen.getByText(/Approver \(Engineering Lead\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^Leaver$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Incoming Maintainer$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Incoming Contributor$/i)).toBeInTheDocument();

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
        "proj-1"
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

    // Test Copy Message
    const copyMessageBtn = screen.getByRole("button", { name: /Copy Message/i });
    fireEvent.click(copyMessageBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("INV-APPROVER-9988776655443322")
    );
  });

  it("loads and displays active, redeemed, and revoked invitations in Manage tab", async () => {
    render(
      <InviteMemberModal isOpen={true} onClose={vi.fn()} projectId="proj-1" projectName="Baton Core" />
    );

    // Switch to Manage tab
    const manageTab = screen.getByRole("button", { name: /Manage Invitations/i });
    fireEvent.click(manageTab);

    await waitFor(() => {
      expect(batonApi.getInvitations).toHaveBeenCalledWith("proj-1");
      expect(screen.getByText("INV-LEAVER-A1B2C3D4")).toBeInTheDocument();
      expect(screen.getByText("INV-MAINTAINER-E5F6G7H8")).toBeInTheDocument();
      expect(screen.getByText("INV-APPROVER-X9Y8Z7W6")).toBeInTheDocument();
    });

    // Check status labels
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Redeemed")).toBeInTheDocument();
    expect(screen.getByText("Revoked")).toBeInTheDocument();
    expect(screen.getByText(/Redeemed by Sarah Chen/i)).toBeInTheDocument();

    // Filter by Active only
    const activeFilterBtn = screen.getByRole("button", { name: /^active/i });
    fireEvent.click(activeFilterBtn);

    expect(screen.getByText("INV-LEAVER-A1B2C3D4")).toBeInTheDocument();
    expect(screen.queryByText("INV-MAINTAINER-E5F6G7H8")).not.toBeInTheDocument();
    expect(screen.queryByText("INV-APPROVER-X9Y8Z7W6")).not.toBeInTheDocument();
  });

  it("allows Approver to revoke an active invitation", async () => {
    vi.mocked(batonApi.revokeInvitation).mockResolvedValueOnce({
      id: "inv-1",
      status: "revoked",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <InviteMemberModal isOpen={true} onClose={vi.fn()} projectId="proj-1" projectName="Baton Core" />
    );

    // Switch to Manage tab
    fireEvent.click(screen.getByRole("button", { name: /Manage Invitations/i }));

    await waitFor(() => {
      expect(screen.getByText("INV-LEAVER-A1B2C3D4")).toBeInTheDocument();
    });

    // Click revoke button for active invitation
    const revokeBtn = screen.getByRole("button", { name: /^revoke$/i });
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(batonApi.revokeInvitation).toHaveBeenCalledWith("inv-1");
    });
  });

  it("closes modal on close button click", () => {
    const onClose = vi.fn();
    render(
      <InviteMemberModal isOpen={true} onClose={onClose} projectId="proj-1" projectName="Baton Core" />
    );

    const closeBtn = screen.getByRole("button", { name: /Close modal/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

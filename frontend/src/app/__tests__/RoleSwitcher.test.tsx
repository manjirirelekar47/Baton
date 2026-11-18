import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RoleSwitcher } from "../RoleSwitcher";

const mockUseAuth = vi.fn();
vi.mock("../auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("RoleSwitcher", () => {
  it("renders a dropdown selector for demo users", () => {
    const switchRole = vi.fn();
    mockUseAuth.mockReturnValue({
      user: { id: "demo-1", name: "Demo User", role: "approver", is_demo: true },
      switchRole,
    });

    render(<RoleSwitcher />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("approver");

    fireEvent.change(select, { target: { value: "leaver" } });
    expect(switchRole).toHaveBeenCalledWith("leaver");
  });

  it("renders a static locked role badge and no select element for registered non-demo accounts", () => {
    const switchRole = vi.fn();
    mockUseAuth.mockReturnValue({
      user: { id: "reg-1", name: "Real User", role: "incoming_maintainer", is_demo: false },
      switchRole,
    });

    render(<RoleSwitcher />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/Incoming Maintainer/i)).toBeInTheDocument();
    expect(screen.getByText(/Role:/i)).toBeInTheDocument();
  });
});

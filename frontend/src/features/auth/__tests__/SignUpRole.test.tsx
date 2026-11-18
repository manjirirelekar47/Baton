import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUp } from "@/pages/SignUp";

const { signInWithPassword, signUp, signOut, resetPasswordForEmail, getSession, onAuthStateChange, loginDemo } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  loginDemo: vi.fn(),
}));

vi.mock("@/features/auth/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithPassword,
      signUp,
      signOut,
      resetPasswordForEmail,
      getSession,
      onAuthStateChange,
    },
  },
}));

vi.mock("@/app/auth", () => ({
  useAuth: () => ({
    loginDemo,
    switchRole: vi.fn(),
    register: vi.fn().mockResolvedValue(undefined),
    syncSession: vi.fn().mockResolvedValue({ registered: true }),
  }),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ toggleTheme: vi.fn(), isDark: false }),
}));

describe("Role-based SignUp Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    signOut.mockResolvedValue({ error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("renders all four role options on the signup screen with none pre-selected", () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Approver (Engineering Lead)")).toBeInTheDocument();
    expect(screen.getByText("Leaver")).toBeInTheDocument();
    expect(screen.getByText("Incoming Maintainer")).toBeInTheDocument();
    expect(screen.getByText("Incoming Contributor")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Invitation Code/i)).not.toBeInTheDocument();
  });

  it("requires explicit role selection before signup (blocks submission if no role is chosen)", async () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "No Role User" } });
    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "norole@example.com" } });
    fireEvent.change(screen.getByLabelText("Create Password"), { target: { value: "Pass12345!" } });
    fireEvent.change(screen.getByLabelText("Repeat Password"), { target: { value: "Pass12345!" } });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/Please select a role to continue/i)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
    expect(loginDemo).not.toHaveBeenCalled();
  });

  it("does not show invitation code input when non-approver role is selected", () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </MemoryRouter>
    );

    // Select Contributor
    fireEvent.click(screen.getByText("Incoming Contributor"));
    expect(screen.queryByLabelText(/Invitation Code/i)).not.toBeInTheDocument();

    // Select Leaver
    fireEvent.click(screen.getByText("Leaver"));
    expect(screen.queryByLabelText(/Invitation Code/i)).not.toBeInTheDocument();

    // Select Maintainer
    fireEvent.click(screen.getByText("Incoming Maintainer"));
    expect(screen.queryByLabelText(/Invitation Code/i)).not.toBeInTheDocument();
  });

  it("dynamically displays invitation code field when Approver role is selected", () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByLabelText(/Invitation Code/i)).not.toBeInTheDocument();

    // Select Approver
    fireEvent.click(screen.getByText("Approver (Engineering Lead)"));
    const inviteInput = screen.getByLabelText(/Invitation Code/i);
    expect(inviteInput).toBeInTheDocument();
    expect(inviteInput).toHaveAttribute("placeholder", "e.g. INV-APPROVER-8F92A1B7C4");
  });

  it("blocks submission and shows error if Approver is selected without invitation code", async () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Lead User" } });
    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "lead@example.com" } });
    fireEvent.change(screen.getByLabelText("Create Password"), { target: { value: "Pass12345!" } });
    fireEvent.change(screen.getByLabelText("Repeat Password"), { target: { value: "Pass12345!" } });
    fireEvent.click(screen.getByText("Approver (Engineering Lead)"));
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/Approver registration requires a valid invitation code/i)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
    expect(loginDemo).not.toHaveBeenCalled();
  });

  it("allows non-approver role signup without invitation code", async () => {
    signUp.mockResolvedValue({
      data: { user: { identities: [{ id: "id-1" }] }, session: null },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<div>Welcome Back</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Maintainer User" } });
    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "maint@example.com" } });
    fireEvent.change(screen.getByLabelText("Create Password"), { target: { value: "Pass12345!" } });
    fireEvent.change(screen.getByLabelText("Repeat Password"), { target: { value: "Pass12345!" } });
    fireEvent.click(screen.getByText("Incoming Maintainer"));
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "maint@example.com",
          options: expect.objectContaining({
            data: expect.objectContaining({
              role: "incoming_maintainer",
            }),
          }),
        })
      );
    });
    expect(loginDemo).not.toHaveBeenCalled();
  });

  it("submits approver registration with valid invitation code successfully", async () => {
    signUp.mockResolvedValue({
      data: { user: { identities: [{ id: "id-2" }] }, session: null },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<div>Welcome Back</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Lead User" } });
    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "lead@example.com" } });
    fireEvent.change(screen.getByLabelText("Create Password"), { target: { value: "Pass12345!" } });
    fireEvent.change(screen.getByLabelText("Repeat Password"), { target: { value: "Pass12345!" } });
    fireEvent.click(screen.getByText("Approver (Engineering Lead)"));
    fireEvent.change(screen.getByLabelText(/Invitation Code/i), {
      target: { value: "INV-APPROVER-RANDOM123" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "lead@example.com",
          options: expect.objectContaining({
            data: expect.objectContaining({
              role: "approver",
              invitation_code: "INV-APPROVER-RANDOM123",
            }),
          }),
        })
      );
    });
    expect(loginDemo).not.toHaveBeenCalled();
  });
});

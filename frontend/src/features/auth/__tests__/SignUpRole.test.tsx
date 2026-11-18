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

describe("SignUp Flow - Role Selection Removed (Bug 2 & Bug 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    signOut.mockResolvedValue({ error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("does not render role selection buttons on the signup screen", () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </MemoryRouter>
    );

    // Role options should not be displayed on the signup form
    expect(screen.queryByText("Approver (Engineering Lead)")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose Role")).not.toBeInTheDocument();
    expect(screen.queryByText("Select Your Role")).not.toBeInTheDocument();

    // Instead, an optional invitation code field is available
    expect(screen.getByLabelText(/Invitation Code/i)).toBeInTheDocument();
  });

  it("allows account creation without requiring any role selection", async () => {
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

    fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "New User" } });
    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "newuser@example.com" } });
    fireEvent.change(screen.getByLabelText("Create Password"), { target: { value: "Pass12345!" } });
    fireEvent.change(screen.getByLabelText("Repeat Password"), { target: { value: "Pass12345!" } });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "newuser@example.com",
          options: expect.objectContaining({
            data: expect.objectContaining({
              full_name: "New User",
            }),
          }),
        })
      );
    });
    expect(loginDemo).not.toHaveBeenCalled();
  });

  it("submits signup with optional invitation code when provided", async () => {
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

    fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Invited Lead" } });
    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "invited@example.com" } });
    fireEvent.change(screen.getByLabelText("Create Password"), { target: { value: "Pass12345!" } });
    fireEvent.change(screen.getByLabelText("Repeat Password"), { target: { value: "Pass12345!" } });
    fireEvent.change(screen.getByLabelText(/Invitation Code/i), {
      target: { value: "INV-LEAVER-XYZ123" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "invited@example.com",
          options: expect.objectContaining({
            data: expect.objectContaining({
              full_name: "Invited Lead",
              invitation_code: "INV-LEAVER-XYZ123",
            }),
          }),
        })
      );
    });
    expect(loginDemo).not.toHaveBeenCalled();
  });
});

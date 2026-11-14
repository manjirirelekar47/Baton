import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUp } from "@/pages/SignUp";

const { signInWithPassword, resetPasswordForEmail, getSession, onAuthStateChange, loginDemo } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
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
      resetPasswordForEmail,
      getSession,
      onAuthStateChange,
    },
  },
}));

vi.mock("@/app/auth", () => ({
  useAuth: () => ({ loginDemo, switchRole: vi.fn() }),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ toggleTheme: vi.fn(), isDark: false }),
}));

describe("Supabase sign-in page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("shows Supabase credential errors and does not open the demo workspace", async () => {
    signInWithPassword.mockResolvedValue({ error: new Error("Invalid login credentials") });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<SignUp />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Work Email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "incorrect-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in to baton/i }));

    expect(await screen.findByText("Invalid login credentials")).toBeInTheDocument();
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "incorrect-password",
    });
    expect(loginDemo).not.toHaveBeenCalled();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("starts Supabase password recovery instead of a demo login", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<SignUp />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Work Email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalled());
    expect(loginDemo).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/reset link is on its way/i);
  });
});

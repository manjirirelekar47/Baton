import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  useAuth: () => ({ loginDemo, switchRole: vi.fn() }),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ toggleTheme: vi.fn(), isDark: false }),
}));

describe("Supabase sign-in page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    signOut.mockResolvedValue({ error: null });
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

  it("opens account creation from the sign-in footer link", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<SignUp />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const signupLinks = screen.getAllByRole("button", { name: "Sign up here" });
    fireEvent.click(signupLinks[signupLinks.length - 1]);

    expect(await screen.findByRole("heading", { name: "Create Your Account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Repeat Password")).toBeInTheDocument();
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

  it("keeps a password recovery callback on the reset form instead of opening the app", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<SignUp />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const authStateChangeHandler = onAuthStateChange.mock.calls[0][0];
    const recoverySession = { user: { id: "user-1" } };
    act(() => {
      authStateChangeHandler("PASSWORD_RECOVERY", recoverySession);
      authStateChangeHandler("SIGNED_IN", recoverySession);
    });

    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
    expect(loginDemo).not.toHaveBeenCalled();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("returns to sign-in after a new account is created and asks for email confirmation", async () => {
    signUp.mockResolvedValue({
      data: { user: { identities: [{ id: "identity-1" }] }, session: null },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/login" element={<SignUp />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Example User" } });
    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Create Password"), { target: { value: "StrongPass123!" } });
    fireEvent.change(screen.getByLabelText("Repeat Password"), { target: { value: "StrongPass123!" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(/account created.*confirm it/i);
    expect(screen.getByLabelText("Work Email")).toHaveValue("person@example.com");
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ email: "person@example.com" }));
    expect(loginDemo).not.toHaveBeenCalled();
  });

  it("takes duplicate-email signup attempts to sign-in with a password-reset hint", async () => {
    signUp.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/login" element={<SignUp />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Example User" } });
    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Create Password"), { target: { value: "StrongPass123!" } });
    fireEvent.change(screen.getByLabelText("Repeat Password"), { target: { value: "StrongPass123!" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
    expect(await screen.findByText(/an account may already exist.*forgot password/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Work Email")).toHaveValue("person@example.com");
  });

  it("clears the session and returns to sign-in when email confirmation is disabled", async () => {
    signUp.mockResolvedValue({
      data: { user: { identities: [{ id: "identity-1" }] }, session: { access_token: "test-token" } },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/login" element={<SignUp />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Example User" } });
    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Create Password"), { target: { value: "StrongPass123!" } });
    fireEvent.change(screen.getByLabelText("Repeat Password"), { target: { value: "StrongPass123!" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(/account created.*sign in/i);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(loginDemo).not.toHaveBeenCalled();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});

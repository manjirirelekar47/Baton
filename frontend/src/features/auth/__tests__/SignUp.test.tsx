import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUp } from "@/pages/SignUp";
import { SignIn } from "@/pages/SignIn";

const { signInWithPassword, signUp, signOut, resetPasswordForEmail, getSession, onAuthStateChange, loginDemo, joinProject } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  loginDemo: vi.fn(),
  joinProject: vi.fn(),
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
  useAuth: () => ({ loginDemo, switchRole: vi.fn(), joinProject }),
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

  it("explains the Supabase duplicate-account OAuth callback error", async () => {
    render(
      <MemoryRouter initialEntries={["/login?error=server_error&error_description=Multiple%20accounts%20with%20the%20same%20email%20address"]}>
        <Routes>
          <Route path="/login" element={<SignUp />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Supabase found more than one account/i)).toBeInTheDocument();
    expect(screen.getByText(/Link GitHub account from the profile menu/i)).toBeInTheDocument();
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

  it("shows and hides both password fields when their visibility buttons are clicked", () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/login" element={<SignUp />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </MemoryRouter>,
    );

    const password = screen.getByLabelText("Create Password");
    const repeatPassword = screen.getByLabelText("Repeat Password");
    expect(password).toHaveAttribute("type", "password");
    expect(repeatPassword).toHaveAttribute("type", "password");

    fireEvent.change(password, { target: { value: "StrongPass123!" } });
    fireEvent.change(repeatPassword, { target: { value: "StrongPass123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    fireEvent.click(screen.getByRole("button", { name: "Show repeat password" }));

    expect(screen.getByLabelText("Create Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Repeat Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Create Password")).toHaveValue("StrongPass123!");
    expect(screen.getByLabelText("Repeat Password")).toHaveValue("StrongPass123!");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide repeat password" }));

    expect(screen.getByLabelText("Create Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Repeat Password")).toHaveAttribute("type", "password");
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

  it("SignIn component redeems pending invite code from URL, calls joinProject, and navigates to dashboard", async () => {
    joinProject.mockResolvedValue({ id: "proj-approver-shared", name: "Approver Core Service", role: "leaver" });
    signInWithPassword.mockImplementation(async () => {
      getSession.mockResolvedValue({
        data: {
          session: {
            access_token: "mock-supabase-token",
            user: { id: "usr-leaver-1", email: "leaver@example.com", user_metadata: { full_name: "Taylor Leaver" } },
          },
        },
        error: null,
      });
      return { error: null };
    });

    render(
      <MemoryRouter initialEntries={["/signin?invite=INV-LEAVER-7788"]}>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/dashboard" element={<div>Dashboard Active Workspace</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Work Email"), { target: { value: "leaver@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "SecretPass123!" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in to baton/i }));
    });

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "leaver@example.com",
        password: "SecretPass123!",
      });
      expect(joinProject).toHaveBeenCalledWith("INV-LEAVER-7788");
      expect(screen.getByText("Dashboard Active Workspace")).toBeInTheDocument();
    });
  });
});

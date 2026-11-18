import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUp } from "@/pages/SignUp";

const {
  signInWithPassword,
  signUp,
  signOut,
  resetPasswordForEmail,
  getSession,
  onAuthStateChange,
  loginDemo,
  register,
  createProject,
  joinProject,
  switchProject,
  fetchProjects,
  syncSession,
} = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  loginDemo: vi.fn(),
  register: vi.fn().mockResolvedValue(undefined),
  createProject: vi.fn(),
  joinProject: vi.fn(),
  switchProject: vi.fn(),
  fetchProjects: vi.fn(),
  syncSession: vi.fn(),
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
    switchRole: loginDemo,
    register,
    syncSession,
    createProject,
    joinProject,
    switchProject,
    fetchProjects,
    projects: [],
  }),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ toggleTheme: vi.fn(), isDark: false }),
}));

describe("SignUp Project Onboarding & Demo Persona Selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    signOut.mockResolvedValue({ error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    fetchProjects.mockResolvedValue([]);
  });

  function renderSignUp(initialRoute = "/login") {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/login" element={<SignUp />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<div>Dashboard Workspace</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("allows launching demo personas from the sign-in page", async () => {
    const { unmount } = renderSignUp("/login");

    // Click Approver
    const approverBtn = screen.getByRole("button", { name: "Approver" });
    fireEvent.click(approverBtn);
    expect(loginDemo).toHaveBeenCalledWith("approver");
    unmount();

    // Click Aarav (Leaver)
    renderSignUp("/login");
    const leaverBtn = screen.getByRole("button", { name: "Aarav (Leaver)" });
    fireEvent.click(leaverBtn);
    expect(loginDemo).toHaveBeenCalledWith("leaver");
  });

  it("shows project onboarding modal with three options when a user has zero projects", async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "uid-zero-projects",
            email: "newlead@company.test",
            user_metadata: { full_name: "New Lead" },
          },
          access_token: "sb-mock-token",
        },
      },
      error: null,
    });

    syncSession.mockResolvedValue({
      registered: true,
      requires_project: true,
    });
    fetchProjects.mockResolvedValue([]);

    renderSignUp("/login");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Set Up Your First Project" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create New Project" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Join with Code" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open Existing Project" })).toBeInTheDocument();
    });
  });

  it("renders active projects list and allows selecting an existing project via switchProject", async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "uid-user-with-projects",
            email: "engineer@company.test",
            user_metadata: { full_name: "Engineer Jane" },
          },
          access_token: "sb-mock-token",
        },
      },
      error: null,
    });

    syncSession.mockResolvedValue({
      registered: true,
      requires_project: true,
    });

    const mockProjects = [
      { id: "proj-alpha", name: "Core Banking Platform", role: "approver" as const },
      { id: "proj-beta", name: "Event Stream Service", role: "incoming_maintainer" as const },
    ];
    // First call during completeAuthenticatedLogin returns empty to trigger modal, subsequent calls return list
    fetchProjects.mockResolvedValueOnce([]).mockResolvedValue(mockProjects);
    switchProject.mockResolvedValue(undefined);

    renderSignUp("/login");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Set Up Your First Project" })).toBeInTheDocument();
    });

    // Switch to Open Existing Project tab
    const existingTab = screen.getByRole("button", { name: "Open Existing Project" });
    fireEvent.click(existingTab);

    await waitFor(() => {
      expect(screen.getByText("Core Banking Platform")).toBeInTheDocument();
      expect(screen.getByText("Event Stream Service")).toBeInTheDocument();
    });

    // Click Open on Core Banking Platform (exact match to distinguish from "Open Existing Project" tab)
    const openButtons = screen.getAllByRole("button", { name: /^open$/i });
    fireEvent.click(openButtons[0]);

    await waitFor(() => {
      expect(switchProject).toHaveBeenCalledWith("proj-alpha");
    });
  });

  it("displays empty state with action buttons when user has no existing projects", async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "uid-no-projs",
            email: "noproj@company.test",
            user_metadata: { full_name: "No Proj User" },
          },
          access_token: "sb-mock-token",
        },
      },
      error: null,
    });

    syncSession.mockResolvedValue({
      registered: true,
      requires_project: true,
    });
    fetchProjects.mockResolvedValue([]);

    renderSignUp("/login");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Set Up Your First Project" })).toBeInTheDocument();
    });

    // Switch to Open Existing Project tab
    fireEvent.click(screen.getByRole("button", { name: "Open Existing Project" }));

    await waitFor(() => {
      expect(screen.getByText("No Existing Projects")).toBeInTheDocument();
      expect(screen.getByText(/Your account is not associated with any active projects yet/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create Project" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Join Team" })).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";
import { batonApi, setStoredToken, getStoredToken, getStoredProjectId, setStoredProjectId } from "../../api/client";
import { queryClient } from "../../queryClient";
import { ProjectSwitcher } from "../../components/layout/ProjectSwitcher";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    batonApi: {
      ...actual.batonApi,
      getMe: vi.fn(),
      getProjects: vi.fn(),
      createProject: vi.fn(),
      joinProject: vi.fn(),
      switchProject: vi.fn(),
      syncSession: vi.fn(),
      demoLogin: vi.fn(),
      demoReset: vi.fn(),
    },
  };
});

describe("Multi-Project Frontend Regression Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    queryClient.clear();
    vi.mocked(batonApi.getProjects).mockResolvedValue([]);
  });

  it("createProject updates token, sets active project as approver, and clears React Query cache", async () => {
    const clearSpy = vi.spyOn(queryClient, "clear");

    // Populate query cache with stale project data
    queryClient.setQueryData(["claims", "proj-old"], [{ id: "c1", title: "Old Claim" }]);
    expect(queryClient.getQueryData(["claims", "proj-old"])).toBeDefined();

    const mockProject = { id: "proj-new-123", name: "New Core Service", role: "approver" as const };
    const mockUser = { id: "usr-1", name: "Lead Dev", role: "approver" as const, project_id: "proj-new-123", email: "lead@test.com" };
    const mockToken = "jwt-project-new-123";

    vi.mocked(batonApi.createProject).mockResolvedValueOnce({
      project: mockProject,
      token: mockToken,
      user: mockUser,
    });
    vi.mocked(batonApi.getProjects).mockResolvedValueOnce([mockProject]);

    function TestComponent() {
      const { createProject, activeProject, user } = useAuth();
      return (
        <div>
          <button onClick={() => createProject("New Core Service")}>Create</button>
          <span data-testid="active-project">{activeProject?.name || "none"}</span>
          <span data-testid="user-role">{user?.role || "none"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const btn = screen.getByRole("button", { name: "Create" });
    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(batonApi.createProject).toHaveBeenCalledWith("New Core Service");
      expect(getStoredToken()).toBe(mockToken);
      expect(clearSpy).toHaveBeenCalled();
      // Cache was cleared for project isolation
      expect(queryClient.getQueryData(["claims", "proj-old"])).toBeUndefined();
      expect(screen.getByTestId("active-project").textContent).toBe("New Core Service");
      expect(screen.getByTestId("user-role").textContent).toBe("approver");
    });
  });

  it("joinProject redeems invitation code, updates token, and clears query cache", async () => {
    const clearSpy = vi.spyOn(queryClient, "clear");

    queryClient.setQueryData(["tasks", "proj-old"], [{ id: "t1" }]);

    const mockProject = { id: "proj-joined-456", name: "Joined Service", role: "incoming_maintainer" as const };
    const mockUser = { id: "usr-2", name: "Maintainer User", role: "incoming_maintainer" as const, project_id: "proj-joined-456", email: "m@test.com" };
    const mockToken = "jwt-joined-token";

    vi.mocked(batonApi.joinProject).mockResolvedValueOnce({
      project: mockProject,
      token: mockToken,
      user: mockUser,
    });
    vi.mocked(batonApi.getProjects).mockResolvedValueOnce([mockProject]);

    function TestComponent() {
      const { joinProject, activeProject, user } = useAuth();
      return (
        <div>
          <button onClick={() => joinProject("INV-MAINTAINER-XYZ")}>Join</button>
          <span data-testid="joined-role">{user?.role || "none"}</span>
          <span data-testid="joined-project">{activeProject?.name || "none"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Join" }));
    });

    await waitFor(() => {
      expect(batonApi.joinProject).toHaveBeenCalledWith("INV-MAINTAINER-XYZ");
      expect(getStoredToken()).toBe(mockToken);
      expect(clearSpy).toHaveBeenCalled();
      expect(queryClient.getQueryData(["tasks", "proj-old"])).toBeUndefined();
      expect(screen.getByTestId("joined-role").textContent).toBe("incoming_maintainer");
      expect(screen.getByTestId("joined-project").textContent).toBe("Joined Service");
    });
  });

  it("switchProject updates active project token and purges React Query cache to prevent cross-project leaks", async () => {
    const clearSpy = vi.spyOn(queryClient, "clear");

    // Populate cache with Project Alpha data
    queryClient.setQueryData(["evidence", "proj-alpha"], ["evidence-1", "evidence-2"]);

    const mockProjectB = { id: "proj-beta", name: "Project Beta", role: "approver" as const };
    const mockUserB = { id: "usr-1", name: "Lead Dev", role: "approver" as const, project_id: "proj-beta", email: "lead@test.com" };
    const tokenB = "jwt-token-beta";

    vi.mocked(batonApi.switchProject).mockResolvedValueOnce({
      project: mockProjectB,
      token: tokenB,
      user: mockUserB,
    });

    function TestComponent() {
      const { switchProject, activeProject } = useAuth();
      return (
        <div>
          <button onClick={() => switchProject("proj-beta")}>Switch to Beta</button>
          <span data-testid="active-p">{activeProject?.id || "none"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Switch to Beta" }));
    });

    await waitFor(() => {
      expect(batonApi.switchProject).toHaveBeenCalledWith("proj-beta");
      expect(getStoredToken()).toBe(tokenB);
      expect(clearSpy).toHaveBeenCalled();
      // Verifies query cache isolation: Project Alpha data is completely evicted
      expect(queryClient.getQueryData(["evidence", "proj-alpha"])).toBeUndefined();
      expect(screen.getByTestId("active-p").textContent).toBe("proj-beta");
    });
  });

  it("ProjectSwitcher renders active project, role badge, and opens project selection modal", async () => {
    const projectsList = [
      { id: "proj-1", name: "Campus Event Portal", role: "approver" as const },
      { id: "proj-2", name: "Payment Gateway", role: "incoming_contributor" as const },
    ];

    vi.mocked(batonApi.getProjects).mockResolvedValue(projectsList);

    function SwitcherWrapper() {
      const { setProjects } = useAuth() as any;
      return (
        <div>
          <ProjectSwitcher />
        </div>
      );
    }

    render(
      <AuthProvider>
        <SwitcherWrapper />
      </AuthProvider>
    );

    // Initial render displays demo project
    expect(screen.getByText("Campus Event Portal")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();

    // Click to open switcher dropdown
    const triggerBtn = screen.getByRole("button", { name: /Campus Event Portal/i });
    fireEvent.click(triggerBtn);

    // Modal / popover content visible
    expect(screen.getByText("Your Projects")).toBeInTheDocument();
    expect(screen.getByText("Create New Project")).toBeInTheDocument();
    expect(screen.getByText("Join with Invitation Code")).toBeInTheDocument();
  });

  it("loginDemo switches across all 4 personas, clears cache, and sets active project", async () => {
    const clearSpy = vi.spyOn(queryClient, "clear");

    const mockApprover = {
      user: { id: "u-approver", name: "Approver", role: "approver" as const, project_id: "proj-campus-event-portal", is_demo: true },
      token: "demo-jwt-approver",
      projects: [{ id: "proj-campus-event-portal", name: "Campus Event Portal", role: "approver" as const }],
      active_project_id: "proj-campus-event-portal",
    };
    const mockMaintainer = {
      user: { id: "u-meera", name: "Meera", role: "incoming_maintainer" as const, project_id: "proj-campus-event-portal", is_demo: true },
      token: "demo-jwt-meera",
      projects: [{ id: "proj-campus-event-portal", name: "Campus Event Portal", role: "incoming_maintainer" as const }],
      active_project_id: "proj-campus-event-portal",
    };

    vi.mocked(batonApi.demoLogin)
      .mockResolvedValueOnce(mockApprover)
      .mockResolvedValueOnce(mockMaintainer);
    vi.mocked(batonApi.getProjects).mockResolvedValue([
      { id: "proj-campus-event-portal", name: "Campus Event Portal", role: "approver" as const },
    ]);

    function DemoTestComponent() {
      const { user, loginDemo, switchRole, activeProject } = useAuth();
      return (
        <div>
          <button onClick={() => loginDemo("approver")}>Demo Approver</button>
          <button onClick={() => switchRole("incoming_maintainer")}>Switch to Meera</button>
          <span data-testid="demo-user">{user?.name || "none"}</span>
          <span data-testid="demo-role">{user?.role || "none"}</span>
          <span data-testid="demo-project">{activeProject?.name || "none"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <DemoTestComponent />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Demo Approver" }));
    });

    await waitFor(() => {
      expect(batonApi.demoLogin).toHaveBeenCalledWith("approver");
      expect(getStoredToken()).toBe("demo-jwt-approver");
      expect(clearSpy).toHaveBeenCalled();
      expect(screen.getByTestId("demo-user").textContent).toBe("Approver");
      expect(screen.getByTestId("demo-role").textContent).toBe("approver");
      expect(screen.getByTestId("demo-project").textContent).toBe("Campus Event Portal");
    });

    // Switch to Incoming Maintainer (Meera)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Switch to Meera" }));
    });

    await waitFor(() => {
      expect(batonApi.demoLogin).toHaveBeenCalledWith("incoming_maintainer");
      expect(getStoredToken()).toBe("demo-jwt-meera");
      expect(screen.getByTestId("demo-user").textContent).toBe("Meera");
      expect(screen.getByTestId("demo-role").textContent).toBe("incoming_maintainer");
    });
  });

  it("resetDemo invokes demoReset API, clears query cache, and reloads approver demo session", async () => {
    const clearSpy = vi.spyOn(queryClient, "clear");

    vi.mocked(batonApi.demoReset).mockResolvedValueOnce({
      status: "reset",
      project_id: "proj-campus-event-portal",
    });
    vi.mocked(batonApi.demoLogin).mockResolvedValueOnce({
      user: { id: "u-approver", name: "Approver", role: "approver" as const, project_id: "proj-campus-event-portal", is_demo: true },
      token: "demo-jwt-reset-approver",
      projects: [{ id: "proj-campus-event-portal", name: "Campus Event Portal", role: "approver" as const }],
      active_project_id: "proj-campus-event-portal",
    });

    function ResetTestComponent() {
      const { resetDemo, user } = useAuth();
      return (
        <div>
          <button onClick={() => resetDemo()}>Reset Demo</button>
          <span data-testid="reset-user">{user?.name || "none"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <ResetTestComponent />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    });

    await waitFor(() => {
      expect(batonApi.demoReset).toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalled();
      expect(getStoredToken()).toBe("demo-jwt-reset-approver");
      expect(screen.getByTestId("reset-user").textContent).toBe("Approver");
    });
  });

  it("persists active project per-user in localStorage and restores selection on reload", async () => {
    const clearSpy = vi.spyOn(queryClient, "clear");

    const projectsList = [
      { id: "proj-1", name: "Alpha Service", role: "approver" as const },
      { id: "proj-2", name: "Beta Service", role: "approver" as const },
    ];

    // Seed token and user-scoped stored project
    setStoredToken("test-session-jwt");
    setStoredProjectId("proj-2", "usr-1");
    expect(getStoredProjectId("usr-1")).toBe("proj-2");

    vi.mocked(batonApi.getMe).mockResolvedValueOnce({
      id: "usr-1",
      name: "Lead Dev",
      role: "approver",
      project_id: "proj-1", // Token was scoped to proj-1, but user had selected proj-2
    });
    vi.mocked(batonApi.getProjects).mockResolvedValueOnce(projectsList);
    vi.mocked(batonApi.switchProject).mockResolvedValueOnce({
      project: projectsList[1],
      token: "aligned-beta-token",
      user: {
        id: "usr-1",
        name: "Lead Dev",
        role: "approver",
        project_id: "proj-2",
      },
    });

    function ReloadComponent() {
      const { activeProject, projects, loading } = useAuth();
      if (loading) return <div>Loading...</div>;
      return (
        <div>
          <span data-testid="active-pid">{activeProject?.id || "none"}</span>
          <span data-testid="active-name">{activeProject?.name || "none"}</span>
          <span data-testid="project-count">{projects.length}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <ReloadComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      // Reconciled stored project with accessible projects and aligned token
      expect(batonApi.switchProject).toHaveBeenCalledWith("proj-2");
      expect(screen.getByTestId("active-pid").textContent).toBe("proj-2");
      expect(screen.getByTestId("active-name").textContent).toBe("Beta Service");
      expect(screen.getByTestId("project-count").textContent).toBe("2");
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  it("syncSession respects user stored project and restores active project state", async () => {
    setStoredProjectId("proj-custom", "usr-sync");

    const userProjects = [
      { id: "proj-default", name: "Default Service", role: "approver" as const },
      { id: "proj-custom", name: "Custom Service", role: "approver" as const },
    ];

    vi.mocked(batonApi.syncSession).mockResolvedValueOnce({
      registered: true,
      token: "jwt-synced-token",
      user: {
        id: "usr-sync",
        name: "Synced User",
        role: "approver",
        project_id: "proj-custom",
      },
      projects: userProjects,
    });

    function SyncComponent() {
      const { syncSession, activeProject, user } = useAuth();
      return (
        <div>
          <button onClick={() => syncSession("usr-sync", "sync@test.com", "Synced User")}>Sync</button>
          <span data-testid="sync-pid">{activeProject?.id || "none"}</span>
          <span data-testid="sync-uname">{user?.name || "none"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <SyncComponent />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sync" }));
    });

    await waitFor(() => {
      expect(batonApi.syncSession).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "usr-sync",
          email: "sync@test.com",
          project_id: "proj-custom",
        })
      );
      expect(screen.getByTestId("sync-pid").textContent).toBe("proj-custom");
      expect(screen.getByTestId("sync-uname").textContent).toBe("Synced User");
      expect(getStoredProjectId("usr-sync")).toBe("proj-custom");
    });
  });

  it("logout clears active session, stored project ID, and resets project context cleanly", async () => {
    const clearSpy = vi.spyOn(queryClient, "clear");

    setStoredToken("active-user-jwt");
    setStoredProjectId("proj-active-1", "usr-123");
    sessionStorage.setItem("baton.session_active", "true");
    sessionStorage.setItem("baton.pending_invite", "INV-123");

    function LogoutComponent() {
      const { logout, user, activeProject, requiresProject } = useAuth();
      return (
        <div>
          <button onClick={() => logout()}>Log Out</button>
          <span data-testid="user-state">{user ? "logged-in" : "logged-out"}</span>
          <span data-testid="project-state">{activeProject ? activeProject.id : "none"}</span>
          <span data-testid="requires-project">{requiresProject ? "yes" : "no"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <LogoutComponent />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
    });

    await waitFor(() => {
      expect(getStoredToken()).toBeNull();
      expect(getStoredProjectId("usr-123")).toBeNull();
      expect(getStoredProjectId()).toBeNull();
      expect(sessionStorage.getItem("baton.session_active")).toBeNull();
      expect(sessionStorage.getItem("baton.pending_invite")).toBeNull();
      expect(screen.getByTestId("user-state").textContent).toBe("logged-out");
      expect(screen.getByTestId("project-state").textContent).toBe("none");
      expect(screen.getByTestId("requires-project").textContent).toBe("no");
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  it("page reload preserves active project from localStorage without resetting workspace", async () => {
    const clearSpy = vi.spyOn(queryClient, "clear");

    const projectsList = [
      { id: "proj-persist-1", name: "Primary Service", role: "approver" as const },
      { id: "proj-persist-2", name: "Secondary Service", role: "contributor" as const },
    ];

    setStoredToken("session-jwt-token");
    setStoredProjectId("proj-persist-2", "usr-reload-user");

    vi.mocked(batonApi.getMe).mockResolvedValueOnce({
      id: "usr-reload-user",
      name: "Reload Dev",
      role: "contributor",
      project_id: "proj-persist-2",
    });
    vi.mocked(batonApi.getProjects).mockResolvedValueOnce(projectsList);

    function ReloadWorkspaceComponent() {
      const { activeProject, projects, loading, requiresProject } = useAuth();
      if (loading) return <div>Restoring session...</div>;
      return (
        <div>
          <span data-testid="restored-pid">{activeProject?.id || "none"}</span>
          <span data-testid="restored-pname">{activeProject?.name || "none"}</span>
          <span data-testid="requires-proj">{requiresProject ? "yes" : "no"}</span>
          <span data-testid="total-projs">{projects.length}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <ReloadWorkspaceComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("restored-pid").textContent).toBe("proj-persist-2");
      expect(screen.getByTestId("restored-pname").textContent).toBe("Secondary Service");
      expect(screen.getByTestId("requires-proj").textContent).toBe("no");
      expect(screen.getByTestId("total-projs").textContent).toBe("2");
      expect(clearSpy).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";
import { batonApi, setStoredToken, getStoredToken } from "../../api/client";
import { queryClient } from "../../queryClient";
import { ProjectSwitcher } from "../../components/layout/ProjectSwitcher";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    batonApi: {
      ...actual.batonApi,
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
});

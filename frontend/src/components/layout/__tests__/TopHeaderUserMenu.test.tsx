import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TopHeaderUserMenu } from "../TopHeaderUserMenu";
import { DashboardLayoutDark } from "../DashboardLayoutDark";
import { DashboardLayoutLight } from "../DashboardLayoutLight";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseAuth = vi.fn();
vi.mock("../../../context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../context/AuthContext")>();
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

vi.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({ isDark: true, toggleTheme: vi.fn() }),
}));

vi.mock("../../../api/client", () => ({
  batonApi: {
    measureLatency: vi.fn().mockResolvedValue(15),
  },
}));

vi.mock("../../../features/auth/supabase", () => ({
  isSupabaseConfigured: true,
}));

vi.mock("../../../features/auth/linkGithubIdentity", () => ({
  linkGithubIdentity: vi.fn(),
}));

function renderWithProviders(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TopHeaderUserMenu Component & Header Avatar Integration", () => {
  const mockSwitchRole = vi.fn();
  const mockResetDemo = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Interactive Top Header Avatar in Dark Theme", () => {
    it("renders dynamic user initials and opens dropdown on click", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "u-1",
          name: "Bhavesh Patil",
          role: "approver",
          email: "bhavesh@company.com",
          is_demo: false,
          displayRole: "Approver (Engineering Lead)",
        },
        loading: false,
        switchRole: mockSwitchRole,
        resetDemo: mockResetDemo,
        logout: mockLogout,
      });

      render(
        <TopHeaderUserMenu
          theme="dark"
          userInitials="BP"
          onOpenResetModal={vi.fn()}
        />
      );

      const avatarBtn = screen.getByRole("button", { name: /User profile menu for Bhavesh Patil/i });
      expect(avatarBtn).toBeInTheDocument();
      expect(avatarBtn).toHaveTextContent("BP");
      expect(avatarBtn).toHaveAttribute("aria-expanded", "false");

      // Click to open
      fireEvent.click(avatarBtn);
      expect(avatarBtn).toHaveAttribute("aria-expanded", "true");

      const menu = screen.getByRole("menu", { name: "User profile menu" });
      expect(menu).toBeInTheDocument();
      expect(screen.getByText("Assigned Role")).toBeInTheDocument();
      expect(screen.getByText("Verified")).toBeInTheDocument();
      expect(screen.getByText("Bhavesh Patil (Engineering Lead)")).toBeInTheDocument();
      expect(screen.getByText("bhavesh@company.com")).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Sign Out" })).toBeInTheDocument();
    });

    it("supports demo role switching and closes menu on role selection", async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "u-demo",
          name: "Demo Approver",
          role: "approver",
          email: "demo@baton.local",
          is_demo: true,
          displayRole: "Approver (Engineering Lead)",
        },
        loading: false,
        switchRole: mockSwitchRole,
        resetDemo: mockResetDemo,
        logout: mockLogout,
      });

      render(
        <TopHeaderUserMenu
          theme="dark"
          userInitials="DA"
          onOpenResetModal={vi.fn()}
        />
      );

      const avatarBtn = screen.getByRole("button", { name: /User profile menu for Demo Approver/i });
      fireEvent.click(avatarBtn);

      expect(screen.getByText("Switch Active Role")).toBeInTheDocument();
      expect(screen.getByText("Demo Account")).toBeInTheDocument();
      expect(screen.getByText("Demo")).toBeInTheDocument();

      // Check demo role options
      const leaverBtn = screen.getByRole("menuitem", { name: /Aarav \(Departing Lead\)/i });
      expect(leaverBtn).toBeInTheDocument();

      fireEvent.click(leaverBtn);
      expect(mockSwitchRole).toHaveBeenCalledWith("leaver");

      // Menu closes after role switch
      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });

    it("calls logout and closes menu when Sign Out is clicked", async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "u-1",
          name: "Alex Smith",
          role: "contributor",
          email: "alex@company.com",
          is_demo: false,
        },
        loading: false,
        switchRole: mockSwitchRole,
        resetDemo: mockResetDemo,
        logout: mockLogout,
      });

      render(
        <TopHeaderUserMenu
          theme="dark"
          userInitials="AS"
          onOpenResetModal={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /User profile menu for Alex Smith/i }));
      const signOutBtn = screen.getByRole("menuitem", { name: "Sign Out" });
      fireEvent.click(signOutBtn);

      expect(mockLogout).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });

    it("closes menu on Escape key press", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "u-1",
          name: "Alex Smith",
          role: "approver",
          email: "alex@company.com",
          is_demo: false,
        },
        loading: false,
        switchRole: mockSwitchRole,
        resetDemo: mockResetDemo,
        logout: mockLogout,
      });

      render(
        <TopHeaderUserMenu
          theme="dark"
          userInitials="AS"
          onOpenResetModal={vi.fn()}
        />
      );

      const avatarBtn = screen.getByRole("button", { name: /User profile menu for Alex Smith/i });
      fireEvent.click(avatarBtn);
      expect(screen.getByRole("menu")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("closes menu on outside click", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "u-1",
          name: "Alex Smith",
          role: "approver",
          email: "alex@company.com",
          is_demo: false,
        },
        loading: false,
        switchRole: mockSwitchRole,
        resetDemo: mockResetDemo,
        logout: mockLogout,
      });

      render(
        <div>
          <span data-testid="outside-element">Outside</span>
          <TopHeaderUserMenu
            theme="dark"
            userInitials="AS"
            onOpenResetModal={vi.fn()}
          />
        </div>
      );

      const avatarBtn = screen.getByRole("button", { name: /User profile menu for Alex Smith/i });
      fireEvent.click(avatarBtn);
      expect(screen.getByRole("menu")).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByTestId("outside-element"));
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  describe("Interactive Top Header Avatar in Light Theme", () => {
    it("renders correctly and supports opening menu in light mode", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "u-light",
          name: "Light User",
          role: "approver",
          email: "light@company.com",
          is_demo: false,
          displayRole: "Approver (Engineering Lead)",
        },
        loading: false,
        switchRole: mockSwitchRole,
        resetDemo: mockResetDemo,
        logout: mockLogout,
      });

      render(
        <TopHeaderUserMenu
          theme="light"
          userInitials="LU"
          onOpenResetModal={vi.fn()}
        />
      );

      const avatarBtn = screen.getByRole("button", { name: /User profile menu for Light User/i });
      fireEvent.click(avatarBtn);

      expect(screen.getByRole("menu")).toBeInTheDocument();
      expect(screen.getByText("Light User (Engineering Lead)")).toBeInTheDocument();
      expect(screen.getByText("light@company.com")).toBeInTheDocument();
    });
  });

  describe("DashboardLayout Integration Parity (Dark & Light)", () => {
    it("renders interactive header avatar button in DashboardLayoutDark", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "usr-dark",
          name: "Dark Engineer",
          role: "approver",
          email: "dark@company.com",
          is_demo: false,
          displayRole: "Approver (Engineering Lead)",
        },
        loading: false,
        switchRole: mockSwitchRole,
        resetDemo: mockResetDemo,
        logout: mockLogout,
      });

      renderWithProviders(
        <DashboardLayoutDark>
          <div>Main Dark</div>
        </DashboardLayoutDark>
      );

      // Header avatar button exists with proper accessibility
      const headerAvatarBtn = screen.getByRole("button", { name: /User profile menu for Dark Engineer/i });
      expect(headerAvatarBtn).toBeInTheDocument();
      expect(headerAvatarBtn).toHaveTextContent("DE");

      // Click to open header menu
      fireEvent.click(headerAvatarBtn);
      expect(screen.getByRole("menu", { name: "User profile menu" })).toBeInTheDocument();
      expect(screen.getByText("Dark Engineer (Engineering Lead)")).toBeInTheDocument();
    });

    it("renders interactive header avatar button in DashboardLayoutLight", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "usr-light",
          name: "Light Engineer",
          role: "approver",
          email: "light@company.com",
          is_demo: false,
          displayRole: "Approver (Engineering Lead)",
        },
        loading: false,
        switchRole: mockSwitchRole,
        resetDemo: mockResetDemo,
        logout: mockLogout,
      });

      renderWithProviders(
        <DashboardLayoutLight>
          <div>Main Light</div>
        </DashboardLayoutLight>
      );

      const headerAvatarBtn = screen.getByRole("button", { name: /User profile menu for Light Engineer/i });
      expect(headerAvatarBtn).toBeInTheDocument();
      expect(headerAvatarBtn).toHaveTextContent("LE");

      fireEvent.click(headerAvatarBtn);
      expect(screen.getByRole("menu", { name: "User profile menu" })).toBeInTheDocument();
      expect(screen.getByText("Light Engineer (Engineering Lead)")).toBeInTheDocument();
    });
  });
});

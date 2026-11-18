import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardLayoutDark } from "../DashboardLayoutDark";
import { DashboardLayoutLight } from "../DashboardLayoutLight";

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
  isSupabaseConfigured: false,
}));

describe("DashboardLayout Active Role Switcher Popover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Dark Layout", () => {
    it("displays 'Demo Account' below 'Switch Active Role' in Demo mode", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "u-approver",
          name: "Demo Approver",
          role: "approver",
          email: "real.user@company.com",
          is_demo: true,
          displayRole: "Approver (Engineering Lead)",
        },
        loading: false,
        switchRole: vi.fn(),
        resetDemo: vi.fn(),
        logout: vi.fn(),
      });

      render(
        <MemoryRouter>
          <DashboardLayoutDark>
            <div>Content</div>
          </DashboardLayoutDark>
        </MemoryRouter>
      );

      // Open profile dropdown popover via button title
      const profileButton = screen.getByTitle(/Demo Approver/i);
      expect(profileButton).toBeInTheDocument();
      fireEvent.click(profileButton);

      expect(screen.getByText("Switch Active Role")).toBeInTheDocument();
      expect(screen.getByText("Demo Account")).toBeInTheDocument();
      expect(screen.queryByText("real.user@company.com")).not.toBeInTheDocument();
      expect(screen.getByText("Demo")).toBeInTheDocument();
    });

    it("displays actual email for normal authenticated (non-demo) sessions", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "usr-real-123",
          name: "Real Engineer",
          role: "approver",
          email: "real.user@company.com",
          is_demo: false,
          displayRole: "Approver (Engineering Lead)",
        },
        loading: false,
        switchRole: vi.fn(),
        resetDemo: vi.fn(),
        logout: vi.fn(),
      });

      render(
        <MemoryRouter>
          <DashboardLayoutDark>
            <div>Content</div>
          </DashboardLayoutDark>
        </MemoryRouter>
      );

      const profileButton = screen.getByTitle(/Real Engineer/i);
      expect(profileButton).toBeInTheDocument();
      fireEvent.click(profileButton);

      expect(screen.getByText("Assigned Role")).toBeInTheDocument();
      expect(screen.getByText("Verified")).toBeInTheDocument();
      expect(screen.getByText("real.user@company.com")).toBeInTheDocument();
      expect(screen.getByText("Real Engineer (Engineering Lead)")).toBeInTheDocument();
      expect(screen.queryByText("Demo Account")).not.toBeInTheDocument();
      expect(screen.queryByText("Switch Active Role")).not.toBeInTheDocument();
    });

    it("displays user's name first followed by assigned role in brackets (e.g. Aarav (Departing Lead))", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "usr-leaver-456",
          name: "Aarav",
          role: "leaver",
          email: "aarav@company.com",
          is_demo: false,
        },
        loading: false,
        switchRole: vi.fn(),
        resetDemo: vi.fn(),
        logout: vi.fn(),
      });

      render(
        <MemoryRouter>
          <DashboardLayoutDark>
            <div>Content</div>
          </DashboardLayoutDark>
        </MemoryRouter>
      );

      const profileButton = screen.getByTitle(/Aarav \(Departing Lead\)/i);
      expect(profileButton).toBeInTheDocument();
      fireEvent.click(profileButton);

      expect(screen.getByText("Assigned Role")).toBeInTheDocument();
      expect(screen.getByText("Verified")).toBeInTheDocument();
      expect(screen.getByText("Aarav (Departing Lead)")).toBeInTheDocument();
      expect(screen.getByText("aarav@company.com")).toBeInTheDocument();
    });
  });

  describe("Light Layout", () => {
    it("displays 'Demo Account' below 'Switch Active Role' in Demo mode", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "u-approver",
          name: "Demo Approver",
          role: "approver",
          email: "real.user@company.com",
          is_demo: true,
          displayRole: "Approver (Engineering Lead)",
        },
        loading: false,
        switchRole: vi.fn(),
        resetDemo: vi.fn(),
        logout: vi.fn(),
      });

      render(
        <MemoryRouter>
          <DashboardLayoutLight>
            <div>Content</div>
          </DashboardLayoutLight>
        </MemoryRouter>
      );

      const profileButton = screen.getByTitle(/Demo Approver/i);
      expect(profileButton).toBeInTheDocument();
      fireEvent.click(profileButton);

      expect(screen.getByText("Switch Active Role")).toBeInTheDocument();
      expect(screen.getByText("Demo Account")).toBeInTheDocument();
      expect(screen.queryByText("real.user@company.com")).not.toBeInTheDocument();
      expect(screen.getByText("Demo")).toBeInTheDocument();
    });

    it("displays actual email for normal authenticated (non-demo) sessions", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "usr-real-123",
          name: "Real Engineer",
          role: "approver",
          email: "real.user@company.com",
          is_demo: false,
          displayRole: "Approver (Engineering Lead)",
        },
        loading: false,
        switchRole: vi.fn(),
        resetDemo: vi.fn(),
        logout: vi.fn(),
      });

      render(
        <MemoryRouter>
          <DashboardLayoutLight>
            <div>Content</div>
          </DashboardLayoutLight>
        </MemoryRouter>
      );

      const profileButton = screen.getByTitle(/Real Engineer/i);
      expect(profileButton).toBeInTheDocument();
      fireEvent.click(profileButton);

      expect(screen.getByText("Assigned Role")).toBeInTheDocument();
      expect(screen.getByText("Verified")).toBeInTheDocument();
      expect(screen.getByText("real.user@company.com")).toBeInTheDocument();
      expect(screen.getByText("Real Engineer (Engineering Lead)")).toBeInTheDocument();
      expect(screen.queryByText("Demo Account")).not.toBeInTheDocument();
      expect(screen.queryByText("Switch Active Role")).not.toBeInTheDocument();
    });

    it("displays user's name first followed by assigned role in brackets (e.g. Aarav (Departing Lead))", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: "usr-leaver-456",
          name: "Aarav",
          role: "leaver",
          email: "aarav@company.com",
          is_demo: false,
        },
        loading: false,
        switchRole: vi.fn(),
        resetDemo: vi.fn(),
        logout: vi.fn(),
      });

      render(
        <MemoryRouter>
          <DashboardLayoutDark>
            <div>Content</div>
          </DashboardLayoutDark>
        </MemoryRouter>
      );

      const profileButton = screen.getByTitle(/Aarav \(Departing Lead\)/i);
      expect(profileButton).toBeInTheDocument();
      fireEvent.click(profileButton);

      expect(screen.getByText("Assigned Role")).toBeInTheDocument();
      expect(screen.getByText("Verified")).toBeInTheDocument();
      expect(screen.getByText("Aarav (Departing Lead)")).toBeInTheDocument();
      expect(screen.getByText("aarav@company.com")).toBeInTheDocument();
    });
  });
});

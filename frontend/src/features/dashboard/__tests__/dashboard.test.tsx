import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";

vi.mock("@/app/auth", () => ({
  useAuth: () => ({
    user: { id: "u-approver", name: "Samruddhi", role: "approver", project_id: "proj-campus-event-portal" },
    loading: false,
    error: null,
    switchRole: vi.fn(),
    resetDemo: vi.fn(),
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe("DashboardPage", () => {
  it("renders KPI cards and core sections", () => {
    renderWithProviders(<DashboardPage />);

    // Greeting
    expect(screen.getByText(/Here's what's happening with your projects today/i)).toBeInTheDocument();

    // 4 KPI Cards
    expect(screen.getByText("Active Projects")).toBeInTheDocument();
    expect(screen.getByText("At Risk")).toBeInTheDocument();
    expect(screen.getByText("Handover Ready")).toBeInTheDocument();
    expect(screen.getByText("Verified Claims")).toBeInTheDocument();

    // Risk Radar & Activity
    expect(screen.getByText("Risk Radar")).toBeInTheDocument();
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();

    // Deep dive & Evidence
    expect(screen.getByText("Payments Service")).toBeInTheDocument();
    expect(screen.getByText("Evidence Explorer")).toBeInTheDocument();
    expect(screen.getByText("Handover Workspace")).toBeInTheDocument();
  });
});

describe("LoginPage", () => {
  it("renders Baton branding and sign-in controls", () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText(/Every Handover/i)).toBeInTheDocument();
    expect(screen.getByText(/Capture. Verify. Transfer./i)).toBeInTheDocument();
    expect(screen.getByText("Welcome Back!")).toBeInTheDocument();
    expect(screen.getByText("Select Demo Persona")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In to Baton/i })).toBeInTheDocument();
  });
});

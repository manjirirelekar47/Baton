import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../ProtectedRoute";

// Mock the auth hook
const mockUseAuth = vi.fn();
vi.mock("@/app/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("ProtectedRoute", () => {
  it("shows loading indicator when session verification is loading", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Secret Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Verifying session/i)).toBeInTheDocument();
    expect(screen.queryByText("Secret Dashboard")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to /login", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Secret Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Secret Dashboard")).not.toBeInTheDocument();
  });

  it("renders protected content when user is authenticated", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: "u-1", name: "Samruddhi", role: "approver" },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Secret Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Secret Dashboard")).toBeInTheDocument();
  });

  it("redirects authenticated user to /dashboard when user role is not allowed", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: "u-2", name: "Contributor", role: "incoming_contributor" },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/review"]}>
        <Routes>
          <Route path="/dashboard" element={<div>User Dashboard</div>} />
          <Route element={<ProtectedRoute allowedRoles={["approver"]} />}>
            <Route path="/review" element={<div>Review Queue</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("User Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Review Queue")).not.toBeInTheDocument();
  });

  it("renders protected content when user role matches allowedRoles", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: "u-3", name: "Lead Approver", role: "approver" },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/review"]}>
        <Routes>
          <Route path="/dashboard" element={<div>User Dashboard</div>} />
          <Route element={<ProtectedRoute allowedRoles={["approver"]} />}>
            <Route path="/review" element={<div>Review Queue</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Review Queue")).toBeInTheDocument();
  });
});

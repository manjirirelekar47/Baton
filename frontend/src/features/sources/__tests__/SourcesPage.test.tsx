import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { api } from "@/app/api";
import { useAuth } from "@/app/auth";
import { SourcesPage } from "../pages/SourcesPage";

vi.mock("@/app/api", () => ({
  api: vi.fn(),
  ApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getToken: vi.fn(() => "mock-jwt-token"),
}));

vi.mock("@/app/auth", () => ({
  useAuth: vi.fn(),
}));

function renderWithProviders(initialEntries: string[] = ["/sources"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <SourcesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SourcesPage Live Connections & OAuth UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders connection status badges for connected, needs_attention, and revoked", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u-1", name: "Alice", role: "approver", project_id: "p-1" },
    } as any);

    vi.mocked(api).mockImplementation((path: string) => {
      if (path === "/sources") return Promise.resolve([]);
      if (path === "/drift/alerts") return Promise.resolve([]);
      if (path === "/drift/scan") return Promise.resolve({ baselined: 0, changed: 0 });
      if (path === "/sources/connections") {
        return Promise.resolve([
          {
            id: "conn-1",
            project_id: "p-1",
            provider: "github",
            target_name: "baton-org/baton-core",
            acl_label: "L1",
            status: "succeeded",
            auth_status: "connected",
            last_synced_at: "2026-11-18T00:00:00Z",
            records_added: 5,
            records_updated: 0,
            records_skipped: 2,
            error_message: null,
            created_at: "2026-11-18T00:00:00Z",
            updated_at: "2026-11-18T00:00:00Z",
          },
          {
            id: "conn-2",
            project_id: "p-1",
            provider: "jira",
            target_name: "CAMPUS",
            acl_label: "L2",
            status: "failed",
            auth_status: "needs_attention",
            last_synced_at: null,
            records_added: 0,
            records_updated: 0,
            records_skipped: 0,
            error_message: "OAuth token expired. Reauthorization required.",
            created_at: "2026-11-18T00:00:00Z",
            updated_at: "2026-11-18T00:00:00Z",
          },
          {
            id: "conn-3",
            project_id: "p-1",
            provider: "github",
            target_name: "baton-org/baton-legacy",
            acl_label: "L1",
            status: "failed",
            auth_status: "revoked",
            last_synced_at: null,
            records_added: 0,
            records_updated: 0,
            records_skipped: 0,
            error_message: "Connection revoked by project administrator.",
            created_at: "2026-11-18T00:00:00Z",
            updated_at: "2026-11-18T00:00:00Z",
          },
        ]);
      }
      return Promise.resolve({});
    });

    renderWithProviders();

    // Verify all targets render
    expect(await screen.findByText("baton-org/baton-core")).toBeInTheDocument();
    expect(screen.getByText("CAMPUS")).toBeInTheDocument();
    expect(screen.getByText("baton-org/baton-legacy")).toBeInTheDocument();

    // Verify status badges
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Revoked")).toBeInTheDocument();

    // Verify warnings
    expect(screen.getByText(/Authorization requires attention/)).toBeInTheDocument();
    expect(screen.getByText(/Access grant revoked/)).toBeInTheDocument();

    // Verify controls present for approver
    expect(screen.getByText("Sync Now")).toBeInTheDocument();
    expect(screen.getAllByText("Reauthorize").length).toBe(2);
    expect(screen.getAllByText("Revoke").length).toBe(2); // for conn-1 and conn-2 (conn-3 is already revoked)
    expect(screen.getAllByText("Disconnect").length).toBe(3);
  });

  it("allows Approver to initiate OAuth connection flow", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u-1", name: "Alice", role: "approver", project_id: "p-1" },
    } as any);

    vi.mocked(api).mockImplementation((path: string) => {
      if (path === "/sources") return Promise.resolve([]);
      if (path === "/drift/alerts") return Promise.resolve([]);
      if (path === "/drift/scan") return Promise.resolve({ baselined: 0, changed: 0 });
      if (path === "/sources/connections") return Promise.resolve([]);
      if (path === "/sources/oauth/github/authorize") {
        return Promise.resolve({
          authorization_url: "https://github.com/login/oauth/authorize?mock=1",
          state: "baton_mock_state",
          provider: "github",
        });
      }
      return Promise.resolve({});
    });

    renderWithProviders();

    // Click Connect Live Source button
    const connectBtn = await screen.findByRole("button", { name: /Connect Live Source/i });
    fireEvent.click(connectBtn);

    // Modal opens
    expect(screen.getByText("Connect Project Source")).toBeInTheDocument();

    // Fill in target
    const targetInput = screen.getByPlaceholderText("acme-corp/project-repo");
    fireEvent.change(targetInput, { target: { value: "test-org/test-repo" } });

    // Check consent checkbox
    const consentCheckbox = screen.getByRole("checkbox", {
      name: /I confirm that I am authorised to connect and sync/i,
    });
    fireEvent.click(consentCheckbox);

    // Click Authorize with GitHub button
    const authBtn = screen.getByRole("button", { name: /Authorize with GitHub/i });
    expect(authBtn).not.toBeDisabled();
    fireEvent.click(authBtn);

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(
        "/sources/oauth/github/authorize",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            target_name: "test-org/test-repo",
            acl_label: "L1",
            consent: true,
          }),
        })
      );
    });
  });

  it("displays success banner when returning from OAuth callback", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u-1", name: "Alice", role: "approver", project_id: "p-1" },
    } as any);

    vi.mocked(api).mockImplementation((path: string) => {
      if (path === "/sources") return Promise.resolve([]);
      if (path === "/drift/alerts") return Promise.resolve([]);
      if (path === "/drift/scan") return Promise.resolve({ baselined: 0, changed: 0 });
      if (path === "/sources/connections") return Promise.resolve([]);
      return Promise.resolve({});
    });

    renderWithProviders(["/sources?oauth=success&provider=github&connection_id=conn-new"]);

    expect(
      await screen.findByText(/Successfully authorized and connected github via OAuth!/i)
    ).toBeInTheDocument();
  });
});

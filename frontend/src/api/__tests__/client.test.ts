import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, batonApi, getApiBaseUrl, setApiBaseUrl, ApiError } from "../client";

describe("apiClient connectivity & loopback fallback", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setApiBaseUrl("http://localhost:8000");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("resolves the initial API base URL", () => {
    expect(getApiBaseUrl()).toMatch(/^https?:\/\//);
  });

  it("checks health via checkHealth()", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    } as Response);

    const health = await batonApi.checkHealth();
    expect(health.ok).toBe(true);
    expect(health.status).toBe("ok");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/health"),
      expect.objectContaining({
        method: "GET",
      })
    );
  });

  it("automatically falls back to 127.0.0.1 when localhost fails with a network error", async () => {
    const mockFetch = vi
      .fn()
      // First call to localhost fails (e.g. IPv6 loopback not listening)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      // Second call to 127.0.0.1 succeeds
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      } as Response);

    global.fetch = mockFetch;

    const res = await apiClient.get<{ status: string }>("/health");
    expect(res.status).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const firstCallUrl = mockFetch.mock.calls[0][0];
    const secondCallUrl = mockFetch.mock.calls[1][0];
    expect(firstCallUrl).toContain("localhost:8000/health");
    expect(secondCallUrl).toContain("127.0.0.1:8000/health");

    // Base URL should be updated to the working loopback host
    expect(getApiBaseUrl()).toContain("127.0.0.1:8000");
  });

  it("does not send Content-Type header on GET requests without a body", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    } as Response);
    global.fetch = mockFetch;

    await apiClient.get("/health");
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["Accept"]).toBe("application/json");
  });

  it("sends Content-Type header on POST requests with a body", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: "xyz" }),
    } as Response);
    global.fetch = mockFetch;

    await apiClient.post("/auth/demo-login", { role: "approver" });
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("throws descriptive ApiError if both primary and fallback hosts fail", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiClient.get("/health")).rejects.toThrow(ApiError);
    await expect(apiClient.get("/health")).rejects.toThrow(/Cannot connect to Baton API/);
  });
});

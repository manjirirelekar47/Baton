/** API client. FROZEN after Day 0. */
const defaultHost =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "localhost";

let BASE = (import.meta.env.VITE_API_URL ?? `http://${defaultHost}:8000`).replace(/\/$/, "");
const TOKEN_KEY = "baton.token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session lasts until reload */
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let response: Response;
  const url = `${BASE}${path}`;
  const isBodyAllowed = init.method && !["GET", "HEAD"].includes(init.method.toUpperCase());
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(isBodyAllowed && init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    try {
      response = await fetch(url, {
        method: init.method ?? "GET",
        headers: requestHeaders,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch (primaryErr) {
      let altUrl: string | null = null;
      if (url.includes("//localhost:8000")) {
        altUrl = url.replace("//localhost:8000", "//127.0.0.1:8000");
      } else if (url.includes("//127.0.0.1:8000")) {
        altUrl = url.replace("//127.0.0.1:8000", "//127.0.0.1:8001");
      } else if (url.includes("//localhost:8001")) {
        altUrl = url.replace("//localhost:8001", "//127.0.0.1:8001");
      } else if (url.includes("//127.0.0.1:8001")) {
        altUrl = url.replace("//127.0.0.1:8001", "//127.0.0.1:8000");
      } else if (url.includes("//localhost:")) {
        altUrl = url.replace("//localhost:", "//127.0.0.1:");
      } else if (url.includes("//127.0.0.1:")) {
        altUrl = url.replace("//127.0.0.1:", "//localhost:");
      }
      if (altUrl) {
        response = await fetch(altUrl, {
          method: init.method ?? "GET",
          headers: requestHeaders,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
        if (altUrl.includes(":8001")) {
          BASE = BASE.replace(":8000", ":8001");
        } else if (altUrl.includes(":8000")) {
          BASE = BASE.replace(":8001", ":8000");
        }
      } else {
        throw primaryErr;
      }
    }
  } catch {
    throw new ApiError(0, "Cannot reach the Baton API. If it was idle it may still be waking up: wait a few seconds and try again.");
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") detail = data.detail;
      else if (Array.isArray(data.detail)) detail = "The request was not valid.";
    } catch {
      /* keep statusText */
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

import { vi } from "vitest";

// A fake fetch for component tests. Paths not listed answer 404 NOT_FOUND, the same as an
// endpoint that is not built yet, so hooks fall back to sample data.
// Keys are an API path (after /api/v1, with query) for a GET, or "POST /path" etc.

export type MockRoutes = Record<string, unknown>;

/** Key -> an API error answer, e.g. { status: 404, code: "PREDICTION_NOT_READY" }. */
export type MockErrors = Record<string, { status: number; code: string }>;

export interface MockRequest {
  method: string;
  path: string;
  body: unknown;
  authorization: string | null;
}

export interface MockApi {
  /** GET paths, in order (kept for the existing tests). */
  requested_paths: string[];
  requests: MockRequest[];
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function read_header(init: RequestInit | undefined, name: string): string | null {
  const headers = new Headers(init?.headers);
  return headers.get(name);
}

/** `routes` maps "path" (GET) or "METHOD path" to the `data` it returns (201 for POST). */
export function mock_api(routes: MockRoutes, errors: MockErrors = {}): MockApi {
  const api: MockApi = { requested_paths: [], requests: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const path = `${url.pathname.replace(/^\/api\/v1/, "")}${url.search}`;
      const method = init?.method ?? "GET";
      const key = method === "GET" ? path : `${method} ${path}`;
      const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      api.requests.push({ method, path, body, authorization: read_header(init, "authorization") });
      if (method === "GET") {
        api.requested_paths.push(path);
      }
      const error = errors[key];
      if (error) {
        return Promise.resolve(
          json(error.status, { error: { code: error.code, message: `${error.code}: ${key}` } }),
        );
      }
      if (key in routes) {
        return Promise.resolve(json(method === "POST" ? 201 : 200, { data: routes[key] }));
      }
      return Promise.resolve(
        json(404, { error: { code: "NOT_FOUND", message: `Route not found: ${method} ${path}` } }),
      );
    }),
  );
  return api;
}

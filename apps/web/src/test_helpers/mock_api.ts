import { vi } from "vitest";

// A fake fetch for component tests. Paths not listed answer 404 NOT_FOUND, the same as an
// endpoint that is not built yet, so hooks fall back to sample data.

export type MockRoutes = Record<string, unknown>;

export interface MockApi {
  requested_paths: string[];
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** `routes` maps an API path (after /api/v1, with query) to the `data` it returns. */
export function mock_api(routes: MockRoutes): MockApi {
  const api: MockApi = { requested_paths: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const path = `${url.pathname.replace(/^\/api\/v1/, "")}${url.search}`;
      api.requested_paths.push(path);
      if (path in routes) {
        return Promise.resolve(json(200, { data: routes[path] }));
      }
      return Promise.resolve(
        json(404, { error: { code: "NOT_FOUND", message: `Route not found: GET ${path}` } }),
      );
    }),
  );
  return api;
}

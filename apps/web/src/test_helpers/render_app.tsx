import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";

export function create_test_query_client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

/** Renders `element` at `path` (pattern) when the URL is `url`, with React Query. */
export function render_at(
  element: ReactNode,
  { url = "/", path = "/" }: { url?: string; path?: string } = {},
) {
  const query_client = create_test_query_client();
  const utils = render(
    <QueryClientProvider client={query_client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, query_client };
}

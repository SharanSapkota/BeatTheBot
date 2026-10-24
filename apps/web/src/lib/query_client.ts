import { QueryClient } from "@tanstack/react-query";

export function create_query_client(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false },
    },
  });
}

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { create_query_client } from "../lib/query_client";

export function Providers({ children }: { children: ReactNode }) {
  const [query_client] = useState(create_query_client);
  return <QueryClientProvider client={query_client}>{children}</QueryClientProvider>;
}

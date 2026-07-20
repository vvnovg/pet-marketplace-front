"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
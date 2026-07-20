"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { SessionProvider } from "@/components/auth/SessionProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient();
  return (
    <QueryClientProvider client={qc}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
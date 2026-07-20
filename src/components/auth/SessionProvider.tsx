"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "@/i18n";
import { getCurrentUser } from "@/lib/api/endpoints/users";
import { ApiError } from "@/lib/api/errors";
import type { UserProfile } from "@/types/api";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";
interface SessionValue { user: UserProfile | null; status: SessionStatus; }

const SessionContext = createContext<SessionValue>({ user: null, status: "loading" });

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const redirecting = useRef(false);

  const { data: user, isLoading } = useQuery<UserProfile | null>({
    queryKey: ["session"],
    queryFn: async () => {
      try { return await getCurrentUser(); } catch { return null; }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Global 401: a non-session query that fails with 401 means the proxy's refresh
  // already failed. Clear session and redirect to login once (ref guard prevents loops).
  useEffect(() => {
    redirecting.current = false;
    return qc.getQueryCache().subscribe((event) => {
      const err = event.query.state.error;
      if (
        err instanceof ApiError &&
        err.status === 401 &&
        event.query.queryKey[0] !== "session" &&
        !redirecting.current
      ) {
        redirecting.current = true;
        qc.setQueryData(["session"], null);
        router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      }
    });
  }, [qc, router, pathname]);

  const status: SessionStatus = isLoading ? "loading" : user ? "authenticated" : "unauthenticated";
  return <SessionContext.Provider value={{ user: user ?? null, status }}>{children}</SessionContext.Provider>;
}

export { SessionContext };
export { useSession } from "@/components/auth/useSession";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SessionProvider, useSession } from "@/components/auth/SessionProvider";
import { ApiError } from "@/lib/api/errors";

const server = setupServer();
beforeEach(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  replace.mockClear();
});
afterEach(() => { server.resetHandlers(); server.close(); });

const replace = vi.fn();
vi.mock("@/i18n", () => ({ useRouter: () => ({ replace }), usePathname: () => "/dashboard" }));
vi.mock("next-intl", () => ({ useLocale: () => "ru" }));

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}><SessionProvider>{children}</SessionProvider></QueryClientProvider>
  );
}

const Show = () => {
  const { user, status } = useSession();
  return <span data-testid="out">{status}:{user?.email ?? "none"}</span>;
};

describe("SessionProvider", () => {
  it("starts loading then resolves authenticated", async () => {
    server.use(http.get("*/api/proxy/users/me", () => HttpResponse.json({ id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true, createdAt: "t", updatedAt: "t" })));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getByTestId } = render(<Show />, { wrapper: wrapper(qc) });
    expect(getByTestId("out").textContent).toBe("loading:none");
    await waitFor(() => expect(getByTestId("out").textContent).toBe("authenticated:a@b.co"));
  });

  it("becomes unauthenticated when /users/me errors", async () => {
    server.use(http.get("*/api/proxy/users/me", () => new HttpResponse(null, { status: 401 })));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getByTestId } = render(<Show />, { wrapper: wrapper(qc) });
    await waitFor(() => expect(getByTestId("out").textContent).toBe("unauthenticated:none"));
    // session 401 must NOT trigger redirect (no loop)
    await waitFor(() => expect(replace).not.toHaveBeenCalled());
  });

  it("a non-session 401 triggers logout redirect (one-shot)", async () => {
    server.use(
      http.get("*/api/proxy/users/me", () => HttpResponse.json({ id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true, createdAt: "t", updatedAt: "t" })),
      http.get("*/api/proxy/listings", () => new HttpResponse(null, { status: 401 })),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Probe = () => { useQuery({ queryKey: ["listings"], queryFn: async () => { const r = await fetch("/api/proxy/listings"); if (!r.ok) throw new ApiError(401, "x", "y"); return r.json(); } }); return <Show />; };
    render(<Probe />, { wrapper: wrapper(qc) });
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringContaining("/login?callbackUrl=")));
  });
});
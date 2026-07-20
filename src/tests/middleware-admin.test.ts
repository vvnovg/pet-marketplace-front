import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextResponse, type NextRequest } from "next/server";

const API_BASE = "http://localhost:8080/api/v1";
process.env.NEXT_PUBLIC_API_BASE = API_BASE;

// next-intl/middleware internally imports `next/server` in a way vitest's node
// resolver can't resolve. The intl routing is NOT what this task tests — we
// stub createMiddleware to return a pass-through non-redirect response so the
// admin role-check logic under test is exercised end-to-end.
vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); server.close(); });

// Plain `Request` has no `nextUrl`, but the middleware reads `req.nextUrl.pathname`
// and `req.nextUrl.clone()`. We attach a `URL` (with an added `clone()`, which
// `NextURL` has but plain `URL` lacks) as `nextUrl` so the real middleware logic
// is exercised (test-only stub; cast to NextRequest).
const mk = (url: string, cookie = "") => {
  const u = new URL(url);
  Object.assign(u, { clone: () => new URL(u.toString()) });
  return Object.assign(new Request(url, { headers: cookie ? { cookie } : {} }), {
    nextUrl: u,
  }) as unknown as NextRequest;
};

describe("middleware admin guard", () => {
  it("allows ADMIN through to intl middleware", async () => {
    server.use(http.get(`${API_BASE}/users/me`, ({ request }) => {
      expect(request.headers.get("authorization")).toBe("Bearer acc");
      return HttpResponse.json({ id: "u1", role: "ADMIN", verified: true, active: true, email: "a@b.co", createdAt: "t", updatedAt: "t" });
    }));
    const { middleware } = await import("@/middleware");
    const res = await middleware(mk("http://x/ru/admin", "pmp_access=acc"));
    // allowed → intl middleware response (200-class, not a 307 to /login)
    expect(res.status).not.toBe(307);
  });

  it("redirects BUYER away from /admin", async () => {
    server.use(http.get(`${API_BASE}/users/me`, () => HttpResponse.json({ id: "u1", role: "BUYER", verified: true, active: true, email: "a@b.co", createdAt: "t", updatedAt: "t" })));
    const { middleware } = await import("@/middleware");
    const res = await middleware(mk("http://x/ru/admin/users", "pmp_access=acc"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/ru/login");
  });

  it("redirects when no access cookie", async () => {
    const { middleware } = await import("@/middleware");
    const res = await middleware(mk("http://x/ru/admin"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/ru/login");
  });

  it("redirects on 401 from /users/me", async () => {
    server.use(http.get(`${API_BASE}/users/me`, () => new HttpResponse(null, { status: 401 })));
    const { middleware } = await import("@/middleware");
    const res = await middleware(mk("http://x/ru/admin", "pmp_access=stale"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/ru/login");
  });
});
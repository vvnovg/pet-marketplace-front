import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { NextRequest } from "next/server";

const API_BASE = "http://localhost:8080/api/v1";
process.env.NEXT_PUBLIC_API_BASE = API_BASE;

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  server.close();
});

import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as logout } from "@/app/api/auth/logout/route";

// Route handlers ignore the second arg; cast to a 2-arg form for the call sites.
type Post2 = (req: NextRequest, ctx?: unknown) => Promise<Response>;
const login2 = login as unknown as Post2;
const register2 = register as unknown as Post2;
const logout2 = logout as unknown as Post2;
const ctx = { params: Promise.resolve({}) };

describe("auth routes", () => {
  it("login sets both cookies", async () => {
    server.use(http.post(`${API_BASE}/auth/login`, () =>
      HttpResponse.json({ accessToken: "a", refreshToken: "r", tokenType: "Bearer", expiresIn: 900 })));
    const req = new Request("http://x/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "e@x", password: "12345678" }),
    });
    const res = await login2(req as unknown as NextRequest, ctx);
    expect(res.status).toBe(200);
    const sc = res.headers.get("set-cookie") ?? "";
    expect(sc).toContain("pmp_access=a");
    expect(sc).toContain("pmp_refresh=r");
  });

  it("register does not set cookies", async () => {
    server.use(http.post(`${API_BASE}/auth/register`, () => HttpResponse.json({}, { status: 201 })));
    const req = new Request("http://x/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const res = await register2(req as unknown as NextRequest, ctx);
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  // NOTE: real NextResponse.cookies.delete serializes as
  // `pmp_access=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT` (Next injects Path=/
  // and uses expires: new Date(0), not maxAge). The cookies.test.ts mock emits
  // `Max-Age=0`; against real NextResponse we match the actual serialization.
  it("logout clears cookies", async () => {
    const req = new Request("http://x/api/auth/logout", { method: "POST", headers: { cookie: "pmp_access=a; pmp_refresh=r" } });
    const res = await logout2(req as unknown as NextRequest, ctx);
    const sc = res.headers.get("set-cookie") ?? "";
    expect(sc).toMatch(/pmp_access=; Path=\/; (Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT)/);
    expect(sc).toMatch(/pmp_refresh=; Path=\/; (Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT)/);
  });
});
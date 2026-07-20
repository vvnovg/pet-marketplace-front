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

const toReq = (url: string, init?: RequestInit) => new Request(url, init) as unknown as NextRequest;
const jsonReq = (url: string, body: unknown) => toReq(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("verify-email route", () => {
  it("forwards token as query and returns ok on 200", async () => {
    let sentUrl = "";
    server.use(http.post(`${API_BASE}/auth/verify-email`, ({ request }) => { sentUrl = request.url; return new HttpResponse(null, { status: 200 }); }));
    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(toReq("http://x/api/auth/verify-email?token=tok-1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sentUrl).toContain("token=tok-1");
  });
  it("returns problem+json on 400", async () => {
    server.use(http.post(`${API_BASE}/auth/verify-email`, () => new HttpResponse('{"detail":"bad"}', { status: 400, headers: { "content-type": "application/problem+json" } })));
    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(toReq("http://x/api/auth/verify-email?token=bad"));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });
});

describe("forgot-password route", () => {
  it("forwards body and returns ok on 200", async () => {
    let sentBody = "";
    server.use(http.post(`${API_BASE}/auth/forgot-password`, async ({ request }) => { sentBody = await request.text(); return new HttpResponse(null, { status: 200 }); }));
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(jsonReq("http://x/api/auth/forgot-password", { email: "a@b.co" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(JSON.parse(sentBody)).toEqual({ email: "a@b.co" });
  });
});

describe("reset-password route", () => {
  it("forwards body and returns ok on 200", async () => {
    let sentBody = "";
    server.use(http.post(`${API_BASE}/auth/reset-password`, async ({ request }) => { sentBody = await request.text(); return new HttpResponse(null, { status: 200 }); }));
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(jsonReq("http://x/api/auth/reset-password", { token: "t", newPassword: "12345678" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(JSON.parse(sentBody)).toEqual({ token: "t", newPassword: "12345678" });
  });
  it("returns problem+json on 400", async () => {
    server.use(http.post(`${API_BASE}/auth/reset-password`, () => new HttpResponse('{"detail":"bad"}', { status: 400, headers: { "content-type": "application/problem+json" } })));
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(jsonReq("http://x/api/auth/reset-password", { token: "bad", newPassword: "12345678" }));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });
});
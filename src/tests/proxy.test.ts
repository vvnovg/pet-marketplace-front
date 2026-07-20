import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { forwardToBackend } from "@/lib/api/proxy-handler";
import type { NextRequest } from "next/server";

const API_BASE = "http://localhost:8080/api/v1";
process.env.NEXT_PUBLIC_API_BASE = API_BASE;

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  server.close();
});

describe("forwardToBackend", () => {
  it("forwards GET with bearer from cookie and returns JSON", async () => {
    server.use(http.get(`${API_BASE}/users/me`, ({ request }) => {
      expect(request.headers.get("authorization")).toBe("Bearer abc");
      return HttpResponse.json({ id: "u1" });
    }));
    const req = new Request("http://x/api/proxy/users/me", {
      headers: { cookie: "pmp_access=abc" },
    });
    const res = await forwardToBackend(req as unknown as NextRequest, ["users", "me"]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "u1" });
  });

  it("on 401 with refresh cookie, refreshes and retries once", async () => {
    let first = true;
    server.use(
      http.get(`${API_BASE}/users/me`, () =>
        first ? (first = false, new HttpResponse(null, { status: 401 })) : HttpResponse.json({ id: "u1" }),
      ),
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: "new", refreshToken: "nr", tokenType: "Bearer", expiresIn: 900 }),
      ),
    );
    const req = new Request("http://x/api/proxy/users/me", {
      headers: { cookie: "pmp_access=stale; pmp_refresh=rr" },
    });
    const res = await forwardToBackend(req as unknown as NextRequest, ["users", "me"]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "u1" });
    // refreshed cookies set on response
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("pmp_access=new");
  });

  it("on 401 with no refresh cookie, returns 401", async () => {
    server.use(http.get(`${API_BASE}/users/me`, () => new HttpResponse(null, { status: 401 })));
    const req = new Request("http://x/api/proxy/users/me", { headers: { cookie: "pmp_access=stale" } });
    const res = await forwardToBackend(req as unknown as NextRequest, ["users", "me"]);
    expect(res.status).toBe(401);
  });

  it("rejects paths starting with auth/", async () => {
    const req = new Request("http://x/api/proxy/auth/login");
    const res = await forwardToBackend(req as unknown as NextRequest, ["auth", "login"]);
    expect(res.status).toBe(404);
  });

  it("replays original body on refresh-retry of a POST (Important #1)", async () => {
    let first = true;
    server.use(
      http.post(`${API_BASE}/listings`, async ({ request }) => {
        if (first) {
          first = false;
          return new HttpResponse(null, { status: 401 });
        }
        // Retried call: assert body survived and bearer is refreshed
        const body = await request.json();
        if (!body || Object.keys(body).length === 0) {
          throw new Error("retried request had empty body — stream was consumed");
        }
        expect(body).toEqual({ title: "Cat", priceCents: 5000 });
        expect(request.headers.get("authorization")).toBe("Bearer new");
        return HttpResponse.json({ id: "l1" });
      }),
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: "new", refreshToken: "nr", tokenType: "Bearer", expiresIn: 900 }),
      ),
    );
    const req = new Request("http://x/api/proxy/listings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "pmp_access=stale; pmp_refresh=rr",
      },
      body: JSON.stringify({ title: "Cat", priceCents: 5000 }),
    });
    const res = await forwardToBackend(req as unknown as NextRequest, ["listings"]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "l1" });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("pmp_access=new");
  });

  it("POST 401 with no refresh cookie returns 401 and is not retried upstream", async () => {
    let calls = 0;
    server.use(
      http.post(`${API_BASE}/listings`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 401 });
      }),
    );
    const req = new Request("http://x/api/proxy/listings", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "pmp_access=stale" },
      body: JSON.stringify({ title: "Cat", priceCents: 5000 }),
    });
    const res = await forwardToBackend(req as unknown as NextRequest, ["listings"]);
    expect(res.status).toBe(401);
    expect(calls).toBe(1);
  });
});
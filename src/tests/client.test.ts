import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { apiGet, apiPost } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/endpoints/users";

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  server.close();
});

describe("client", () => {
  it("apiGet parses JSON and returns typed value", async () => {
    server.use(http.get("http://localhost/api/proxy/users/me", () => HttpResponse.json({ id: "u1" })));
    const u = await apiGet<{ id: string }>("users/me", { baseUrl: "http://localhost" });
    expect(u.id).toBe("u1");
  });

  it("apiPost posts JSON", async () => {
    let captured: unknown;
    server.use(http.post("http://localhost/api/proxy/x", async ({ request }) => {
      captured = await request.json();
      return HttpResponse.json({ ok: true }, { status: 201 });
    }));
    const r = await apiPost<{ ok: boolean }>("x", { a: 1 }, { baseUrl: "http://localhost" });
    expect(r.ok).toBe(true);
    expect(captured).toEqual({ a: 1 });
  });

  it("throws ApiError on non-2xx", async () => {
    server.use(http.get("http://localhost/api/proxy/x", () =>
      new HttpResponse(JSON.stringify({ status: 400, title: "Bad", detail: "nope" }),
        { status: 400, headers: { "content-type": "application/problem+json" } })));
    await expect(apiGet("x", { baseUrl: "http://localhost" })).rejects.toMatchObject({ status: 400, detail: "nope" });
  });

  it("getCurrentUser calls /users/me via endpoint", async () => {
    server.use(http.get("http://localhost/api/proxy/users/me", () =>
      HttpResponse.json({ id: "u1", email: "e@x", role: "BUYER", verified: true, active: true,
        firstName: null, lastName: null, avatarUrl: null, phone: null, bio: null, country: null, city: null,
        address: null, latitude: null, longitude: null, rating: null, totalReviews: null,
        createdAt: "t", updatedAt: "t" })));
    const u = await getCurrentUser({ baseUrl: "http://localhost" });
    expect(u.id).toBe("u1");
  });
});
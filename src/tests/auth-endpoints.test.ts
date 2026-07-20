import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { loginViaApi, registerViaApi, verifyEmailViaApi, forgotPasswordViaApi, resetPasswordViaApi } from "@/lib/api/endpoints/auth";
import { ApiError } from "@/lib/api/errors";

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

describe("loginViaApi", () => {
  it("resolves on 200", async () => {
    server.use(http.post("/api/auth/login", () => HttpResponse.json({ ok: true })));
    await expect(loginViaApi("a@b.co", "12345678")).resolves.toBeUndefined();
  });
  it("throws ApiError with status on 401", async () => {
    server.use(http.post("/api/auth/login", () => new HttpResponse(null, { status: 401 })));
    await expect(loginViaApi("a@b.co", "wrong")).rejects.toMatchObject({ name: "ApiError", status: 401 });
  });
});

describe("registerViaApi", () => {
  it("resolves on 201", async () => {
    server.use(http.post("/api/auth/register", () => new HttpResponse(null, { status: 201 })));
    await expect(registerViaApi({ email: "a@b.co", password: "12345678" })).resolves.toBeUndefined();
  });
  it("throws ApiError 409 on duplicate", async () => {
    server.use(http.post("/api/auth/register", () => new HttpResponse("exists", { status: 409, headers: { "content-type": "application/problem+json" } })));
    await expect(registerViaApi({ email: "a@b.co", password: "12345678" })).rejects.toMatchObject({ status: 409 });
  });
});

describe("verifyEmailViaApi", () => {
  it("POSTs to /api/auth/verify-email?token=", async () => {
    let capturedUrl = "";
    server.use(http.post("/api/auth/verify-email", ({ request }) => { capturedUrl = request.url; return HttpResponse.json({ ok: true }); }));
    await verifyEmailViaApi("tok-123");
    expect(capturedUrl).toContain("token=tok-123");
  });
  it("throws ApiError 400 on bad token", async () => {
    server.use(http.post("/api/auth/verify-email", () => new HttpResponse("bad", { status: 400, headers: { "content-type": "application/problem+json" } })));
    await expect(verifyEmailViaApi("bad")).rejects.toMatchObject({ status: 400 });
  });
});

describe("forgotPasswordViaApi", () => {
  it("resolves on 200", async () => {
    server.use(http.post("/api/auth/forgot-password", () => HttpResponse.json({ ok: true })));
    await expect(forgotPasswordViaApi("a@b.co")).resolves.toBeUndefined();
  });
});

describe("resetPasswordViaApi", () => {
  it("resolves on 200", async () => {
    server.use(http.post("/api/auth/reset-password", () => HttpResponse.json({ ok: true })));
    await expect(resetPasswordViaApi("tok", "12345678")).resolves.toBeUndefined();
  });
  it("throws ApiError 400 on bad token", async () => {
    server.use(http.post("/api/auth/reset-password", () => new HttpResponse("bad", { status: 400, headers: { "content-type": "application/problem+json" } })));
    await expect(resetPasswordViaApi("bad", "12345678")).rejects.toMatchObject({ status: 400 });
  });
});
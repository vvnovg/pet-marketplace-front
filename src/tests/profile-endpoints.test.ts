import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { updateProfile, uploadAvatar } from "@/lib/api/endpoints/profile";
import { ApiError } from "@/lib/api/errors";

type Call = { method: string; url: string; body: unknown };
const calls: Call[] = [];
let failNext = false;

const server = setupServer(
  http.put("*/api/proxy/users/me", async ({ request }) => {
    calls.push({ method: "PUT", url: request.url, body: await request.json() });
    if (failNext) {
      return HttpResponse.json(
        { status: 400, title: "Validation failed", detail: "bad", violations: [{ field: "phone", message: "too long" }] },
        { status: 400 },
      );
    }
    return HttpResponse.json({ id: "u1", email: "a@b.co", role: "BUYER" });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { calls.length = 0; failNext = false; server.resetHandlers(); });
afterAll(() => server.close());

const last = (): Call => calls[calls.length - 1]!;

describe("profile endpoints", () => {
  it("updateProfile PUTs to users/me with the full body", async () => {
    await updateProfile(
      { firstName: "Ivan", lastName: null, phone: null, bio: null, country: null, city: "Samara", address: null },
      { baseUrl: "http://t" },
    );
    expect(last().method).toBe("PUT");
    expect(last().url).toBe("http://t/api/proxy/users/me");
    expect(last().body).toMatchObject({ firstName: "Ivan", lastName: null, city: "Samara" });
  });

  it("updateProfile surfaces violations as ApiError", async () => {
    failNext = true;
    await expect(
      updateProfile(
        { firstName: null, lastName: null, phone: "x", bio: null, country: null, city: null, address: null },
        { baseUrl: "http://t" },
      ),
    ).rejects.toMatchObject({ status: 400, violations: [{ field: "phone", message: "too long" }] });
    await expect(
      updateProfile(
        { firstName: null, lastName: null, phone: "x", bio: null, country: null, city: null, address: null },
        { baseUrl: "http://t" },
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("uploadAvatar POSTs multipart with the 'file' field", async () => {
    // jsdom's fetch/Request cannot serialize a jsdom File's bytes through a real
    // multipart body in this environment: verified empirically that the actual bytes
    // on the wire come out as the literal string "undefined" (size 9) regardless of
    // what was uploaded, once the FormData crosses into `new Request()`/undici. So
    // this stubs fetch to inspect the FormData apiUpload builds *before* that broken
    // serialization step, where `entry instanceof Blob` and `.size`/`.text()` are
    // still accurate.
    const file = new File(["x"], "a.png", { type: "image/png" });
    const state: { captured: { method: string; url: string; body: { size: number; text: string } | null } | null } = {
      captured: null,
    };
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const entry = init?.body instanceof FormData ? init.body.get("file") : null;
      state.captured = {
        method: init?.method ?? "GET",
        url: String(input),
        body: entry instanceof Blob ? { size: entry.size, text: await entry.text() } : null,
      };
      return new Response(JSON.stringify({ id: "u1", avatarUrl: "/a.png" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    try {
      await uploadAvatar(file, { baseUrl: "http://t" });
    } finally {
      vi.stubGlobal("fetch", realFetch);
    }
    expect(state.captured?.method).toBe("POST");
    expect(state.captured?.url).toBe("http://t/api/proxy/users/me/avatar");
    expect(state.captured?.body).toEqual({ size: 1, text: "x" });
  });
});

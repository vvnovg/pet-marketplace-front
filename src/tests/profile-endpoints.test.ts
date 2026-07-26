import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
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
  http.post("*/api/proxy/users/me/avatar", async ({ request }) => {
    const fd = await request.formData();
    calls.push({ method: "POST", url: request.url, body: fd.get("file") instanceof File ? "file" : null });
    return HttpResponse.json({ id: "u1", avatarUrl: "/a.png" });
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
    const file = new File(["x"], "a.png", { type: "image/png" });
    await uploadAvatar(file, { baseUrl: "http://t" });
    expect(last().method).toBe("POST");
    expect(last().url).toBe("http://t/api/proxy/users/me/avatar");
    expect(last().body).toBe("file");
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { listSubscriptions, createSubscription, deleteSubscription } from "@/lib/api/endpoints/subscriptions";

type Call = { method: string; url: string; body: unknown };
const calls: Call[] = [];
const server = setupServer(
  http.get("*/api/proxy/subscriptions", ({ request }) => {
    calls.push({ method: "GET", url: request.url, body: null });
    return HttpResponse.json([]);
  }),
  http.post("*/api/proxy/subscriptions", async ({ request }) => {
    calls.push({ method: "POST", url: request.url, body: await request.json() });
    return HttpResponse.json({ id: "s1", filters: {}, active: true, createdAt: "2026-01-01T00:00:00Z" });
  }),
  http.delete("*/api/proxy/subscriptions/:id", ({ request, params }) => {
    calls.push({ method: "DELETE", url: `subscriptions/${params.id}`, body: null });
    return new HttpResponse(null, { status: 204 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { calls.length = 0; server.resetHandlers(); });
afterAll(() => server.close());

const last = (): Call => calls[calls.length - 1]!;

describe("subscription endpoints", () => {
  it("listSubscriptions GETs subscriptions", async () => {
    await expect(listSubscriptions({ baseUrl: "http://t" })).resolves.toEqual([]);
    expect(last().method).toBe("GET");
    expect(last().url).toBe("http://t/api/proxy/subscriptions");
  });

  it("createSubscription POSTs the filter body", async () => {
    const created = await createSubscription({ city: "Samara", minPrice: 100 }, { baseUrl: "http://t" });
    expect(created.id).toBe("s1");
    expect(last().method).toBe("POST");
    expect(last().body).toMatchObject({ city: "Samara", minPrice: 100 });
  });

  it("deleteSubscription DELETEs by id", async () => {
    await deleteSubscription("s7", { baseUrl: "http://t" });
    expect(last().method).toBe("DELETE");
    expect(last().url).toBe("subscriptions/s7");
  });
});

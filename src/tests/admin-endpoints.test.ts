import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  getAdminUsers, updateUserStatus, updateUserRole,
  getPendingListings, moderateListing, getPendingReviews, moderateReview, getStatistics,
} from "@/lib/api/endpoints/admin";

const calls: { method: string; url: string; body?: string; headers: Record<string, string> }[] = [];
const server = setupServer(
  http.get("*/api/proxy/admin/users", ({ request }) => {
    calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true, empty: true });
  }),
  http.put("*/api/proxy/admin/users/:id/status", async ({ request, params }) => {
    calls.push({ method: "PUT", url: `users/${params.id}/status`, body: await request.text(), headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ id: params.id, email: "a@b.co", role: "BUYER", verified: true, active: false, createdAt: "t", updatedAt: "t" });
  }),
  http.put("*/api/proxy/admin/users/:id/role", async ({ request, params }) => {
    calls.push({ method: "PUT", url: `users/${params.id}/role`, body: await request.text(), headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ id: params.id, email: "a@b.co", role: "ADMIN", verified: true, active: true, createdAt: "t", updatedAt: "t" });
  }),
  http.get("*/api/proxy/admin/listings/pending", ({ request }) => {
    calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true, empty: true });
  }),
  http.put("*/api/proxy/admin/listings/:id/moderate", async ({ request, params }) => {
    calls.push({ method: "PUT", url: `listings/${params.id}/moderate`, body: await request.text(), headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ id: params.id, status: "ACTIVE" });
  }),
  http.get("*/api/proxy/admin/reviews/pending", ({ request }) => {
    calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true, empty: true });
  }),
  http.put("*/api/proxy/admin/reviews/:id/moderate", async ({ request, params }) => {
    calls.push({ method: "PUT", url: `reviews/${params.id}/moderate`, body: await request.text(), headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ id: params.id, status: "APPROVED" });
  }),
  http.get("*/api/proxy/admin/statistics", ({ request }) => {
    calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ totalUsers: 5, activeUsers: 3, listingsByStatus: {}, bookingsByStatus: {}, reviewsByStatus: {}, listingsCreatedToday: 1, listingsCreatedThisWeek: 2, listingsCreatedThisMonth: 4 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { calls.length = 0; server.resetHandlers(); });
afterAll(() => server.close());

describe("admin endpoints", () => {
  it("builds users query skipping null params", async () => {
    await getAdminUsers({ role: "ADMIN", active: true, verified: null, search: "ab", page: 1, size: 20 }, { baseUrl: "http://x" });
    const u = new URL(calls[0]!.url);
    expect(u.searchParams.get("role")).toBe("ADMIN");
    expect(u.searchParams.get("active")).toBe("true");
    expect(u.searchParams.get("verified")).toBeNull();
    expect(u.searchParams.get("search")).toBe("ab");
    expect(u.searchParams.get("page")).toBe("1");
    expect(u.searchParams.get("size")).toBe("20");
  });

  it("updateUserStatus sends PUT body", async () => {
    const r = await updateUserStatus("u1", { active: false, reason: "spam" }, { baseUrl: "http://x" });
    expect(r.active).toBe(false);
    expect(calls[0]!.body).toBe(JSON.stringify({ active: false, reason: "spam" }));
  });

  it("updateUserRole sends PUT body", async () => {
    const r = await updateUserRole("u1", { role: "ADMIN" }, { baseUrl: "http://x" });
    expect(r.role).toBe("ADMIN");
    expect(calls[0]!.body).toBe(JSON.stringify({ role: "ADMIN" }));
  });

  it("getPendingListings sends Accept-Language", async () => {
    await getPendingListings(0, 10, "en", { baseUrl: "http://x" });
    expect(calls[0]!.headers["accept-language"]).toBe("en");
  });

  it("moderateListing sends body + Accept-Language", async () => {
    const r = await moderateListing("l1", { status: "REJECTED", reason: "no" }, "ru", { baseUrl: "http://x" });
    expect(r.status).toBe("ACTIVE");
    expect(calls[0]!.body).toBe(JSON.stringify({ status: "REJECTED", reason: "no" }));
    expect(calls[0]!.headers["accept-language"]).toBe("ru");
  });

  it("getPendingReviews + moderateReview", async () => {
    await getPendingReviews(0, 10, { baseUrl: "http://x" });
    expect(calls[0]!.url).toContain("page=0");
    const r = await moderateReview("r1", { status: "APPROVED" }, { baseUrl: "http://x" });
    expect(r.status).toBe("APPROVED");
    expect(calls[1]!.body).toBe(JSON.stringify({ status: "APPROVED" }));
  });

  it("getStatistics", async () => {
    const s = await getStatistics({ baseUrl: "http://x" });
    expect(s.totalUsers).toBe(5);
    expect(s.listingsCreatedThisMonth).toBe(4);
  });
});
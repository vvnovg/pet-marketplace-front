import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  getCategories, getBreeds, searchListings, getListing, listFavorites, addFavorite, removeFavorite, bookListing,
} from "@/lib/api/endpoints/catalog";

type Call = { method: string; url: string; headers: Record<string, string> };
const calls: Call[] = [];
const server = setupServer(
  http.get("*/api/proxy/categories", ({ request }) => { calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) }); return HttpResponse.json([]); }),
  http.get("*/api/proxy/categories/:id/breeds", ({ request, params }) => { calls.push({ method: "GET", url: `categories/${params.id}/breeds`, headers: Object.fromEntries(request.headers) }); return HttpResponse.json({ id: params.id, name: "C", slug: "c", breeds: [] }); }),
  http.get("*/api/proxy/listings", ({ request }) => { calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) }); return HttpResponse.json({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, first: true, last: true, empty: true }); }),
  http.get("*/api/proxy/listings/:id", ({ request, params }) => { calls.push({ method: "GET", url: `listings/${params.id}`, headers: Object.fromEntries(request.headers) }); return HttpResponse.json({ id: params.id, title: "t" }); }),
  http.get("*/api/proxy/favorites", ({ request }) => { calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) }); return HttpResponse.json([]); }),
  http.post("*/api/proxy/favorites/:listingId", ({ request, params }) => { calls.push({ method: "POST", url: `favorites/${params.listingId}`, headers: Object.fromEntries(request.headers) }); return new HttpResponse(null, { status: 201 }); }),
  http.delete("*/api/proxy/favorites/:listingId", ({ request, params }) => { calls.push({ method: "DELETE", url: `favorites/${params.listingId}`, headers: Object.fromEntries(request.headers) }); return new HttpResponse(null, { status: 204 }); }),
  http.post("*/api/proxy/listings/:id/book", ({ request }) => { calls.push({ method: "POST", url: request.url, headers: Object.fromEntries(request.headers) }); return HttpResponse.json({ id: "b1", status: "PENDING" }); }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { calls.length = 0; server.resetHandlers(); });
afterAll(() => server.close());

const last = (): Call => calls[calls.length - 1]!;

describe("catalog endpoints", () => {
  it("getCategories sends accept-language", async () => {
    await getCategories("en", { baseUrl: "http://t" });
    expect(last().url).toBe("http://t/api/proxy/categories");
    expect(last().headers["accept-language"]).toBe("en");
  });

  it("getBreeds builds category id path with locale", async () => {
    await getBreeds("c1", "ru", { baseUrl: "http://t" });
    expect(last().url).toBe("categories/c1/breeds");
    expect(last().headers["accept-language"]).toBe("ru");
  });

  it("searchListings skips null/empty and applies defaults", async () => {
    await searchListings({ categoryId: null, city: "", page: 0, size: 20 }, "ru", { baseUrl: "http://t" });
    const u = new URL(last().url);
    expect(u.searchParams.get("categoryId")).toBeNull();
    expect(u.searchParams.get("city")).toBeNull();
    expect(u.searchParams.get("sortBy")).toBe("createdAt");
    expect(u.searchParams.get("sortDirection")).toBe("DESC");
    expect(u.searchParams.get("page")).toBe("0");
    expect(last().headers["accept-language"]).toBe("ru");
  });

  it("searchListings includes set filters", async () => {
    await searchListings({ categoryId: "c1", breedId: "b1", minPrice: 100, maxPrice: 500, gender: "MALE", minAge: 1, maxAge: 12, sortBy: "price", sortDirection: "ASC", page: 2, size: 10 }, "en", { baseUrl: "http://t" });
    const u = new URL(last().url);
    expect(u.searchParams.get("categoryId")).toBe("c1");
    expect(u.searchParams.get("minPrice")).toBe("100");
    expect(u.searchParams.get("gender")).toBe("MALE");
    expect(u.searchParams.get("sortBy")).toBe("price");
    expect(u.searchParams.get("page")).toBe("2");
  });

  it("getListing builds id path with locale", async () => {
    await getListing("l1", "en", { baseUrl: "http://t" });
    expect(last().url).toBe("listings/l1");
    expect(last().headers["accept-language"]).toBe("en");
  });

  it("listFavorites hits favorites", async () => {
    await listFavorites({ baseUrl: "http://t" });
    expect(last().method).toBe("GET");
    expect(last().url).toBe("http://t/api/proxy/favorites");
  });

  it("addFavorite posts to favorites/{id}", async () => {
    await addFavorite("l1", { baseUrl: "http://t" });
    expect(last().method).toBe("POST");
    expect(last().url).toBe("favorites/l1");
  });

  it("removeFavorite deletes favorites/{id}", async () => {
    await removeFavorite("l1", { baseUrl: "http://t" });
    expect(last().method).toBe("DELETE");
    expect(last().url).toBe("favorites/l1");
  });

  it("bookListing puts message in query when provided", async () => {
    await bookListing("l1", "hello", { baseUrl: "http://t" });
    expect(last().method).toBe("POST");
    const u = new URL(last().url);
    expect(u.searchParams.get("message")).toBe("hello");
  });

  it("bookListing omits message query when absent", async () => {
    await bookListing("l1", undefined, { baseUrl: "http://t" });
    const u = new URL(last().url);
    expect(u.searchParams.get("message")).toBeNull();
  });
});
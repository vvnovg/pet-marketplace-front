import { test } from "@playwright/test";

// The middleware admin guard (src/middleware.ts) fetches `${API_BASE}/users/me`
// directly from the Next server runtime with the access bearer for ANY /admin/**
// path (src/middleware.ts:40-49). Playwright `page.route` only intercepts
// browser-emitted requests; it CANNOT intercept server-side middleware fetches
// (documented in e2e/auth.spec.ts:95-100 and the project's CLAUDE.md:
// "the middleware admin guard is covered by src/tests/middleware-admin.test.ts,
// not e2e").
//
// Navigating to /ru/admin/listings/pending therefore hits the middleware guard,
// which issues a server-side fetch that page.route cannot stub. The middleware
// would either redirect to /login (no stubbed user) or pass through to the real
// backend (no backend in the e2e environment), so the pending-listing page can
// never be reached hermetically via page.route alone.
//
// The moderation UI itself (cards, approve button, confirm dialog, the
// moderateListing call) is client-side and is already covered by the vitest
// suite src/tests/admin-listings-pending.test.tsx (3/3 passing). The middleware
// admin guard (role check, redirect behavior) is covered by
// src/tests/middleware-admin.test.ts.
//
// The intended flow below is retained as commented pseudo-code so a future
// hermetic setup (e.g. a mock backend pointed at via NEXT_PUBLIC_API_BASE, or
// a middleware-level test harness) can reinstate it without re-deriving the
// stubs.

test.skip("admin approves a pending listing", async ({ page }) => {
  // --- Intended stub setup (documented for a future hermetic setup) ---
  //
  // const adminMe = { id: "me", email: "admin@x.co", role: "ADMIN", verified: true, active: true, createdAt: "t", updatedAt: "t" };
  // const pendingListing = {
  //   id: "l1", seller: { id: "s1", firstName: "S", lastName: "E", avatarUrl: null, bio: null, country: null, city: null, rating: null, totalReviews: null, role: "SELLER" },
  //   categoryId: "c1", categoryName: "Cats", breedId: null, breedName: null, title: "Pending Kitten", description: "d",
  //   price: "100", currency: "USD", gender: "MALE", ageMonths: 3, color: null, weightKg: null, healthInfo: null,
  //   hasVaccination: null, hasDocuments: null, locationCountry: "RU", locationCity: "Moscow", status: "PENDING_MODERATION",
  //   viewsCount: 0, images: [], createdAt: "t", updatedAt: "t",
  // };
  // const page1 = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: content.length === 0 });
  //
  // async function stubAuth(page: Page) {
  //   // Set pmp_access cookie via a stubbed auth response set-cookie header.
  //   await page.route("**/api/auth/login", async (route) =>
  //     route.fulfill({ status: 200, contentType: "application/json", headers: { "set-cookie": "pmp_access=acc; Path=/; HttpOnly" }, body: JSON.stringify({ ok: true }) }));
  //   await page.route("**/api/proxy/users/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminMe) }));
  // }
  //
  // await stubAuth(page);
  // await page.route("**/api/proxy/admin/listings/pending", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(page1([pendingListing])) }));
  // let moderated = false;
  // await page.route("**/api/proxy/admin/listings/*/moderate", async (route) => {
  //   moderated = true;
  //   await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...pendingListing, status: "ACTIVE" }) });
  // });
  //
  // // Seed session cookie, then navigate straight to the pending page.
  // await page.context().addCookies([{ name: "pmp_access", value: "acc", domain: "localhost", path: "/" }]);
  // await page.goto("/ru/admin/listings/pending");
  //
  // await expect(page.getByText("Pending Kitten")).toBeVisible();
  // await page.getByRole("button", { name: /Одобрить|Approve/ }).click();
  // await page.getByRole("button", { name: /Подтвердить|Confirm/ }).click();
  // await expect.poll(() => moderated).toBe(true);
  //
  // NOTE: page.route stubs above only cover browser-emitted /api/proxy/* and
  // /api/auth/* requests. The middleware's server-side fetch to
  // ${API_BASE}/users/me is NOT intercepted, so this flow cannot reach the
  // pending-listing page under page.route-only stubbing. See the comment block
  // at the top of this file for the full rationale.
});
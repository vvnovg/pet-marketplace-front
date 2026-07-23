import { test, expect, type Page } from "@playwright/test";

const listing = (id: string, title: string) => ({
  id, seller: { id: "s", firstName: "Ivan", lastName: "P", avatarUrl: null, bio: null, country: "RU", city: "Moscow", rating: "4.5", totalReviews: 3, role: "SELLER" },
  categoryId: "c1", categoryName: "Cats", breedId: null, breedName: null, title, description: "desc", price: "100", currency: "USD",
  gender: "MALE", ageMonths: 3, color: null, weightKg: null, healthInfo: null, hasVaccination: null, hasDocuments: null,
  locationCountry: "RU", locationCity: "Moscow", status: "ACTIVE", viewsCount: 0,
  images: [{ id: "i1", url: "/a.jpg", orderIndex: 0, isMain: true }], createdAt: "t", updatedAt: "t",
});
const page1 = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 12, first: true, last: true, empty: content.length === 0 });

const fulfill = (r: import("@playwright/test").Route, body: unknown) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

// Use pathname-based function matchers: globs like `**/api/proxy/listings` do NOT
// match URLs that carry a query string (e.g. .../listings?sortBy=createdAt&...), so
// the search request would slip past the stub and hit the real proxy → no backend.
async function stubCatalog(page: Page) {
  await page.route((u) => u.pathname === "/api/proxy/categories", (r) => fulfill(r, [{ id: "c1", name: "Cats", slug: "cats", children: [], breeds: [] }]));
  await page.route((u) => u.pathname.startsWith("/api/proxy/categories/") && u.pathname.endsWith("/breeds"), (r) => fulfill(r, { id: "c1", name: "Cats", slug: "cats", breeds: [{ id: "b1", name: "Siamese" }] }));
  await page.route((u) => u.pathname === "/api/proxy/listings", (r) => fulfill(r, page1([listing("l1", "Siamese Kitten")])));
  await page.route((u) => u.pathname.startsWith("/api/proxy/listings/"), (r) => fulfill(r, listing("l1", "Siamese Kitten")));
}

test("guest browses catalog, filters by category, opens detail", async ({ page }) => {
  await stubCatalog(page);

  await page.goto("/ru/catalog");
  await expect(page.getByText("Siamese Kitten")).toBeVisible();

  await page.getByRole("link", { name: "Siamese Kitten" }).click();
  await expect(page).toHaveURL(/\/ru\/listings\/l1/);
  await expect(page.getByText("100 USD")).toBeVisible();
});
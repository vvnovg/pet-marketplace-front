import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import ru from "@/messages/ru.json";
import CatalogPage from "@/app/[locale]/catalog/page";
import type { UserProfile } from "@/types/api";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/catalog",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => { server.listen({ onUnhandledRequest: "error" }); window.history.replaceState(null, "", "/"); });
afterEach(() => { server.resetHandlers(); server.close(); });

const mkQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const renderPage = (user: UserProfile | null = null) => render(
  <QueryClientProvider client={mkQc()}>
    <NextIntlClientProvider locale="ru" messages={ru}>
      <SessionContext.Provider value={{ user, status: user ? "authenticated" : "unauthenticated" }}>
        <CatalogPage />
      </SessionContext.Provider>
    </NextIntlClientProvider>
  </QueryClientProvider>,
);

const authedUser: UserProfile = {
  id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true,
  firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null,
  country: null, city: null, address: null, latitude: null, longitude: null,
  rating: null, totalReviews: null, createdAt: "t", updatedAt: "t",
};

const listing = (id: string, title: string) => ({
  id, seller: { id: "s", firstName: "S", lastName: "", avatarUrl: null, bio: null, country: null, city: null, rating: null, totalReviews: 0, role: "SELLER" },
  categoryId: "c", categoryName: "Cats", breedId: null, breedName: null, title, description: null, price: "100", currency: "USD",
  gender: "MALE", ageMonths: 3, color: null, weightKg: null, healthInfo: null, hasVaccination: null, hasDocuments: null,
  locationCountry: "RU", locationCity: "Moscow", status: "ACTIVE", viewsCount: 0, images: [], createdAt: "t", updatedAt: "t",
});
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 12, first: true, last: true, empty: content.length === 0 });

describe("CatalogPage", () => {
  it("renders listing cards", async () => {
    server.use(
      http.get("*/api/proxy/categories", () => HttpResponse.json([])),
      http.get("*/api/proxy/listings", () => HttpResponse.json(page([listing("l1", "Kitten"), listing("l2", "Puppy")]))),
    );
    renderPage();
    expect(await screen.findByText("Kitten")).toBeInTheDocument();
    expect(screen.getByText("Puppy")).toBeInTheDocument();
    expect(screen.getByLabelText(ru.Catalog.sortBy)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    server.use(
      http.get("*/api/proxy/categories", () => HttpResponse.json([])),
      http.get("*/api/proxy/listings", () => HttpResponse.json(page([]))),
    );
    renderPage();
    expect(await screen.findByText(ru.Catalog.empty)).toBeInTheDocument();
  });

  it("selecting a category loads breeds and filters", async () => {
    const user = userEvent.setup();
    let lastUrl = "";
    server.use(
      http.get("*/api/proxy/categories", () => HttpResponse.json([{ id: "c1", name: "Cats", slug: "cats", children: [], breeds: [] }])),
      http.get("*/api/proxy/categories/:id/breeds", () => HttpResponse.json({ id: "c1", name: "Cats", slug: "cats", breeds: [{ id: "b1", name: "Siamese" }] })),
      http.get("*/api/proxy/listings", ({ request }) => { lastUrl = request.url; return HttpResponse.json(page([listing("l1", "Kitten")])); }),
    );
    renderPage();
    await screen.findByText("Kitten");
    await user.selectOptions(screen.getByLabelText(ru.Catalog.category), "c1");
    await waitFor(() => expect(screen.getByLabelText(ru.Catalog.breed)).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText(ru.Catalog.breed), "b1");
    await waitFor(() => expect(lastUrl).toContain("breedId=b1"));
  });

  it("resets filters", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/proxy/categories", () => HttpResponse.json([{ id: "c1", name: "Cats", slug: "cats", children: [], breeds: [] }])),
      http.get("*/api/proxy/listings", () => HttpResponse.json(page([listing("l1", "Kitten")]))),
    );
    renderPage();
    await screen.findByText("Kitten");
    await user.selectOptions(screen.getByLabelText(ru.Catalog.category), "c1");
    await user.click(screen.getByText(ru.Catalog.reset));
    expect(screen.getByLabelText(ru.Catalog.category)).toHaveValue("");
  });
});

describe("Catalog save search", () => {
  const listingsAndCategories = () => {
    server.use(
      http.get("*/api/proxy/categories", () => HttpResponse.json([])),
      http.get("*/api/proxy/listings", () => HttpResponse.json(page([listing("l1", "Kitten")]))),
    );
  };

  it("hides the button for anonymous visitors", async () => {
    listingsAndCategories();
    renderPage();
    await screen.findByText("Kitten");
    expect(screen.queryByRole("button", { name: ru.Catalog.saveSearch })).not.toBeInTheDocument();
  });

  it("is disabled until at least one filter is set", async () => {
    listingsAndCategories();
    renderPage(authedUser);
    await screen.findByText("Kitten");
    expect(screen.getByRole("button", { name: ru.Catalog.saveSearch })).toBeDisabled();
  });

  it("posts the current filters without sorting or pagination", async () => {
    const savedSearches: unknown[] = [];
    listingsAndCategories();
    server.use(
      http.post("*/api/proxy/subscriptions", async ({ request }) => {
        savedSearches.push(await request.json());
        return HttpResponse.json({ id: "s1", filters: {}, active: true, createdAt: "2026-02-01T00:00:00Z" });
      }),
    );
    const user = userEvent.setup();
    renderPage(authedUser);
    await screen.findByText("Kitten");
    await user.type(screen.getByLabelText(ru.Catalog.city), "Самара");
    const btn = screen.getByRole("button", { name: ru.Catalog.saveSearch });
    await waitFor(() => expect(btn).toBeEnabled());
    await user.click(btn);
    await waitFor(() => expect(savedSearches).toHaveLength(1));
    expect(savedSearches[0]).toMatchObject({ city: "Самара" });
    expect(savedSearches[0]).not.toHaveProperty("sortBy");
    expect(savedSearches[0]).not.toHaveProperty("page");
    expect(savedSearches[0]).not.toHaveProperty("size");
  });
});
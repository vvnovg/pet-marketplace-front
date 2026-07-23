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
const renderPage = () => render(
  <QueryClientProvider client={mkQc()}>
    <NextIntlClientProvider locale="ru" messages={ru}>
      <SessionContext.Provider value={{ user: null, status: "unauthenticated" }}>
        <CatalogPage />
      </SessionContext.Provider>
    </NextIntlClientProvider>
  </QueryClientProvider>,
);

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
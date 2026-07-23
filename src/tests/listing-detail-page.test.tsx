import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import ru from "@/messages/ru.json";
import ListingDetailPage from "@/app/[locale]/listings/[id]/page";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/listings/l1",
}));
vi.mock("next-intl/navigation", () => ({}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "l1" }) }));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const mkQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = (node: React.ReactNode, user: { id: string; role: string } | null = { id: "me", role: "BUYER" }) => render(
  <QueryClientProvider client={mkQc()}>
    <NextIntlClientProvider locale="ru" messages={ru}>
      <SessionContext.Provider value={{ user: user as never, status: user ? "authenticated" : "unauthenticated" }}>{node}</SessionContext.Provider>
    </NextIntlClientProvider>
  </QueryClientProvider>,
);

const listing = () => ({
  id: "l1", seller: { id: "s1", firstName: "Ivan", lastName: "P", avatarUrl: null, bio: null, country: "RU", city: "Moscow", rating: "4.5", totalReviews: 10, role: "SELLER" },
  categoryId: "c", categoryName: "Cats", breedId: "b", breedName: "Siamese", title: "Kitten", description: "Lovely cat", price: "100", currency: "USD",
  gender: "MALE", ageMonths: 3, color: "black", weightKg: "2", healthInfo: "healthy", hasVaccination: true, hasDocuments: false,
  locationCountry: "RU", locationCity: "Moscow", status: "ACTIVE", viewsCount: 5,
  images: [{ id: "i1", url: "/a.jpg", orderIndex: 0, isMain: true }], createdAt: "2026-01-01T00:00:00Z", updatedAt: "t",
});

describe("ListingDetailPage", () => {
  it("renders listing details, seller, gallery", async () => {
    server.use(
      http.get("*/api/proxy/listings/:id", () => HttpResponse.json(listing())),
      http.get("*/api/proxy/favorites", () => HttpResponse.json([])),
    );
    wrap(<ListingDetailPage />);
    expect(await screen.findByText("Kitten")).toBeInTheDocument();
    expect(screen.getByText("100 USD")).toBeInTheDocument();
    expect(screen.getByText("Ivan P")).toBeInTheDocument();
    expect(document.body.querySelector("img")).toHaveAttribute("src", "/a.jpg");
  });

  it("shows not-found state on 404", async () => {
    server.use(http.get("*/api/proxy/listings/:id", () => HttpResponse.json({ detail: "not found" }, { status: 404 })));
    wrap(<ListingDetailPage />);
    expect(await screen.findByText(ru.Listing.notFound)).toBeInTheDocument();
  });

  it("guest sees login prompt instead of favorite toggle", async () => {
    server.use(http.get("*/api/proxy/listings/:id", () => HttpResponse.json(listing())));
    wrap(<ListingDetailPage />, null);
    expect(await screen.findByText(ru.Listing.loginToFav)).toBeInTheDocument();
  });

  it("booking dialog creates booking", async () => {
    let booked = false;
    server.use(
      http.get("*/api/proxy/listings/:id", () => HttpResponse.json(listing())),
      http.get("*/api/proxy/favorites", () => HttpResponse.json([])),
      http.post("*/api/proxy/listings/:id/book", () => { booked = true; return HttpResponse.json({ id: "b1", status: "PENDING" }); }),
    );
    const user = userEvent.setup();
    wrap(<ListingDetailPage />);
    await screen.findByText("Kitten");
    await user.click(screen.getByText(ru.Listing.book));
    await user.click(screen.getByText(ru.Listing.bookingSubmit));
    await waitFor(() => expect(booked).toBe(true));
  });
});
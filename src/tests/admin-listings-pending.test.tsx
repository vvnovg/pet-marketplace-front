import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ru from "@/messages/ru.json";
import ListingsPendingPage from "@/app/[locale]/(admin)/admin/listings/pending/page";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/listings/pending",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const listing = (id: string, status: "PENDING_MODERATION" | "REJECTED" | "ACTIVE" = "PENDING_MODERATION") => ({
  id, seller: { id: "s1", firstName: "S", lastName: "E", avatarUrl: null, bio: null, country: null, city: null, rating: null, totalReviews: null, role: "SELLER" },
  categoryId: "c1", categoryName: "Cats", breedId: null, breedName: null,
  title: "Kitten " + id, description: "desc", price: "100", currency: "USD", gender: "MALE", ageMonths: 3,
  color: null, weightKg: null, healthInfo: null, hasVaccination: null, hasDocuments: null,
  locationCountry: "RU", locationCity: "Moscow", status, viewsCount: 0, images: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
});

const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: content.length === 0 });

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <NextIntlClientProvider locale="ru" messages={ru}><ListingsPendingPage /></NextIntlClientProvider>
  </QueryClientProvider>,
);

describe("ListingsPendingPage", () => {
  it("renders listing cards", async () => {
    server.use(http.get("*/api/proxy/admin/listings/pending", ({ request }) => {
      expect(request.headers.get("accept-language")).toBe("ru");
      return HttpResponse.json(page([listing("l1")]));
    }));
    renderPage();
    expect(await screen.findByText("Kitten l1")).toBeInTheDocument();
  });

  it("rejects with required reason", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get("*/api/proxy/admin/listings/pending", () => HttpResponse.json(page([listing("l1")]))),
      http.put("*/api/proxy/admin/listings/:id/moderate", async ({ request }) => {
        body = JSON.parse(await request.text()); return HttpResponse.json(listing("l1", "REJECTED"));
      }),
    );
    renderPage();
    await screen.findByText("Kitten l1");
    await user.click(screen.getByRole("button", { name: ru.Admin.pendingListings.reject }));
    await user.type(screen.getByRole("textbox"), "bad photos");
    await user.click(screen.getByRole("button", { name: ru.Admin.common.confirmReject }));
    await waitFor(() => expect(body).toEqual({ status: "REJECTED", reason: "bad photos" }));
  });

  it("approves directly via confirm dialog", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get("*/api/proxy/admin/listings/pending", () => HttpResponse.json(page([listing("l1")]))),
      http.put("*/api/proxy/admin/listings/:id/moderate", async ({ request }) => {
        body = JSON.parse(await request.text()); return HttpResponse.json(listing("l1", "ACTIVE"));
      }),
    );
    renderPage();
    await screen.findByText("Kitten l1");
    await user.click(screen.getByRole("button", { name: ru.Admin.pendingListings.approve }));
    await user.click(screen.getByRole("button", { name: ru.Admin.common.confirmApprove }));
    await waitFor(() => expect(body).toEqual({ status: "ACTIVE" }));
  });
});
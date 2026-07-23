import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ru from "@/messages/ru.json";
import ReviewsPendingPage from "@/app/[locale]/(admin)/admin/reviews/pending/page";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/reviews/pending",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const review = (id: string, rating = 5) => ({
  id, author: { id: "a1", firstName: "A", lastName: "U", avatarUrl: null, bio: null, country: null, city: null, rating: null, totalReviews: null, role: "BUYER" },
  recipient: { id: "r1", firstName: "R", lastName: "V", avatarUrl: null, bio: null, country: null, city: null, rating: null, totalReviews: null, role: "SELLER" },
  booking: { id: "b1" }, rating, comment: "good", status: "PENDING", createdAt: "2026-01-01T00:00:00Z",
});
const page = (c: unknown[]) => ({ content: c, totalElements: c.length, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: c.length === 0 });

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <NextIntlClientProvider locale="ru" messages={ru}><ReviewsPendingPage /></NextIntlClientProvider>
  </QueryClientProvider>,
);

describe("ReviewsPendingPage", () => {
  it("renders review cards with rating", async () => {
    server.use(http.get("*/api/proxy/admin/reviews/pending", () => HttpResponse.json(page([review("r1", 4)]))));
    renderPage();
    expect(await screen.findByText("good")).toBeInTheDocument();
  });

  it("rejects with reason", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get("*/api/proxy/admin/reviews/pending", () => HttpResponse.json(page([review("r1")]))),
      http.put("*/api/proxy/admin/reviews/:id/moderate", async ({ request }) => { body = JSON.parse(await request.text()); return HttpResponse.json(review("r1")); }),
    );
    renderPage();
    await screen.findByText("good");
    await user.click(screen.getByRole("button", { name: ru.Admin.pendingReviews.reject }));
    await user.type(screen.getByRole("textbox"), "rude");
    await user.click(screen.getByRole("button", { name: ru.Admin.common.confirmReject }));
    await waitFor(() => expect(body).toEqual({ status: "REJECTED", reason: "rude" }));
  });
});
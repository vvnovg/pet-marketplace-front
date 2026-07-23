import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ru from "@/messages/ru.json";
import StatisticsPage from "@/app/[locale]/(admin)/admin/statistics/page";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/statistics",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "bypass" })); // recharts may probe layout
afterEach(() => { server.resetHandlers(); server.close(); });

const stats = {
  totalUsers: 10, activeUsers: 7,
  listingsByStatus: { ACTIVE: 3, PENDING_MODERATION: 2, REJECTED: 1 } as Record<string, number>,
  bookingsByStatus: { PENDING: 1, CONFIRMED: 2 } as Record<string, number>,
  reviewsByStatus: { PENDING: 4, APPROVED: 5 } as Record<string, number>,
  listingsCreatedToday: 1, listingsCreatedThisWeek: 3, listingsCreatedThisMonth: 6,
};

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <NextIntlClientProvider locale="ru" messages={ru}><StatisticsPage /></NextIntlClientProvider>
  </QueryClientProvider>,
);

describe("StatisticsPage", () => {
  it("renders KPI tiles with values", async () => {
    server.use(http.get("*/api/proxy/admin/statistics", () => HttpResponse.json(stats)));
    renderPage();
    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("renders empty state when all zero", async () => {
    server.use(http.get("*/api/proxy/admin/statistics", () => HttpResponse.json({
      totalUsers: 0, activeUsers: 0, listingsByStatus: {}, bookingsByStatus: {}, reviewsByStatus: {},
      listingsCreatedToday: 0, listingsCreatedThisWeek: 0, listingsCreatedThisMonth: 0,
    })));
    renderPage();
    expect(await screen.findByText(ru.Admin.common.empty)).toBeInTheDocument();
  });
});
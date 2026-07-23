import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import ru from "@/messages/ru.json";
import FavoritesPage from "@/app/[locale]/favorites/page";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/favorites",
}));
vi.mock("next-intl/navigation", () => ({}));

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

const fav = (id: string, title: string) => ({ id, listing: { id, title, price: "100", currency: "USD", locationCity: "Moscow", mainImageUrl: "/x.jpg", status: "ACTIVE" }, createdAt: "t" });

describe("FavoritesPage", () => {
  it("shows login required for guest", () => {
    wrap(<FavoritesPage />, null);
    expect(screen.getByText(ru.Favorites.loginRequired)).toBeInTheDocument();
  });

  it("renders favorite listings", async () => {
    server.use(http.get("*/api/proxy/favorites", () => HttpResponse.json([fav("l1", "Kitten"), fav("l2", "Puppy")])));
    wrap(<FavoritesPage />);
    expect(await screen.findByText("Kitten")).toBeInTheDocument();
    expect(screen.getByText("Puppy")).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    server.use(http.get("*/api/proxy/favorites", () => HttpResponse.json([])));
    wrap(<FavoritesPage />);
    expect(await screen.findByText(ru.Favorites.empty)).toBeInTheDocument();
  });
});
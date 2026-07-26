import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import DashboardPage from "@/app/[locale]/(dashboard)/dashboard/page";
import ru from "@/messages/ru.json";
import type { UserProfile } from "@/types/api";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  usePathname: () => "/dashboard",
}));

let favoritesFails = false;
const server = setupServer(
  http.get("*/api/proxy/favorites", () =>
    favoritesFails
      ? HttpResponse.json({ status: 500, title: "Error", detail: "boom" }, { status: 500 })
      : HttpResponse.json([
          { id: "f1", listing: { id: "l1" }, createdAt: "t" },
          { id: "f2", listing: { id: "l2" }, createdAt: "t" },
        ]),
  ),
  http.get("*/api/proxy/messages", () =>
    HttpResponse.json([
      { partner: { id: "p1" }, lastMessage: null, unreadCount: 2 },
      { partner: { id: "p2" }, lastMessage: null, unreadCount: 3 },
    ]),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { favoritesFails = false; server.resetHandlers(); });
afterAll(() => server.close());

const base: UserProfile = {
  id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true,
  firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null,
  country: null, city: null, address: null, latitude: null, longitude: null,
  rating: null, totalReviews: null, createdAt: "t", updatedAt: "t",
};

const renderPage = (user: UserProfile) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user, status: "authenticated" }}>
          <DashboardPage />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
};

describe("Dashboard overview", () => {
  it("greets the user and shows the role badge", async () => {
    renderPage(base);
    expect(screen.getByText(/Добро пожаловать, a@b.co/)).toBeInTheDocument();
    expect(await screen.findByText("Покупатель")).toBeInTheDocument();
  });

  it("shows the full name when it is set", () => {
    renderPage({ ...base, firstName: "Иван", lastName: "Петров" });
    expect(screen.getByText("Иван Петров")).toBeInTheDocument();
  });

  it("shows favorite and unread counters", async () => {
    renderPage(base);
    expect(await screen.findByTestId("count-favorites")).toHaveTextContent("2");
    expect(await screen.findByTestId("count-messages")).toHaveTextContent("5");
  });

  it("drops the counter when its query fails but keeps the card", async () => {
    favoritesFails = true;
    renderPage(base);
    expect(await screen.findByTestId("count-messages")).toHaveTextContent("5");
    expect(screen.queryByTestId("count-favorites")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Избранное/ })).toBeInTheDocument();
  });

  it("hides the My listings card for BUYER and shows it for SELLER", () => {
    const { unmount } = renderPage(base);
    expect(screen.queryByRole("link", { name: /Мои объявления/ })).not.toBeInTheDocument();
    unmount();
    renderPage({ ...base, role: "SELLER" });
    expect(screen.getByRole("link", { name: /Мои объявления/ })).toBeInTheDocument();
  });
});

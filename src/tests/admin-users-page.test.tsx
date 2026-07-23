import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import ru from "@/messages/ru.json";
import UsersPage from "@/app/[locale]/(admin)/admin/users/page";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/users",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const mkQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const adminUser = (id: string, email: string, role: "BUYER" | "ADMIN" = "BUYER", active = true) => ({
  id, email, phone: null, firstName: "Fn", lastName: "Ln", avatarUrl: null, role, verified: true, active,
  bio: null, country: null, city: null, address: null, latitude: null, longitude: null, rating: null, totalReviews: 0,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
});

const renderPage = (sessionUser: ReturnType<typeof adminUser> | null = adminUser("me", "me@x.co", "ADMIN")) => {
  const qc = mkQc();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user: sessionUser, status: sessionUser ? "authenticated" : "unauthenticated" }}>
          <UsersPage />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
};

describe("UsersPage", () => {
  it("renders users table", async () => {
    server.use(http.get("*/api/proxy/admin/users", () => HttpResponse.json({
      content: [adminUser("u1", "a@b.co")], totalElements: 1, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: false,
    })));
    renderPage();
    expect(await screen.findByText("a@b.co")).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    server.use(http.get("*/api/proxy/admin/users", () => HttpResponse.json({
      content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true, empty: true,
    })));
    renderPage();
    expect(await screen.findByText(ru.Admin.common.empty)).toBeInTheDocument();
  });

  it("blocks a user with a required reason", async () => {
    const user = userEvent.setup();
    let statusBody: unknown = null;
    server.use(
      http.get("*/api/proxy/admin/users", () => HttpResponse.json({
        content: [adminUser("u1", "a@b.co", "BUYER", true)], totalElements: 1, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: false,
      })),
      http.put("*/api/proxy/admin/users/:id/status", async ({ request }) => {
        statusBody = JSON.parse(await request.text());
        return HttpResponse.json({ ...adminUser("u1", "a@b.co", "BUYER", false) });
      }),
    );
    renderPage();
    await screen.findByText("a@b.co");
    await user.click(screen.getByRole("button", { name: ru.Admin.users.block }));
    await user.type(screen.getByRole("textbox"), "spam");
    await user.click(screen.getByRole("button", { name: ru.Admin.common.confirmReject }));
    await waitFor(() => expect(statusBody).toEqual({ active: false, reason: "spam" }));
  });

  it("disables actions on own row", async () => {
    server.use(http.get("*/api/proxy/admin/users", () => HttpResponse.json({
      content: [adminUser("me", "me@x.co", "ADMIN", true)], totalElements: 1, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: false,
    })));
    renderPage(adminUser("me", "me@x.co", "ADMIN"));
    await screen.findByText("me@x.co");
    expect(screen.getByRole("button", { name: ru.Admin.users.block })).toBeDisabled();
  });

  it("preserves initial page param from deep-link URL on mount", async () => {
    const originalSearch = window.location.search;
    window.history.replaceState(null, "", "/admin/users?search=foo&page=2");
    let requestedPage: string | null = null;
    server.use(http.get("*/api/proxy/admin/users", ({ request }) => {
      const url = new URL(request.url);
      requestedPage = url.searchParams.get("page");
      return HttpResponse.json({
        content: [adminUser("u1", "a@b.co")], totalElements: 1, totalPages: 1, number: 2, size: 10, first: false, last: true, empty: false,
      });
    }));
    try {
      renderPage();
      await waitFor(() => expect(requestedPage).toBe("2"));
    } finally {
      window.history.replaceState(null, "", originalSearch ? `?${originalSearch.replace(/^\?/, "")}` : "/");
    }
  });
});
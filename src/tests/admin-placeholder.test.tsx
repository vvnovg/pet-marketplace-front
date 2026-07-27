import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import AdminPage from "@/app/[locale]/(admin)/admin/page";
import ru from "@/messages/ru.json";
import type { UserProfile } from "@/types/api";

vi.mock("@/i18n", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const admin: UserProfile = {
  id: "u1", email: "a@b.co", role: "ADMIN", verified: true, active: true,
  firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null,
  country: null, city: null, address: null, latitude: null, longitude: null,
  rating: null, totalReviews: null, createdAt: "t", updatedAt: "t",
};

const renderPage = () =>
  render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user: admin, status: "authenticated" }}>
          <AdminPage />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

describe("Admin index", () => {
  it("renders admin title", () => {
    renderPage();
    expect(screen.getByText("Админ-панель")).toBeInTheDocument();
  });

  it("labels every section link with its translated title, not a raw key", () => {
    renderPage();

    // Each Admin.<section> is an object (title, column captions, …), so asking for the
    // section itself yields no string and next-intl falls back to printing the key path.
    const sections = [
      { href: "/admin/users", label: ru.Admin.users.title },
      { href: "/admin/listings/pending", label: ru.Admin.pendingListings.title },
      { href: "/admin/reviews/pending", label: ru.Admin.pendingReviews.title },
      { href: "/admin/statistics", label: ru.Admin.statistics.title },
    ];
    for (const { href, label } of sections) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    expect(screen.queryByText(/^Admin\./)).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import { DashboardNav, isNavItemActive } from "@/components/dashboard/DashboardNav";
import ru from "@/messages/ru.json";
import type { UserProfile } from "@/types/api";

const h = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("@/i18n", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => h.pathname,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const base: UserProfile = {
  id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true,
  firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null,
  country: null, city: null, address: null, latitude: null, longitude: null,
  rating: null, totalReviews: null, createdAt: "t", updatedAt: "t",
};

const renderNav = (user: UserProfile | null, status: "authenticated" | "unauthenticated" | "loading" = "authenticated") =>
  render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user, status }}>
          <DashboardNav />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

describe("isNavItemActive", () => {
  it("matches /dashboard exactly, not by prefix", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard", "/dashboard/profile")).toBe(false);
  });
  it("matches nested routes by prefix", () => {
    expect(isNavItemActive("/dashboard/profile", "/dashboard/profile")).toBe(true);
    expect(isNavItemActive("/dashboard/listings", "/dashboard/listings/42")).toBe(true);
    expect(isNavItemActive("/dashboard/listings", "/dashboard/listings-archive")).toBe(false);
  });
});

describe("DashboardNav", () => {
  it("hides My listings for BUYER", () => {
    h.pathname = "/dashboard";
    renderNav(base);
    expect(screen.queryByRole("link", { name: "Мои объявления" })).not.toBeInTheDocument();
  });

  it("shows My listings for SELLER and ADMIN", () => {
    h.pathname = "/dashboard";
    const { unmount } = renderNav({ ...base, role: "SELLER" });
    expect(screen.getByRole("link", { name: "Мои объявления" })).toBeInTheDocument();
    unmount();
    renderNav({ ...base, role: "ADMIN" });
    expect(screen.getByRole("link", { name: "Мои объявления" })).toBeInTheDocument();
  });

  it("marks the current section with aria-current", () => {
    h.pathname = "/dashboard/subscriptions";
    renderNav(base);
    expect(screen.getByRole("link", { name: "Подписки" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Обзор" })).not.toHaveAttribute("aria-current");
  });

  it("links to bare paths without a locale prefix", () => {
    h.pathname = "/dashboard";
    renderNav(base);
    expect(screen.getByRole("link", { name: "Избранное" })).toHaveAttribute("href", "/favorites");
    expect(screen.getByRole("link", { name: "Профиль" })).toHaveAttribute("href", "/dashboard/profile");
  });

  it("renders nothing while the session is loading", () => {
    h.pathname = "/dashboard";
    renderNav(null, "loading");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

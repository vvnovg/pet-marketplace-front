import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import DashboardPage from "@/app/[locale]/(dashboard)/dashboard/page";
import AdminPage from "@/app/[locale]/(admin)/admin/page";
import ru from "@/messages/ru.json";
import type { UserProfile } from "@/types/api";

vi.mock("@/i18n", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const base: UserProfile = { id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true, firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null, country: null, city: null, address: null, latitude: null, longitude: null, rating: null, totalReviews: null, createdAt: "t", updatedAt: "t" };

const renderWith = (user: UserProfile, page: React.ReactNode) =>
  render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user, status: "authenticated" }}>{page}</SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

describe("Dashboard placeholder", () => {
  it("welcomes the user by email", () => {
    renderWith(base, <DashboardPage />);
    expect(screen.getByText(/Добро пожаловать, a@b.co/)).toBeInTheDocument();
  });
  it("shows seller-only My listings link for SELLER", () => {
    renderWith({ ...base, role: "SELLER" }, <DashboardPage />);
    expect(screen.getByText("Мои объявления")).toBeInTheDocument();
  });
  it("hides My listings for BUYER", () => {
    renderWith(base, <DashboardPage />);
    expect(screen.queryByText("Мои объявления")).not.toBeInTheDocument();
  });
});

describe("Admin placeholder", () => {
  it("renders admin title", () => {
    renderWith({ ...base, role: "ADMIN" }, <AdminPage />);
    expect(screen.getByText("Админ-панель")).toBeInTheDocument();
  });
});
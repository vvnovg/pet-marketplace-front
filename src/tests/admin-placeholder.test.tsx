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

describe("Admin placeholder", () => {
  it("renders admin title", () => {
    render(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="ru" messages={ru}>
          <SessionContext.Provider value={{ user: admin, status: "authenticated" }}>
            <AdminPage />
          </SessionContext.Provider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Админ-панель")).toBeInTheDocument();
  });
});

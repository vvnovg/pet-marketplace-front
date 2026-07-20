import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import { UserMenu } from "@/components/layout/UserMenu";
import type { UserProfile } from "@/types/api";

const push = vi.fn();
const replace = vi.fn();
vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push, replace }),
}));
vi.mock("next-intl", () => ({ useTranslations: (ns: string) => (k: string) => `${ns}.${k}` }));
vi.mock("@/lib/api/endpoints/auth", () => ({ logoutViaApi: vi.fn().mockResolvedValue(undefined) }));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const renderWith = (user: UserProfile | null) =>
  render(
    <QueryClientProvider client={qc}>
      <SessionContext.Provider value={{ user, status: user ? "authenticated" : "unauthenticated" }}>
        <UserMenu />
      </SessionContext.Provider>
    </QueryClientProvider>,
  );

const admin: UserProfile = {
  id: "u1",
  email: "a@b.co",
  role: "ADMIN",
  verified: true,
  active: true,
  firstName: "A",
  lastName: "B",
  phone: null,
  avatarUrl: null,
  bio: null,
  country: null,
  city: null,
  address: null,
  latitude: null,
  longitude: null,
  rating: null,
  totalReviews: null,
  createdAt: "t",
  updatedAt: "t",
};
const buyer: UserProfile = { ...admin, role: "BUYER" };

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
});

describe("UserMenu", () => {
  it("shows login/register when logged out", () => {
    renderWith(null);
    expect(screen.getByText("Nav.login")).toBeInTheDocument();
    expect(screen.getByText("Nav.register")).toBeInTheDocument();
  });

  it("shows email + admin link for admin, and logout clears session", async () => {
    const user = userEvent.setup();
    renderWith(admin);
    expect(screen.getByText(/a@b.co/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /a@b.co/i }));
    expect(screen.getByText("Auth.userMenu.admin")).toBeInTheDocument();
    await user.click(screen.getByText("Auth.userMenu.logout"));
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("does NOT show admin link for buyer", async () => {
    const user = userEvent.setup();
    renderWith(buyer);
    await user.click(screen.getByRole("button", { name: /a@b.co/i }));
    expect(screen.queryByText("Auth.userMenu.admin")).not.toBeInTheDocument();
  });
});
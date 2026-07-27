import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import SubscriptionsPage from "@/app/[locale]/(dashboard)/dashboard/subscriptions/page";
import ru from "@/messages/ru.json";
import type { Subscription, SubscriptionFilters, UserProfile } from "@/types/api";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  usePathname: () => "/dashboard/subscriptions",
}));

const emptyFilters: SubscriptionFilters = {
  categoryId: null, breedId: null, city: null, minPrice: null, maxPrice: null,
  gender: null, minAge: null, maxAge: null, hasVaccination: null, hasDocuments: null,
};

let items: Subscription[] = [];
const createdBodies: unknown[] = [];
const deletedIds: string[] = [];

const server = setupServer(
  http.get("*/api/proxy/categories", () =>
    HttpResponse.json([{ id: "c1", name: "Собаки", slug: "dogs", children: [], breeds: [] }]),
  ),
  http.get("*/api/proxy/categories/:id/breeds", ({ params }) =>
    HttpResponse.json({ id: params.id, name: "Собаки", slug: "dogs", breeds: [{ id: "b1", name: "Лабрадор" }] }),
  ),
  http.get("*/api/proxy/subscriptions", () => HttpResponse.json(items)),
  http.post("*/api/proxy/subscriptions", async ({ request }) => {
    createdBodies.push(await request.json());
    return HttpResponse.json({ id: "new", filters: emptyFilters, active: true, createdAt: "2026-02-01T00:00:00Z" });
  }),
  http.delete("*/api/proxy/subscriptions/:id", ({ params }) => {
    deletedIds.push(String(params.id));
    items = [];
    return new HttpResponse(null, { status: 204 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { items = []; createdBodies.length = 0; deletedIds.length = 0; server.resetHandlers(); });
afterAll(() => server.close());

const user: UserProfile = {
  id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true,
  firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null,
  country: null, city: null, address: null, latitude: null, longitude: null,
  rating: null, totalReviews: null, createdAt: "t", updatedAt: "t",
};

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user, status: "authenticated" }}>
          <SubscriptionsPage />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
};

describe("Subscriptions page", () => {
  it("shows the empty state when there are no subscriptions", async () => {
    renderPage();
    expect(await screen.findByText("Сохранённых поисков пока нет")).toBeInTheDocument();
  });

  it("describes stored filters and links to the catalog", async () => {
    items = [{
      id: "s1",
      filters: { ...emptyFilters, categoryId: "c1", city: "Самара", minPrice: "100", maxPrice: "900" },
      active: true,
      createdAt: "2026-02-01T00:00:00Z",
    }];
    renderPage();
    expect(await screen.findByText(/Собаки/)).toBeInTheDocument();
    expect(screen.getByText(/Город: Самара/)).toBeInTheDocument();
    expect(screen.getByText(/Цена: 100 — 900/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Открыть в каталоге" });
    expect(link.getAttribute("href")).toContain("categoryId=c1");
    expect(link.getAttribute("href")).toContain("city=%D0%A1%D0%B0%D0%BC%D0%B0%D1%80%D0%B0");
  });

  it("creates a subscription from the dialog once a filter is set", async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(await screen.findByRole("button", { name: "Новая подписка" }));
    const submit = await screen.findByRole("button", { name: "Сохранить" });
    expect(submit).toBeDisabled();
    expect(within(screen.getByRole("dialog")).queryByLabelText(ru.Catalog.sortBy)).toBeNull();
    await u.type(screen.getByLabelText("Город"), "Самара");
    await waitFor(() => expect(submit).toBeEnabled());
    await u.click(submit);
    await waitFor(() => expect(createdBodies).toHaveLength(1));
    expect(createdBodies[0]).toMatchObject({ city: "Самара" });
    expect(createdBodies[0]).not.toHaveProperty("sortBy");
    expect(createdBodies[0]).not.toHaveProperty("page");
  });

  it("deletes only after confirmation", async () => {
    items = [{ id: "s1", filters: { ...emptyFilters, city: "Самара" }, active: true, createdAt: "2026-02-01T00:00:00Z" }];
    const u = userEvent.setup();
    renderPage();
    await u.click(await screen.findByRole("button", { name: "Удалить" }));
    expect(await screen.findByText("Удалить подписку?")).toBeInTheDocument();
    expect(deletedIds).toHaveLength(0);
    const dialog = screen.getByRole("dialog");
    await u.click(within(dialog).getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(deletedIds).toEqual(["s1"]));
  });
});

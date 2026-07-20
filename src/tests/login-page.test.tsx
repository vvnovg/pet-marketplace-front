import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import ru from "@/messages/ru.json";
import LoginPage from "@/app/[locale]/(auth)/login/page";

const replace = vi.fn();
vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace }),
  usePathname: () => "/login",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });
beforeEach(() => replace.mockClear());

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

type SearchParams = { callbackUrl?: string; verified?: string; reset?: string };

const renderPage = (params: SearchParams = {}) =>
  render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user: null, status: "unauthenticated" }}>
          <LoginPage searchParams={Promise.resolve(params)} />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

const meResponse = (role: "BUYER" | "ADMIN") =>
  HttpResponse.json({ id: "u1", email: "a@b.co", role, verified: true, active: true, createdAt: "t", updatedAt: "t" });

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText("Email"), "a@b.co");
  await user.type(screen.getByLabelText("Пароль"), "12345678");
  await user.click(screen.getByRole("button", { name: "Войти" }));
};

describe("LoginPage", () => {
  it("shows verified banner when ?verified=1", async () => {
    renderPage({ verified: "1" });
    expect(await screen.findByText(ru.Auth.login.verifiedBanner)).toBeInTheDocument();
  });

  it("shows reset banner when ?reset=1", async () => {
    renderPage({ reset: "1" });
    expect(await screen.findByText(ru.Auth.login.resetBanner)).toBeInTheDocument();
  });

  it("does not show banners without flags", async () => {
    renderPage();
    // wait for the form to be ready (Promise prop resolved), then assert no banners
    await screen.findByRole("button", { name: "Войти" });
    expect(screen.queryByText(ru.Auth.login.verifiedBanner)).not.toBeInTheDocument();
    expect(screen.queryByText(ru.Auth.login.resetBanner)).not.toBeInTheDocument();
  });

  it("logs in a BUYER and redirects to /ru/dashboard", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/auth/login", () => HttpResponse.json({ ok: true })),
      http.get("*/api/proxy/users/me", () => meResponse("BUYER")),
    );
    renderPage();
    await fillAndSubmit(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ru/dashboard"));
  });

  it("logs in an ADMIN and redirects to /ru/admin", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/auth/login", () => HttpResponse.json({ ok: true })),
      http.get("*/api/proxy/users/me", () => meResponse("ADMIN")),
    );
    renderPage();
    await fillAndSubmit(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ru/admin"));
  });

  it("honors safe callbackUrl", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/auth/login", () => HttpResponse.json({ ok: true })),
      http.get("*/api/proxy/users/me", () => meResponse("BUYER")),
    );
    renderPage({ callbackUrl: "/ru/dashboard/messages" });
    await fillAndSubmit(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ru/dashboard/messages"));
  });

  it("shows invalid-credentials error on 401", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/auth/login", () => new HttpResponse(null, { status: 401 })),
    );
    renderPage();
    await fillAndSubmit(user);
    await waitFor(() => expect(screen.getByText(/Неверный email или пароль/)).toBeInTheDocument());
  });
});
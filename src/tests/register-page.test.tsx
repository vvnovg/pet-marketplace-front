import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ru from "@/messages/ru.json";
import RegisterPage from "@/app/[locale]/(auth)/register/page";
import VerifyEmailInfoPage from "@/app/[locale]/(auth)/verify-email-info/page";

const replace = vi.fn();
vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace }),
}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });
beforeEach(() => replace.mockClear());

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const intl = (kids: React.ReactNode) => (
  <QueryClientProvider client={qc}>
    <NextIntlClientProvider locale="ru" messages={ru}>{kids}</NextIntlClientProvider>
  </QueryClientProvider>
);

describe("RegisterPage", () => {
  it("registers and redirects to /ru/verify-email-info", async () => {
    const user = userEvent.setup();
    server.use(http.post("/api/auth/register", () => new HttpResponse(null, { status: 201 })));
    render(intl(<RegisterPage />));
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Пароль"), "12345678");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ru/verify-email-info"));
  });

  it("shows field error on 409 duplicate email", async () => {
    const user = userEvent.setup();
    server.use(http.post("/api/auth/register", () => new HttpResponse('{"detail":"exists"}', { status: 409, headers: { "content-type": "application/problem+json" } })));
    render(intl(<RegisterPage />));
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Пароль"), "12345678");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
    await waitFor(() => expect(screen.getByText(/exists/)).toBeInTheDocument());
  });
});

describe("VerifyEmailInfoPage", () => {
  it("dev helper: success redirects to /ru/login?verified=1", async () => {
    const user = userEvent.setup();
    server.use(http.post("/api/auth/verify-email", () => HttpResponse.json({ ok: true })));
    render(intl(<VerifyEmailInfoPage />));
    await user.type(screen.getByLabelText(/Redis/i), "tok-1");
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ru/login?verified=1"));
  });

  it("dev helper: 400 shows inline error", async () => {
    const user = userEvent.setup();
    server.use(http.post("/api/auth/verify-email", () => new HttpResponse('{"detail":"bad"}', { status: 400, headers: { "content-type": "application/problem+json" } })));
    render(intl(<VerifyEmailInfoPage />));
    await user.type(screen.getByLabelText(/Redis/i), "bad");
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    await waitFor(() => expect(screen.getByText(/Неверный или просроченный токен/)).toBeInTheDocument());
  });
});
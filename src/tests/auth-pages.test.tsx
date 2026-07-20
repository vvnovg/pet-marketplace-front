import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ru from "@/messages/ru.json";
import VerifyEmailPage from "@/app/[locale]/(auth)/verify-email/page";
import ForgotPasswordPage from "@/app/[locale]/(auth)/forgot-password/page";
import ResetPasswordPage from "@/app/[locale]/(auth)/reset-password/page";

const replace = vi.fn();
vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace }),
  usePathname: () => "/reset-password",
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

describe("VerifyEmailPage", () => {
  it("auto-verifies and shows success with token in URL", async () => {
    server.use(http.post("/api/auth/verify-email", () => HttpResponse.json({ ok: true })));
    render(intl(<VerifyEmailPage searchParams={Promise.resolve({ token: "tok-1" })} />));
    await waitFor(() => expect(screen.getByText(/Email подтверждён/)).toBeInTheDocument());
  });
  it("shows error on 400", async () => {
    server.use(http.post("/api/auth/verify-email", () => new HttpResponse('{"detail":"bad"}', { status: 400, headers: { "content-type": "application/problem+json" } })));
    render(intl(<VerifyEmailPage searchParams={Promise.resolve({ token: "bad" })} />));
    await waitFor(() => expect(screen.getByText(/недействительна или просрочена/)).toBeInTheDocument());
  });
});

describe("ForgotPasswordPage", () => {
  it("always shows success after submit", async () => {
    const user = userEvent.setup();
    server.use(http.post("/api/auth/forgot-password", () => HttpResponse.json({ ok: true })));
    render(intl(<ForgotPasswordPage />));
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.click(screen.getByRole("button", { name: "Отправить ссылку" }));
    await waitFor(() => expect(screen.getByText(/Если аккаунт существует/)).toBeInTheDocument());
  });
});

describe("ResetPasswordPage", () => {
  it("resets and redirects to /ru/login?reset=1", async () => {
    const user = userEvent.setup();
    server.use(http.post("/api/auth/reset-password", () => HttpResponse.json({ ok: true })));
    render(intl(<ResetPasswordPage searchParams={Promise.resolve({ token: "tok-1" })} />));
    // token resolves asynchronously via useEffect+useState (URL is empty in jsdom),
    // so the form appears on the next tick — use async findBy* queries.
    const newPwd = await screen.findByLabelText("Новый пароль");
    const confirmPwd = await screen.findByLabelText("Повторите пароль");
    await user.type(newPwd, "12345678");
    await user.type(confirmPwd, "12345678");
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ru/login?reset=1"));
  });
  it("shows mismatch error", async () => {
    const user = userEvent.setup();
    render(intl(<ResetPasswordPage searchParams={Promise.resolve({ token: "tok-1" })} />));
    const newPwd = await screen.findByLabelText("Новый пароль");
    const confirmPwd = await screen.findByLabelText("Повторите пароль");
    await user.type(newPwd, "12345678");
    await user.type(confirmPwd, "87654321");
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await waitFor(() => expect(screen.getByText(/Пароли не совпадают/)).toBeInTheDocument());
  });
  it("shows error on 400", async () => {
    const user = userEvent.setup();
    server.use(http.post("/api/auth/reset-password", () => new HttpResponse('{"detail":"bad"}', { status: 400, headers: { "content-type": "application/problem+json" } })));
    render(intl(<ResetPasswordPage searchParams={Promise.resolve({ token: "bad" })} />));
    const newPwd = await screen.findByLabelText("Новый пароль");
    const confirmPwd = await screen.findByLabelText("Повторите пароль");
    await user.type(newPwd, "12345678");
    await user.type(confirmPwd, "12345678");
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await waitFor(() => expect(screen.getByText(/недействителен или просрочен/)).toBeInTheDocument());
  });
});
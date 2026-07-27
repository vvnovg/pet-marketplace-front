import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import ProfilePage from "@/app/[locale]/(dashboard)/dashboard/profile/page";
import { profileSchema, toProfileUpdate } from "@/lib/validation/profile-schemas";
import ru from "@/messages/ru.json";
import type { UserProfile } from "@/types/api";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  usePathname: () => "/dashboard/profile",
}));

const putBodies: unknown[] = [];
let avatarUploadCalls = 0;
let putFailsWithViolation = false;
const server = setupServer(
  http.put("*/api/proxy/users/me", async ({ request }) => {
    putBodies.push(await request.json());
    if (putFailsWithViolation) {
      return HttpResponse.json(
        { status: 400, title: "Validation failed", detail: "bad", violations: [{ field: "phone", message: "Слишком длинный телефон" }] },
        { status: 400 },
      );
    }
    return HttpResponse.json({ id: "u1", email: "a@b.co", role: "BUYER" });
  }),
  http.post("*/api/proxy/users/me/avatar", () => {
    avatarUploadCalls += 1;
    return HttpResponse.json({ id: "u1", avatarUrl: "/a.png" });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { putBodies.length = 0; avatarUploadCalls = 0; putFailsWithViolation = false; server.resetHandlers(); });
afterAll(() => server.close());

const base: UserProfile = {
  id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true,
  firstName: "Иван", lastName: "Петров", phone: "+79990000000", avatarUrl: null,
  bio: "О себе", country: "Россия", city: "Самара", address: "ул. Ленина, 1",
  latitude: null, longitude: null, rating: null, totalReviews: null,
  createdAt: "t", updatedAt: "t",
};

const renderPage = (user: UserProfile = base) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Wrapper is a named component (rather than an inline JSX tree) so that a later
  // rerender with a new `user` can go through the *same* QueryClientProvider/
  // NextIntlClientProvider instances, exercising the same session-context-changes
  // path that a live `["session"]` refetch would take.
  const Wrapper = ({ user }: { user: UserProfile }) => (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user, status: "authenticated" }}>
          <ProfilePage />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  const result = render(<Wrapper user={user} />);
  return { ...result, rerenderWithUser: (nextUser: UserProfile) => result.rerender(<Wrapper user={nextUser} />) };
};

describe("toProfileUpdate", () => {
  it("turns blank strings into null", () => {
    const parsed = profileSchema.parse({ firstName: "", lastName: "Петров", phone: "  ", bio: "", country: "", city: "", address: "" });
    expect(toProfileUpdate(parsed)).toEqual({
      firstName: null, lastName: "Петров", phone: null, bio: null, country: null, city: null, address: null,
    });
  });
  it("rejects an over-long phone", () => {
    expect(profileSchema.safeParse({ phone: "x".repeat(21) }).success).toBe(false);
  });
});

describe("Profile page", () => {
  it("prefills the form from the session", () => {
    renderPage();
    expect(screen.getByLabelText("Имя")).toHaveValue("Иван");
    expect(screen.getByLabelText("Фамилия")).toHaveValue("Петров");
    expect(screen.getByLabelText("Город")).toHaveValue("Самара");
  });

  it("submits the whole profile, sending blanks as null", async () => {
    const u = userEvent.setup();
    renderPage();
    await u.clear(screen.getByLabelText("Адрес"));
    await u.clear(screen.getByLabelText("Имя"));
    await u.type(screen.getByLabelText("Имя"), "Пётр");
    await u.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(putBodies).toHaveLength(1));
    expect(putBodies[0]).toEqual({
      firstName: "Пётр", lastName: "Петров", phone: "+79990000000",
      bio: "О себе", country: "Россия", city: "Самара", address: null,
    });
  });

  it("maps server violations onto their fields", async () => {
    putFailsWithViolation = true;
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByText("Слишком длинный телефон")).toBeInTheDocument();
  });

  it("refuses an avatar larger than 5 MB without calling the API", async () => {
    const u = userEvent.setup();
    renderPage();
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    await u.upload(screen.getByLabelText("Аватар"), big);
    expect(await screen.findByText("Файл больше 5 МБ")).toBeInTheDocument();
    expect(avatarUploadCalls).toBe(0);
  });

  it("keeps an in-progress edit when the session refetch resolves with different data", async () => {
    const u = userEvent.setup();
    const { rerenderWithUser } = renderPage();

    const phoneInput = screen.getByLabelText("Телефон");
    await u.clear(phoneInput);
    await u.type(phoneInput, "+79997654321");
    expect(phoneInput).toHaveValue("+79997654321");

    // Simulate `["session"]` resolving after a save elsewhere: the phone field above
    // is dirty (user typed into it but hasn't submitted), while city is untouched.
    rerenderWithUser({ ...base, city: "Москва" });

    // Untouched field picks up the fresh session value...
    await waitFor(() => expect(screen.getByLabelText("Город")).toHaveValue("Москва"));
    // ...but the dirty field's in-progress edit must survive the refill.
    expect(phoneInput).toHaveValue("+79997654321");
  });
});

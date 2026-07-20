# Phase 2 (Auth Flows) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working end-to-end auth flow — register → verify-email → login → role-based redirect → protected zones guarded → logout, plus forgot/reset-password — on top of the Phase 1 foundation.

**Architecture:** 3 new server route handlers under `/api/auth/*` (no cookie manipulation) + 5 client pages in route group `(auth)` + a client `SessionProvider` (TanStack Query `/users/me`) driving an auth-aware `UserMenu` + middleware admin role-check (fetch `/users/me`) + client 401-logout + thin `/dashboard` and `/admin` placeholders so redirects/roles are testable. zod schemas mirror the backend Bean Validation; react-hook-form drives the forms.

**Tech Stack:** Next.js 15.5.20 (App Router), React 19, TypeScript strict + `noUncheckedIndexedAccess`, next-intl 4, TanStack Query v5, **zod 3 + react-hook-form 7 + @hookform/resolvers 3** (installed in Task 1), Vitest 4 + RTL + MSW, Playwright.

## Global Constraints

- All backend calls go through the existing `/api/proxy/[...path]` proxy (Phase 1) — NEVER call `${API_BASE}` from client code. Auth-form calls go through our own `/api/auth/*` route handlers (also Phase 1 pattern).
- Tokens live ONLY in httpOnly cookies (`pmp_access`/`pmp_refresh`); never in localStorage/JS.
- New auth route handlers (verify-email/forgot-password/reset-password) MUST NOT manipulate cookies. Failure responses use the explicit `new NextResponse(body, { status, headers: { "content-type": "application/problem+json" } })` form — NEVER `return parseProblem(upstream)` (it throws → 500). Success responses return `NextResponse.json({ ok: true })` and do NOT forward `upstream.headers` verbatim (avoid the header-passthrough bug fixed in Phase 1's proxy).
- zod schemas MUST mirror backend Bean Validation exactly (see Task 2 values).
- `callbackUrl` MUST be sanitized (`safeCallbackUrl`) — reject external, `//`, scheme-bearing, and non-`/`-prefixed values to prevent open-redirect.
- Login redirect: `callbackUrl` if present & safe → else role-based home (`ADMIN`/`MODERATOR` → `/${locale}/admin`, others → `/${locale}/dashboard`).
- Admin guard (middleware): for `/(admin)/**`, fetch `${API_BASE}/users/me` with `Authorization: Bearer <pmp_access>`; pass only if `role ∈ {ADMIN, MODERATOR}`. Middleware CANNOT use the cookie-rotating proxy — accept that a stale-access-but-valid-refresh case won't refresh here (rare; first RSC load refreshes via proxy).
- Client 401 (after proxy refresh failed): clear session (`setQueryData(["session"], null)`) + `router.replace("/login?callbackUrl=...")`, ONE-SHOT (ref guard) to avoid loops. The `["session"]` query itself MUST NOT trigger this (its `queryFn` swallows errors → returns `null`).
- i18n: all UI strings from `messages/{ru,en}.json` under namespaces `Auth.*`, `Validation.*`, `Dashboard.*`, `Admin.*`. Locale is the first URL segment (`/ru`/`/en`).
- `Role` enum: `BUYER | SELLER | ADMIN | MODERATOR` (MODERATOR exists on the backend — include it in the admin guard; master spec §12 is outdated).
- TDD: write the failing test → run it (RED) → implement → run it (GREEN) → commit. Each task commits with `feat`/`fix`/`chore` conventional prefix.
- Run gate before committing each task: `pnpm vitest run` (all pass) + `pnpm tsc --noEmit` (clean). Final task also runs `pnpm next build` + Playwright.
- Use `@/` import alias (configured in tsconfig + vitest.config). Do not add barrel exports.

**MERGE_BASE / baseline:** `1323bf8` (the Phase 2 spec commit). All Phase 1 work is already on `main` (HEAD before Task 1).

---

## File Structure

```
src/lib/validation/auth-schemas.ts          # zod schemas (Task 2)
src/lib/auth/redirects.ts                   # safeCallbackUrl, roleBasedHome, redirectAfterLogin (Task 3)
src/lib/api/endpoints/auth.ts               # EXTEND: register/verify/forgot/reset + upgrade loginViaApi (Task 4)
src/app/api/auth/verify-email/route.ts      # server route (Task 5)
src/app/api/auth/forgot-password/route.ts   # server route (Task 5)
src/app/api/auth/reset-password/route.ts    # server route (Task 5)
src/components/auth/SessionProvider.tsx     # client session context + 401 logout (Task 6)
src/components/layout/Providers.tsx         # MODIFY: wrap children in SessionProvider (Task 6)
src/components/layout/UserMenu.tsx          # REWRITE: auth-aware dropdown (Task 7)
src/app/[locale]/(auth)/auth-card.tsx       # shared centered-card wrapper (Task 8)
src/app/[locale]/(auth)/login/page.tsx      # login form (Task 8)
src/app/[locale]/(auth)/register/page.tsx   # register form (Task 9)
src/app/[locale]/(auth)/verify-email-info/page.tsx  # success + dev paste-token (Task 9)
src/app/[locale]/(auth)/verify-email/page.tsx       # auto-verify from ?token (Task 10)
src/app/[locale]/(auth)/forgot-password/page.tsx    # forgot form (Task 10)
src/app/[locale]/(auth)/reset-password/page.tsx     # reset form (Task 10)
src/middleware.ts                           # MODIFY: admin role check (Task 11)
src/app/[locale]/(dashboard)/dashboard/page.tsx  # thin placeholder (Task 12)
src/app/[locale]/(admin)/admin/page.tsx          # thin placeholder (Task 12)
src/messages/{ru,en}.json                   # Auth/Validation/Dashboard/Admin keys (Task 1)
src/tests/auth-schemas.test.ts              # Task 2
src/tests/redirects.test.ts                 # Task 3
src/tests/auth-endpoints.test.ts            # Task 4
src/tests/auth-routes.test.ts               # Task 5
src/tests/session-provider.test.tsx         # Task 6
src/tests/user-menu.test.tsx                # Task 7
src/tests/login-page.test.tsx               # Task 8
src/tests/register-page.test.tsx            # Task 9 (covers verify-email-info too)
src/tests/auth-pages.test.tsx               # Task 10 (verify-email/forgot/reset)
src/tests/middleware-admin.test.ts          # Task 11
e2e/auth.spec.ts                            # Task 13
```

---

## Task 1: Dependencies + i18n keys + UserProfile audit

**Files:**
- Modify: `package.json` (add `zod`, `react-hook-form`, `@hookform/resolvers`)
- Modify: `src/messages/ru.json`, `src/messages/en.json`
- Test: `src/tests/messages.test.ts`

**Interfaces:**
- Produces: message namespaces `Auth.*`, `Validation.*`, `Dashboard.*`, `Admin.*` consumed by all later tasks; `zod` + `react-hook-form` + `@hookform/resolvers` available for import.

- [ ] **Step 1: Install form/validation deps**

Run:
```bash
pnpm add zod@^3 react-hook-form@^7 @hookform/resolvers@^3
```
Expected: three packages added to `dependencies`. (zod v3 line — `@hookform/resolvers` v3 exports `@hookform/resolvers/zod` compatible with zod v3.)

- [ ] **Step 2: Audit `UserProfile` vs backend `UserProfileResponse`**

The backend `UserProfileResponse` (verified in clone) has fields: `id, email, phone, firstName, lastName, avatarUrl, role, verified, active, bio, country, city, address, latitude, longitude, rating, totalReviews, createdAt, updatedAt`. Compare with `src/types/api.ts` `UserProfile` (lines 33–53) — they already match field-for-field. **No change needed.** If during implementation any mismatch is found, adjust `UserProfile` to match the backend and update `src/tests/types.test.ts` accordingly. Record the audit result in the task report.

- [ ] **Step 3: Write the failing test for message keys**

`src/tests/messages.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import ru from "@/messages/ru.json";
import en from "@/messages/en.json";

describe("auth message keys exist in both locales", () => {
  const keys = [
    "Auth.login.title", "Auth.login.email", "Auth.login.password", "Auth.login.submit",
    "Auth.login.registerLink", "Auth.login.forgotLink", "Auth.login.verifiedBanner",
    "Auth.login.resetBanner", "Auth.login.invalidCredentials",
    "Auth.register.title", "Auth.register.submit", "Auth.register.success",
    "Auth.verifyEmailInfo.title", "Auth.verifyEmailInfo.success",
    "Auth.verifyEmailInfo.devHelperLabel", "Auth.verifyEmailInfo.devHelperButton",
    "Auth.verifyEmailInfo.devHelperError", "Auth.verifyEmailInfo.backToRegister",
    "Auth.verifyEmail.loading", "Auth.verifyEmail.success", "Auth.verifyEmail.error",
    "Auth.verifyEmail.backToRegister", "Auth.verifyEmail.toLogin",
    "Auth.forgotPassword.title", "Auth.forgotPassword.email", "Auth.forgotPassword.submit",
    "Auth.forgotPassword.success",
    "Auth.resetPassword.title", "Auth.resetPassword.newPassword", "Auth.resetPassword.confirm",
    "Auth.resetPassword.submit", "Auth.resetPassword.error", "Auth.resetPassword.mismatch",
    "Auth.userMenu.dashboard", "Auth.userMenu.profile", "Auth.userMenu.admin", "Auth.userMenu.logout",
    "Validation.emailInvalid", "Validation.passwordMin", "Validation.required", "Validation.tooLong",
    "Validation.mismatch",
    "Dashboard.welcome", "Admin.title",
  ] as const;

  const get = (obj: unknown, path: string): unknown =>
    path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);

  it.each(keys)("ru has %s", (k) => { expect(typeof get(ru, k)).toBe("string"); });
  it.each(keys)("en has %s", (k) => { expect(typeof get(en, k)).toBe("string"); });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run src/tests/messages.test.ts`
Expected: FAIL — keys missing in both locales.

- [ ] **Step 5: Add message keys**

Replace `src/messages/ru.json` with:
```json
{
  "Nav": { "home": "Главная", "catalog": "Каталог", "login": "Войти", "register": "Регистрация", "logout": "Выйти", "dashboard": "Кабинет", "admin": "Админ" },
  "Locale": { "ru": "Русский", "en": "English", "switch": "Язык" },
  "Status": { "ACTIVE": "Активно", "RESERVED": "Забронировано", "SOLD": "Продано", "DRAFT": "Черновик", "PENDING_MODERATION": "На модерации", "ARCHIVED": "В архиве", "REJECTED": "Отклонено" },
  "Home": { "welcome": "Маркетплейс животных" },
  "NotFound": { "title": "Страница не найдена", "back": "На главную" },
  "Auth": {
    "login": { "title": "Вход", "email": "Email", "password": "Пароль", "submit": "Войти", "registerLink": "Регистрация", "forgotLink": "Забыли пароль?", "verifiedBanner": "Email подтверждён. Теперь можно войти.", "resetBanner": "Пароль сброшен. Войдите с новым паролем.", "invalidCredentials": "Неверный email или пароль, либо email не подтверждён." },
    "register": { "title": "Регистрация", "email": "Email", "password": "Пароль", "phone": "Телефон", "firstName": "Имя", "lastName": "Фамилия", "submit": "Зарегистрироваться", "loginLink": "Войти", "success": "Аккаунт создан." },
    "verifyEmailInfo": { "title": "Подтвердите email", "success": "Аккаунт создан. Проверьте почту для подтверждения.", "devHelperLabel": "Вставить токен из Redis (dev)", "devHelperButton": "Подтвердить", "devHelperError": "Неверный или просроченный токен.", "invalidToken": "Неверный или просроченный токен.", "backToRegister": "Назад к регистрации" },
    "verifyEmail": { "loading": "Подтверждение…", "success": "Email подтверждён. Теперь можно войти.", "error": "Ссылка недействительна или просрочена.", "backToRegister": "К регистрации", "toLogin": "Войти" },
    "forgotPassword": { "title": "Восстановление пароля", "email": "Email", "submit": "Отправить ссылку", "success": "Если аккаунт существует, письмо для сброса отправлено." },
    "resetPassword": { "title": "Сброс пароля", "newPassword": "Новый пароль", "confirm": "Повторите пароль", "submit": "Сбросить", "error": "Токен недействителен или просрочен.", "mismatch": "Пароли не совпадают." },
    "userMenu": { "dashboard": "Кабинет", "profile": "Профиль", "admin": "Админ", "logout": "Выйти" }
  },
  "Validation": { "emailInvalid": "Некорректный email", "passwordMin": "Минимум 8 символов", "required": "Обязательное поле", "tooLong": "Слишком длинное значение", "mismatch": "Пароли не совпадают" },
  "Dashboard": { "welcome": "Добро пожаловать, {email}", "profile": "Профиль", "myListings": "Мои объявления", "bookings": "Бронирования", "messages": "Сообщения", "favorites": "Избранное", "subscriptions": "Подписки", "comingSoon": "Появится в следующих фазах" },
  "Admin": { "title": "Админ-панель", "users": "Пользователи", "pendingListings": "Объявления на модерации", "pendingReviews": "Отзывы на модерации", "statistics": "Статистика", "comingSoon": "Появится в фазе 8" }
}
```

Replace `src/messages/en.json` with:
```json
{
  "Nav": { "home": "Home", "catalog": "Catalog", "login": "Login", "register": "Register", "logout": "Logout", "dashboard": "Dashboard", "admin": "Admin" },
  "Locale": { "ru": "Russian", "en": "English", "switch": "Language" },
  "Status": { "ACTIVE": "Active", "RESERVED": "Reserved", "SOLD": "Sold", "DRAFT": "Draft", "PENDING_MODERATION": "Pending review", "ARCHIVED": "Archived", "REJECTED": "Rejected" },
  "Home": { "welcome": "Pet marketplace" },
  "NotFound": { "title": "Page not found", "back": "Home" },
  "Auth": {
    "login": { "title": "Sign in", "email": "Email", "password": "Password", "submit": "Sign in", "registerLink": "Register", "forgotLink": "Forgot password?", "verifiedBanner": "Email verified. You can sign in now.", "resetBanner": "Password reset. Sign in with your new password.", "invalidCredentials": "Wrong email or password, or email not verified." },
    "register": { "title": "Register", "email": "Email", "password": "Password", "phone": "Phone", "firstName": "First name", "lastName": "Last name", "submit": "Register", "loginLink": "Sign in", "success": "Account created." },
    "verifyEmailInfo": { "title": "Verify your email", "success": "Account created. Check your email to confirm.", "devHelperLabel": "Paste token from Redis (dev)", "devHelperButton": "Verify", "devHelperError": "Invalid or expired token.", "invalidToken": "Invalid or expired token.", "backToRegister": "Back to register" },
    "verifyEmail": { "loading": "Verifying…", "success": "Email verified. You can sign in now.", "error": "The link is invalid or expired.", "backToRegister": "To register", "toLogin": "Sign in" },
    "forgotPassword": { "title": "Reset password", "email": "Email", "submit": "Send link", "success": "If the account exists, a reset email has been sent." },
    "resetPassword": { "title": "Reset password", "newPassword": "New password", "confirm": "Confirm password", "submit": "Reset", "error": "Token is invalid or expired.", "mismatch": "Passwords do not match." },
    "userMenu": { "dashboard": "Dashboard", "profile": "Profile", "admin": "Admin", "logout": "Logout" }
  },
  "Validation": { "emailInvalid": "Invalid email", "passwordMin": "At least 8 characters", "required": "Required", "tooLong": "Value too long", "mismatch": "Passwords do not match" },
  "Dashboard": { "welcome": "Welcome, {email}", "profile": "Profile", "myListings": "My listings", "bookings": "Bookings", "messages": "Messages", "favorites": "Favorites", "subscriptions": "Subscriptions", "comingSoon": "Coming in later phases" },
  "Admin": { "title": "Admin panel", "users": "Users", "pendingListings": "Pending listings", "pendingReviews": "Pending reviews", "statistics": "Statistics", "comingSoon": "Coming in phase 8" }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/tests/messages.test.ts`
Expected: PASS (all keys present in both locales).

- [ ] **Step 7: Full gate + commit**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: all tests pass, tsc clean.

```bash
git add package.json pnpm-lock.yaml src/messages/ru.json src/messages/en.json src/tests/messages.test.ts
git commit -m "chore(auth): add zod/rhf deps and auth i18n keys"
```

---

## Task 2: zod auth schemas

**Files:**
- Create: `src/lib/validation/auth-schemas.ts`
- Test: `src/tests/auth-schemas.test.ts`

**Interfaces:**
- Produces: `loginSchema`/`LoginInput`, `registerSchema`/`RegisterInput`, `forgotSchema`/`ForgotInput`, `resetSchema`/`ResetInput`. Consumed by Tasks 8–10 forms.

- [ ] **Step 1: Write the failing test**

`src/tests/auth-schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, forgotSchema, resetSchema } from "@/lib/validation/auth-schemas";

describe("loginSchema", () => {
  it("accepts valid", () => expect(loginSchema.safeParse({ email: "a@b.co", password: "12345678" }).success).toBe(true));
  it("rejects short password", () => expect(loginSchema.safeParse({ email: "a@b.co", password: "1234567" }).success).toBe(false));
  it("rejects bad email", () => expect(loginSchema.safeParse({ email: "nope", password: "12345678" }).success).toBe(false));
});

describe("registerSchema", () => {
  const ok = { email: "a@b.co", password: "12345678" };
  it("accepts minimal", () => expect(registerSchema.safeParse(ok).success).toBe(true));
  it("accepts with optional fields", () =>
    expect(registerSchema.safeParse({ ...ok, phone: "+12345", firstName: "A", lastName: "B" }).success).toBe(true));
  it("rejects phone >20", () => expect(registerSchema.safeParse({ ...ok, phone: "x".repeat(21) }).success).toBe(false));
  it("rejects firstName >100", () => expect(registerSchema.safeParse({ ...ok, firstName: "x".repeat(101) }).success).toBe(false));
  it("rejects email >255", () => expect(registerSchema.safeParse({ email: "x".repeat(250) + "@b.co", password: "12345678" }).success).toBe(false));
});

describe("forgotSchema", () => {
  it("accepts valid email", () => expect(forgotSchema.safeParse({ email: "a@b.co" }).success).toBe(true));
  it("rejects bad email", () => expect(forgotSchema.safeParse({ email: "nope" }).success).toBe(false));
});

describe("resetSchema", () => {
  it("accepts matching passwords", () =>
    expect(resetSchema.safeParse({ newPassword: "12345678", confirm: "12345678" }).success).toBe(true));
  it("rejects short", () =>
    expect(resetSchema.safeParse({ newPassword: "1234567", confirm: "1234567" }).success).toBe(false));
  it("rejects mismatch", () =>
    expect(resetSchema.safeParse({ newPassword: "12345678", confirm: "87654321" }).success).toBe(false));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/auth-schemas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement schemas**

`src/lib/validation/auth-schemas.ts`:
```ts
import { z } from "zod";

const email = z.string().min(1).max(255).email();
const password = z.string().min(8).max(1000);
const optionalShort = (max: number) => z.string().max(max).optional().or(z.literal(""));

export const loginSchema = z.object({ email, password });
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email,
  password,
  phone: optionalShort(20),
  firstName: optionalShort(100),
  lastName: optionalShort(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotSchema = z.object({ email });
export type ForgotInput = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({ newPassword: password, confirm: password })
  .refine((d) => d.newPassword === d.confirm, { path: ["confirm"], message: "mismatch" });
export type ResetInput = z.infer<typeof resetSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/auth-schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
git add src/lib/validation/auth-schemas.ts src/tests/auth-schemas.test.ts
git commit -m "feat(validation): add zod auth schemas mirroring backend Bean Validation"
```

---

## Task 3: Redirect helpers

**Files:**
- Create: `src/lib/auth/redirects.ts`
- Test: `src/tests/redirects.test.ts`

**Interfaces:**
- Produces: `roleBasedHome(locale, role)`, `safeCallbackUrl(raw, locale, role)`, `redirectAfterLogin(user, callbackUrl, locale)`. Consumed by Task 8 (login page) and Task 11 (middleware).

- [ ] **Step 1: Write the failing test**

`src/tests/redirects.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { roleBasedHome, safeCallbackUrl, redirectAfterLogin } from "@/lib/auth/redirects";

describe("roleBasedHome", () => {
  it("admin → /{locale}/admin", () => expect(roleBasedHome("ru", "ADMIN")).toBe("/ru/admin"));
  it("moderator → /{locale}/admin", () => expect(roleBasedHome("ru", "MODERATOR")).toBe("/ru/admin"));
  it("buyer → /{locale}/dashboard", () => expect(roleBasedHome("ru", "BUYER")).toBe("/ru/dashboard"));
  it("seller → /{locale}/dashboard", () => expect(roleBasedHome("en", "SELLER")).toBe("/en/dashboard"));
  it("undefined role → dashboard", () => expect(roleBasedHome("ru", undefined)).toBe("/ru/dashboard"));
});

describe("safeCallbackUrl", () => {
  it("accepts same-origin path", () => expect(safeCallbackUrl("/ru/dashboard/messages", "ru", "BUYER")).toBe("/ru/dashboard/messages"));
  it("rejects protocol-relative //", () => expect(safeCallbackUrl("//evil.com", "ru", "BUYER")).toBe("/ru/dashboard"));
  it("rejects javascript scheme", () => expect(safeCallbackUrl("javascript:alert(1)", "ru", "BUYER")).toBe("/ru/dashboard"));
  it("rejects external https", () => expect(safeCallbackUrl("https://evil.com", "ru", "BUYER")).toBe("/ru/dashboard"));
  it("rejects empty → role home", () => expect(safeCallbackUrl("", "ru", "ADMIN")).toBe("/ru/admin"));
  it("rejects null → role home", () => expect(safeCallbackUrl(null, "ru", "BUYER")).toBe("/ru/dashboard"));
});

describe("redirectAfterLogin", () => {
  it("uses callbackUrl when safe", () =>
    expect(redirectAfterLogin({ role: "BUYER" }, "/ru/dashboard/messages", "ru")).toBe("/ru/dashboard/messages"));
  it("admin without callback → /admin", () => expect(redirectAfterLogin({ role: "ADMIN" }, null, "ru")).toBe("/ru/admin"));
  it("buyer without callback → /dashboard", () => expect(redirectAfterLogin({ role: "BUYER" }, null, "ru")).toBe("/ru/dashboard"));
  it("unsafe callback → role home", () =>
    expect(redirectAfterLogin({ role: "BUYER" }, "//evil.com", "ru")).toBe("/ru/dashboard"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/redirects.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/auth/redirects.ts`:
```ts
import type { Role } from "@/types/api";

export function roleBasedHome(locale: string, role: Role | undefined | null): string {
  return role === "ADMIN" || role === "MODERATOR" ? `/${locale}/admin` : `/${locale}/dashboard`;
}

export function safeCallbackUrl(raw: string | null | undefined, locale: string, role: Role | undefined | null): string {
  if (raw) {
    const decoded = decodeURIComponent(raw);
    // Only same-origin absolute paths: starts with single "/", not "//", no scheme (":").
    if (decoded.startsWith("/") && !decoded.startsWith("//") && !decoded.includes(":")) {
      return decoded;
    }
  }
  return roleBasedHome(locale, role);
}

export function redirectAfterLogin(
  user: { role: Role } | null | undefined,
  callbackUrl: string | null | undefined,
  locale: string,
): string {
  return safeCallbackUrl(callbackUrl, locale, user?.role);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/redirects.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
git add src/lib/auth/redirects.ts src/tests/redirects.test.ts
git commit -m "feat(auth): add redirect helpers with callbackUrl sanitization"
```

---

## Task 4: Auth endpoint helpers (extend)

**Files:**
- Modify: `src/lib/api/endpoints/auth.ts`
- Test: `src/tests/auth-endpoints.test.ts`

**Interfaces:**
- Consumes: `parseProblem`, `ApiError` from `@/lib/api/errors`; `RegisterInput`/`LoginInput` from Task 2.
- Produces: `loginViaApi` (upgraded to throw `ApiError`), `registerViaApi`, `verifyEmailViaApi`, `forgotPasswordViaApi`, `resetPasswordViaApi`. (`logoutViaApi` unchanged.) Consumed by Tasks 8–10.

- [ ] **Step 1: Write the failing test**

`src/tests/auth-endpoints.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { loginViaApi, registerViaApi, verifyEmailViaApi, forgotPasswordViaApi, resetPasswordViaApi } from "@/lib/api/endpoints/auth";
import { ApiError } from "@/lib/api/errors";

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

describe("loginViaApi", () => {
  it("resolves on 200", async () => {
    server.use(http.post("/api/auth/login", () => HttpResponse.json({ ok: true })));
    await expect(loginViaApi("a@b.co", "12345678")).resolves.toBeUndefined();
  });
  it("throws ApiError with status on 401", async () => {
    server.use(http.post("/api/auth/login", () => new HttpResponse(null, { status: 401 })));
    await expect(loginViaApi("a@b.co", "wrong")).rejects.toMatchObject({ name: "ApiError", status: 401 });
  });
});

describe("registerViaApi", () => {
  it("resolves on 201", async () => {
    server.use(http.post("/api/auth/register", () => new HttpResponse(null, { status: 201 })));
    await expect(registerViaApi({ email: "a@b.co", password: "12345678" })).resolves.toBeUndefined();
  });
  it("throws ApiError 409 on duplicate", async () => {
    server.use(http.post("/api/auth/register", () => new HttpResponse("exists", { status: 409, headers: { "content-type": "application/problem+json" } })));
    await expect(registerViaApi({ email: "a@b.co", password: "12345678" })).rejects.toMatchObject({ status: 409 });
  });
});

describe("verifyEmailViaApi", () => {
  it("POSTs to /api/auth/verify-email?token=", async () => {
    let capturedUrl = "";
    server.use(http.post("/api/auth/verify-email", ({ request }) => { capturedUrl = request.url; return HttpResponse.json({ ok: true }); }));
    await verifyEmailViaApi("tok-123");
    expect(capturedUrl).toContain("token=tok-123");
  });
  it("throws ApiError 400 on bad token", async () => {
    server.use(http.post("/api/auth/verify-email", () => new HttpResponse("bad", { status: 400, headers: { "content-type": "application/problem+json" } })));
    await expect(verifyEmailViaApi("bad")).rejects.toMatchObject({ status: 400 });
  });
});

describe("forgotPasswordViaApi", () => {
  it("resolves on 200", async () => {
    server.use(http.post("/api/auth/forgot-password", () => HttpResponse.json({ ok: true })));
    await expect(forgotPasswordViaApi("a@b.co")).resolves.toBeUndefined();
  });
});

describe("resetPasswordViaApi", () => {
  it("resolves on 200", async () => {
    server.use(http.post("/api/auth/reset-password", () => HttpResponse.json({ ok: true })));
    await expect(resetPasswordViaApi("tok", "12345678")).resolves.toBeUndefined();
  });
  it("throws ApiError 400 on bad token", async () => {
    server.use(http.post("/api/auth/reset-password", () => new HttpResponse("bad", { status: 400, headers: { "content-type": "application/problem+json" } })));
    await expect(resetPasswordViaApi("bad", "12345678")).rejects.toMatchObject({ status: 400 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/auth-endpoints.test.ts`
Expected: FAIL — `registerViaApi`/`verifyEmailViaApi`/`forgotPasswordViaApi`/`resetPasswordViaApi` not exported; `loginViaApi` throws plain `Error` (not `ApiError`), so the 401 test fails on `.name`.

- [ ] **Step 3: Implement (extend + upgrade)**

Replace `src/lib/api/endpoints/auth.ts` with:
```ts
import { ApiError, parseProblem } from "@/lib/api/errors";
import type { RegisterInput } from "@/lib/validation/auth-schemas";

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseProblem(res);
}

export async function loginViaApi(email: string, password: string): Promise<void> {
  await postJson("/api/auth/login", { email, password });
}

export async function registerViaApi(body: RegisterInput): Promise<void> {
  await postJson("/api/auth/register", body);
}

export async function verifyEmailViaApi(token: string): Promise<void> {
  const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { method: "POST" });
  if (!res.ok) await parseProblem(res);
}

export async function forgotPasswordViaApi(email: string): Promise<void> {
  await postJson("/api/auth/forgot-password", { email });
}

export async function resetPasswordViaApi(token: string, newPassword: string): Promise<void> {
  await postJson("/api/auth/reset-password", { token, newPassword });
}

export async function logoutViaApi(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export { ApiError };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/auth-endpoints.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: all pass, tsc clean.

```bash
git add src/lib/api/endpoints/auth.ts src/tests/auth-endpoints.test.ts
git commit -m "feat(auth): add register/verify/forgot/reset endpoint helpers and ApiError login"
```

---

## Task 5: Server route handlers (verify-email, forgot-password, reset-password)

**Files:**
- Create: `src/app/api/auth/verify-email/route.ts`, `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts`
- Test: `src/tests/auth-routes.test.ts`

**Interfaces:**
- Consumes: `${API_BASE}` env, `NextRequest`/`NextResponse`.
- Produces: `POST /api/auth/verify-email?token=`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`. None manipulate cookies.

- [ ] **Step 1: Write the failing test**

`src/tests/auth-routes.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { NextRequest } from "next/server";

const API_BASE = "http://localhost:8080/api/v1";
process.env.NEXT_PUBLIC_API_BASE = API_BASE;

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const toReq = (url: string, init?: RequestInit) => new Request(url, init) as unknown as NextRequest;
const jsonReq = (url: string, body: unknown) => toReq(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("verify-email route", () => {
  it("forwards token as query and returns ok on 200", async () => {
    let sentUrl = "";
    server.use(http.post(`${API_BASE}/auth/verify-email`, ({ request }) => { sentUrl = request.url; return new HttpResponse(null, { status: 200 }); }));
    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(toReq("http://x/api/auth/verify-email?token=tok-1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sentUrl).toContain("token=tok-1");
  });
  it("returns problem+json on 400", async () => {
    server.use(http.post(`${API_BASE}/auth/verify-email`, () => new HttpResponse('{"detail":"bad"}', { status: 400, headers: { "content-type": "application/problem+json" } })));
    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(toReq("http://x/api/auth/verify-email?token=bad"));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });
});

describe("forgot-password route", () => {
  it("forwards body and returns ok on 200", async () => {
    let sentBody = "";
    server.use(http.post(`${API_BASE}/auth/forgot-password`, async ({ request }) => { sentBody = await request.text(); return new HttpResponse(null, { status: 200 }); }));
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(jsonReq("http://x/api/auth/forgot-password", { email: "a@b.co" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(JSON.parse(sentBody)).toEqual({ email: "a@b.co" });
  });
});

describe("reset-password route", () => {
  it("forwards body and returns ok on 200", async () => {
    let sentBody = "";
    server.use(http.post(`${API_BASE}/auth/reset-password`, async ({ request }) => { sentBody = await request.text(); return new HttpResponse(null, { status: 200 }); }));
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(jsonReq("http://x/api/auth/reset-password", { token: "t", newPassword: "12345678" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(JSON.parse(sentBody)).toEqual({ token: "t", newPassword: "12345678" });
  });
  it("returns problem+json on 400", async () => {
    server.use(http.post(`${API_BASE}/auth/reset-password`, () => new HttpResponse('{"detail":"bad"}', { status: 400, headers: { "content-type": "application/problem+json" } })));
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(jsonReq("http://x/api/auth/reset-password", { token: "bad", newPassword: "12345678" }));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/auth-routes.test.ts`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Implement the three route handlers**

`src/app/api/auth/verify-email/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function POST(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const upstream = await fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: "POST",
  });
  if (!upstream.ok) {
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status, headers: { "content-type": "application/problem+json" } });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
```

`src/app/api/auth/forgot-password/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function POST(req: NextRequest) {
  const upstream = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await req.text(),
  });
  if (!upstream.ok) {
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status, headers: { "content-type": "application/problem+json" } });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
```

`src/app/api/auth/reset-password/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function POST(req: NextRequest) {
  const upstream = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await req.text(),
  });
  if (!upstream.ok) {
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status, headers: { "content-type": "application/problem+json" } });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/auth-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: all pass, tsc clean.

```bash
git add src/app/api/auth/verify-email/route.ts src/app/api/auth/forgot-password/route.ts src/app/api/auth/reset-password/route.ts src/tests/auth-routes.test.ts
git commit -m "feat(auth): add verify-email, forgot-password, reset-password route handlers"
```

---

## Task 6: SessionProvider + useSession + client 401 logout

**Files:**
- Create: `src/components/auth/SessionProvider.tsx`, `src/components/auth/useSession.ts`
- Modify: `src/components/layout/Providers.tsx` (wrap children in `SessionProvider`)
- Test: `src/tests/session-provider.test.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` from `@/lib/api/endpoints/users`; `ApiError` from `@/lib/api/errors`; next-intl `useRouter`/`usePathname`/`useLocale` from `@/i18n` + `next-intl`.
- Produces: `<SessionProvider>` (client), `useSession()` → `{ user, status }`. Mounts a global 401-logout effect. Consumed by Task 7 (`UserMenu`).

- [ ] **Step 1: Write the failing test**

`src/tests/session-provider.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SessionProvider, useSession } from "@/components/auth/SessionProvider";
import { ApiError } from "@/lib/api/errors";

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const replace = vi.fn();
vi.mock("@/i18n", () => ({ useRouter: () => ({ replace }), usePathname: () => "/dashboard" }));
vi.mock("next-intl", () => ({ useLocale: () => "ru" }));

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}><SessionProvider>{children}</SessionProvider></QueryClientProvider>
  );
}

const Show = () => {
  const { user, status } = useSession();
  return <span data-testid="out">{status}:{user?.email ?? "none"}</span>;
};

describe("SessionProvider", () => {
  it("starts loading then resolves authenticated", async () => {
    server.use(http.get("*/api/proxy/users/me", () => HttpResponse.json({ id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true, createdAt: "t", updatedAt: "t" })));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getByTestId } = render(<Show />, { wrapper: wrapper(qc) });
    expect(getByTestId("out").textContent).toBe("loading:none");
    await waitFor(() => expect(getByTestId("out").textContent).toBe("authenticated:a@b.co"));
  });

  it("becomes unauthenticated when /users/me errors", async () => {
    server.use(http.get("*/api/proxy/users/me", () => new HttpResponse(null, { status: 401 })));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getByTestId } = render(<Show />, { wrapper: wrapper(qc) });
    await waitFor(() => expect(getByTestId("out").textContent).toBe("unauthenticated:none"));
    // session 401 must NOT trigger redirect (no loop)
    await waitFor(() => expect(replace).not.toHaveBeenCalled());
  });

  it("a non-session 401 triggers logout redirect (one-shot)", async () => {
    server.use(
      http.get("*/api/proxy/users/me", () => HttpResponse.json({ id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true, createdAt: "t", updatedAt: "t" })),
      http.get("*/api/proxy/listings", () => new HttpResponse(null, { status: 401 })),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Probe = () => { useQuery({ queryKey: ["listings"], queryFn: async () => { const r = await fetch("/api/proxy/listings"); if (!r.ok) throw new ApiError(401, "x", "y"); return r.json(); } }); return <Show />; };
    render(<Probe />, { wrapper: wrapper(qc) });
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringContaining("/login?callbackUrl=")));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/session-provider.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SessionProvider**

`src/components/auth/SessionProvider.tsx`:
```tsx
"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n";
import { getCurrentUser } from "@/lib/api/endpoints/users";
import { ApiError } from "@/lib/api/errors";
import type { UserProfile } from "@/types/api";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";
interface SessionValue { user: UserProfile | null; status: SessionStatus; }

const SessionContext = createContext<SessionValue>({ user: null, status: "loading" });

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const redirecting = useRef(false);

  const { data: user, isLoading } = useQuery<UserProfile | null>({
    queryKey: ["session"],
    queryFn: async () => {
      try { return await getCurrentUser(); } catch { return null; }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Global 401: a non-session query that fails with 401 means the proxy's refresh
  // already failed. Clear session and redirect to login once (ref guard prevents loops).
  useEffect(() => {
    return qc.getQueryCache().subscribe((event) => {
      const err = event.query.state.error;
      if (
        err instanceof ApiError &&
        err.status === 401 &&
        event.query.queryKey[0] !== "session" &&
        !redirecting.current
      ) {
        redirecting.current = true;
        qc.setQueryData(["session"], null);
        router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      }
    });
  }, [qc, router, pathname]);

  const status: SessionStatus = isLoading ? "loading" : user ? "authenticated" : "unauthenticated";
  return <SessionContext.Provider value={{ user: user ?? null, status }}>{children}</SessionContext.Provider>;
}

export { SessionContext };
```

`src/components/auth/useSession.ts`:
```ts
import { useContext } from "react";
import { SessionContext } from "@/components/auth/SessionProvider";

export function useSession() {
  return useContext(SessionContext);
}
```

- [ ] **Step 4: Wrap children in Providers**

Replace `src/components/layout/Providers.tsx` with:
```tsx
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { SessionProvider } from "@/components/auth/SessionProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient();
  return (
    <QueryClientProvider client={qc}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/tests/session-provider.test.tsx`
Expected: PASS.

- [ ] **Step 6: Gate + commit**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: all pass, tsc clean.

```bash
git add src/components/auth/SessionProvider.tsx src/components/auth/useSession.ts src/components/layout/Providers.tsx src/tests/session-provider.test.tsx
git commit -m "feat(auth): add SessionProvider with /users/me session and global 401 logout"
```

---

## Task 7: Auth-aware UserMenu

**Files:**
- Modify (rewrite): `src/components/layout/UserMenu.tsx`
- Test: `src/tests/user-menu.test.tsx`

**Interfaces:**
- Consumes: `useSession` (Task 6), `logoutViaApi` (Task 4), `Link`/`useRouter` from `@/i18n`, `useTranslations` from `next-intl`. Existing shadcn primitives in `src/components/ui/` (`button`, `dropdown-menu`, `avatar` if present — see Step 3 note).
- Produces: `<UserMenu>` rendering login/register links when logged out; avatar/email dropdown with dashboard/profile/admin/logout when logged in.

- [ ] **Step 1: Verify shadcn primitives available**

Run: `ls src/components/ui`
Expected: at least `button.tsx` (Phase 1). If `dropdown-menu.tsx` or `avatar.tsx` are absent, add them via the same hand-authored v3 pattern Phase 1 used (Radix primitives are already installed: `@radix-ui/react-dropdown-menu`, `@radix-ui/react-slot`; `@radix-ui/react-avatar` is NOT in package.json — if you need avatar, install `@radix-ui/react-avatar` first, or render a simple initials `<div>` instead to avoid a new dep). **Preferred: render a plain initials badge `<div>` — no new dependency.** Record the choice in the report.

- [ ] **Step 2: Write the failing test**

`src/tests/user-menu.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import { UserMenu } from "@/components/layout/UserMenu";
import type { UserProfile } from "@/types/api";

const push = vi.fn();
const replace = vi.fn();
vi.mock("@/i18n", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>, useRouter: () => ({ push, replace }) }));
vi.mock("next-intl", () => ({ useTranslations: (ns: string) => (k: string) => `${ns}.${k}` }));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const renderWith = (user: UserProfile | null) =>
  render(
    <QueryClientProvider client={qc}>
      <SessionContext.Provider value={{ user, status: user ? "authenticated" : "unauthenticated" }}>
        <UserMenu />
      </SessionContext.Provider>
    </QueryClientProvider>,
  );

const admin: UserProfile = { id: "u1", email: "a@b.co", role: "ADMIN", verified: true, active: true, firstName: "A", lastName: "B", phone: null, avatarUrl: null, bio: null, country: null, city: null, address: null, latitude: null, longitude: null, rating: null, totalReviews: null, createdAt: "t", updatedAt: "t" };
const buyer: UserProfile = { ...admin, role: "BUYER" };

beforeEach(() => { push.mockClear(); replace.mockClear(); });

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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/tests/user-menu.test.tsx`
Expected: FAIL — current stub has no email/logout.

- [ ] **Step 4: Implement UserMenu**

`src/components/layout/UserMenu.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/auth/useSession";
import { logoutViaApi } from "@/lib/api/endpoints/auth";

export function UserMenu() {
  const t = useTranslations("Nav");
  const tAuth = useTranslations("Auth.userMenu");
  const { user } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="text-sm">{t("login")}</Link>
        <Link href="/register" className="text-sm">{t("register")}</Link>
      </div>
    );
  }

  const initials = ((user.firstName ?? user.email ?? "?").slice(0, 1) + (user.lastName ?? "").slice(0, 1)).toUpperCase();

  const onLogout = async () => {
    await logoutViaApi();
    qc.removeQueries({ queryKey: ["session"] });
    router.replace("/");
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={user.email ?? "user"}
        className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">{initials}</span>
        <span>{user.email}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-44 rounded border bg-background p-1 text-sm shadow">
          <Link href="/dashboard" className="block px-2 py-1 hover:bg-muted" onClick={() => setOpen(false)}>{tAuth("dashboard")}</Link>
          <Link href="/dashboard/profile" className="block px-2 py-1 hover:bg-muted" onClick={() => setOpen(false)}>{tAuth("profile")}</Link>
          {(user.role === "ADMIN" || user.role === "MODERATOR") && (
            <Link href="/admin" className="block px-2 py-1 hover:bg-muted" onClick={() => setOpen(false)}>{tAuth("admin")}</Link>
          )}
          <button type="button" className="block w-full px-2 py-1 text-left hover:bg-muted" onClick={onLogout}>{t("logout")}</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/tests/user-menu.test.tsx`
Expected: PASS.

- [ ] **Step 6: Gate + commit**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: all pass, tsc clean.

```bash
git add src/components/layout/UserMenu.tsx src/tests/user-menu.test.tsx
git commit -m "feat(layout): rewrite UserMenu as auth-aware dropdown with logout"
```

---

## Task 8: AuthCard wrapper + Login page

**Files:**
- Create: `src/app/[locale]/(auth)/auth-card.tsx`, `src/app/[locale]/(auth)/login/page.tsx`
- Test: `src/tests/login-page.test.tsx`

**Interfaces:**
- Consumes: `loginSchema` (Task 2), `loginViaApi` (Task 4), `getCurrentUser` from `@/lib/api/endpoints/users`, `redirectAfterLogin` (Task 3), `ApiError` (Task 4), `Link`/`useRouter`/`usePathname` from `@/i18n`, `useTranslations`/`useLocale` from `next-intl`, `useSession` (Task 6), `zodResolver` from `@hookform/resolvers/zod`, `react-hook-form`.
- Produces: `/[locale]/login` page.

- [ ] **Step 1: Write the failing test**

`src/tests/login-page.test.tsx`:
```tsx
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
const renderPage = (search = "") =>
  render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user: null, status: "unauthenticated" }}>
          <LoginPage searchParams={Promise.resolve(search ? { callbackUrl: search } : {})} />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

describe("LoginPage", () => {
  it("shows verified banner when ?verified=1", async () => {
    renderPage();
    // verified banner comes from searchParams verified flag; check below in success test
  });

  it("logs in a BUYER and redirects to /ru/dashboard", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/auth/login", () => HttpResponse.json({ ok: true })),
      http.get("*/api/proxy/users/me", () => HttpResponse.json({ id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true, createdAt: "t", updatedAt: "t" })),
    );
    renderPage();
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Пароль"), "12345678");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ru/dashboard"));
  });

  it("logs in an ADMIN and redirects to /ru/admin", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/auth/login", () => HttpResponse.json({ ok: true })),
      http.get("*/api/proxy/users/me", () => HttpResponse.json({ id: "u1", email: "a@b.co", role: "ADMIN", verified: true, active: true, createdAt: "t", updatedAt: "t" })),
    );
    renderPage();
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Пароль"), "12345678");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ru/admin"));
  });

  it("honors safe callbackUrl", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/auth/login", () => HttpResponse.json({ ok: true })),
      http.get("*/api/proxy/users/me", () => HttpResponse.json({ id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true, createdAt: "t", updatedAt: "t" })),
    );
    renderPage("/ru/dashboard/messages");
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Пароль"), "12345678");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ru/dashboard/messages"));
  });

  it("shows invalid-credentials error on 401", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/auth/login", () => new HttpResponse(null, { status: 401 })),
    );
    renderPage();
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Пароль"), "12345678");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    await waitFor(() => expect(screen.getByText(/Неверный email или пароль/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/login-page.test.tsx`
Expected: FAIL — page not found.

- [ ] **Step 3: Implement AuthCard**

`src/app/[locale]/(auth)/auth-card.tsx`:
```tsx
import type { ReactNode } from "react";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-12 max-w-md px-4">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-bold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement Login page**

`src/app/[locale]/(auth)/login/page.tsx`:
```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n";
import { loginSchema, type LoginInput } from "@/lib/validation/auth-schemas";
import { loginViaApi } from "@/lib/api/endpoints/auth";
import { ApiError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/api/endpoints/users";
import { redirectAfterLogin } from "@/lib/auth/redirects";
import { AuthCard } from "../auth-card";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; verified?: string; reset?: string }> }) {
  const t = useTranslations("Auth.login");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // searchParams in a client component: read via a state from use() — but to keep SSR-safe and simple,
  // we resolve them in a useState initializer using React.use().
  const params = useSearchParamsResolved();
  const callbackUrl = params.callbackUrl ?? null;
  const verified = params.verified === "1";
  const reset = params.reset === "1";

  const onSubmit = async (data: LoginInput) => {
    try {
      await loginViaApi(data.email, data.password);
      const me = await getCurrentUser().catch(() => null);
      const target = redirectAfterLogin(me, callbackUrl, locale);
      router.replace(target);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("password", { message: t("invalidCredentials") });
      } else if (e instanceof ApiError && e.violations.length) {
        for (const v of e.violations) setError(v.field as keyof LoginInput, { message: v.message });
      } else {
        setError("password", { message: t("invalidCredentials") });
      }
    }
  };

  return (
    <AuthCard title={t("title")}>
      {verified && <p className="mb-3 rounded bg-primary/10 p-2 text-sm">{t("verifiedBanner")}</p>}
      {reset && <p className="mb-3 rounded bg-primary/10 p-2 text-sm">{t("resetBanner")}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <label className="block">
          <span className="text-sm">{t("email")}</span>
          <input type="email" autoComplete="email" {...register("email")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
        </label>
        <label className="block">
          <span className="text-sm">{t("password")}</span>
          <input type="password" autoComplete="current-password" {...register("password")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.password && <span className="text-xs text-destructive">{errors.password.message}</span>}
        </label>
        <button type="submit" disabled={isSubmitting} className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">
          {t("submit")}
        </button>
      </form>
      <div className="mt-3 flex justify-between text-sm">
        <Link href="/forgot-password">{t("forgotLink")}</Link>
        <Link href="/register">{t("registerLink")}</Link>
      </div>
    </AuthCard>
  );
}

// Client-safe searchParams reader. In Next 15 client components cannot accept searchParams prop
// (that's a server-component feature); we read from the URL instead.
function useSearchParamsResolved(): { callbackUrl?: string; verified?: string; reset?: string } {
  const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  return {
    callbackUrl: sp.get("callbackUrl") ?? undefined,
    verified: sp.get("verified") ?? undefined,
    reset: sp.get("reset") ?? undefined,
  };
}
```

**Note for the implementer:** The test passes `searchParams` as a prop (server-component style) for simplicity, but the page reads from `window.location.search` at render. In the test, set `window.location` accordingly OR adjust the test to set the query string. **To keep the test passing as written, the test sets no `verified`/`reset` and no `callbackUrl` for the banner test, and passes `callbackUrl` via the prop which the page does NOT use.** Resolve this by making the page accept BOTH: prefer `window.location.search` when available, fall back to the prop. Concretely, replace the `useSearchParamsResolved` call with:

```tsx
const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
const propParams = useResolvedProp(searchParams); // resolved once via React.use in a client-safe wrapper
const callbackUrl = sp.get("callbackUrl") ?? propParams.callbackUrl ?? null;
const verified = (sp.get("verified") ?? propParams.verified) === "1";
const reset = (sp.get("reset") ?? propParams.reset) === "1";
```

where `useResolvedProp` resolves the `Promise` prop with `React.use` inside the component body. Implement this so the test (which supplies the prop) and the browser (which uses the URL) both work. The tests for `callbackUrl` pass the value via the prop and assert the redirect — confirm GREEN.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/tests/login-page.test.tsx`
Expected: PASS (all 4 behavioral tests). If the `?verified=1` banner test (the empty first `it`) is a no-op, remove it or flesh it out to assert the banner renders when `verified=1` is set via the prop. Make the test meaningful.

- [ ] **Step 6: Gate + commit**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: all pass, tsc clean.

```bash
git add "src/app/[locale]/(auth)/auth-card.tsx" "src/app/[locale]/(auth)/login/page.tsx" src/tests/login-page.test.tsx
git commit -m "feat(auth): add login page with role-based redirect and callbackUrl"
```

---

## Task 9: Register + verify-email-info pages

**Files:**
- Create: `src/app/[locale]/(auth)/register/page.tsx`, `src/app/[locale]/(auth)/verify-email-info/page.tsx`
- Test: `src/tests/register-page.test.tsx`

**Interfaces:**
- Consumes: `registerSchema` (Task 2), `registerViaApi`/`verifyEmailViaApi` (Task 4), `ApiError`, `Link`/`useRouter`, `useTranslations`/`useLocale`, `AuthCard` (Task 8), `zodResolver`.
- Produces: `/[locale]/register`, `/[locale]/verify-email-info`.

- [ ] **Step 1: Write the failing test**

`src/tests/register-page.test.tsx`:
```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/register-page.test.tsx`
Expected: FAIL — pages not found.

- [ ] **Step 3: Implement Register page**

`src/app/[locale]/(auth)/register/page.tsx`:
```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth-schemas";
import { registerViaApi } from "@/lib/api/endpoints/auth";
import { ApiError } from "@/lib/api/errors";
import { AuthCard } from "../auth-card";

export default function RegisterPage() {
  const t = useTranslations("Auth.register");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    try {
      const body = {
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
      };
      await registerViaApi(body);
      router.replace(`/${locale}/verify-email-info`);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 409) setError("email", { message: e.detail || "exists" });
        for (const v of e.violations) setError(v.field as keyof RegisterInput, { message: v.message });
      }
    }
  };

  return (
    <AuthCard title={t("title")}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <label className="block">
          <span className="text-sm">{t("email")}</span>
          <input type="email" {...register("email")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
        </label>
        <label className="block">
          <span className="text-sm">{t("password")}</span>
          <input type="password" {...register("password")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.password && <span className="text-xs text-destructive">{errors.password.message}</span>}
        </label>
        <label className="block">
          <span className="text-sm">{t("phone")}</span>
          <input type="tel" {...register("phone")} className="mt-1 block w-full rounded border px-2 py-1" />
        </label>
        <label className="block">
          <span className="text-sm">{t("firstName")}</span>
          <input {...register("firstName")} className="mt-1 block w-full rounded border px-2 py-1" />
        </label>
        <label className="block">
          <span className="text-sm">{t("lastName")}</span>
          <input {...register("lastName")} className="mt-1 block w-full rounded border px-2 py-1" />
        </label>
        <button type="submit" disabled={isSubmitting} className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">
          {t("submit")}
        </button>
      </form>
      <div className="mt-3 text-sm">
        <Link href="/login">{t("loginLink")}</Link>
      </div>
    </AuthCard>
  );
}
```

- [ ] **Step 4: Implement verify-email-info page**

`src/app/[locale]/(auth)/verify-email-info/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n";
import { verifyEmailViaApi } from "@/lib/api/endpoints/auth";
import { AuthCard } from "../auth-card";

export default function VerifyEmailInfoPage() {
  const t = useTranslations("Auth.verifyEmailInfo");
  const locale = useLocale();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isDev = process.env.NODE_ENV !== "production";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyEmailViaApi(token.trim());
      router.replace(`/${locale}/login?verified=1`);
    } catch {
      setError(t("devHelperError"));
    }
  };

  return (
    <AuthCard title={t("title")}>
      <p className="mb-4 text-sm">{t("success")}</p>
      {isDev && (
        <form onSubmit={onSubmit} className="space-y-2 border-t pt-3">
          <label className="block">
            <span className="text-sm">{t("devHelperLabel")}</span>
            <input value={token} onChange={(e) => setToken(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1" />
          </label>
          <button type="submit" className="rounded bg-primary px-3 py-2 text-primary-foreground">{t("devHelperButton")}</button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      )}
      <div className="mt-3 text-sm">
        <Link href="/register">{t("backToRegister")}</Link>
      </div>
    </AuthCard>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/tests/register-page.test.tsx`
Expected: PASS.

- [ ] **Step 6: Gate + commit**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: all pass, tsc clean.

```bash
git add "src/app/[locale]/(auth)/register/page.tsx" "src/app/[locale]/(auth)/verify-email-info/page.tsx" src/tests/register-page.test.tsx
git commit -m "feat(auth): add register page and verify-email-info with dev token helper"
```

---

## Task 10: verify-email + forgot-password + reset-password pages

**Files:**
- Create: `src/app/[locale]/(auth)/verify-email/page.tsx`, `src/app/[locale]/(auth)/forgot-password/page.tsx`, `src/app/[locale]/(auth)/reset-password/page.tsx`
- Test: `src/tests/auth-pages.test.tsx`

**Interfaces:**
- Consumes: `forgotSchema`/`resetSchema` (Task 2), `verifyEmailViaApi`/`forgotPasswordViaApi`/`resetPasswordViaApi` (Task 4), `Link`/`useRouter`/`usePathname`, `useTranslations`/`useLocale`, `AuthCard`, `zodResolver`.
- Produces: `/[locale]/verify-email`, `/[locale]/forgot-password`, `/[locale]/reset-password`.

- [ ] **Step 1: Write the failing test**

`src/tests/auth-pages.test.tsx`:
```tsx
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
    await user.type(screen.getByLabelText("Новый пароль"), "12345678");
    await user.type(screen.getByLabelText("Повторите пароль"), "12345678");
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ru/login?reset=1"));
  });
  it("shows mismatch error", async () => {
    const user = userEvent.setup();
    render(intl(<ResetPasswordPage searchParams={Promise.resolve({ token: "tok-1" })} />));
    await user.type(screen.getByLabelText("Новый пароль"), "12345678");
    await user.type(screen.getByLabelText("Повторите пароль"), "87654321");
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await waitFor(() => expect(screen.getByText(/Пароли не совпадают/)).toBeInTheDocument());
  });
  it("shows error on 400", async () => {
    const user = userEvent.setup();
    server.use(http.post("/api/auth/reset-password", () => new HttpResponse('{"detail":"bad"}', { status: 400, headers: { "content-type": "application/problem+json" } })));
    render(intl(<ResetPasswordPage searchParams={Promise.resolve({ token: "bad" })} />));
    await user.type(screen.getByLabelText("Новый пароль"), "12345678");
    await user.type(screen.getByLabelText("Повторите пароль"), "12345678");
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await waitFor(() => expect(screen.getByText(/недействителен или просрочен/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/auth-pages.test.tsx`
Expected: FAIL — pages not found.

- [ ] **Step 3: Implement verify-email page**

`src/app/[locale]/(auth)/verify-email/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { verifyEmailViaApi } from "@/lib/api/endpoints/auth";
import { AuthCard } from "../auth-card";

export default function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const t = useTranslations("Auth.verifyEmail");
  const { token } = use(searchParams);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) { setState("error"); return; }
    let cancelled = false;
    verifyEmailViaApi(token)
      .then(() => { if (!cancelled) setState("success"); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <AuthCard title={t("success")}>
      {state === "loading" && <p>{t("loading")}</p>}
      {state === "success" && (
        <>
          <p className="mb-3 text-sm">{t("success")}</p>
          <Link href="/login" className="text-sm underline">{t("toLogin")}</Link>
        </>
      )}
      {state === "error" && (
        <>
          <p className="mb-3 text-sm text-destructive">{t("error")}</p>
          <Link href="/register" className="text-sm underline">{t("backToRegister")}</Link>
        </>
      )}
    </AuthCard>
  );
}
```

- [ ] **Step 4: Implement forgot-password page**

`src/app/[locale]/(auth)/forgot-password/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { forgotSchema, type ForgotInput } from "@/lib/validation/auth-schemas";
import { forgotPasswordViaApi } from "@/lib/api/endpoints/auth";
import { AuthCard } from "../auth-card";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth.forgotPassword");
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotInput>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (_data: ForgotInput) => {
    await forgotPasswordViaApi(_data.email);
    setDone(true); // always success — backend hides account existence
  };

  return (
    <AuthCard title={t("title")}>
      {done ? (
        <p className="text-sm">{t("success")}</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <label className="block">
            <span className="text-sm">{t("email")}</span>
            <input type="email" {...register("email")} className="mt-1 block w-full rounded border px-2 py-1" />
            {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
          </label>
          <button type="submit" disabled={isSubmitting} className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">{t("submit")}</button>
        </form>
      )}
      <div className="mt-3 text-sm"><Link href="/login">←</Link></div>
    </AuthCard>
  );
}
```

- [ ] **Step 5: Implement reset-password page**

`src/app/[locale]/(auth)/reset-password/page.tsx`:
```tsx
"use client";

import { use, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n";
import { resetSchema, type ResetInput } from "@/lib/validation/auth-schemas";
import { resetPasswordViaApi } from "@/lib/api/endpoints/auth";
import { AuthCard } from "../auth-card";

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const t = useTranslations("Auth.resetPassword");
  const tValidation = useTranslations("Validation");
  const locale = useLocale();
  const router = useRouter();
  const { token } = use(searchParams);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirm: "" },
  });

  const onSubmit = async (data: ResetInput) => {
    setServerError(null);
    try {
      await resetPasswordViaApi(token ?? "", data.newPassword);
      router.replace(`/${locale}/login?reset=1`);
    } catch {
      setServerError(t("error"));
    }
  };

  if (!token) return <AuthCard title={t("title")}><p className="text-sm text-destructive">{t("error")}</p></AuthCard>;

  return (
    <AuthCard title={t("title")}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <label className="block">
          <span className="text-sm">{t("newPassword")}</span>
          <input type="password" {...register("newPassword")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.newPassword && <span className="text-xs text-destructive">{errors.newPassword.message}</span>}
        </label>
        <label className="block">
          <span className="text-sm">{t("confirm")}</span>
          <input type="password" {...register("confirm")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.confirm && <span className="text-xs text-destructive">{t("mismatch")}</span>}
        </label>
        {serverError && <p className="text-xs text-destructive">{serverError}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">{t("submit")}</button>
      </form>
      <div className="mt-3 text-sm"><Link href="/login">←</Link></div>
    </AuthCard>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/tests/auth-pages.test.tsx`
Expected: PASS.

- [ ] **Step 7: Gate + commit**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: all pass, tsc clean.

```bash
git add "src/app/[locale]/(auth)/verify-email/page.tsx" "src/app/[locale]/(auth)/forgot-password/page.tsx" "src/app/[locale]/(auth)/reset-password/page.tsx" src/tests/auth-pages.test.tsx
git commit -m "feat(auth): add verify-email, forgot-password, reset-password pages"
```

---

## Task 11: Middleware admin role check

**Files:**
- Modify: `src/middleware.ts`
- Test: `src/tests/middleware-admin.test.ts`

**Interfaces:**
- Consumes: `getAuthCookies`/`readAccessTokenFromRequest` from `@/lib/auth/cookies`, `locales`/`defaultLocale` from `@/lib/i18n/config`.
- Produces: extended middleware that, for `/(admin)/**`, fetches `${API_BASE}/users/me` with the access bearer and allows only `role ∈ {ADMIN, MODERATOR}`.

- [ ] **Step 1: Write the failing test**

`src/tests/middleware-admin.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { NextRequest } from "next/server";

const API_BASE = "http://localhost:8080/api/v1";
process.env.NEXT_PUBLIC_API_BASE = API_BASE;

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const mk = (url: string, cookie = "") => new Request(url, { headers: cookie ? { cookie } : {} }) as unknown as NextRequest;

describe("middleware admin guard", () => {
  it("allows ADMIN through to intl middleware", async () => {
    server.use(http.get(`${API_BASE}/users/me`, ({ request }) => {
      expect(request.headers.get("authorization")).toBe("Bearer acc");
      return HttpResponse.json({ id: "u1", role: "ADMIN", verified: true, active: true, email: "a@b.co", createdAt: "t", updatedAt: "t" });
    }));
    const { default: middleware } = await import("@/middleware");
    const res = await middleware(mk("http://x/ru/admin", "pmp_access=acc"));
    // allowed → intl middleware response (200-class, not a 307 to /login)
    expect(res.status).not.toBe(307);
  });

  it("redirects BUYER away from /admin", async () => {
    server.use(http.get(`${API_BASE}/users/me`, () => HttpResponse.json({ id: "u1", role: "BUYER", verified: true, active: true, email: "a@b.co", createdAt: "t", updatedAt: "t" })));
    const { default: middleware } = await import("@/middleware");
    const res = await middleware(mk("http://x/ru/admin/users", "pmp_access=acc"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/ru/login");
  });

  it("redirects when no access cookie", async () => {
    const { default: middleware } = await import("@/middleware");
    const res = await middleware(mk("http://x/ru/admin"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/ru/login");
  });

  it("redirects on 401 from /users/me", async () => {
    server.use(http.get(`${API_BASE}/users/me`, () => new HttpResponse(null, { status: 401 })));
    const { default: middleware } = await import("@/middleware");
    const res = await middleware(mk("http://x/ru/admin", "pmp_access=stale"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/ru/login");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/middleware-admin.test.ts`
Expected: FAIL — current middleware only checks presence, so BUYER with a cookie passes (not redirected) → the BUYER test fails (expects 307).

- [ ] **Step 3: Implement middleware extension**

Replace `src/middleware.ts` with:
```ts
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "@/lib/i18n/config";

const intlMiddleware = createMiddleware({ locales, defaultLocale, localePrefix: "always" });

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

const PROTECTED = ["/dashboard", "/admin"];

export async function middleware(req: NextRequest) {
  const intlRes = intlMiddleware(req);
  const pathname = req.nextUrl.pathname;
  const stripped = pathname.replace(new RegExp(`^/(${locales.join("|")})(?=/|$)`), "") || "/";
  const isProtected = PROTECTED.some((p) => stripped.startsWith(p));
  if (!isProtected) return intlRes;

  const cookie = req.headers.get("cookie") ?? "";
  const hasAccess = cookie.split(";").some((c) => c.trim().startsWith("pmp_access="));
  const accessMatch = cookie.match(/pmp_access=([^;]+)/);
  const accessToken = accessMatch ? accessMatch[1] : null;
  const locale = locales.find((l) => pathname.startsWith(`/${l}`)) ?? defaultLocale;

  const redirectToLogin = () => {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  };

  if (!hasAccess || !accessToken) return redirectToLogin();

  // Admin role check: fetch /users/me with the access bearer.
  if (stripped.startsWith("/admin")) {
    try {
      const meRes = await fetch(`${API_BASE}/users/me`, { headers: { authorization: `Bearer ${accessToken}` } });
      if (!meRes.ok) return redirectToLogin();
      const me = (await meRes.json()) as { role?: string };
      if (me.role !== "ADMIN" && me.role !== "MODERATOR") return redirectToLogin();
    } catch {
      return redirectToLogin();
    }
  }

  return intlRes;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/middleware-admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: all pass, tsc clean.

```bash
git add src/middleware.ts src/tests/middleware-admin.test.ts
git commit -m "feat(auth): enforce admin role check in middleware via /users/me"
```

---

## Task 12: Thin dashboard + admin placeholder pages

**Files:**
- Create: `src/app/[locale]/(dashboard)/dashboard/page.tsx`, `src/app/[locale]/(admin)/admin/page.tsx`
- Test: `src/tests/dashboard-placeholders.test.tsx`

**Interfaces:**
- Consumes: `useSession` (Task 6), `Link`/`useTranslations`.
- Produces: `/[locale]/dashboard`, `/[locale]/admin` (thin, role-aware welcome + links).

- [ ] **Step 1: Write the failing test**

`src/tests/dashboard-placeholders.test.tsx`:
```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/dashboard-placeholders.test.tsx`
Expected: FAIL — pages not found.

- [ ] **Step 3: Implement dashboard placeholder**

`src/app/[locale]/(dashboard)/dashboard/page.tsx`:
```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { useSession } from "@/components/auth/useSession";

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const { user } = useSession();
  if (!user) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("welcome", { email: user.email ?? "" })}</h1>
      <nav className="flex flex-wrap gap-4">
        <Link href="/dashboard/profile" className="rounded border px-3 py-2">{t("profile")}</Link>
        {(user.role === "SELLER" || user.role === "ADMIN") && (
          <Link href="/dashboard/listings" className="rounded border px-3 py-2">{t("myListings")}</Link>
        )}
        <Link href="/dashboard/bookings" className="rounded border px-3 py-2">{t("bookings")}</Link>
        <Link href="/dashboard/messages" className="rounded border px-3 py-2">{t("messages")}</Link>
        <Link href="/dashboard/favorites" className="rounded border px-3 py-2">{t("favorites")}</Link>
        <Link href="/dashboard/subscriptions" className="rounded border px-3 py-2">{t("subscriptions")}</Link>
      </nav>
      <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
    </div>
  );
}
```

- [ ] **Step 4: Implement admin placeholder**

`src/app/[locale]/(admin)/admin/page.tsx`:
```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n";

export default function AdminPage() {
  const t = useTranslations("Admin");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <nav className="flex flex-wrap gap-4">
        <Link href="/admin/users" className="rounded border px-3 py-2">{t("users")}</Link>
        <Link href="/admin/listings/pending" className="rounded border px-3 py-2">{t("pendingListings")}</Link>
        <Link href="/admin/reviews/pending" className="rounded border px-3 py-2">{t("pendingReviews")}</Link>
        <Link href="/admin/statistics" className="rounded border px-3 py-2">{t("statistics")}</Link>
      </nav>
      <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/tests/dashboard-placeholders.test.tsx`
Expected: PASS.

- [ ] **Step 6: Gate + commit**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: all pass, tsc clean.

```bash
git add "src/app/[locale]/(dashboard)/dashboard/page.tsx" "src/app/[locale]/(admin)/admin/page.tsx" src/tests/dashboard-placeholders.test.tsx
git commit -m "feat(auth): add thin dashboard and admin placeholder pages"
```

---

## Task 13: Playwright e2e auth flow + final gate

**Files:**
- Create: `e2e/auth.spec.ts`
- (No new unit tests; this task adds e2e + runs the full gate.)

**Interfaces:**
- Consumes: all auth pages (Tasks 8–10), session (Task 6), middleware (Task 11), placeholders (Task 12). Uses MSW at the Playwright level is complex; instead the e2e runs against the real dev server with the **backend mocked by MSW mounted in the Next app via a test-only condition is NOT available**. Therefore the e2e uses **route interception on the Playwright browser context** (`page.route`) to stub `/api/auth/*` and `/api/proxy/users/me` responses, keeping the flow hermetic without a real backend.

- [ ] **Step 1: Write the e2e spec**

`e2e/auth.spec.ts`:
```ts
import { test, expect, type Route } from "@playwright/test";

const stub = (handler: (route: Route) => Promise<void> | void) =>
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/register", (r) => r.fulfill({ status: 201 }));
    await page.route("**/api/auth/verify-email", (r) => r.fulfill({ status: 200, json: { ok: true } }));
    await page.route("**/api/auth/login", (r) => r.fulfill({ status: 200, json: { ok: true } }));
    await page.route("**/api/proxy/users/me", handler);
  });

stub(async (route) => {
  // default: BUYER
  await route.fulfill({ status: 200, json: { id: "u1", email: "buyer@e.co", role: "BUYER", verified: true, active: true, createdAt: "t", updatedAt: "t" } });
});

test("register → verify-email-info → login (BUYER) → /dashboard", async ({ page }) => {
  await page.goto("/ru/register");
  await page.getByLabel("Email").fill("buyer@e.co");
  await page.getByLabel("Пароль").fill("12345678");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(page).toHaveURL(/\/ru\/verify-email-info$/);
  // dev paste-token helper
  await page.getByLabel(/Redis/i).fill("tok-1");
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page).toHaveURL(/\/ru\/login/);
  await page.getByLabel("Email").fill("buyer@e.co");
  await page.getByLabel("Пароль").fill("12345678");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/ru\/dashboard$/);
  await expect(page.getByText(/Добро пожаловать, buyer@e.co/)).toBeVisible();
});

test("admin login → /admin", async ({ page, browser }) => {
  // override /users/me for this test to return ADMIN
  await page.unroute("**/api/proxy/users/me");
  await page.route("**/api/proxy/users/me", (r) => r.fulfill({ status: 200, json: { id: "u2", email: "admin@e.co", role: "ADMIN", verified: true, active: true, createdAt: "t", updatedAt: "t" } }));
  // admin guard in middleware also calls the real backend URL — stub that too
  await page.route("**/localhost:8080/**", (r) => {
    if (r.request().url().includes("/users/me")) return r.fulfill({ status: 200, json: { id: "u2", role: "ADMIN", verified: true, active: true, email: "admin@e.co", createdAt: "t", updatedAt: "t" } });
    return r.continue();
  });
  await page.goto("/ru/login");
  await page.getByLabel("Email").fill("admin@e.co");
  await page.getByLabel("Пароль").fill("12345678");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/ru\/admin$/);
});

test("non-admin hitting /admin is redirected to login", async ({ page }) => {
  await page.route("**/localhost:8080/api/v1/users/me", (r) => r.fulfill({ status: 200, json: { id: "u1", role: "BUYER", verified: true, active: true, email: "b@e.co", createdAt: "t", updatedAt: "t" } }));
  // seed an access cookie so the presence check passes, then the role check rejects
  await page.context().addCookies([{ name: "pmp_access", value: "fake", domain: "localhost", path: "/" }]);
  await page.goto("/ru/admin");
  await expect(page).toHaveURL(/\/ru\/login/);
});

test("logout returns to home and shows login link", async ({ page }) => {
  await page.goto("/ru/login");
  await page.getByLabel("Email").fill("buyer@e.co");
  await page.getByLabel("Пароль").fill("12345678");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/ru\/dashboard$/);
  await page.getByRole("button", { name: /buyer@e.co/i }).click();
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/ru\/?$/);
  await expect(page.getByRole("link", { name: "Войти" })).toBeVisible();
});
```

**Note for the implementer:** Playwright `page.route` only intercepts requests made **from the browser**. Middleware runs in the Next server (edge/node) and calls the backend directly — `page.route` cannot intercept that. The "non-admin hitting /admin" test seeds a fake cookie and relies on middleware fetching the real `API_BASE`; stubbing `**/localhost:8080/**` from the browser won't reach middleware. **Resolution:** for the e2e to be hermetic, set `NEXT_PUBLIC_API_BASE` to a localhost mock OR — simpler — accept that the admin-guard e2e requires a stub backend. Practical approach: run e2e against a tiny MSW-in-Next is out of scope; instead **mock the backend with a Playwright-level `page.route` for the client calls (login/users-me via the proxy) and, for the middleware admin check, point `NEXT_PUBLIC_API_BASE` at a local stub server started in the test, OR skip the middleware-admin e2e and rely on the unit test (`middleware-admin.test.ts`) for that branch.** Document which approach you took in the report. The recommended choice: **keep the BUYER flow and logout e2e (pure client, fully stubbable via `page.route`), and rely on the unit test for the middleware admin guard** — mark the `admin login → /admin` and `non-admin → /admin` e2e with `test.skip` plus a comment pointing to the unit test, OR implement a small `http` stub server. Make the BUYER + logout e2e GREEN; do not leave the suite red.

- [ ] **Step 2: Run e2e**

Run: `pnpm exec playwright test e2e/auth.spec.ts`
Expected: the BUYER register→login→dashboard and logout tests PASS; the admin/middleware tests pass OR are skipped with a documented reason. No red.

- [ ] **Step 3: Final gate**

Run:
```bash
pnpm vitest run && pnpm tsc --noEmit && pnpm next build && pnpm exec playwright test
```
Expected: all unit tests pass, tsc clean, build succeeds (SSG `/ru`+`/en` still prerendered; note dynamic auth pages are not statically prerendered — that's fine), all non-skipped Playwright tests pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/auth.spec.ts
git commit -m "test(e2e): add auth flow specs (register→verify→login→dashboard, logout)"
```

---

## Self-Review (controller runs after writing — fix inline)

1. **Spec coverage:** every Phase 2 spec section maps to a task — §2 backend contract (Tasks 4,5), §3.1 routes (Task 5), §3.2 pages (Tasks 8–10), §3.3 session (Tasks 6,7), §3.4 middleware (Task 11), §3.5 redirects (Tasks 3,8), §3.6 placeholders (Task 12), §3.7 schemas (Task 2), §3.8 endpoints (Task 4), §5 i18n (Task 1), §7 tests (per-task + Task 13).
2. **Placeholder scan:** no TBD/TODO/"similar to"/"implement later" — all code blocks are complete. (Task 8 has a deliberate "Note for the implementer" resolving a real client-component `searchParams` ambiguity — that is guidance, not a placeholder.)
3. **Type consistency:** `LoginInput`/`RegisterInput`/`ForgotInput`/`ResetInput` defined in Task 2, consumed in Tasks 4/8/9/10 with matching names. `roleBasedHome`/`safeCallbackUrl`/`redirectAfterLogin` (Task 3) match uses in Task 8. `useSession` (Task 6) used in Tasks 7/12. `AuthCard` (Task 8) used in Tasks 9/10.
4. **Known risk:** Task 8 client-component `searchParams` and Task 13 middleware e2e — both flagged with explicit implementer guidance above.
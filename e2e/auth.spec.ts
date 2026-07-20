import { test, expect } from "@playwright/test";

// Cookie-aware route stubs.
//
// The Next.js route handlers for /api/auth/login and /api/auth/logout run on
// the server and normally set/clear the httpOnly `pmp_access` cookie themselves
// (forwarding to the real backend). But Playwright's `page.route` intercepts
// the request at the browser BEFORE it reaches the Next handler, so if we
// `fulfill(...)` directly the real handler never runs and the cookie is never
// set. Without the cookie, subsequent client navigations to /dashboard trigger
// an RSC request that runs middleware, middleware sees no `pmp_access` and
// redirects to /login — breaking the BUYER flow.
//
// Fix: the login/logout stubs set/clear the cookie themselves via the
// `set-cookie` header on the fulfilled response. The browser stores it and
// sends it on every subsequent request (including the middleware RSC fetch and
// the `/api/proxy/users/me` client fetch), where the `/api/proxy/users/me`
// stub reads it back to decide whether the session is alive.
//
// httpOnly cookies ARE sent on HTTP requests and are visible to `page.route`
// via `route.request().headers()["cookie"]`.

const ACCESS_COOKIE = "pmp_access=test-access; Path=/; HttpOnly";

test.beforeEach(async ({ page }) => {
  // Register: 201, does NOT log the user in (no cookie set).
  await page.route("**/api/auth/register", (r) => r.fulfill({ status: 201 }));

  // Verify-email: 200, no cookie. The request URL carries a ?token= query
  // string, so the glob must allow trailing characters.
  await page.route("**/api/auth/verify-email*", (r) =>
    r.fulfill({ status: 200, json: { ok: true } }),
  );

  // Login: set the httpOnly access cookie so middleware sees it on the
  // subsequent RSC navigation to /dashboard.
  await page.route("**/api/auth/login", (r) =>
    r.fulfill({
      status: 200,
      json: { ok: true },
      headers: { "set-cookie": ACCESS_COOKIE },
    }),
  );

  // Logout: clear the access cookie so the next /api/proxy/users/me returns
  // 401 and the SessionProvider resolves `user: null`.
  await page.route("**/api/auth/logout", (r) =>
    r.fulfill({
      status: 200,
      headers: { "set-cookie": "pmp_access=; Path=/; Max-Age=0" },
    }),
  );

  // /api/proxy/users/me: cookie-aware. With pmp_access → BUYER user; without
  // → 401, which the SessionProvider queryFn swallows into `null`.
  await page.route("**/api/proxy/users/me", async (r) => {
    const cookie = r.request().headers()["cookie"] ?? "";
    if (!cookie.includes("pmp_access=")) {
      return r.fulfill({ status: 401, json: { detail: "unauthorized" } });
    }
    return r.fulfill({
      status: 200,
      json: {
        id: "u1",
        email: "buyer@e.co",
        role: "BUYER",
        verified: true,
        active: true,
        createdAt: "t",
        updatedAt: "t",
      },
    });
  });
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

// The middleware admin guard (src/middleware.ts) fetches `${API_BASE}/users/me`
// directly from the Next server runtime. Playwright `page.route` only
// intercepts browser-emitted requests; it CANNOT intercept server-side
// middleware fetches. Therefore the admin-login and non-admin→/admin branches
// of the middleware guard are NOT e2e-testable hermetically via `page.route`.
// They are covered by the unit test `src/tests/middleware-admin.test.ts`.

test.skip("admin login → /admin", async () => {
  // middleware admin guard covered by unit test src/tests/middleware-admin.test.ts;
  // page.route cannot intercept server-side middleware fetches.
});

test.skip("non-admin hitting /admin is redirected to login", async () => {
  // middleware admin guard covered by unit test src/tests/middleware-admin.test.ts;
  // page.route cannot intercept server-side middleware fetches.
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
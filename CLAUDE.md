# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

React frontend for a pet-marketplace Spring Boot backend. Next.js 15 App Router, React 19, TypeScript strict, next-intl (RU/EN), TanStack Query, Tailwind + hand-authored shadcn primitives. Package manager is **pnpm**.

## Commands

```bash
pnpm dev                      # dev server on :3000
pnpm build                    # next build (SSG /ru,/en; auth pages are dynamic)
pnpm lint                     # eslint (flat config: next/core-web-vitals + next/typescript)
pnpm test                     # vitest run (full unit suite)
pnpm tsc --noEmit             # typecheck gate (not a package.json script)
pnpm exec playwright test     # e2e (auto-starts `pnpm dev` via webServer config)

# single targets
pnpm vitest run src/tests/proxy.test.ts            # one file
pnpm vitest run -t "replays original body"         # one test by name
pnpm exec playwright test e2e/auth.spec.ts         # one e2e spec

# full pre-merge gate used by this project:
pnpm test && pnpm tsc --noEmit && pnpm build && pnpm exec playwright test
```

`NEXT_PUBLIC_API_BASE` (default `http://localhost:8080/api/v1`) configures the backend; see `.env.example` / `.env.local`.

## Architecture: the security model (read before touching auth)

**Tokens live ONLY in httpOnly cookies** (`pmp_access` ~15min, `pmp_refresh` ~7d rotating) — never in localStorage or JS-readable storage. Client code never reads cookies or tokens. Three layers enforce this:

1. **`/api/proxy/[...path]` (`src/lib/api/proxy-handler.ts`)** — the ONLY path client code uses to reach the backend for authenticated requests. It reads `pmp_access`/`pmp_refresh` from the request cookie, injects `Authorization: Bearer <access>` (deleting any client-supplied `authorization`/`cookie`), and on a 401 with a refresh token does **refresh → retry → rotate cookies** on the response. Body is buffered once so POST refresh-retries can replay it. Hop-by-hop/encoding/`set-cookie` headers are stripped on both return paths. The proxy **404s on any `/auth/*` path** — auth must go through `/api/auth/*`.
2. **`/api/auth/*` route handlers (`src/app/api/auth/*/route.ts`)** — thin server-side wrappers that call `${API_BASE}` directly (sanctioned: server-side). `login`/`register`/`refresh`/`logout` set/rotate/clear the cookies via `src/lib/auth/cookies.ts`. `verify-email`/`forgot-password`/`reset-password` **MUST NOT manipulate cookies** — they only forward and return `{ ok: true }` or `application/problem+json`. On failure they return an explicit `new NextResponse(body, { status, headers: { "content-type": "application/problem+json" } })` — never `parseProblem` (it throws → 500).
3. **Middleware (`src/middleware.ts`)** — next-intl locale routing + presence guard for `/dashboard`+`/admin` (require `pmp_access`). For `/admin` it fetches `${API_BASE}/users/me` directly with the bearer and requires `role ∈ {ADMIN, MODERATOR}`, else redirects to `/${locale}/login?callbackUrl=<raw pathname>`. Middleware runs in edge/Node and **cannot use the proxy or rotate cookies** — a stale access token won't refresh here; the backend 403 is the source of truth.

**Rule:** never call `${API_BASE}` / `process.env.NEXT_PUBLIC_API_BASE` from `"use client"` code. Client → `/api/proxy/*` (via `src/lib/api/client.ts`) for data, or `/api/auth/*` helpers (`src/lib/api/endpoints/auth.ts`) for auth forms. The only direct `${API_BASE}` calls are in route handlers and middleware.

`src/lib/api/client.ts` (`apiGet/apiPost/apiPut/apiDelete/apiUpload`) builds URLs as `${origin}/api/proxy/${path}` (relative in browser). `parseProblem` throws `ApiError` with `.status`, `.detail`, `.violations: { field, message }[]`.

## Architecture: i18n + locale-aware navigation (easy to get wrong)

Locale lives in the `/[locale]` URL segment (`ru`, `en`; default `ru`; `localePrefix: "always"`). `src/i18n.ts` calls `createNavigation` and exports `Link`, `useRouter`, `usePathname`, `redirect`, `getPathname` — **these auto-prepend the locale**.

- **Pass BARE paths** to `useRouter().replace()` / `router.push()` / `<Link href>`: `/dashboard`, not `/ru/dashboard`. Passing `/${locale}/...` produces a double prefix (`/ru/ru/dashboard`) → 404. This bit the auth pages once; `redirectAfterLogin` (in `src/lib/auth/redirects.ts`) returns `/${locale}/...`, so callers must `stripLocalePrefix(target)` before handing it to the locale-aware router.
- `usePathname()` returns the locale-**stripped** path. `useTranslations`/`useLocale` come from `next-intl` (provided by `NextIntlClientProvider` in `[locale]/layout.tsx`).
- next-intl plugin is wired to `src/lib/i18n/request.ts` in `next.config.ts`; `request.ts` uses `requestLocale` (not the legacy `{ locale }`).

Layout structure: `app/layout.tsx` is a pass-through (returns `children`); `<html lang={locale}>`/`<body>` and `NextIntlClientProvider` live in `app/[locale]/layout.tsx`, which wraps children in `Providers` (`QueryClientProvider` > `SessionProvider`). `app/global-error.tsx` has its own `<html>`/`<body>` for errors above the locale layout.

## Architecture: session + client 401 handling

`SessionProvider` (`src/components/auth/SessionProvider.tsx`, `"use client"`) holds a `useQuery(["session"])` whose `queryFn` calls `getCurrentUser()` (via the proxy) and **swallows errors → `null`**. A `/users/me` 401 therefore produces no error event, so it does NOT trigger the logout redirect (no loop). A global 401 effect (`getQueryCache().subscribe`) catches non-session `ApiError` 401s: it sets `["session"]` to `null` and `router.replace("/login?callbackUrl=...")`, guarded by a one-shot `redirecting` ref that **resets on pathname change** (so the handler isn't single-use per app session). `callbackUrl` is sanitized by `safeCallbackUrl` (rejects `//`, `/\`, scheme-bearing, whitespace/control; decode-then-check for encoded variants).

Login flow: `loginViaApi` → `getCurrentUser().catch(() => null)` → `redirectAfterLogin(user, callbackUrl, locale)` → `stripLocalePrefix` → `router.replace(bare)`. After login, `qc.setQueryData(["session"], me)` populates the cache so the dashboard's `useSession` sees the user without a refetch. Logout: `logoutViaApi()` → `qc.removeQueries(["session"])` → `router.replace("/")`.

Forms use react-hook-form + zod (`@hookform/resolvers/zod`); schemas in `src/lib/validation/auth-schemas.ts` mirror the backend's Bean Validation. Map server `violations[]` to `form.setError(field, { message })`.

## Testing conventions

- **Vitest + RTL + jsdom**, setup in `src/tests/setup.ts` (jest-dom matchers + `document.body` cleanup each test). `globals: true` (no need to import `describe`/`it`/`expect`, though most files do). `@` alias resolves to `src`.
- **MSW 2.15** (`setupServer`) intercepts fetch in the node env. `server.close()` in `afterEach` is required. Tests stub `@/i18n` (`Link` as plain `<a>`, `useRouter`/`usePathname` as `vi.fn()`) and `next-intl` where needed, while `NextIntlClientProvider` provides real `useTranslations`/`useLocale`. `@/messages/ru.json` is imported directly (`resolveJsonModule: true`).
- **`src/tests/messages.test.ts`** asserts every used i18n key exists in **both** `ru.json` and `en.json`. When you add a user-facing string, add the key to both locale files AND to that test's key list, or the suite breaks.
- **Client-component `searchParams`**: Next 15 client components do NOT receive `searchParams` as a prop in production. Read from `window.location.search` (sync) with the Promise prop as a test-only fallback, resolved via `useEffect`+`useState`. **Do NOT use `React.use(promise)`** for this — it suspends indefinitely under vitest/jsdom `act`. See `login/page.tsx` / `verify-email/page.tsx` / `reset-password/page.tsx` for the pattern.
- **Playwright e2e** (`e2e/`, baseURL `:3000`, chromium) uses `page.route` to stub `/api/auth/*` and `/api/proxy/users/me`. `page.route` fulfills at the browser, so stubs that need to set/clear the `pmp_access` cookie must do so via the response `set-cookie` header (the real route handler is bypassed). `page.route` **cannot** intercept server-side middleware fetches — the middleware admin guard is covered by `src/tests/middleware-admin.test.ts`, not e2e.

## Workflow

Design specs and implementation plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/` (the backend contract is documented there). The project uses a subagent-driven-development workflow with a per-task progress ledger at `.superpowers/sdd/progress.md` (gitignored scratch — recover from `git log` if it's lost). Commits use conventional prefixes (`feat:`, `fix:`, `test:`, `chore:`).

## Gotchas

- `noUncheckedIndexedAccess` is on — guard indexed access (`arr[0]`, `match[1]`) with truthy checks.
- shadcn primitives are **hand-authored v3** (Tailwind 3.4.17 + `tailwindcss-animate`), not shadcn CLI v4 output. `@radix-ui/react-dropdown-menu`/`-slot`/`-label` are installed; avatar is a plain `<div>` initials badge (no `@radix-ui/react-avatar` dependency by design).
- A dev-then-stale-access edge case on the middleware admin guard is accepted (documented in the spec): the first real RSC load of an admin page refreshes the token via the proxy.
# PetMarketplace Frontend

React frontend for the pet-marketplace Spring Boot backend. Next.js 15 App Router, React 19, TypeScript, next-intl (RU/EN), TanStack Query, Tailwind.

The backend repo is a sibling directory (`../pet-marketplace`). Run it first — the frontend talks to it over HTTP.

## Prerequisites

- Node.js 22+, pnpm 11+
- Backend prerequisites: JDK 26, Docker + Docker Compose, Gradle 9 (see backend `README.md`)

## Quick start

### 1. Start the backend

From the backend repo (`../pet-marketplace`):

```bash
# start PostgreSQL, Redis, MinIO, Mailpit, Kafka
docker-compose up -d

# run the API (http://localhost:8080/api/v1)
gradle bootRun
```

### 2. Start the frontend

From this repo:

```bash
pnpm install        # first time only
pnpm dev            # dev server on :3000
```

### 3. Open the app in the browser

```
http://localhost:3000
```

The root redirects to the default locale (`ru`), so you'll land on **http://localhost:3000/ru**. Switch locales with the `/en` URL segment (`http://localhost:3000/en`) — locales are always present in the path.

## Configuration

`NEXT_PUBLIC_API_BASE` points the frontend at the backend (default `http://localhost:8080/api/v1`). Override it via `.env.local`:

```bash
cp .env.example .env.local
# edit NEXT_PUBLIC_API_BASE if your backend runs elsewhere
```

## Common commands

```bash
pnpm dev                      # dev server on :3000
pnpm build                    # production build
pnpm start                    # serve the production build
pnpm lint                     # eslint
pnpm test                     # unit tests (vitest)
pnpm tsc --noEmit             # typecheck
pnpm exec playwright test     # e2e (auto-starts `pnpm dev`)

# single targets
pnpm vitest run src/tests/proxy.test.ts        # one test file
pnpm vitest run -t "replays original body"     # one test by name
pnpm exec playwright test e2e/auth.spec.ts     # one e2e spec

# full pre-merge gate
pnpm test && pnpm tsc --noEmit && pnpm build && pnpm exec playwright test
```

## Project layout

- `src/app/[locale]/...` — App Router pages grouped by route: `(auth)` login/register/verify/forgot/reset, `(dashboard)` buyer area, `(admin)` admin area. Locale lives in the `/[locale]` URL segment.
- `src/app/api/proxy/[...path]` — the single client→backend gateway (injects the httpOnly bearer, refreshes on 401).
- `src/app/api/auth/*` — server-side route handlers for auth form submissions.
- `src/middleware.ts` — next-intl locale routing + auth/role guards for `/dashboard` and `/admin`.
- `src/lib/api/`, `src/lib/auth/` — API client, proxy logic, cookie/redirect helpers.
- `src/messages/{ru,en}.json` — i18n strings (keep both locales in sync).
- `e2e/` — Playwright specs.

See `CLAUDE.md` for the full architecture, security model, and conventions.
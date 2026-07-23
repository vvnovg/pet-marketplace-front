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

## Deploy (frontend distribution)

This is the **frontend** distribution (Next.js). It is the public entry point on `:3000`. It requires the **backend distribution** (`pet-marketplace` repo) already running on the same host on `:8080` (see that repo's README). Deploy order: backend first, then this.

### 1. Prerequisites

The same Debian host prepared for the backend (Docker Engine + Compose plugin, git). See the backend README "Deploy (backend distribution) → 1. Prepare the Debian host".

### 2. Configure and start the frontend

```bash
git clone <frontend-repo-url> pet-marketplace-front && cd pet-marketplace-front
# No .env needed: docker-compose.yml's build-arg defaults NEXT_PUBLIC_API_BASE
# to http://host.docker.internal:8080/api/v1 (reaches the backend on the same host).
# Set NEXT_PUBLIC_API_BASE in a .env only to override that default.
docker compose up -d --build
```

Verify locally on the host:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/   # 200
```

### 3. Firewall

The backend distribution's README already opens `:3000` on `enp1s0` and keeps `:8080` private. No extra firewall step here.

### 4. Publish via the Keenetic cloud

`netcraze.link` is a KeenDNS domain: the Keenetic cloud terminates HTTPS (Let's Encrypt cert `novgorodtsev.netcraze.link`) and tunnels to the Keenetic router, which forwards to an internal `IP:port`.

In the Keenetic web GUI (KeenDNS / "Доступ из интернета"), retarget the `www.novgorodtsev.netcraze.link` cloud publication to:

- internal host: `192.168.1.81`
- port: `3000`
- protocol: HTTP (TLS is handled by the cloud)

Then verify publicly:

```bash
curl -fsS https://www.novgorodtsev.netcraze.link/ -o /dev/null -w "%{http_code}\n"   # 200
```

The browser talks only to the frontend (auth cookies `pmp_access`/`pmp_refresh` are set on this domain); the backend is never reached directly from the browser, so no CORS is needed.

### 5. Rebuilding after a backend address/port change

`NEXT_PUBLIC_API_BASE` is inlined at build time. If the backend moves, update `.env` and rebuild:

```bash
docker compose up -d --build
```

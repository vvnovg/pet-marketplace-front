# PetMarketplace Frontend — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js 15 app skeleton with Tailwind + shadcn/ui, RU/EN i18n, a server-side auth/token proxy, a typed API client, core layout (Header/Footer/LocaleSwitch), middleware route-guard stub, and `not-found` — so every later phase builds on a runnable, testable base.

**Architecture:** Next.js App Router with locale segment `/[locale]`; tokens live in httpOnly cookies set by server route handlers; all backend calls go through a single `/api/proxy/[...path]` route handler that injects `Authorization: Bearer` and does silent 401-refresh; client components call a typed `client.ts` that hits `/api/proxy`. React Server Components for public pages, TanStack Query for client mutations (wired but not yet exercised by features in this phase).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS, shadcn/ui (Radix), next-intl, TanStack Query v5, zod, sonner, lucide-react, Vitest + React Testing Library + MSW, Playwright.

## Global Constraints

- Node >= 20, package manager: **pnpm**.
- TypeScript strict mode, `noUncheckedIndexedAccess` on.
- All backend calls go through `/api/proxy/*` — never call `${NEXT_PUBLIC_API_BASE}` directly from client code.
- Access/refresh tokens are **only** in httpOnly, `Secure`, `SameSite=Lax` cookies set by server route handlers; never exposed to browser JS.
- Cookie names: `pmp_access`, `pmp_refresh`.
- Backend base: `http://localhost:8080/api/v1` (override via `NEXT_PUBLIC_API_BASE`).
- Default locale `ru`, supported `['ru','en']`, locale is first URL segment.
- Every form uses react-hook-form + zod; zod rules mirror backend Bean Validation.
- ESLint `next/core-web-vitals`; Prettier default config.
- Commits use conventional-commits prefixes (`feat:`, `chore:`, `test:`, `refactor:`).

### Prerequisite (manual, before Task 1)

Install Node 20+ and pnpm if not present:
```bash
# via Homebrew (macOS)
brew install node@20 pnpm
# verify
node -v   # >= v20
pnpm -v
```
The backend must be runnable for end-to-end checks later: from `/Users/vvnovg/pet-marketplace`, `docker-compose up -d && gradle bootRun`. Not required to complete Phase 1 tasks (MSW mocks the backend in tests), but needed for the Phase 1 smoke test at the end.

---

## File Structure (created in this plan)

```
src/
  app/
    [locale]/
      layout.tsx                 # next-intl provider, QueryClientProvider, Toaster, Header/Footer
      page.tsx                    # home placeholder (catalog arrives in Phase 2)
      not-found.tsx
    api/
      proxy/[...path]/route.ts    # universal proxy: cookie→Bearer, 401 refresh
      auth/login/route.ts         # sets cookies from TokenResponse
      auth/register/route.ts
      auth/refresh/route.ts       # rotates cookies
      auth/logout/route.ts        # clears cookies
    layout.tsx                    # root html, suppressHydrationWarning
    globals.css                   # Tailwind directives + shadcn vars
  middleware.ts                   # locale negotiation + guard for /(dashboard) and /(admin)
  lib/
    api/
      client.ts                   # typed fetch wrapper over /api/proxy
      errors.ts                   # ApiError + ProblemDetail parser
      endpoints/auth.ts            # auth endpoint functions
      endpoints/users.ts           # getCurrentUser (used by guard + session)
    auth/
      cookies.ts                  # get/set/clear pmp_access/pmp_refresh
    i18n/
      config.ts                   # locales, defaultLocale
      request.ts                  # next-intl getRequestConfig
      locale.ts                   # localizedCategory(cat, locale) helper + pickField
    utils/
      cn.ts                       # clsx + tailwind-merge
    query-client.ts               # makeQueryClient (server-safe)
  components/
    ui/                            # shadcn primitives added via CLI (button, card, input, label, dropdown-menu, sonner)
    layout/
      Header.tsx
      Footer.tsx
      LocaleSwitch.tsx
      UserMenu.tsx                 # stub (auth-aware menu; real flows in Phase 2)
  types/
    api.ts                         # TS types mirroring backend DTOs (full set)
  messages/
    ru.json
    en.json
  tests/
    setup.ts                       # vitest setup (jsdom, afterEach cleanup)
  middleware.ts
  next.config.ts
  tailwind.config.ts
  postcss.config.mjs
  tsconfig.json
  components.json                  # shadcn config
  vitest.config.ts
  playwright.config.ts
  .env.local                       # NEXT_PUBLIC_API_BASE
  .env.example
```

---

### Task 1: Initialize Next.js project and base config

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `.env.local`, `.env.example`, `.gitignore`
- Test: `tests/app-smoke.test.tsx`

**Interfaces:**
- Produces: a runnable `pnpm dev` Next.js app at `http://localhost:3000` with a root layout that renders "PetMarketplace".

- [ ] **Step 1: Scaffold the project**

```bash
cd /Users/vvnovg/pet-marketplace-front
pnpm create next-app@latest . --typescript --tailwind --app --src-dir --eslint --import-alias "@/*" --no-turbopack --skip-install
pnpm install
```
If `create-next-app` refuses to run in a non-empty dir, delete its detected conflict files (the `docs/` folder is fine to keep) and re-run, or use `--use-pnpm` and answer prompts as above interactively.

- [ ] **Step 2: Pin TS strictness**

Replace `tsconfig.json` `compilerOptions` additions: ensure `"strict": true` and add `"noUncheckedIndexedAccess": true`. Keep the `paths` mapping `"@/*": ["./src/*"]` that create-next-app generated.

- [ ] **Step 3: Add env files**

`.env.example`:
```env
NEXT_PUBLIC_API_BASE=http://localhost:8080/api/v1
```
`.env.local`:
```env
NEXT_PUBLIC_API_BASE=http://localhost:8080/api/v1
```

- [ ] **Step 4: Replace root layout + globals**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PetMarketplace",
  description: "Маркетплейс животных / Pet marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` (create-next-app makes `app/page.tsx`; move to `src/app/page.tsx` and simplify):
```tsx
export default function Home() {
  return <main className="p-8"><h1 className="text-2xl font-bold">PetMarketplace</h1></main>;
}
```

`src/app/globals.css` (replace contents):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
:root { --background: 0 0% 100%; --foreground: 222.2 84% 4.9%; }
.dark { --background: 222.2 84% 4.9%; --foreground: 210 40% 98%; }
body { @apply bg-background text-foreground; }
```

- [ ] **Step 5: Verify dev server boots**

Run: `pnpm dev` (in one terminal), then `curl -s http://localhost:3000 | grep -o "PetMarketplace" | head -1`
Expected: prints `PetMarketplace`. Stop the dev server after.

- [ ] **Step 6: Install test deps + config**

```bash
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw @vitejs/plugin-react
pnpm add -D playwright @playwright/test
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

`src/tests/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
afterEach(() => { document.body.innerHTML = ""; });
```

- [ ] **Step 7: Write the smoke test**

`src/tests/app-smoke.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the brand title", () => {
    render(<Home />);
    expect(screen.getByText("PetMarketplace")).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run the test**

Run: `pnpm vitest run src/tests/app-smoke.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 9: Init git and commit**

```bash
cd /Users/vvnovg/pet-marketplace-front
git init
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind and test tooling"
```

---

### Task 2: Add shadcn/ui, utils, and base UI primitives

**Files:**
- Create: `src/lib/utils/cn.ts`, `components.json`, `src/components/ui/{button,card,input,label}.tsx`
- Test: `src/tests/cn.test.ts`

**Interfaces:**
- Produces: `cn(...inputs)` className merger; shadcn `Button`, `Card`, `Input`, `Label` components.

- [ ] **Step 1: Install shadcn deps**

```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-dropdown-menu sonner
pnpm add -D tailwindcss-animate
```

- [ ] **Step 2: Add cn util**

`src/lib/utils/cn.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Write cn test**

`src/tests/cn.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils/cn";

describe("cn", () => {
  it("merges tailwind classes de-duping conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", false && "text-blue-500", "text-blue-500")).toBe("text-blue-500");
  });
});
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/tests/cn.test.ts`
Expected: PASS.

- [ ] **Step 5: Init shadcn and add primitives**

```bash
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button card input label dropdown-menu sonner
```
This creates `components.json` and the `src/components/ui/*.tsx` files using our `cn` util. If shadcn complains about an existing `tailwind.config.ts`, accept the merge. Verify `src/components/ui/button.tsx` exists.

- [ ] **Step 6: Wire tailwindcss-animate**

`tailwind.config.ts` — ensure `content` includes `./src/**/*.{ts,tsx}` and add to plugins:
```ts
import tailwindcssAnimate from "tailwindcss-animate";
// ...
plugins: [tailwindcssAnimate],
```
And add a minimal `theme.extend` with CSS-var-based colors:
```ts
theme: {
  extend: {
    colors: {
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
      muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
      border: "hsl(var(--border))",
      ring: "hsl(var(--ring))",
    },
    borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
  },
},
```
Expand `globals.css` `:root` with the standard shadcn neutral palette variables (`--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--ring`, `--radius`) — copy from shadcn init output if present.

- [ ] **Step 7: Verify build compiles**

Run: `pnpm build`
Expected: build succeeds (may warn about no `metadata` export in layout — fine).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): add shadcn/ui primitives and cn util"
```

---

### Task 3: Backend DTO types

**Files:**
- Create: `src/types/api.ts`
- Test: `src/tests/types.test-d.ts`

**Interfaces:**
- Produces: TS types used by all later phases: `TokenResponse`, `UserProfile`, `PublicProfile`, `Listing`, `ListingMini`, `Booking`, `Message`, `Conversation`, `Review`, `Favorite`, `Subscription`, enums `Role`, `ListingStatus`, `ListingGender`, `BookingStatus`, `ReviewStatus`, and `Page<T>`.

- [ ] **Step 1: Write the types**

`src/types/api.ts`:
```ts
export type UUID = string;
export type IsoInstant = string;
export type Money = string; // BigDecimal as string to preserve precision

export type Role = "BUYER" | "SELLER" | "ADMIN" | "MODERATOR";
export type ListingStatus =
  | "DRAFT" | "PENDING_MODERATION" | "ACTIVE"
  | "RESERVED" | "SOLD" | "ARCHIVED" | "REJECTED";
export type ListingGender = "MALE" | "FEMALE";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface PublicProfile {
  id: UUID;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  rating: Money | null;
  totalReviews: number | null;
  role: Role;
}

export interface UserProfile {
  id: UUID;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: Role;
  verified: boolean;
  active: boolean;
  bio: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  latitude: Money | null;
  longitude: Money | null;
  rating: Money | null;
  totalReviews: number | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface ListingImage {
  id: UUID;
  url: string;
  orderIndex: number;
  isMain: boolean;
}

export interface Listing {
  id: UUID;
  seller: PublicProfile;
  categoryId: UUID;
  categoryName: string;
  breedId: UUID | null;
  breedName: string | null;
  title: string;
  description: string | null;
  price: Money;
  currency: string;
  gender: ListingGender;
  ageMonths: number;
  color: string | null;
  weightKg: Money | null;
  healthInfo: string | null;
  hasVaccination: boolean | null;
  hasDocuments: boolean | null;
  locationCountry: string | null;
  locationCity: string | null;
  status: ListingStatus;
  viewsCount: number;
  images: ListingImage[];
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface ListingMini {
  id: UUID;
  title: string;
  price: Money;
  currency: string;
  locationCity: string | null;
  mainImageUrl: string | null;
  status: ListingStatus;
}

export interface Booking {
  id: UUID;
  listing: { id: UUID; title: string; price: Money; currency: string; mainImageUrl: string | null };
  buyer: PublicProfile;
  seller: PublicProfile;
  status: BookingStatus;
  message: string | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface Message {
  id: UUID;
  sender: PublicProfile;
  receiver: PublicProfile;
  listing: { id: UUID; title: string } | null;
  content: string | null;
  attachmentUrl: string | null;
  read: boolean;
  createdAt: IsoInstant;
}

export interface Conversation {
  partner: PublicProfile;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface Review {
  id: UUID;
  author: PublicProfile;
  recipient: PublicProfile;
  booking: { id: UUID } | null;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: IsoInstant;
}

export interface Favorite {
  id: UUID;
  listing: ListingMini;
  createdAt: IsoInstant;
}

export interface Breed { id: UUID; name: string; }
export interface CategoryWithBreeds {
  id: UUID;
  name: string;
  slug: string;
  breeds: Breed[];
}

export interface Subscription {
  id: UUID;
  filters: Record<string, unknown>;
  isActive: boolean;
  createdAt: IsoInstant;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;       // current page (0-based)
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface ApiProblemDetail {
  status?: number;
  title?: string;
  detail?: string;
  type?: string;
  violations?: { field: string; message: string }[];
}
```

- [ ] **Step 2: Write a type-level test**

`src/tests/types.test-d.ts`:
```ts
import { describe, it, expectType } from "vitest";
import type { Page, Listing, TokenResponse } from "@/types/api";

describe("types", () => {
  it("Page<Listing> has content array of Listing", () => {
    const p = {} as Page<Listing>;
    expectType<Listing[]>(p.content);
  });
  it("TokenResponse has number expiresIn", () => {
    const t = {} as TokenResponse;
    expectType<number>(t.expiresIn);
  });
});
```
Type-level tests run with the normal vitest run; `expectType` is provided by vitest when `@vitest/expect-type` types resolve. Add the dependency if missing: `pnpm add -D @vitest/expect-type`.

- [ ] **Step 3: Run the test**

Run: `pnpm vitest run src/tests/types.test-d.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(types): add backend DTO mirror types"
```

---

### Task 4: Error handling — ApiError and ProblemDetail parser

**Files:**
- Create: `src/lib/api/errors.ts`
- Test: `src/tests/errors.test.ts`

**Interfaces:**
- Produces: `ApiError` class (with `status`, `title`, `detail`, `violations`), `parseProblem(res)` that reads a `Response` and throws `ApiError`.

- [ ] **Step 1: Write the failing test**

`src/tests/errors.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ApiError, parseProblem } from "@/lib/api/errors";

describe("parseProblem", () => {
  it("parses RFC 9457 problem+json with violations", async () => {
    const res = new Response(JSON.stringify({
      status: 400, title: "Bad Request", detail: "validation failed",
      violations: [{ field: "email", message: "must be valid" }],
    }), { status: 400, headers: { "content-type": "application/problem+json" } });
    await expect(parseProblem(res)).rejects.toMatchObject({
      status: 400, title: "Bad Request", detail: "validation failed",
      violations: [{ field: "email", message: "must be valid" }],
    });
  });

  it("produces ApiError instance", async () => {
    const res = new Response("{}", { status: 500 });
    await expect(parseProblem(res)).rejects.toBeInstanceOf(ApiError);
  });

  it("falls back when body is not JSON", async () => {
    const res = new Response("boom", { status: 502 });
    await expect(parseProblem(res)).rejects.toMatchObject({ status: 502, detail: "boom" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/tests/errors.test.ts`
Expected: FAIL — module `@/lib/api/errors` not found.

- [ ] **Step 3: Implement**

`src/lib/api/errors.ts`:
```ts
import type { ApiProblemDetail } from "@/types/api";

export interface ApiViolation { field: string; message: string; }

export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    public violations: ApiViolation[] = [],
  ) {
    super(`${title}: ${detail}`);
    this.name = "ApiError";
  }
  static fromProblem(p: ApiProblemDetail, fallbackStatus: number): ApiError {
    return new ApiError(
      p.status ?? fallbackStatus,
      p.title ?? "Error",
      p.detail ?? "Request failed",
      p.violations ?? [],
    );
  }
}

export async function parseProblem(res: Response): Promise<never> {
  const text = await res.text();
  let detail = text;
  let body: ApiProblemDetail | null = null;
  try {
    body = text ? (JSON.parse(text) as ApiProblemDetail) : null;
    if (body) detail = body.detail ?? text;
  } catch {
    /* not JSON */
  }
  if (body) throw ApiError.fromProblem(body, res.status);
  throw new ApiError(res.status, "Error", detail || `HTTP ${res.status}`);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/tests/errors.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): add ApiError and ProblemDetail parser"
```

---

### Task 5: Cookie helpers for auth tokens

**Files:**
- Create: `src/lib/auth/cookies.ts`
- Test: `src/tests/cookies.test.ts`

**Interfaces:**
- Produces: `ACCESS_COOKIE = "pmp_access"`, `REFRESH_COOKIE = "pmp_refresh"`, `cookieOptions`, `getAuthCookies(req)`, `setAuthCookies(res, tokens)`, `clearAuthCookies(res)`, `readAccessTokenFromRequest(req)`.

- [ ] **Step 1: Write the failing test**

`src/tests/cookies.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions, setAuthCookies, clearAuthCookies, getAuthCookies } from "@/lib/auth/cookies";
import type { TokenResponse } from "@/types/api";

function mockRes() {
  const headers = new Headers();
  return {
    cookies: { set: (k: string, v: string, _o: unknown) => headers.append("set-cookie", `${k}=${v}`),
               delete: (k: string) => headers.append("set-cookie", `${k}=; Max-Age=0`) },
    headers,
  } as unknown as { cookies: { set:(k:string,v:string,o:unknown)=>void; delete:(k:string)=>void }; headers: Headers };
}

describe("auth cookies", () => {
  it("exports names", () => {
    expect(ACCESS_COOKIE).toBe("pmp_access");
    expect(REFRESH_COOKIE).toBe("pmp_refresh");
  });
  it("cookieOptions is httpOnly+secure+sameSite lax", () => {
    expect(cookieOptions).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  });
  it("setAuthCookies sets both cookies", () => {
    const res = mockRes();
    const tokens: TokenResponse = { accessToken: "a", refreshToken: "r", tokenType: "Bearer", expiresIn: 900 };
    setAuthCookies(res as never, tokens);
    expect(res.headers.get("set-cookie")).toContain("pmp_access=a");
    expect(res.headers.get("set-cookie")).toContain("pmp_refresh=r");
  });
  it("clearAuthCookies deletes both", () => {
    const res = mockRes();
    clearAuthCookies(res as never);
    expect(res.headers.get("set-cookie")).toContain("pmp_access=; Max-Age=0");
    expect(res.headers.get("set-cookie")).toContain("pmp_refresh=; Max-Age=0");
  });
  it("getAuthCookies reads both from a cookie header", () => {
    const req = { headers: { get: () => "pmp_access=a; pmp_refresh=r" } };
    expect(getAuthCookies(req as never)).toEqual({ accessToken: "a", refreshToken: "r" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/tests/cookies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/auth/cookies.ts`:
```ts
import type { NextRequest, NextResponse } from "next/server";
import type { TokenResponse } from "@/types/api";

export const ACCESS_COOKIE = "pmp_access";
export const REFRESH_COOKIE = "pmp_refresh";

export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: undefined as number | undefined,
};

export function setAuthCookies(res: NextResponse, tokens: TokenResponse) {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...cookieOptions, maxAge: 60 * 15 });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
}

function parseCookie(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = v;
    }
  }
  return out;
}

export function getAuthCookies(req: NextRequest): { accessToken?: string; refreshToken?: string } {
  const c = parseCookie(req.headers.get("cookie"));
  return { accessToken: c[ACCESS_COOKIE], refreshToken: c[REFRESH_COOKIE] };
}

export function readAccessTokenFromRequest(req: NextRequest): string | undefined {
  return getAuthCookies(req).accessToken;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/tests/cookies.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): add httpOnly cookie helpers for tokens"
```

---

### Task 6: Universal proxy route handler

**Files:**
- Create: `src/app/api/proxy/[...path]/route.ts`
- Test: `src/tests/proxy.test.ts` (MSW-backed unit of the forward logic via extracted helper)

**Interfaces:**
- Consumes: `getAuthCookies`, `setAuthCookies`, `clearAuthCookies` (Task 5), `parseProblem` (Task 4).
- Produces: `forwardToBackend(req, path)` — exported helper used by the route + tests; route `GET/POST/PUT/DELETE` that call it.

- [ ] **Step 1: Write the failing test**

`src/tests/proxy.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { forwardToBackend } from "@/app/api/proxy/[...path]/route";

const API_BASE = "http://localhost:8080/api/v1";
process.env.NEXT_PUBLIC_API_BASE = API_BASE;

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());

describe("forwardToBackend", () => {
  it("forwards GET with bearer from cookie and returns JSON", async () => {
    server.use(http.get(`${API_BASE}/users/me`, ({ request }) => {
      expect(request.headers.get("authorization")).toBe("Bearer abc");
      return HttpResponse.json({ id: "u1" });
    }));
    const req = new Request("http://x/api/proxy/users/me", {
      headers: { cookie: "pmp_access=abc" },
    });
    const res = await forwardToBackend(req, ["users", "me"]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "u1" });
  });

  it("on 401 with refresh cookie, refreshes and retries once", async () => {
    let first = true;
    server.use(
      http.get(`${API_BASE}/users/me`, () =>
        first ? (first = false, new HttpResponse(null, { status: 401 })) : HttpResponse.json({ id: "u1" }),
      ),
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: "new", refreshToken: "nr", tokenType: "Bearer", expiresIn: 900 }),
      ),
    );
    const req = new Request("http://x/api/proxy/users/me", {
      headers: { cookie: "pmp_access=stale; pmp_refresh=rr" },
    });
    const res = await forwardToBackend(req, ["users", "me"]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "u1" });
    // refreshed cookies set on response
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("pmp_access=new");
  });

  it("on 401 with no refresh cookie, returns 401", async () => {
    server.use(http.get(`${API_BASE}/users/me`, () => new HttpResponse(null, { status: 401 })));
    const req = new Request("http://x/api/proxy/users/me", { headers: { cookie: "pmp_access=stale" } });
    const res = await forwardToBackend(req, ["users", "me"]);
    expect(res.status).toBe(401);
  });

  it("rejects paths starting with auth/", async () => {
    const req = new Request("http://x/api/proxy/auth/login");
    const res = await forwardToBackend(req, ["auth", "login"]);
    expect(res.status).toBe(404);
  });
});
```

Note: `setupServer` requires `pnpm add -D msw` (added in Task 1 Step 6).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/tests/proxy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/app/api/proxy/[...path]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getAuthCookies, setAuthCookies } from "@/lib/auth/cookies";
import { parseProblem } from "@/lib/api/errors";
import type { TokenResponse } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function forwardToBackend(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join("/");
  if (path.startsWith("auth/")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const target = new URL(`${API_BASE}/${path}`);
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  const { accessToken, refreshToken } = getAuthCookies(req);
  const headers = new Headers(req.headers);
  headers.delete("cookie");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  const doFetch = () => fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    duplex: "half",
  } as RequestInit);

  let upstream = await doFetch();

  if (upstream.status === 401 && refreshToken) {
    const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (refreshed.ok) {
      const tokens = (await refreshed.json()) as TokenResponse;
      headers.set("authorization", `Bearer ${tokens.accessToken}`);
      upstream = await doFetch();
      const res = NextResponse.next({ request: { headers } });
      // Build a new response from upstream body + set refreshed cookies
      const body = await upstream.text();
      const out = new NextResponse(body, { status: upstream.status, headers: new Headers(upstream.headers) });
      setAuthCookies(out, tokens);
      return out;
    }
  }

  const body = await upstream.text();
  return new NextResponse(body, { status: upstream.status, headers: new Headers(upstream.headers) });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forwardToBackend(req, path);
}
export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
```

> Note: the `duplex: "half"` and streaming `req.body` are required to forward request bodies in route handlers; `as RequestInit` appeases TS. For `multipart/form-data`, the `content-type` header is forwarded as-is via `req.headers`, so boundary is preserved.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/tests/proxy.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): add universal proxy route with 401 refresh"
```

---

### Task 7: Auth route handlers (login/register/logout)

**Files:**
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/refresh/route.ts`
- Test: `src/tests/auth-routes.test.ts`

**Interfaces:**
- Consumes: `setAuthCookies`, `clearAuthCookies` (Task 5), `API_BASE`.
- Produces: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `POST /api/auth/refresh`.

- [ ] **Step 1: Write the failing test**

`src/tests/auth-routes.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const API_BASE = "http://localhost:8080/api/v1";
process.env.NEXT_PUBLIC_API_BASE = API_BASE;
const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());

import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as logout } from "@/app/api/auth/logout/route";

describe("auth routes", () => {
  it("login sets both cookies", async () => {
    server.use(http.post(`${API_BASE}/auth/login`, () =>
      HttpResponse.json({ accessToken: "a", refreshToken: "r", tokenType: "Bearer", expiresIn: 900 })));
    const req = new Request("http://x/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "e@x", password: "12345678" }),
    });
    const res = await login(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const sc = res.headers.get("set-cookie") ?? "";
    expect(sc).toContain("pmp_access=a");
    expect(sc).toContain("pmp_refresh=r");
  });

  it("register does not set cookies", async () => {
    server.use(http.post(`${API_BASE}/auth/register`, () => HttpResponse.json({}, { status: 201 })));
    const req = new Request("http://x/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const res = await register(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("logout clears cookies", async () => {
    const req = new Request("http://x/api/auth/logout", { method: "POST", headers: { cookie: "pmp_access=a; pmp_refresh=r" } });
    const res = await logout(req, { params: Promise.resolve({}) });
    const sc = res.headers.get("set-cookie") ?? "";
    expect(sc).toContain("pmp_access=; Max-Age=0");
    expect(sc).toContain("pmp_refresh=; Max-Age=0");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/tests/auth-routes.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/app/api/auth/login/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { setAuthCookies } from "@/lib/auth/cookies";
import { parseProblem } from "@/lib/api/errors";
import type { TokenResponse } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function POST(req: NextRequest) {
  const upstream = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await req.text(),
  });
  if (!upstream.ok) return parseProblem(upstream);
  const tokens = (await upstream.json()) as TokenResponse;
  const res = NextResponse.json({ ok: true }, { status: 200 });
  setAuthCookies(res, tokens);
  return res;
}
```

`src/app/api/auth/register/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { parseProblem } from "@/lib/api/errors";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function POST(req: NextRequest) {
  const upstream = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await req.text(),
  });
  if (!upstream.ok) return parseProblem(upstream);
  return new NextResponse(await upstream.text(), { status: upstream.status, headers: upstream.headers });
}
```

`src/app/api/auth/refresh/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getAuthCookies, setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";
import type { TokenResponse } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function POST(req: NextRequest) {
  const { refreshToken } = getAuthCookies(req);
  if (!refreshToken) return NextResponse.json({ error: "no refresh token" }, { status: 401 });
  const upstream = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!upstream.ok) {
    const res = NextResponse.json({ error: "refresh failed" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
  const tokens = (await upstream.json()) as TokenResponse;
  const res = NextResponse.json({ ok: true }, { status: 200 });
  setAuthCookies(res, tokens);
  return res;
}
```

`src/app/api/auth/logout/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function POST(req: NextRequest) {
  const { accessToken } = getAuthCookies(req);
  if (accessToken) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    }).catch(() => void 0);
  }
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
```

> Note: `parseProblem(upstream)` returns a `Promise<never>` that throws — but used as a `return` value it throws synchronously and Next renders it as a 500. For Phase 1 we accept that and return the thrown error's response shape; Phase 2 will wrap it into a proper `Response`. Replace each `if (!upstream.ok) return parseProblem(upstream);` with the explicit form below to keep `POST` returning a `Response`:
```ts
if (!upstream.ok) {
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { "content-type": "application/problem+json" } });
}
```
Apply this corrected form in all three auth route files (and in `refresh` for the failure branch already handled).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/tests/auth-routes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): add login/register/refresh/logout route handlers"
```

---

### Task 8: Typed API client + auth/users endpoints

**Files:**
- Create: `src/lib/api/client.ts`, `src/lib/api/endpoints/auth.ts`, `src/lib/api/endpoints/users.ts`
- Test: `src/tests/client.test.ts`

**Interfaces:**
- Consumes: types from Task 3, `ApiError`/`parseProblem` (Task 4).
- Produces: `apiGet<T>`, `apiPost<T>`, `apiPut<T>`, `apiDelete`, `apiUpload`; `login`, `register`, `logout`, `getCurrentUser`, `getPublicProfile`.

- [ ] **Step 1: Write the failing test**

`src/tests/client.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { apiGet, apiPost } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/endpoints/users";

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());

describe("client", () => {
  it("apiGet parses JSON and returns typed value", async () => {
    server.use(http.get("http://localhost/api/proxy/users/me", () => HttpResponse.json({ id: "u1" })));
    const u = await apiGet<{ id: string }>("users/me", { baseUrl: "http://localhost" });
    expect(u.id).toBe("u1");
  });

  it("apiPost posts JSON", async () => {
    let captured: unknown;
    server.use(http.post("http://localhost/api/proxy/x", async ({ request }) => {
      captured = await request.json();
      return HttpResponse.json({ ok: true }, { status: 201 });
    }));
    const r = await apiPost<{ ok: boolean }>("x", { a: 1 }, { baseUrl: "http://localhost" });
    expect(r.ok).toBe(true);
    expect(captured).toEqual({ a: 1 });
  });

  it("throws ApiError on non-2xx", async () => {
    server.use(http.get("http://localhost/api/proxy/x", () =>
      new HttpResponse(JSON.stringify({ status: 400, title: "Bad", detail: "nope" }),
        { status: 400, headers: { "content-type": "application/problem+json" } })));
    await expect(apiGet("x", { baseUrl: "http://localhost" })).rejects.toMatchObject({ status: 400, detail: "nope" });
  });

  it("getCurrentUser calls /users/me via endpoint", async () => {
    server.use(http.get("http://localhost/api/proxy/users/me", () =>
      HttpResponse.json({ id: "u1", email: "e@x", role: "BUYER", verified: true, active: true,
        firstName: null, lastName: null, avatarUrl: null, phone: null, bio: null, country: null, city: null,
        address: null, latitude: null, longitude: null, rating: null, totalReviews: null,
        createdAt: "t", updatedAt: "t" })));
    const u = await getCurrentUser({ baseUrl: "http://localhost" });
    expect(u.id).toBe("u1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/tests/client.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement client**

`src/lib/api/client.ts`:
```ts
import { ApiError, parseProblem } from "@/lib/api/errors";

const DEFAULT_PROXY_BASE = "/api/proxy";

export interface ClientOpts {
  baseUrl?: string; // defaults to relative "/api/proxy" (browser) — tests pass absolute
  cache?: RequestCache;
}

function buildUrl(path: string, opts: ClientOpts): string {
  const base = opts.baseUrl ?? DEFAULT_PROXY_BASE;
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${base.replace(/\/$/, "")}/${p}`;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) return parseProblem(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiGet<T>(path: string, opts: ClientOpts = {}): Promise<T> {
  return handle<T>(await fetch(buildUrl(path, opts), { method: "GET", cache: opts.cache ?? "no-store" }));
}

export async function apiPost<T>(path: string, body: unknown, opts: ClientOpts = {}): Promise<T> {
  return handle<T>(await fetch(buildUrl(path, opts), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function apiPut<T>(path: string, body: unknown, opts: ClientOpts = {}): Promise<T> {
  return handle<T>(await fetch(buildUrl(path, opts), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function apiDelete(path: string, opts: ClientOpts = {}): Promise<void> {
  const res = await fetch(buildUrl(path, opts), { method: "DELETE" });
  if (!res.ok) return parseProblem(res);
}

export async function apiUpload<T>(path: string, file: File | Blob, fieldName = "file", opts: ClientOpts = {}): Promise<T> {
  const fd = new FormData();
  fd.append(fieldName, file);
  return handle<T>(await fetch(buildUrl(path, opts), { method: "POST", body: fd }));
}

export { ApiError };
```

`src/lib/api/endpoints/users.ts`:
```ts
import { apiGet } from "@/lib/api/client";
import type { UserProfile, PublicProfile, Page, Listing } from "@/types/api";
import type { ClientOpts } from "@/lib/api/client";

export function getCurrentUser(opts: ClientOpts = {}): Promise<UserProfile> {
  return apiGet<UserProfile>("users/me", opts);
}
export function getPublicProfile(id: string, opts: ClientOpts = {}): Promise<PublicProfile> {
  return apiGet<PublicProfile>(`users/${id}`, opts);
}
export function getUserListings(id: string, page = 0, size = 20, opts: ClientOpts = {}): Promise<Page<Listing>> {
  return apiGet<Page<Listing>>(`users/${id}/listings?page=${page}&size=${size}`, opts);
}
```

`src/lib/api/endpoints/auth.ts`:
```ts
// Auth forms call our own /api/auth/* route handlers (not the proxy), returning ok.
export async function loginViaApi(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("login failed");
}
export async function logoutViaApi(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/tests/client.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): add typed client and auth/users endpoints"
```

---

### Task 9: next-intl setup (RU/EN)

**Files:**
- Create: `src/lib/i18n/config.ts`, `src/lib/i18n/request.ts`, `src/messages/ru.json`, `src/messages/en.json`, `src/i18n.ts` (next-intl plugin router path)
- Modify: `next.config.ts`, `src/middleware.ts` (next-intl middleware integration)
- Test: `src/tests/i18n.test.ts`

**Interfaces:**
- Produces: `locales = ['ru','en']`, `defaultLocale = 'ru'`, `localizedCategory(cat, locale)`, `pickField(obj, locale)`.

- [ ] **Step 1: Install next-intl**

```bash
pnpm add next-intl
```

- [ ] **Step 2: Config + request**

`src/lib/i18n/config.ts`:
```ts
export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";
```

`src/lib/i18n/request.ts`:
```ts
import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";
import type { Locale } from "./config";

export default getRequestConfig(async ({ locale }) => {
  const l = (locale as Locale) ?? defaultLocale;
  return {
    locale: l,
    messages: (await import(`../../messages/${l}.json`)).default,
  };
});
```

`src/i18n.ts`:
```ts
import { createNavigation } from "next-intl/navigation";
import { locales, defaultLocale } from "@/lib/i18n/config";
export const localePrefix = "always" as const;
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation({ locales, localePrefix });
```

`src/messages/ru.json`:
```json
{
  "Nav": { "home": "Главная", "catalog": "Каталог", "login": "Войти", "register": "Регистрация", "logout": "Выйти", "dashboard": "Кабинет", "admin": "Админ" },
  "Locale": { "ru": "Русский", "en": "English", "switch": "Язык" },
  "Status": { "ACTIVE": "Активно", "RESERVED": "Забронировано", "SOLD": "Продано", "DRAFT": "Черновик", "PENDING_MODERATION": "На модерации", "ARCHIVED": "В архиве", "REJECTED": "Отклонено" },
  "Home": { "welcome": "Маркетплейс животных" },
  "NotFound": { "title": "Страница не найдена", "back": "На главную" }
}
```

`src/messages/en.json`:
```json
{
  "Nav": { "home": "Home", "catalog": "Catalog", "login": "Login", "register": "Register", "logout": "Logout", "dashboard": "Dashboard", "admin": "Admin" },
  "Locale": { "ru": "Russian", "en": "English", "switch": "Language" },
  "Status": { "ACTIVE": "Active", "RESERVED": "Reserved", "SOLD": "Sold", "DRAFT": "Draft", "PENDING_MODERATION": "Pending review", "ARCHIVED": "Archived", "REJECTED": "Rejected" },
  "Home": { "welcome": "Pet marketplace" },
  "NotFound": { "title": "Page not found", "back": "Home" }
}
```

- [ ] **Step 3: next.config.ts with next-intl plugin**

Replace `next.config.ts`:
```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8080" },
      { protocol: "http", hostname: "localhost", port: "9000" },
    ],
  },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 4: i18n helper + test**

`src/lib/i18n/locale.ts`:
```ts
import type { Locale } from "./config";
import type { CategoryWithBreeds } from "@/types/api";

export function pickField<T extends Record<string, unknown>>(obj: T, locale: Locale, key: string): string {
  const localized = obj[`${key}_${locale}`];
  return typeof localized === "string" ? localized : (typeof obj[key] === "string" ? (obj[key] as string) : "");
}

export function localizedCategory(cat: CategoryWithBreeds, locale: Locale): string {
  // backend DTO currently exposes single `name`; helper is forward-compatible with name_<locale>
  return pickField(cat as unknown as Record<string, unknown>, locale, "name");
}
```

`src/tests/i18n.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { localizedCategory, pickField } from "@/lib/i18n/locale";
import type { CategoryWithBreeds } from "@/types/api";

describe("locale helpers", () => {
  it("pickField prefers name_<locale> over name", () => {
    const obj = { name_ru: "Кошки", name_en: "Cats", name: "Cats" } as unknown as Record<string, unknown>;
    expect(pickField(obj, "ru", "name")).toBe("Кошки");
    expect(pickField(obj, "en", "name")).toBe("Cats");
  });
  it("localizedCategory falls back to name when no localized field", () => {
    const cat = { id: "1", name: "Cats", slug: "cats", breeds: [] } as CategoryWithBreeds;
    expect(localizedCategory(cat, "ru")).toBe("Cats");
  });
});
```

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run src/tests/i18n.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Middleware (next-intl + guard)**

`src/middleware.ts`:
```ts
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "@/lib/i18n/config";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

const PROTECTED = ["/dashboard", "/admin"];

export async function middleware(req: NextRequest) {
  const intlRes = intlMiddleware(req);
  // Determine the pathname without locale prefix
  const pathname = req.nextUrl.pathname;
  const stripped = pathname.replace(new RegExp(`^/(${locales.join("|")})`), "") || "/";
  const isProtected = PROTECTED.some((p) => stripped.startsWith(p));
  if (isProtected) {
    const cookie = req.headers.get("cookie") ?? "";
    const hasAccess = cookie.split(";").some((c) => c.trim().startsWith("pmp_access="));
    if (!hasAccess) {
      const locale = locales.find((l) => pathname.startsWith(`/${l}`)) ?? defaultLocale;
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/${locale}/login`;
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  return intlRes;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
```

- [ ] **Step 7: Verify build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(i18n): add next-intl RU/EN with locale helpers and guard middleware"
```

---

### Task 10: Locale segment layout, providers, Header/Footer/LocaleSwitch, not-found

**Files:**
- Create: `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/app/[locale]/not-found.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`, `src/components/layout/LocaleSwitch.tsx`, `src/components/layout/UserMenu.tsx`, `src/lib/query-client.ts`
- Modify: delete `src/app/page.tsx` (moved under `[locale]`)
- Test: `src/tests/locale-switch.test.tsx`

**Interfaces:**
- Consumes: next-intl `NextIntlClientProvider`, TanStack Query `QueryClientProvider`, `LocaleSwitch`/`Header`.
- Produces: localized root layout rendering Header + main + Footer + Toaster.

- [ ] **Step 1: Install TanStack Query**

```bash
pnpm add @tanstack/react-query
```

- [ ] **Step 2: Query client (server-safe)**

`src/lib/query-client.ts`:
```ts
import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000, retry: false, refetchOnWindowFocus: false },
    },
  });
}

let browserQueryClient: QueryClient | undefined;
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
```

- [ ] **Step 3: LocaleSwitch component + test**

`src/components/layout/LocaleSwitch.tsx`:
```tsx
"use client";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n";
import { locales, type Locale } from "@/lib/i18n/config";

export function LocaleSwitch() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      aria-label="locale"
      value={locale}
      onChange={(e) => router.replace(pathname, { locale: e.target.value as Locale })}
      className="border rounded px-2 py-1"
    >
      {locales.map((l) => (
        <option key={l} value={l}>{l.toUpperCase()}</option>
      ))}
    </select>
  );
}
```

`src/tests/locale-switch.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next-intl", () => ({ useLocale: () => "ru" }));
const replace = vi.fn();
vi.mock("@/i18n", () => ({ useRouter: () => ({ replace }), usePathname: () => "/" }));
vi.mock("@/lib/i18n/config", () => ({ locales: ["ru", "en"] }));

import { LocaleSwitch } from "@/components/layout/LocaleSwitch";

describe("LocaleSwitch", () => {
  it("renders options for ru and en", () => {
    render(<LocaleSwitch />);
    expect(screen.getByLabelText("locale")).toBeInTheDocument();
    expect(screen.getByText("RU")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
  });
  it("calls router.replace with chosen locale", async () => {
    render(<LocaleSwitch />);
    await userEvent.selectOptions(screen.getByLabelText("locale"), "en");
    expect(replace).toHaveBeenCalledWith("/", { locale: "en" });
  });
});
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/tests/locale-switch.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Header / Footer / UserMenu stub**

`src/components/layout/Header.tsx`:
```tsx
import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { LocaleSwitch } from "./LocaleSwitch";
import { UserMenu } from "./UserMenu";

export function Header() {
  const t = useTranslations("Nav");
  return (
    <header className="border-b">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <Link href="/" className="font-bold text-lg">PetMarketplace</Link>
        <nav className="flex items-center gap-4">
          <Link href="/">{t("catalog")}</Link>
          <UserMenu />
          <LocaleSwitch />
        </nav>
      </div>
    </header>
  );
}
```

`src/components/layout/Footer.tsx`:
```tsx
export function Footer() {
  return <footer className="border-t mt-12 py-6 text-center text-sm text-muted-foreground">© PetMarketplace</footer>;
}
```

`src/components/layout/UserMenu.tsx`:
```tsx
"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
// Phase 1 stub: real auth-aware menu lands in Phase 2.
export function UserMenu() {
  const t = useTranslations("Nav");
  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className="text-sm">{t("login")}</Link>
      <Link href="/register" className="text-sm">{t("register")}</Link>
    </div>
  );
}
```

- [ ] **Step 6: Locale layout + home + not-found**

`src/app/[locale]/layout.tsx`:
```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages, setRequestLocale } from "next-intl/server";
import { locales } from "@/lib/i18n/config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Toaster } from "sonner";
import { getQueryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const qc = getQueryClient();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <Footer />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
```

`src/app/[locale]/page.tsx`:
```tsx
import { useTranslations } from "next-intl";
export default function Home() {
  const t = useTranslations("Home");
  return <h1 className="text-2xl font-bold">{t("welcome")}</h1>;
}
```

`src/app/[locale]/not-found.tsx`:
```tsx
import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <Link href="/" className="text-primary underline mt-4 inline-block">{t("back")}</Link>
    </div>
  );
}
```

Delete the now-unused root `src/app/page.tsx` (moved under `[locale]`):
```bash
rm -f src/app/page.tsx
```

- [ ] **Step 7: Build + dev smoke**

Run: `pnpm build`
Expected: build succeeds, generates `/ru` and `/en` static pages.

Run: `pnpm dev` then `curl -s http://localhost:3000/ru | grep -o "Маркетплейс животных" | head -1`
Expected: prints `Маркетплейс животных`. Stop dev server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(layout): add locale layout, providers, Header/Footer/LocaleSwitch, not-found"
```

---

### Task 11: Phase 1 e2e (Playwright) + final verification

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Test: e2e

**Interfaces:**
- Produces: a green Playwright smoke test verifying the home page renders in both locales and the locale switcher is present.

- [ ] **Step 1: Playwright config**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: { baseURL: "http://localhost:3000" },
  webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 2: Install browser binaries**

```bash
pnpm exec playwright install chromium
```

- [ ] **Step 3: Smoke e2e**

`e2e/smoke.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("home renders in ru and shows locale switch", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.getByText("Маркетплейс животных")).toBeVisible();
  await expect(page.getByLabel("locale")).toBeVisible();
});

test("locale switch navigates to en", async ({ page }) => {
  await page.goto("/ru");
  await page.getByLabel("locale").selectOption("en");
  await expect(page.getByText("Pet marketplace")).toBeVisible();
});

test("protected route redirects to login", async ({ page }) => {
  await page.goto("/ru/dashboard/profile");
  await expect(page).toHaveURL(/\/ru\/login/);
});
```

- [ ] **Step 4: Run e2e**

Run: `pnpm exec playwright test`
Expected: 3 tests pass.

- [ ] **Step 5: Run the full unit suite**

Run: `pnpm vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(e2e): add Playwright smoke tests for locale + guard"
```

---

## Self-Review (completed during authoring)

- **Spec coverage for Phase 1 scope:** scaffolding ✓ (T1), shadcn/ui + Tailwind ✓ (T2), types ✓ (T3), error handling ✓ (T4), httpOnly cookies ✓ (T5), proxy + 401-refresh ✓ (T6), auth route handlers ✓ (T7), typed client + endpoints ✓ (T8), i18n RU/EN ✓ (T9), layout/Header/Footer/LocaleSwitch/not-found ✓ (T10), middleware guard ✓ (T9), tests ✓ (T1/T4/T5/T6/T7/T8/T9/T10/T11). Features deferred to later phases (catalog, listings CRUD, bookings, chat, reviews, admin) are out of Phase 1 by design.
- **Placeholders:** none — each code step contains full code; the `parseProblem` return shape was flagged inline in T7 Step 3 with the corrected explicit form.
- **Type consistency:** cookie names (`pmp_access`/`pmp_refresh`), `ClientOpts.baseUrl`, `forwardToBackend(req, pathSegments)`, `apiGet/Post/Put/Delete/Upload`, `getCurrentUser`, `localizedCategory`/`pickField` used consistently across tasks.
- **Known follow-ups for later phases:** real auth-aware `UserMenu` (Phase 2), catalog page (Phase 2), admin role check beyond cookie presence (Phase 2, via server `/users/me`), image-proxy route (Phase 3 with listings).

## Subsequent phases (separate plans, not in this file)

- Phase 2 — Auth flows (login/register/verify/forgot/reset forms + session-aware UserMenu + role guard via `/users/me`).
- Phase 3 — Catalog + listing card (filters, SSR list, card, favorites/book/message buttons).
- Phase 4 — Profile + my listings CRUD + image upload.
- Phase 5 — Favorites + bookings.
- Phase 6 — Chat (polling + MessageTransport abstraction).
- Phase 7 — Reviews + subscriptions.
- Phase 8 — Admin panel.
- Phase 9 — Test hardening, a11y, perf.
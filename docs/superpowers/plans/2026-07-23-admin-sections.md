# Admin Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four 404 placeholder admin sections (`/admin/users`, `/admin/listings/pending`, `/admin/reviews/pending`, `/admin/statistics`) with working, tested pages over the backend `AdminController` API.

**Architecture:** All pages are `"use client"` (consistent with the existing `(dashboard)`/`(admin)` pages) and reach the backend through the existing `/api/proxy/*` handler (no new route handlers). Data via TanStack Query; mutations invalidate list queries. Shared hand-authored shadcn-v3 primitives + admin components in `src/components/`. Statistics uses `recharts`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict (`noUncheckedIndexedAccess`), next-intl (RU/EN), TanStack Query, Tailwind 3.4 + hand-authored shadcn v3, react-hook-form + zod, sonner toasts, `@radix-ui/react-dialog` (new), `recharts` (new), Vitest + RTL + MSW, Playwright.

## Global Constraints

- Package manager is **pnpm**. Add deps with `pnpm add`.
- Tokens live ONLY in httpOnly cookies; client code MUST call `${origin}/api/proxy/<path>` via `src/lib/api/client.ts` — never `${API_BASE}` directly from client.
- i18n: every user-facing string must exist in BOTH `src/messages/ru.json` and `src/messages/en.json`, AND be added to the key list in `src/tests/messages.test.ts`, or `pnpm test` breaks.
- Locale-aware router (`@/i18n` `Link`/`useRouter`) auto-prepends locale — pass BARE paths (`/admin/users`, not `/ru/admin/users`).
- Client-component searchParams: read from `window.location.search` (sync) — do NOT use `React.use(promise)` (suspends under jsdom). Test supplies a Promise prop resolved via `useEffect`+`useState` (see `login/page.tsx`).
- `noUncheckedIndexedAccess` is on — guard indexed access (`arr[0]`, `match[1]`) with truthy checks.
- shadcn primitives are hand-authored v3 (Tailwind 3.4 + `tailwindcss-animate`); match the style of existing `src/components/ui/button.tsx` / `card.tsx`.
- Pre-merge gate: `pnpm test && pnpm tsc --noEmit && pnpm build && pnpm exec playwright test`.
- **i18n deviation from spec (approved):** spec said `Admin.status.*`; implementation instead extends the existing flat top-level `Status` namespace (already present in both locale files, unused elsewhere) with ALL enum values (listing + booking + review + role). `StatusBadge` does a single `t(`Status.${value}`)` lookup. Overlapping keys (`REJECTED`, `PENDING`) share one label — intentional and correct.

---

## File Structure

**Create:**
- `src/lib/api/endpoints/admin.ts` — admin API functions.
- `src/components/ui/badge.tsx` — variant `<span>`.
- `src/components/ui/select.tsx` — styled native `<select>`.
- `src/components/ui/dialog.tsx` — radix-dialog wrapper.
- `src/components/ui/textarea.tsx` — styled `<textarea>` (used by reason field).
- `src/components/admin/StatusBadge.tsx` — enum→badge label+variant.
- `src/components/admin/EmptyState.tsx` — empty/loading placeholder.
- `src/components/admin/Pagination.tsx` — page controls from `Page<T>`.
- `src/components/admin/DataTable.tsx` — generic table.
- `src/components/admin/ConfirmModerationDialog.tsx` — approve/reject + reason dialog.
- `src/components/admin/useDebouncedValue.ts` — debounce hook (users filter).
- `src/app/[locale]/(admin)/admin/users/page.tsx`
- `src/app/[locale]/(admin)/admin/listings/pending/page.tsx`
- `src/app/[locale]/(admin)/admin/reviews/pending/page.tsx`
- `src/app/[locale]/(admin)/admin/statistics/page.tsx`
- `src/tests/admin-endpoints.test.ts`
- `src/tests/admin-primitives.test.tsx`
- `src/tests/admin-users-page.test.tsx`
- `src/tests/admin-listings-pending.test.tsx`
- `src/tests/admin-reviews-pending.test.tsx`
- `src/tests/admin-statistics.test.tsx`
- `e2e/admin.spec.ts`

**Modify:**
- `src/types/api.ts` — add admin types.
- `src/lib/api/client.ts` — add `headers?` to `ClientOpts`.
- `src/messages/ru.json`, `src/messages/en.json` — extend `Status`, add `Admin.*` sub-keys; remove `Admin.comingSoon` usage (keep key or remove — remove to keep tidy, update `messages.test.ts`).
- `src/tests/messages.test.ts` — add new keys.
- `src/app/[locale]/(admin)/admin/page.tsx` — drop `comingSoon` line.
- `package.json` — add `@radix-ui/react-dialog`, `recharts`.

---

### Task 1: Admin types + client headers + admin endpoints

**Files:**
- Modify: `src/types/api.ts` (append before `ApiProblemDetail`)
- Modify: `src/lib/api/client.ts` (`ClientOpts`, `apiGet`, `apiPost`, `apiPut`, `apiDelete`, `apiUpload`)
- Create: `src/lib/api/endpoints/admin.ts`
- Test: `src/tests/admin-endpoints.test.ts`

**Interfaces:**
- Produces: `AdminUser`, `AdminStatistics`, `UserStatusUpdate`, `UserRoleUpdate`, `ListingModerate`, `ReviewModerate` types; `ClientOpts.headers`; `getAdminUsers`, `updateUserStatus`, `updateUserRole`, `getPendingListings`, `moderateListing`, `getPendingReviews`, `moderateReview`, `getStatistics` functions.

- [ ] **Step 1: Write the failing test**

`src/tests/admin-endpoints.test.ts`:
```ts
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  getAdminUsers, updateUserStatus, updateUserRole,
  getPendingListings, moderateListing, getPendingReviews, moderateReview, getStatistics,
} from "@/lib/api/endpoints/admin";

const calls: { method: string; url: string; body?: string; headers: Record<string, string> }[] = [];
const server = setupServer(
  http.get("*/api/proxy/admin/users", ({ request }) => {
    calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true, empty: true });
  }),
  http.put("*/api/proxy/admin/users/:id/status", async ({ request, params }) => {
    calls.push({ method: "PUT", url: `users/${params.id}/status`, body: await request.text(), headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ id: params.id, email: "a@b.co", role: "BUYER", verified: true, active: false, createdAt: "t", updatedAt: "t" });
  }),
  http.put("*/api/proxy/admin/users/:id/role", async ({ request, params }) => {
    calls.push({ method: "PUT", url: `users/${params.id}/role`, body: await request.text(), headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ id: params.id, email: "a@b.co", role: "ADMIN", verified: true, active: true, createdAt: "t", updatedAt: "t" });
  }),
  http.get("*/api/proxy/admin/listings/pending", ({ request }) => {
    calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true, empty: true });
  }),
  http.put("*/api/proxy/admin/listings/:id/moderate", async ({ request, params }) => {
    calls.push({ method: "PUT", url: `listings/${params.id}/moderate`, body: await request.text(), headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ id: params.id, status: "ACTIVE" });
  }),
  http.get("*/api/proxy/admin/reviews/pending", ({ request }) => {
    calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true, empty: true });
  }),
  http.put("*/api/proxy/admin/reviews/:id/moderate", async ({ request, params }) => {
    calls.push({ method: "PUT", url: `reviews/${params.id}/moderate`, body: await request.text(), headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ id: params.id, status: "APPROVED" });
  }),
  http.get("*/api/proxy/admin/statistics", ({ request }) => {
    calls.push({ method: "GET", url: request.url, headers: Object.fromEntries(request.headers) });
    return HttpResponse.json({ totalUsers: 5, activeUsers: 3, listingsByStatus: {}, bookingsByStatus: {}, reviewsByStatus: {}, listingsCreatedToday: 1, listingsCreatedThisWeek: 2, listingsCreatedThisMonth: 4 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { calls.length = 0; server.resetHandlers(); });
afterAll(() => server.close());

describe("admin endpoints", () => {
  it("builds users query skipping null params", async () => {
    await getAdminUsers({ role: "ADMIN", active: true, verified: null, search: "ab", page: 1, size: 20 }, { baseUrl: "http://x" });
    const u = new URL(calls[0]!.url);
    expect(u.searchParams.get("role")).toBe("ADMIN");
    expect(u.searchParams.get("active")).toBe("true");
    expect(u.searchParams.get("verified")).toBeNull();
    expect(u.searchParams.get("search")).toBe("ab");
    expect(u.searchParams.get("page")).toBe("1");
    expect(u.searchParams.get("size")).toBe("20");
  });

  it("updateUserStatus sends PUT body", async () => {
    const r = await updateUserStatus("u1", { active: false, reason: "spam" }, { baseUrl: "http://x" });
    expect(r.active).toBe(false);
    expect(calls[0]!.body).toBe(JSON.stringify({ active: false, reason: "spam" }));
  });

  it("updateUserRole sends PUT body", async () => {
    const r = await updateUserRole("u1", { role: "ADMIN" }, { baseUrl: "http://x" });
    expect(r.role).toBe("ADMIN");
    expect(calls[0]!.body).toBe(JSON.stringify({ role: "ADMIN" }));
  });

  it("getPendingListings sends Accept-Language", async () => {
    await getPendingListings(0, 10, "en", { baseUrl: "http://x" });
    expect(calls[0]!.headers["accept-language"]).toBe("en");
  });

  it("moderateListing sends body + Accept-Language", async () => {
    const r = await moderateListing("l1", { status: "REJECTED", reason: "no" }, "ru", { baseUrl: "http://x" });
    expect(r.status).toBe("ACTIVE");
    expect(calls[0]!.body).toBe(JSON.stringify({ status: "REJECTED", reason: "no" }));
    expect(calls[0]!.headers["accept-language"]).toBe("ru");
  });

  it("getPendingReviews + moderateReview", async () => {
    await getPendingReviews(0, 10, { baseUrl: "http://x" });
    expect(calls[0]!.url).toContain("page=0");
    const r = await moderateReview("r1", { status: "APPROVED" }, { baseUrl: "http://x" });
    expect(r.status).toBe("APPROVED");
    expect(calls[1]!.body).toBe(JSON.stringify({ status: "APPROVED" }));
  });

  it("getStatistics", async () => {
    const s = await getStatistics({ baseUrl: "http://x" });
    expect(s.totalUsers).toBe(5);
    expect(s.listingsCreatedThisMonth).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/admin-endpoints.test.ts`
Expected: FAIL — `@/lib/api/endpoints/admin` module not found.

- [ ] **Step 3: Add types to `src/types/api.ts`**

Append before `ApiProblemDetail`:
```ts
export interface AdminUser {
  id: UUID;
  email: string;
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

export interface AdminStatistics {
  totalUsers: number;
  activeUsers: number;
  listingsByStatus: Partial<Record<ListingStatus, number>>;
  bookingsByStatus: Partial<Record<BookingStatus, number>>;
  reviewsByStatus: Partial<Record<ReviewStatus, number>>;
  listingsCreatedToday: number;
  listingsCreatedThisWeek: number;
  listingsCreatedThisMonth: number;
}

export interface UserStatusUpdate { active: boolean; reason?: string; }
export interface UserRoleUpdate { role: Role; }
export interface ListingModerate { status: "ACTIVE" | "REJECTED"; reason?: string; }
export interface ReviewModerate { status: "APPROVED" | "REJECTED"; reason?: string; }
```

- [ ] **Step 4: Add `headers?` to `ClientOpts` in `src/lib/api/client.ts`**

Replace the `ClientOpts` interface and the five fetch call sites so custom headers merge in. New file body:
```ts
import { ApiError, parseProblem } from "@/lib/api/errors";

const DEFAULT_PROXY_BASE = "/api/proxy";

export interface ClientOpts {
  baseUrl?: string; // defaults to relative "/api/proxy" (browser) — tests pass absolute
  cache?: RequestCache;
  headers?: Record<string, string>;
}

function buildUrl(path: string, opts: ClientOpts): string {
  const origin = (opts.baseUrl ?? "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${origin}${DEFAULT_PROXY_BASE}/${p}`;
}

function reqHeaders(opts: ClientOpts, json = false): Record<string, string> {
  const h: Record<string, string> = { ...(opts.headers ?? {}) };
  if (json) h["content-type"] = "application/json";
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) return parseProblem(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiGet<T>(path: string, opts: ClientOpts = {}): Promise<T> {
  return handle<T>(await fetch(buildUrl(path, opts), { method: "GET", cache: opts.cache ?? "no-store", headers: reqHeaders(opts) }));
}

export async function apiPost<T>(path: string, body: unknown, opts: ClientOpts = {}): Promise<T> {
  return handle<T>(await fetch(buildUrl(path, opts), { method: "POST", headers: reqHeaders(opts, true), body: JSON.stringify(body) }));
}

export async function apiPut<T>(path: string, body: unknown, opts: ClientOpts = {}): Promise<T> {
  return handle<T>(await fetch(buildUrl(path, opts), { method: "PUT", headers: reqHeaders(opts, true), body: JSON.stringify(body) }));
}

export async function apiDelete(path: string, opts: ClientOpts = {}): Promise<void> {
  const res = await fetch(buildUrl(path, opts), { method: "DELETE", headers: reqHeaders(opts) });
  if (!res.ok) return parseProblem(res);
}

export async function apiUpload<T>(path: string, file: File | Blob, fieldName = "file", opts: ClientOpts = {}): Promise<T> {
  const fd = new FormData();
  fd.append(fieldName, file);
  return handle<T>(await fetch(buildUrl(path, opts), { method: "POST", headers: opts.headers ?? {}, body: fd }));
}

export { ApiError };
```

- [ ] **Step 5: Create `src/lib/api/endpoints/admin.ts`**

```ts
import { apiGet, apiPut, type ClientOpts } from "@/lib/api/client";
import type {
  AdminUser, AdminStatistics, Listing, Review, Page,
  UserStatusUpdate, UserRoleUpdate, ListingModerate, ReviewModerate, Role,
} from "@/types/api";
import type { Locale } from "@/lib/i18n/config";

export interface AdminUsersParams {
  role?: Role | null;
  active?: boolean | null;
  verified?: boolean | null;
  search?: string | null;
  page?: number;
  size?: number;
}

function withQuery(base: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `${base}?${q}` : base;
}

export function getAdminUsers(params: AdminUsersParams, opts: ClientOpts = {}): Promise<Page<AdminUser>> {
  return apiGet<Page<AdminUser>>(withQuery("admin/users", {
    role: params.role ?? null,
    active: params.active ?? null,
    verified: params.verified ?? null,
    search: params.search ?? null,
    page: params.page ?? 0,
    size: params.size ?? 10,
  }), opts);
}

export function updateUserStatus(id: string, body: UserStatusUpdate, opts: ClientOpts = {}): Promise<AdminUser> {
  return apiPut<AdminUser>(`admin/users/${id}/status`, body, opts);
}

export function updateUserRole(id: string, body: UserRoleUpdate, opts: ClientOpts = {}): Promise<AdminUser> {
  return apiPut<AdminUser>(`admin/users/${id}/role`, body, opts);
}

export function getPendingListings(page: number, size: number, locale: Locale, opts: ClientOpts = {}): Promise<Page<Listing>> {
  return apiGet<Page<Listing>>(withQuery("admin/listings/pending", { page, size }), { ...opts, headers: { "accept-language": locale, ...(opts.headers ?? {}) } });
}

export function moderateListing(id: string, body: ListingModerate, locale: Locale, opts: ClientOpts = {}): Promise<Listing> {
  return apiPut<Listing>(`admin/listings/${id}/moderate`, body, { ...opts, headers: { "accept-language": locale, ...(opts.headers ?? {}) } });
}

export function getPendingReviews(page: number, size: number, opts: ClientOpts = {}): Promise<Page<Review>> {
  return apiGet<Page<Review>>(withQuery("admin/reviews/pending", { page, size }), opts);
}

export function moderateReview(id: string, body: ReviewModerate, opts: ClientOpts = {}): Promise<Review> {
  return apiPut<Review>(`admin/reviews/${id}/moderate`, body, opts);
}

export function getStatistics(opts: ClientOpts = {}): Promise<AdminStatistics> {
  return apiGet<AdminStatistics>("admin/statistics", opts);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/tests/admin-endpoints.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add src/types/api.ts src/lib/api/client.ts src/lib/api/endpoints/admin.ts src/tests/admin-endpoints.test.ts
git commit -m "feat(admin): add admin API endpoints + client headers option"
```

---

### Task 2: UI primitives — badge, select, dialog, textarea

**Files:**
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/dialog.tsx`
- Test: `src/tests/admin-primitives.test.tsx`

**Interfaces:**
- Produces: `Badge` + `badgeVariants` (variants: `default|secondary|destructive|outline|success|warning`); `Select` (native, props extend `React.SelectHTMLAttributes<HTMLSelectElement>`); `Textarea`; `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` (radix-based, controlled via `open`/`onOpenChange`).

- [ ] **Step 1: Install radix-dialog**

Run: `pnpm add @radix-ui/react-dialog`
Expected: package added to `dependencies`.

- [ ] **Step 2: Write the failing test**

`src/tests/admin-primitives.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge, Select, Textarea, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/__all";
import { Button } from "@/components/ui/button";

describe("Badge", () => {
  it("renders variant class", () => {
    const { container } = render(<Badge variant="destructive">X</Badge>);
    expect(container.firstChild).toHaveClass("bg-destructive");
  });
});

describe("Select", () => {
  it("renders options and fires onChange", async () => {
    let v = "";
    render(
      <Select value={v} onChange={(e) => { v = e.target.value; }} data-testid="s">
        <option value="">all</option>
        <option value="ADMIN">admin</option>
      </Select>,
    );
    await userEvent.setup().selectOptions(screen.getByTestId("s"), "ADMIN");
    expect(v).toBe("ADMIN");
  });
});

describe("Textarea", () => {
  it("binds value", () => {
    render(<Textarea value="hi" readOnly data-testid="t" />);
    expect(screen.getByTestId("t")).toHaveValue("hi");
  });
});

describe("Dialog", () => {
  it("shows content when open and closes on cancel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog open={true} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button>Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

(Note: the test imports from a barrel `@/components/ui/__all` — create that too, OR adjust imports to the individual files. Use individual-file imports to avoid a barrel; replace the import line with:
```tsx
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
```
and add `import { vi } from "vitest";`.)

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/tests/admin-primitives.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Create `src/components/ui/badge.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-emerald-500 text-white",
        warning: "border-transparent bg-amber-500 text-white",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
```

- [ ] **Step 5: Create `src/components/ui/select.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
```

- [ ] **Step 6: Create `src/components/ui/textarea.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
```

- [ ] **Step 7: Create `src/components/ui/dialog.tsx`**

```tsx
"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg rounded-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background hover:opacity-100 focus:outline-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />;
}
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm vitest run src/tests/admin-primitives.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/badge.tsx src/components/ui/select.tsx src/components/ui/textarea.tsx src/components/ui/dialog.tsx src/tests/admin-primitives.test.tsx package.json pnpm-lock.yaml
git commit -m "feat(ui): add badge, select, textarea, dialog primitives"
```

---

### Task 3: Admin shared components — StatusBadge, EmptyState, Pagination, DataTable, ConfirmModerationDialog, useDebouncedValue

**Files:**
- Create: `src/components/admin/useDebouncedValue.ts`
- Create: `src/components/admin/StatusBadge.tsx`
- Create: `src/components/admin/EmptyState.tsx`
- Create: `src/components/admin/Pagination.tsx`
- Create: `src/components/admin/DataTable.tsx`
- Create: `src/components/admin/ConfirmModerationDialog.tsx`
- Test: `src/tests/admin-primitives.test.tsx` (append cases)

**Interfaces:**
- Consumes: `Badge`, `Button`, `Dialog*`, `Textarea`, `Select`, `Page<T>` type, i18n `Status.*` keys.
- Produces:
  - `useDebouncedValue<T>(value: T, delayMs: number): T`
  - `StatusBadge({ value: string })` — renders `<Badge>` with label `t("Status."+value)` and a variant by value.
  - `EmptyState({ children })`
  - `Pagination({ page: Page<unknown>, onPageChange: (n:number)=>void, onSizeChange: (s:number)=>void })`
  - `DataTable<T>({ columns, rows, emptyState, loading })` where `columns: { key: string; header: ReactNode; cell: (row: T) => ReactNode }[]`
  - `ConfirmModerationDialog({ open, onOpenChange, kind: "approve"|"reject"|"block"|"unblock"|"role", onConfirm: (reason?: string)=>void, submitting, title, description, requireReason })`

- [ ] **Step 1: Write failing tests (append to `src/tests/admin-primitives.test.tsx`)**

Add imports and cases:
```tsx
import { Pagination } from "@/components/admin/Pagination";
import { DataTable } from "@/components/admin/DataTable";
import { ConfirmModerationDialog } from "@/components/admin/ConfirmModerationDialog";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { NextIntlClientProvider } from "next-intl";
import ru from "@/messages/ru.json";

const wrap = (ui: React.ReactNode) =>
  render(<NextIntlClientProvider locale="ru" messages={ru}>{ui}</NextIntlClientProvider>);

describe("StatusBadge", () => {
  it("renders localized label for ACTIVE", () => {
    wrap(<StatusBadge value="ACTIVE" />);
    expect(screen.getByText(ru.Status.ACTIVE)).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  const page = { content: [], totalElements: 25, totalPages: 3, number: 1, size: 10, first: false, last: false, empty: false };
  it("disables prev on first and calls onPageChange", async () => {
    const onpage = vi.fn();
    wrap(<Pagination page={{ ...page, number: 0, first: true }} onPageChange={onpage} onSizeChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Следующая|Next/ })).toBeEnabled();
    await userEvent.setup().click(screen.getByRole("button", { name: /Следующая|Next/ }));
    expect(onpage).toHaveBeenCalledWith(1);
  });
});

describe("DataTable", () => {
  it("renders rows and empty state", () => {
    const cols = [{ key: "n", header: "Name", cell: (r: { n: string }) => r.n }];
    const { rerender } = wrap(<DataTable columns={cols} rows={[{ n: "Alice" }]} loading={false} emptyState={<div>empty</div>} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    rerender(<NextIntlClientProvider locale="ru" messages={ru}><DataTable columns={cols} rows={[]} loading={false} emptyState={<div>empty</div>} /></NextIntlClientProvider>);
    expect(screen.getByText("empty")).toBeInTheDocument();
  });
});

describe("ConfirmModerationDialog", () => {
  it("requires reason for reject", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    wrap(
      <ConfirmModerationDialog open onOpenChange={vi.fn()} kind="reject"
        title="t" description="d" requireReason submitting={false} onConfirm={onConfirm} />,
    );
    await user.click(screen.getByRole("button", { name: /Подтвердить|Confirm/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox"), "bad content");
    await user.click(screen.getByRole("button", { name: /Подтвердить|Confirm/ }));
    expect(onConfirm).toHaveBeenCalledWith("bad content");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/admin-primitives.test.tsx`
Expected: FAIL — admin components not found.

- [ ] **Step 3: Create `src/components/admin/useDebouncedValue.ts`**

```ts
"use client";
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 4: Create `src/components/admin/StatusBadge.tsx`**

```tsx
"use client";
import { useTranslations } from "next-intl";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const VARIANT: Record<string, BadgeProps["variant"]> = {
  ACTIVE: "success",
  PENDING_MODERATION: "warning",
  REJECTED: "destructive",
  PENDING: "warning",
  APPROVED: "success",
  CONFIRMED: "success",
  CANCELLED: "destructive",
  COMPLETED: "secondary",
  ADMIN: "default",
  MODERATOR: "secondary",
  SELLER: "outline",
  BUYER: "outline",
  SOLD: "secondary",
  RESERVED: "warning",
  DRAFT: "outline",
  ARCHIVED: "outline",
};

export function StatusBadge({ value }: { value: string }) {
  const t = useTranslations("Status");
  return <Badge variant={VARIANT[value] ?? "outline"}>{t(value as never)}</Badge>;
}
```

- [ ] **Step 5: Create `src/components/admin/EmptyState.tsx`**

```tsx
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</div>;
}
```

- [ ] **Step 6: Create `src/components/admin/Pagination.tsx`**

```tsx
"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { Page } from "@/types/api";

const SIZES = [10, 20, 50];

export function Pagination({
  page, onPageChange, onSizeChange,
}: {
  page: Page<unknown>;
  onPageChange: (n: number) => void;
  onSizeChange: (s: number) => void;
}) {
  const t = useTranslations("Admin.common");
  if (page.empty && page.totalElements === 0) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="text-sm text-muted-foreground">
        {t("pageInfo", { number: page.number + 1, total: page.totalPages, elements: page.totalElements })}
      </div>
      <div className="flex items-center gap-2">
        <Select
          aria-label={t("pageSize")}
          value={String(page.size)}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="h-9 w-20"
        >
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Button variant="outline" size="sm" disabled={page.first} onClick={() => onPageChange(page.number - 1)}>{t("prev")}</Button>
        <Button variant="outline" size="sm" disabled={page.last} onClick={() => onPageChange(page.number + 1)}>{t("next")}</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create `src/components/admin/DataTable.tsx`**

```tsx
"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface Column<T> { key: string; header: ReactNode; cell: (row: T) => ReactNode; }

export function DataTable<T>({
  columns, rows, emptyState, loading, rowClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyState?: ReactNode;
  loading?: boolean;
  rowClassName?: (row: T) => string;
}) {
  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}</div>;
  }
  if (rows.length === 0) return <>{emptyState ?? null}</>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>{columns.map((c) => <th key={c.key} className="px-3 py-2 text-left font-medium">{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn("border-t", rowClassName?.(row))}>
              {columns.map((c) => <td key={c.key} className="px-3 py-2 align-top">{c.cell(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 8: Create `src/components/admin/ConfirmModerationDialog.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ConfirmModerationDialog({
  open, onOpenChange, kind, title, description, requireReason, submitting, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: "approve" | "reject" | "block" | "unblock" | "role";
  title: string;
  description?: string;
  requireReason: boolean;
  submitting: boolean;
  onConfirm: (reason?: string) => void;
}) {
  const t = useTranslations("Admin.common");
  const [reason, setReason] = useState("");
  const reasonInvalid = requireReason && reason.trim().length === 0;
  const reasonTooLong = reason.length > 1000;
  const submit = () => {
    if (reasonInvalid || reasonTooLong || submitting) return;
    onConfirm(reason.trim() || undefined);
  };
  const confirmLabel = kind === "reject" || kind === "block" ? t("confirmReject") : t("confirmApprove");
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setReason(""); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            aria-label={t("reason")}
            placeholder={t("reasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
          />
          <div className="text-xs text-muted-foreground">
            {requireReason ? t("reasonRequired") : t("reasonOptional")}
            {reasonTooLong ? <span className="text-destructive"> {t("reasonTooLong")}</span> : null}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={submitting}>{t("cancel")}</Button></DialogClose>
          <Button
            variant={kind === "reject" || kind === "block" ? "destructive" : "default"}
            disabled={reasonInvalid || reasonTooLong || submitting}
            onClick={submit}
          >
            {submitting ? t("submitting") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm vitest run src/tests/admin-primitives.test.tsx`
Expected: PASS (all). If `StatusBadge` test fails on `t(value as never)` typing, ensure `Status` keys exist (added in Task 4) — temporarily mark `StatusBadge` test as the `ACTIVE` key already exists in current `ru.json`, so it passes now.

- [ ] **Step 10: Commit**

```bash
git add src/components/admin src/tests/admin-primitives.test.tsx
git commit -m "feat(admin): add shared admin components (DataTable, Pagination, dialogs, StatusBadge)"
```

---

### Task 4: i18n keys + admin landing cleanup

**Files:**
- Modify: `src/messages/ru.json`
- Modify: `src/messages/en.json`
- Modify: `src/tests/messages.test.ts`
- Modify: `src/app/[locale]/(admin)/admin/page.tsx`

**Interfaces:** Produces all `Admin.*` and extended `Status.*` keys used by Tasks 5–8.

- [ ] **Step 1: Update `src/messages/ru.json`**

Replace the `Status` and `Admin` objects with:
```json
  "Status": { "ACTIVE": "Активно", "RESERVED": "Забронировано", "SOLD": "Продано", "DRAFT": "Черновик", "PENDING_MODERATION": "На модерации", "ARCHIVED": "В архиве", "REJECTED": "Отклонено", "PENDING": "Ожидает", "CONFIRMED": "Подтверждено", "CANCELLED": "Отменено", "COMPLETED": "Завершено", "APPROVED": "Одобрено", "BUYER": "Покупатель", "SELLER": "Продавец", "ADMIN": "Администратор", "MODERATOR": "Модератор" },
```
```json
  "Admin": {
    "title": "Админ-панель",
    "users": "Пользователи", "pendingListings": "Объявления на модерации", "pendingReviews": "Отзывы на модерации", "statistics": "Статистика",
    "back": "Назад в админ-панель",
    "common": {
      "refresh": "Обновить", "prev": "Назад", "next": "Далее", "pageInfo": "Стр. {number} из {total} ({elements})",
      "pageSize": "Размер страницы", "empty": "Нет данных", "loadingError": "Ошибка загрузки", "retry": "Повторить",
      "cancel": "Отмена", "confirmApprove": "Подтвердить", "confirmReject": "Подтвердить", "submitting": "Выполняется…",
      "reason": "Причина", "reasonPlaceholder": "Укажите причину…", "reasonRequired": "Причина обязательна", "reasonOptional": "Причина необязательна", "reasonTooLong": "Слишком длинная причина",
      "yes": "Да", "no": "Нет", "resetFilters": "Сбросить фильтры", "forbidden": "Недостаточно прав", "saved": "Сохранено", "error": "Ошибка: {detail}"
    },
    "status": { "listing": "Статус объявления", "booking": "Статус бронирования", "review": "Статус отзыва", "role": "Роль" },
    "users": {
      "title": "Пользователи", "search": "Поиск", "searchPlaceholder": "Имя или email…", "role": "Роль", "active": "Активные", "verified": "Подтверждённые",
      "colUser": "Пользователь", "colRole": "Роль", "colVerified": "Подтверждён", "colActive": "Активен", "colReviews": "Отзывы", "colCreated": "Создан", "colActions": "Действия",
      "block": "Заблокировать", "unblock": "Разблокировать", "changeRole": "Сменить роль", "selfGuard": "Нельзя менять свою учётную запись", "blockAdminWarn": "Вы блокируете администратора.",
      "confirmBlockTitle": "Заблокировать пользователя?", "confirmBlockDesc": "Пользователь потеряет доступ к платформе.", "confirmUnblockTitle": "Разблокировать пользователя?",
      "allRoles": "Все роли", "allActive": "Любой статус", "allVerified": "Любой"
    },
    "pendingListings": {
      "title": "Объявления на модерации", "seller": "Продавец", "category": "Категория", "price": "Цена", "location": "Локация", "created": "Создано", "status": "Статус",
      "approve": "Одобрить", "reject": "Отклонить", "confirmApproveTitle": "Одобрить объявление?", "confirmApproveDesc": "Объявление станет активным.",
      "confirmRejectTitle": "Отклонить объявление?", "confirmRejectDesc": "Продавец получит уведомление с причиной.", "noImage": "Нет фото"
    },
    "pendingReviews": {
      "title": "Отзывы на модерации", "author": "Автор", "recipient": "Получатель", "booking": "Бронирование", "rating": "Оценка", "comment": "Комментарий", "created": "Создано", "status": "Статус",
      "approve": "Одобрить", "reject": "Отклонить", "confirmApproveTitle": "Одобрить отзыв?", "confirmApproveDesc": "Отзыв будет опубликован.",
      "confirmRejectTitle": "Отклонить отзыв?", "confirmRejectDesc": "Автор будет проинформирован."
    },
    "statistics": {
      "title": "Статистика", "totalUsers": "Всего пользователей", "activeUsers": "Активных пользователей",
      "listingsToday": "Объявлений сегодня", "listingsWeek": "За неделю", "listingsMonth": "За месяц",
      "listingsByStatus": "Объявления по статусам", "bookingsByStatus": "Бронирования по статусам", "reviewsByStatus": "Отзывы по статусам"
    }
  }
```
(Remove the old `Admin.comingSoon` key — it is no longer used.)

- [ ] **Step 2: Update `src/messages/en.json`** with the same structure, English values:
```json
  "Status": { "ACTIVE": "Active", "RESERVED": "Reserved", "SOLD": "Sold", "DRAFT": "Draft", "PENDING_MODERATION": "Pending review", "ARCHIVED": "Archived", "REJECTED": "Rejected", "PENDING": "Pending", "CONFIRMED": "Confirmed", "CANCELLED": "Cancelled", "COMPLETED": "Completed", "APPROVED": "Approved", "BUYER": "Buyer", "SELLER": "Seller", "ADMIN": "Administrator", "MODERATOR": "Moderator" },
```
```json
  "Admin": {
    "title": "Admin panel",
    "users": "Users", "pendingListings": "Pending listings", "pendingReviews": "Pending reviews", "statistics": "Statistics",
    "back": "Back to admin panel",
    "common": {
      "refresh": "Refresh", "prev": "Prev", "next": "Next", "pageInfo": "Page {number} of {total} ({elements})",
      "pageSize": "Page size", "empty": "No data", "loadingError": "Loading error", "retry": "Retry",
      "cancel": "Cancel", "confirmApprove": "Confirm", "confirmReject": "Confirm", "submitting": "Submitting…",
      "reason": "Reason", "reasonPlaceholder": "State the reason…", "reasonRequired": "Reason is required", "reasonOptional": "Reason is optional", "reasonTooLong": "Reason too long",
      "yes": "Yes", "no": "No", "resetFilters": "Reset filters", "forbidden": "Not enough permissions", "saved": "Saved", "error": "Error: {detail}"
    },
    "status": { "listing": "Listing status", "booking": "Booking status", "review": "Review status", "role": "Role" },
    "users": {
      "title": "Users", "search": "Search", "searchPlaceholder": "Name or email…", "role": "Role", "active": "Active", "verified": "Verified",
      "colUser": "User", "colRole": "Role", "colVerified": "Verified", "colActive": "Active", "colReviews": "Reviews", "colCreated": "Created", "colActions": "Actions",
      "block": "Block", "unblock": "Unblock", "changeRole": "Change role", "selfGuard": "Cannot modify your own account", "blockAdminWarn": "You are blocking an administrator.",
      "confirmBlockTitle": "Block user?", "confirmBlockDesc": "The user will lose platform access.", "confirmUnblockTitle": "Unblock user?",
      "allRoles": "All roles", "allActive": "Any status", "allVerified": "Any"
    },
    "pendingListings": {
      "title": "Pending listings", "seller": "Seller", "category": "Category", "price": "Price", "location": "Location", "created": "Created", "status": "Status",
      "approve": "Approve", "reject": "Reject", "confirmApproveTitle": "Approve listing?", "confirmApproveDesc": "The listing will become active.",
      "confirmRejectTitle": "Reject listing?", "confirmRejectDesc": "The seller will be notified with the reason.", "noImage": "No photo"
    },
    "pendingReviews": {
      "title": "Pending reviews", "author": "Author", "recipient": "Recipient", "booking": "Booking", "rating": "Rating", "comment": "Comment", "created": "Created", "status": "Status",
      "approve": "Approve", "reject": "Reject", "confirmApproveTitle": "Approve review?", "confirmApproveDesc": "The review will be published.",
      "confirmRejectTitle": "Reject review?", "confirmRejectDesc": "The author will be informed."
    },
    "statistics": {
      "title": "Statistics", "totalUsers": "Total users", "activeUsers": "Active users",
      "listingsToday": "Listings today", "listingsWeek": "This week", "listingsMonth": "This month",
      "listingsByStatus": "Listings by status", "bookingsByStatus": "Bookings by status", "reviewsByStatus": "Reviews by status"
    }
  }
```

- [ ] **Step 3: Extend `src/tests/messages.test.ts`**

Remove `"Admin.title"` from the existing `keys` array (it still exists; keep it — actually keep it) and append every new key used by the pages. Add to the `keys` array (these are the keys actually rendered):
```ts
    "Admin.title", "Admin.back",
    "Admin.common.refresh", "Admin.common.prev", "Admin.common.next", "Admin.common.pageInfo",
    "Admin.common.pageSize", "Admin.common.empty", "Admin.common.loadingError", "Admin.common.retry",
    "Admin.common.cancel", "Admin.common.confirmApprove", "Admin.common.confirmReject", "Admin.common.submitting",
    "Admin.common.reason", "Admin.common.reasonPlaceholder", "Admin.common.reasonRequired", "Admin.common.reasonOptional", "Admin.common.reasonTooLong",
    "Admin.common.yes", "Admin.common.no", "Admin.common.resetFilters", "Admin.common.forbidden", "Admin.common.saved", "Admin.common.error",
    "Admin.users.title", "Admin.users.search", "Admin.users.searchPlaceholder", "Admin.users.role", "Admin.users.active", "Admin.users.verified",
    "Admin.users.colUser", "Admin.users.colRole", "Admin.users.colVerified", "Admin.users.colActive", "Admin.users.colReviews", "Admin.users.colCreated", "Admin.users.colActions",
    "Admin.users.block", "Admin.users.unblock", "Admin.users.changeRole", "Admin.users.selfGuard", "Admin.users.blockAdminWarn",
    "Admin.users.confirmBlockTitle", "Admin.users.confirmBlockDesc", "Admin.users.confirmUnblockTitle",
    "Admin.users.allRoles", "Admin.users.allActive", "Admin.users.allVerified",
    "Admin.pendingListings.title", "Admin.pendingListings.seller", "Admin.pendingListings.category", "Admin.pendingListings.price",
    "Admin.pendingListings.location", "Admin.pendingListings.created", "Admin.pendingListings.status",
    "Admin.pendingListings.approve", "Admin.pendingListings.reject", "Admin.pendingListings.confirmApproveTitle", "Admin.pendingListings.confirmApproveDesc",
    "Admin.pendingListings.confirmRejectTitle", "Admin.pendingListings.confirmRejectDesc", "Admin.pendingListings.noImage",
    "Admin.pendingReviews.title", "Admin.pendingReviews.author", "Admin.pendingReviews.recipient", "Admin.pendingReviews.booking",
    "Admin.pendingReviews.rating", "Admin.pendingReviews.comment", "Admin.pendingReviews.created", "Admin.pendingReviews.status",
    "Admin.pendingReviews.approve", "Admin.pendingReviews.reject", "Admin.pendingReviews.confirmApproveTitle", "Admin.pendingReviews.confirmApproveDesc",
    "Admin.pendingReviews.confirmRejectTitle", "Admin.pendingReviews.confirmRejectDesc",
    "Admin.statistics.title", "Admin.statistics.totalUsers", "Admin.statistics.activeUsers",
    "Admin.statistics.listingsToday", "Admin.statistics.listingsWeek", "Admin.statistics.listingsMonth",
    "Admin.statistics.listingsByStatus", "Admin.statistics.bookingsByStatus", "Admin.statistics.reviewsByStatus",
    "Status.ACTIVE", "Status.RESERVED", "Status.SOLD", "Status.DRAFT", "Status.PENDING_MODERATION", "Status.ARCHIVED", "Status.REJECTED",
    "Status.PENDING", "Status.CONFIRMED", "Status.CANCELLED", "Status.COMPLETED", "Status.APPROVED",
    "Status.BUYER", "Status.SELLER", "Status.ADMIN", "Status.MODERATOR",
```

- [ ] **Step 4: Clean up `src/app/[locale]/(admin)/admin/page.tsx`**

Remove the `<p ...>{t("comingSoon")}</p>` line (and the now-unused `comingSoon` translation usage). Final file:
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
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/tests/messages.test.ts`
Expected: PASS — every listed key exists in both locales.

- [ ] **Step 6: Commit**

```bash
git add src/messages/ru.json src/messages/en.json src/tests/messages.test.ts src/app/[locale]/(admin)/admin/page.tsx
git commit -m "feat(admin): add i18n keys for admin sections, drop comingSoon"
```

---

### Task 5: `/admin/users` page

**Files:**
- Create: `src/app/[locale]/(admin)/admin/users/page.tsx`
- Test: `src/tests/admin-users-page.test.tsx`

**Interfaces:**
- Consumes: `getAdminUsers`, `updateUserStatus`, `updateUserRole`; `DataTable`, `Pagination`, `StatusBadge`, `ConfirmModerationDialog`, `Select`, `useDebouncedValue`; `useSession` (self-guard); `Admin.users.*`, `Admin.common.*`, `Status.*` keys.

- [ ] **Step 1: Write the failing test**

`src/tests/admin-users-page.test.tsx`:
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
import UsersPage from "@/app/[locale]/(admin)/admin/users/page";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/users",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const mkQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const adminUser = (id: string, email: string, role: "BUYER" | "ADMIN" = "BUYER", active = true) => ({
  id, email, phone: null, firstName: "Fn", lastName: "Ln", avatarUrl: null, role, verified: true, active,
  bio: null, country: null, city: null, address: null, latitude: null, longitude: null, rating: null, totalReviews: 0,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
});

const renderPage = (sessionUser: typeof adminUser | null = adminUser("me", "me@x.co", "ADMIN")) => {
  const qc = mkQc();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user: sessionUser, status: sessionUser ? "authenticated" : "unauthenticated" }}>
          <UsersPage />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
};

describe("UsersPage", () => {
  it("renders users table", async () => {
    server.use(http.get("*/api/proxy/admin/users", () => HttpResponse.json({
      content: [adminUser("u1", "a@b.co")], totalElements: 1, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: false,
    })));
    renderPage();
    expect(await screen.findByText("a@b.co")).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    server.use(http.get("*/api/proxy/admin/users", () => HttpResponse.json({
      content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true, empty: true,
    })));
    renderPage();
    expect(await screen.findByText(ru.Admin.common.empty)).toBeInTheDocument();
  });

  it("blocks a user with a required reason", async () => {
    const user = userEvent.setup();
    let statusBody: unknown = null;
    server.use(
      http.get("*/api/proxy/admin/users", () => HttpResponse.json({
        content: [adminUser("u1", "a@b.co", "BUYER", true)], totalElements: 1, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: false,
      })),
      http.put("*/api/proxy/admin/users/:id/status", async ({ request }) => {
        statusBody = JSON.parse(await request.text());
        return HttpResponse.json({ ...adminUser("u1", "a@b.co", "BUYER", false) });
      }),
    );
    renderPage();
    await screen.findByText("a@b.co");
    await user.click(screen.getByRole("button", { name: ru.Admin.users.block }));
    await user.type(screen.getByRole("textbox"), "spam");
    await user.click(screen.getByRole("button", { name: ru.Admin.common.confirmReject }));
    await waitFor(() => expect(statusBody).toEqual({ active: false, reason: "spam" }));
  });

  it("disables actions on own row", async () => {
    server.use(http.get("*/api/proxy/admin/users", () => HttpResponse.json({
      content: [adminUser("me", "me@x.co", "ADMIN", true)], totalElements: 1, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: false,
    })));
    renderPage(adminUser("me", "me@x.co", "ADMIN"));
    await screen.findByText("me@x.co");
    expect(screen.getByRole("button", { name: ru.Admin.users.block })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/admin-users-page.test.tsx`
Expected: FAIL — page module not found.

- [ ] **Step 3: Create `src/app/[locale]/(admin)/admin/users/page.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n";
import { getAdminUsers, updateUserStatus, updateUserRole, type AdminUsersParams } from "@/lib/api/endpoints/admin";
import { ApiError } from "@/lib/api/errors";
import { useSession } from "@/components/auth/useSession";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { ConfirmModerationDialog } from "@/components/admin/ConfirmModerationDialog";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AdminUser, Page, Role } from "@/types/api";

const ROLES: Role[] = ["BUYER", "SELLER", "ADMIN", "MODERATOR"];

type Filters = { search: string; role: "" | Role; active: "" | "true" | "false"; verified: "" | "true" | "false"; page: number; size: number };

const readInitial = (): Filters => {
  if (typeof window === "undefined") return { search: "", role: "", active: "", verified: "", page: 0, size: 10 };
  const sp = new URLSearchParams(window.location.search);
  const num = (k: string, d: number) => { const v = sp.get(k); return v ? Math.max(0, Number(v) || d) : d; };
  return {
    search: sp.get("search") ?? "",
    role: (sp.get("role") as Filters["role"]) ?? "",
    active: (sp.get("active") as Filters["active"]) ?? "",
    verified: (sp.get("verified") as Filters["verified"]) ?? "",
    page: num("page", 0),
    size: num("size", 10),
  };
};

function initials(u: AdminUser): string {
  const a = (u.firstName ?? "").trim()[0] ?? "";
  const b = (u.lastName ?? "").trim()[0] ?? "";
  return (a + b).toUpperCase() || (u.email[0] ?? "?").toUpperCase();
}

export default function UsersPage() {
  const t = useTranslations("Admin");
  const tc = useTranslations("Admin.common");
  const tu = useTranslations("Admin.users");
  const qc = useQueryClient();
  const { user: me } = useSession();
  const [filters, setFilters] = useState<Filters>(readInitial);
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const queryParams: AdminUsersParams = useMemo(() => ({
    search: debouncedSearch || null,
    role: filters.role || null,
    active: filters.active === "" ? null : filters.active === "true",
    verified: filters.verified === "" ? null : filters.verified === "true",
    page: filters.page,
    size: filters.size,
  }), [debouncedSearch, filters.role, filters.active, filters.verified, filters.page, filters.size]);

  const { data, isLoading, isError, refetch } = useQuery<Page<AdminUser>>({
    queryKey: ["admin", "users", queryParams],
    queryFn: () => getAdminUsers(queryParams),
  });

  // Sync filters to URL (shareable) without navigation/scroll.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams();
    if (filters.search) sp.set("search", filters.search);
    if (filters.role) sp.set("role", filters.role);
    if (filters.active) sp.set("active", filters.active);
    if (filters.verified) sp.set("verified", filters.verified);
    if (filters.page) sp.set("page", String(filters.page));
    if (filters.size !== 10) sp.set("size", String(filters.size));
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }, [filters]);

  // Reset to page 0 when filters change (debounced search included).
  useEffect(() => { setFilters((f) => ({ ...f, page: 0 })); }, [debouncedSearch, filters.role, filters.active, filters.verified]);

  const [dialog, setDialog] = useState<{ user: AdminUser; kind: "block" | "unblock" } | null>(null);

  const onMutated = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    setDialog(null);
  };
  const onMutError = (e: unknown) => {
    setDialog(null);
    if (e instanceof ApiError && e.status === 403) toast.error(tc("forbidden"));
    else if (e instanceof ApiError) toast.error(tc("error", { detail: e.detail }));
    else toast.error(tc("error", { detail: "—" }));
  };

  const statusMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { active: boolean; reason?: string } }) => updateUserStatus(id, body),
    onSuccess: () => { toast.success(tc("saved")); onMutated(); },
    onError: onMutError,
  });
  const roleMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role: Role } }) => updateUserRole(id, body),
    onSuccess: () => { toast.success(tc("saved")); qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: onMutError,
  });

  const isSelf = (u: AdminUser) => !!me && u.id === me.id;

  const columns: Column<AdminUser>[] = [
    { key: "user", header: tu("colUser"), cell: (u) => (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initials(u)}</div>
        <div className="min-w-0">
          <div className="truncate">{u.firstName ?? ""} {u.lastName ?? ""}</div>
          <div className="truncate text-xs text-muted-foreground">{u.email}</div>
        </div>
      </div>
    ) },
    { key: "role", header: tu("colRole"), cell: (u) => (
      isSelf(u) ? <StatusBadge value={u.role} />
      : <Select aria-label={tu("changeRole")} value={u.role} className="h-9 w-36"
          disabled={roleMut.isPending} onChange={(e) => roleMut.mutate({ id: u.id, body: { role: e.target.value as Role } })}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
    ) },
    { key: "verified", header: tu("colVerified"), cell: (u) => u.verified ? tc("yes") : tc("no") },
    { key: "active", header: tu("colActive"), cell: (u) => u.active ? tc("yes") : tc("no") },
    { key: "reviews", header: tu("colReviews"), cell: (u) => String(u.totalReviews ?? 0) },
    { key: "created", header: tu("colCreated"), cell: (u) => new Date(u.createdAt).toLocaleDateString() },
    { key: "actions", header: tu("colActions"), cell: (u) => {
      if (isSelf(u)) return <span className="text-xs text-muted-foreground">{tu("selfGuard")}</span>;
      return (
        <Button variant={u.active ? "destructive" : "outline"} size="sm"
          onClick={() => setDialog({ user: u, kind: u.active ? "block" : "unblock" })}>
          {u.active ? tu("block") : tu("unblock")}
        </Button>
      );
    } },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tu("title")}</h1>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">{t("back")}</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={tu("search")} placeholder={tu("searchPlaceholder")} value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} className="h-9 w-60" />
        <Select aria-label={tu("role")} value={filters.role} className="h-9 w-36"
          onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value as Filters["role"] }))}>
          <option value="">{tu("allRoles")}</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select aria-label={tu("active")} value={filters.active} className="h-9 w-36"
          onChange={(e) => setFilters((f) => ({ ...f, active: e.target.value as Filters["active"] }))}>
          <option value="">{tu("allActive")}</option>
          <option value="true">{tc("yes")}</option>
          <option value="false">{tc("no")}</option>
        </Select>
        <Select aria-label={tu("verified")} value={filters.verified} className="h-9 w-36"
          onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.value as Filters["verified"] }))}>
          <option value="">{tu("allVerified")}</option>
          <option value="true">{tc("yes")}</option>
          <option value="false">{tc("no")}</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", role: "", active: "", verified: "", page: 0, size: 10 })}>{tc("resetFilters")}</Button>
      </div>

      {isError ? (
        <EmptyState><div className="space-y-2"><div>{tc("loadingError")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{tc("retry")}</Button></div></EmptyState>
      ) : (
        <DataTable<AdminUser> columns={columns} rows={data?.content ?? []} loading={isLoading}
          rowClassName={(u) => (u.active ? "" : "opacity-60")}
          emptyState={<EmptyState>{tc("empty")}</EmptyState>} />
      )}

      {data ? <Pagination page={data} onPageChange={(n) => setFilters((f) => ({ ...f, page: n }))} onSizeChange={(s) => setFilters((f) => ({ ...f, size: s, page: 0 }))} /> : null}

      <ConfirmModerationDialog
        open={!!dialog}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        kind={dialog?.kind === "block" ? "block" : "unblock"}
        submitting={statusMut.isPending}
        requireReason={dialog?.kind === "block"}
        title={dialog?.kind === "block" ? tu("confirmBlockTitle") : tu("confirmUnblockTitle")}
        description={dialog?.kind === "block" ? (dialog.user.role === "ADMIN" ? tu("blockAdminWarn") + " " + tu("confirmBlockDesc") : tu("confirmBlockDesc")) : undefined}
        onConfirm={(reason) => {
          if (!dialog) return;
          statusMut.mutate({ id: dialog.user.id, body: { active: dialog.kind === "unblock", reason } });
        }}
      />
    </div>
  );
}
```

**Notes for the implementer:**
- `Input` is imported from `src/components/ui/input.tsx` (existing styled `<input>`). `StatusBadge` IS used (self-row role cell) — keep its import.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/admin-users-page.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/(admin)/admin/users/page.tsx" src/tests/admin-users-page.test.tsx
git commit -m "feat(admin): implement /admin/users with filters, role/status actions, self-guard"
```

---

### Task 6: `/admin/listings/pending` page

**Files:**
- Create: `src/app/[locale]/(admin)/admin/listings/pending/page.tsx`
- Test: `src/tests/admin-listings-pending.test.tsx`

**Interfaces:**
- Consumes: `getPendingListings`, `moderateListing`; `useLocale` (next-intl) for `Accept-Language`; `Pagination`, `StatusBadge`, `EmptyState`, `ConfirmModerationDialog`; `Listing` type.

- [ ] **Step 1: Write the failing test**

`src/tests/admin-listings-pending.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ru from "@/messages/ru.json";
import ListingsPendingPage from "@/app/[locale]/(admin)/admin/listings/pending/page";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/listings/pending",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const listing = (id: string, status: "PENDING_MODERATION" | "REJECTED" = "PENDING_MODERATION") => ({
  id, seller: { id: "s1", firstName: "S", lastName: "E", avatarUrl: null, bio: null, country: null, city: null, rating: null, totalReviews: null, role: "SELLER" },
  categoryId: "c1", categoryName: "Cats", breedId: null, breedName: null,
  title: "Kitten " + id, description: "desc", price: "100", currency: "USD", gender: "MALE", ageMonths: 3,
  color: null, weightKg: null, healthInfo: null, hasVaccination: null, hasDocuments: null,
  locationCountry: "RU", locationCity: "Moscow", status, viewsCount: 0, images: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
});

const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: content.length === 0 });

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <NextIntlClientProvider locale="ru" messages={ru}><ListingsPendingPage /></NextIntlClientProvider>
  </QueryClientProvider>,
);

describe("ListingsPendingPage", () => {
  it("renders listing cards", async () => {
    server.use(http.get("*/api/proxy/admin/listings/pending", ({ request }) => {
      expect(request.headers.get("accept-language")).toBe("ru");
      return HttpResponse.json(page([listing("l1")]));
    }));
    renderPage();
    expect(await screen.findByText("Kitten l1")).toBeInTheDocument();
  });

  it("rejects with required reason", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get("*/api/proxy/admin/listings/pending", () => HttpResponse.json(page([listing("l1")]))),
      http.put("*/api/proxy/admin/listings/:id/moderate", async ({ request }) => {
        body = JSON.parse(await request.text()); return HttpResponse.json(listing("l1", "REJECTED"));
      }),
    );
    renderPage();
    await screen.findByText("Kitten l1");
    await user.click(screen.getByRole("button", { name: ru.Admin.pendingListings.reject }));
    await user.type(screen.getByRole("textbox"), "bad photos");
    await user.click(screen.getByRole("button", { name: ru.Admin.common.confirmReject }));
    await waitFor(() => expect(body).toEqual({ status: "REJECTED", reason: "bad photos" }));
  });

  it("approves directly via confirm dialog", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get("*/api/proxy/admin/listings/pending", () => HttpResponse.json(page([listing("l1")]))),
      http.put("*/api/proxy/admin/listings/:id/moderate", async ({ request }) => {
        body = JSON.parse(await request.text()); return HttpResponse.json(listing("l1", "ACTIVE"));
      }),
    );
    renderPage();
    await screen.findByText("Kitten l1");
    await user.click(screen.getByRole("button", { name: ru.Admin.pendingListings.approve }));
    await user.click(screen.getByRole("button", { name: ru.Admin.common.confirmApprove }));
    await waitFor(() => expect(body).toEqual({ status: "ACTIVE" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/admin-listings-pending.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/app/[locale]/(admin)/admin/listings/pending/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n";
import { getPendingListings, moderateListing } from "@/lib/api/endpoints/admin";
import { ApiError } from "@/lib/api/errors";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { ConfirmModerationDialog } from "@/components/admin/ConfirmModerationDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Listing, Page } from "@/types/api";

export default function ListingsPendingPage() {
  const t = useTranslations("Admin");
  const tc = useTranslations("Admin.common");
  const tl = useTranslations("Admin.pendingListings");
  const locale = useLocale();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [dialog, setDialog] = useState<{ listing: Listing; kind: "approve" | "reject" } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<Page<Listing>>({
    queryKey: ["admin", "listings", "pending", { page, size, locale }],
    queryFn: () => getPendingListings(page, size, locale),
  });

  const mut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status: "ACTIVE" | "REJECTED"; reason?: string } }) => moderateListing(id, body, locale),
    onSuccess: () => { toast.success(tc("saved")); qc.invalidateQueries({ queryKey: ["admin", "listings", "pending"] }); setDialog(null); },
    onError: (e) => {
      setDialog(null);
      if (e instanceof ApiError && e.status === 403) toast.error(tc("forbidden"));
      else if (e instanceof ApiError) toast.error(tc("error", { detail: e.detail }));
      else toast.error(tc("error", { detail: "—" }));
    },
  });

  const mainImage = (l: Listing) => l.images.find((i) => i.isMain)?.url ?? l.images[0]?.url ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tl("title")}</h1>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">{t("back")}</Link>
      </div>

      {isError ? (
        <EmptyState><div className="space-y-2"><div>{tc("loadingError")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{tc("retry")}</Button></div></EmptyState>
      ) : isLoading || !data || data.empty ? (
        <EmptyState>{isLoading ? "…" : tc("empty")}</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.content.map((l) => (
            <Card key={l.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex gap-3">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                    {mainImage(l) ? <img src={mainImage(l)!} alt={l.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{tl("noImage")}</div>}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2"><span className="truncate font-medium">{l.title}</span><StatusBadge value={l.status} /></div>
                    <div className="text-xs text-muted-foreground">{l.categoryName}{l.breedName ? " · " + l.breedName : ""}</div>
                    <div className="text-sm">{l.price} {l.currency}</div>
                    <div className="text-xs text-muted-foreground">{tl("seller")}: {l.seller.firstName ?? ""} {l.seller.lastName ?? ""} · {tl("location")}: {l.locationCity ?? "—"}</div>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{l.description}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setDialog({ listing: l, kind: "approve" })}>{tl("approve")}</Button>
                  <Button size="sm" variant="destructive" onClick={() => setDialog({ listing: l, kind: "reject" })}>{tl("reject")}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data ? <Pagination page={data} onPageChange={setPage} onSizeChange={(s) => { setSize(s); setPage(0); }} /> : null}

      <ConfirmModerationDialog
        open={!!dialog}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        kind={dialog?.kind ?? "approve"}
        submitting={mut.isPending}
        requireReason={dialog?.kind === "reject"}
        title={dialog?.kind === "approve" ? tl("confirmApproveTitle") : tl("confirmRejectTitle")}
        description={dialog?.kind === "approve" ? tl("confirmApproveDesc") : tl("confirmRejectDesc")}
        onConfirm={(reason) => {
          if (!dialog) return;
          mut.mutate({ id: dialog.listing.id, body: { status: dialog.kind === "approve" ? "ACTIVE" : "REJECTED", reason } });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/admin-listings-pending.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm tsc --noEmit` — expected no errors.
```bash
git add "src/app/[locale]/(admin)/admin/listings/pending/page.tsx" src/tests/admin-listings-pending.test.tsx
git commit -m "feat(admin): implement /admin/listings/pending moderation"
```

---

### Task 7: `/admin/reviews/pending` page

**Files:**
- Create: `src/app/[locale]/(admin)/admin/reviews/pending/page.tsx`
- Test: `src/tests/admin-reviews-pending.test.tsx`

**Interfaces:**
- Consumes: `getPendingReviews`, `moderateReview`; `Pagination`, `StatusBadge`, `EmptyState`, `ConfirmModerationDialog`; `Review` type.

- [ ] **Step 1: Write the failing test**

`src/tests/admin-reviews-pending.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ru from "@/messages/ru.json";
import ReviewsPendingPage from "@/app/[locale]/(admin)/admin/reviews/pending/page";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/reviews/pending",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const review = (id: string, rating = 5) => ({
  id, author: { id: "a1", firstName: "A", lastName: "U", avatarUrl: null, bio: null, country: null, city: null, rating: null, totalReviews: null, role: "BUYER" },
  recipient: { id: "r1", firstName: "R", lastName: "V", avatarUrl: null, bio: null, country: null, city: null, rating: null, totalReviews: null, role: "SELLER" },
  booking: { id: "b1" }, rating, comment: "good", status: "PENDING", createdAt: "2026-01-01T00:00:00Z",
});
const page = (c: unknown[]) => ({ content: c, totalElements: c.length, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: c.length === 0 });

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <NextIntlClientProvider locale="ru" messages={ru}><ReviewsPendingPage /></NextIntlClientProvider>
  </QueryClientProvider>,
);

describe("ReviewsPendingPage", () => {
  it("renders review cards with rating", async () => {
    server.use(http.get("*/api/proxy/admin/reviews/pending", () => HttpResponse.json(page([review("r1", 4)]))));
    renderPage();
    expect(await screen.findByText("good")).toBeInTheDocument();
  });

  it("rejects with reason", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get("*/api/proxy/admin/reviews/pending", () => HttpResponse.json(page([review("r1")]))),
      http.put("*/api/proxy/admin/reviews/:id/moderate", async ({ request }) => { body = JSON.parse(await request.text()); return HttpResponse.json(review("r1")); }),
    );
    renderPage();
    await screen.findByText("good");
    await user.click(screen.getByRole("button", { name: ru.Admin.pendingReviews.reject }));
    await user.type(screen.getByRole("textbox"), "rude");
    await user.click(screen.getByRole("button", { name: ru.Admin.common.confirmReject }));
    await waitFor(() => expect(body).toEqual({ status: "REJECTED", reason: "rude" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/admin-reviews-pending.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/app/[locale]/(admin)/admin/reviews/pending/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n";
import { getPendingReviews, moderateReview } from "@/lib/api/endpoints/admin";
import { ApiError } from "@/lib/api/errors";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { ConfirmModerationDialog } from "@/components/admin/ConfirmModerationDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Review, Page } from "@/types/api";

function Stars({ rating }: { rating: number }) {
  return <span aria-label={String(rating)}>{"★".repeat(rating)}{"☆".repeat(Math.max(0, 5 - rating))}</span>;
}

export default function ReviewsPendingPage() {
  const t = useTranslations("Admin");
  const tc = useTranslations("Admin.common");
  const tr = useTranslations("Admin.pendingReviews");
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [dialog, setDialog] = useState<{ review: Review; kind: "approve" | "reject" } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<Page<Review>>({
    queryKey: ["admin", "reviews", "pending", { page, size }],
    queryFn: () => getPendingReviews(page, size),
  });

  const mut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status: "APPROVED" | "REJECTED"; reason?: string } }) => moderateReview(id, body),
    onSuccess: () => { toast.success(tc("saved")); qc.invalidateQueries({ queryKey: ["admin", "reviews", "pending"] }); setDialog(null); },
    onError: (e) => {
      setDialog(null);
      if (e instanceof ApiError && e.status === 403) toast.error(tc("forbidden"));
      else if (e instanceof ApiError) toast.error(tc("error", { detail: e.detail }));
      else toast.error(tc("error", { detail: "—" }));
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tr("title")}</h1>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">{t("back")}</Link>
      </div>

      {isError ? (
        <EmptyState><div className="space-y-2"><div>{tc("loadingError")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{tc("retry")}</Button></div></EmptyState>
      ) : isLoading || !data || data.empty ? (
        <EmptyState>{isLoading ? "…" : tc("empty")}</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.content.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm"><span className="font-medium">{r.author.firstName ?? ""} {r.author.lastName ?? ""}</span> → <span>{r.recipient.firstName ?? ""} {r.recipient.lastName ?? ""}</span></div>
                  <StatusBadge value={r.status} />
                </div>
                <div className="text-xs text-muted-foreground">{tr("booking")}: #{r.booking?.id.slice(0, 8) ?? "—"} · {tr("rating")}: <Stars rating={r.rating} /></div>
                <p className="text-sm">{r.comment}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setDialog({ review: r, kind: "approve" })}>{tr("approve")}</Button>
                  <Button size="sm" variant="destructive" onClick={() => setDialog({ review: r, kind: "reject" })}>{tr("reject")}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data ? <Pagination page={data} onPageChange={setPage} onSizeChange={(s) => { setSize(s); setPage(0); }} /> : null}

      <ConfirmModerationDialog
        open={!!dialog}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        kind={dialog?.kind ?? "approve"}
        submitting={mut.isPending}
        requireReason={dialog?.kind === "reject"}
        title={dialog?.kind === "approve" ? tr("confirmApproveTitle") : tr("confirmRejectTitle")}
        description={dialog?.kind === "approve" ? tr("confirmApproveDesc") : tr("confirmRejectDesc")}
        onConfirm={(reason) => { if (!dialog) return; mut.mutate({ id: dialog.review.id, body: { status: dialog.kind === "approve" ? "APPROVED" : "REJECTED", reason } }); }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/admin-reviews-pending.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm tsc --noEmit` — expected no errors.
```bash
git add "src/app/[locale]/(admin)/admin/reviews/pending/page.tsx" src/tests/admin-reviews-pending.test.tsx
git commit -m "feat(admin): implement /admin/reviews/pending moderation"
```

---

### Task 8: `/admin/statistics` page (recharts)

**Files:**
- Create: `src/app/[locale]/(admin)/admin/statistics/page.tsx`
- Test: `src/tests/admin-statistics.test.tsx`

**Interfaces:**
- Consumes: `getStatistics`; `AdminStatistics`, `ListingStatus`, `BookingStatus`, `ReviewStatus` types; `Status.*` keys; `recharts` `BarChart`/`Bar`/`XAxis`/`YAxis`/`ResponsiveContainer`.

**Dataviz:** Use the `dataviz` skill to pick the palette and mark specs before writing chart code. Recharts responsive container needs a fixed height; in jsdom `ResponsiveContainer` renders nothing without dimensions — render bars via a deterministic width or assert on SVG title/data instead. The test below uses `ResponsiveContainer height={250} width="100%"` and asserts on the KPI tiles + empty state; recharts rendering is smoke-tested by checking the chart container div is present.

- [ ] **Step 1: Install recharts**

Run: `pnpm add recharts`
Expected: `recharts` in `dependencies`.

- [ ] **Step 2: Write the failing test**

`src/tests/admin-statistics.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ru from "@/messages/ru.json";
import StatisticsPage from "@/app/[locale]/(admin)/admin/statistics/page";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/statistics",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "bypass" })); // recharts may probe layout
afterEach(() => { server.resetHandlers(); server.close(); });

const stats = {
  totalUsers: 10, activeUsers: 7,
  listingsByStatus: { ACTIVE: 3, PENDING_MODERATION: 2, REJECTED: 1 } as Record<string, number>,
  bookingsByStatus: { PENDING: 1, CONFIRMED: 2 } as Record<string, number>,
  reviewsByStatus: { PENDING: 4, APPROVED: 5 } as Record<string, number>,
  listingsCreatedToday: 1, listingsCreatedThisWeek: 3, listingsCreatedThisMonth: 6,
};

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <NextIntlClientProvider locale="ru" messages={ru}><StatisticsPage /></NextIntlClientProvider>
  </QueryClientProvider>,
);

describe("StatisticsPage", () => {
  it("renders KPI tiles with values", async () => {
    server.use(http.get("*/api/proxy/admin/statistics", () => HttpResponse.json(stats)));
    renderPage();
    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("renders empty state when all zero", async () => {
    server.use(http.get("*/api/proxy/admin/statistics", () => HttpResponse.json({
      totalUsers: 0, activeUsers: 0, listingsByStatus: {}, bookingsByStatus: {}, reviewsByStatus: {},
      listingsCreatedToday: 0, listingsCreatedThisWeek: 0, listingsCreatedThisMonth: 0,
    })));
    renderPage();
    expect(await screen.findByText(ru.Admin.common.empty)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/tests/admin-statistics.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Invoke the dataviz skill for chart palette/specs**

Use the `dataviz` skill to confirm the categorical palette and bar mark spec for the three status-distribution charts (light + dark theme). Apply its brand-neutral placeholder palette (or project tokens) consistently.

- [ ] **Step 5: Create `src/app/[locale]/(admin)/admin/statistics/page.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { getStatistics } from "@/lib/api/endpoints/admin";
import { ApiError } from "@/lib/api/errors";
import { EmptyState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminStatistics } from "@/types/api";

const BAR_COLOR = "hsl(var(--primary))";

function toData(map: Record<string, number> | undefined, t: (k: string) => string) {
  return Object.entries(map ?? {})
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => ({ name: t(k), value: v as number }))
    .sort((a, b) => b.value - a.value);
}

export default function StatisticsPage() {
  const t = useTranslations("Admin");
  const tc = useTranslations("Admin.common");
  const ts = useTranslations("Admin.statistics");
  const tStatus = useTranslations("Status");
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<AdminStatistics>({
    queryKey: ["admin", "statistics"],
    queryFn: getStatistics,
    staleTime: 60_000,
  });

  const allZero = (s?: AdminStatistics) =>
    !!s && s.totalUsers === 0 && s.activeUsers === 0 && s.listingsCreatedToday === 0 && s.listingsCreatedThisWeek === 0 && s.listingsCreatedThisMonth === 0
    && Object.values(s.listingsByStatus).every((v) => !v)
    && Object.values(s.bookingsByStatus).every((v) => !v)
    && Object.values(s.reviewsByStatus).every((v) => !v);

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{ts("title")}</h1>
        <EmptyState><div className="space-y-2"><div>{tc("loadingError")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{tc("retry")}</Button></div></EmptyState>
      </div>
    );
  }

  const tiles = data ? [
    { label: ts("totalUsers"), value: data.totalUsers },
    { label: ts("activeUsers"), value: data.activeUsers },
    { label: ts("listingsToday"), value: data.listingsCreatedToday },
    { label: ts("listingsWeek"), value: data.listingsCreatedThisWeek },
    { label: ts("listingsMonth"), value: data.listingsCreatedThisMonth },
  ] : [];

  const Chart = ({ title, map }: { title: string; map: Record<string, number> | undefined }) => {
    const rows = toData(map, (k) => tStatus(k as never));
    if (rows.length === 0) return null;
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          <div style={{ height: Math.max(160, rows.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 16, right: 16 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip cursor={{ fillOpacity: 0.1 }} />
                <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{ts("title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ["admin", "statistics"] }); refetch(); }}>{tc("refresh")}</Button>
          <Link href="/admin" className="text-sm text-muted-foreground hover:underline">{t("back")}</Link>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : allZero(data) ? (
        <EmptyState>{tc("empty")}</EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-5">
            {tiles.map((tile) => (
              <Card key={tile.label}>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{tile.value}</div>
                  <div className="text-xs text-muted-foreground">{tile.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <Chart title={ts("listingsByStatus")} map={data.listingsByStatus as Record<string, number>} />
            <Chart title={ts("bookingsByStatus")} map={data.bookingsByStatus as Record<string, number>} />
            <Chart title={ts("reviewsByStatus")} map={data.reviewsByStatus as Record<string, number>} />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/tests/admin-statistics.test.tsx`
Expected: PASS (2 tests). (`onUnhandledRequest: "bypass"` avoids recharts ResizeObserver noise.)

- [ ] **Step 7: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors. If `recharts` JSX intrinsic types are missing, ensure `@types/recharts` is not required (recharts ships its own types); otherwise `pnpm add -D @types/recharts` is NOT needed.

- [ ] **Step 8: Commit**

```bash
git add "src/app/[locale]/(admin)/admin/statistics/page.tsx" src/tests/admin-statistics.test.tsx package.json pnpm-lock.yaml
git commit -m "feat(admin): implement /admin/statistics with recharts"
```

---

### Task 9: Playwright e2e — admin moderation flow

**Files:**
- Create: `e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `e2e` Playwright config (baseURL `:3000`, chromium, webServer auto-starts `pnpm dev`); `page.route` to stub `/api/auth/*`, `/api/proxy/users/me`, `/api/proxy/admin/listings/pending`, `/api/proxy/admin/listings/:id/moderate`.

- [ ] **Step 1: Inspect existing e2e stubs**

Run: `ls e2e/ && cat e2e/auth.spec.ts` (if absent, mirror `src/tests/middleware-admin.test.ts` cookie pattern). Note how an existing spec sets the `pmp_access` cookie via a response `set-cookie` header on a `page.route` stub.

- [ ] **Step 2: Write `e2e/admin.spec.ts`**

```ts
import { test, expect, type Page } from "@playwright/test";

const adminMe = { id: "me", email: "admin@x.co", role: "ADMIN", verified: true, active: true, createdAt: "t", updatedAt: "t" };
const pendingListing = {
  id: "l1", seller: { id: "s1", firstName: "S", lastName: "E", avatarUrl: null, bio: null, country: null, city: null, rating: null, totalReviews: null, role: "SELLER" },
  categoryId: "c1", categoryName: "Cats", breedId: null, breedName: null, title: "Pending Kitten", description: "d",
  price: "100", currency: "USD", gender: "MALE", ageMonths: 3, color: null, weightKg: null, healthInfo: null,
  hasVaccination: null, hasDocuments: null, locationCountry: "RU", locationCity: "Moscow", status: "PENDING_MODERATION",
  viewsCount: 0, images: [], createdAt: "t", updatedAt: "t",
};
const page1 = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 10, first: true, last: true, empty: content.length === 0 });

async function stubAuth(page: Page) {
  // Set pmp_access cookie via a stubbed auth response set-cookie header.
  await page.route("**/api/auth/login", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "set-cookie": "pmp_access=acc; Path=/; HttpOnly" }, body: JSON.stringify({ ok: true }) }));
  await page.route("**/api/proxy/users/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminMe) }));
}

test("admin approves a pending listing", async ({ page }) => {
  await stubAuth(page);
  await page.route("**/api/proxy/admin/listings/pending", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(page1([pendingListing])) }));
  let moderated = false;
  await page.route("**/api/proxy/admin/listings/*/moderate", async (route) => {
    moderated = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...pendingListing, status: "ACTIVE" }) });
  });

  // Seed session cookie, then navigate straight to the pending page.
  await page.context().addCookies([{ name: "pmp_access", value: "acc", domain: "localhost", path: "/" }]);
  await page.goto("/ru/admin/listings/pending");

  await expect(page.getByText("Pending Kitten")).toBeVisible();
  await page.getByRole("button", { name: /Одобрить|Approve/ }).click();
  await page.getByRole("button", { name: /Подтвердить|Confirm/ }).click();
  await expect.poll(() => moderated).toBe(true);
});
```

- [ ] **Step 3: Run the e2e spec**

Run: `pnpm exec playwright test e2e/admin.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/admin.spec.ts
git commit -m "test(e2e): admin pending-listing moderation flow"
```

---

### Task 10: Full pre-merge gate

- [ ] **Step 1: Run the gate**

Run: `pnpm test && pnpm tsc --noEmit && pnpm build && pnpm exec playwright test`
Expected: all green. `pnpm build` must succeed (SSG of `/ru`/`/en`; admin pages are dynamic `"use client"` — confirm they are not forced static).

- [ ] **Step 2: Fix any remaining issues**

If `pnpm build` fails on i18n missing keys, add them to both locale files and `messages.test.ts`. If ESLint errors surface during `next build` (CLAUDE.md notes build skips ESLint, but `pnpm lint` may still flag) — run `pnpm lint` and fix unused imports / `noUncheckedIndexedAccess` guards.

- [ ] **Step 3: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "test(admin): satisfy full pre-merge gate"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** types/endpoints (Task 1), primitives (Task 2), shared components (Task 3), i18n (Task 4), users page (Task 5), listings pending (Task 6), reviews pending (Task 7), statistics (Task 8), e2e (Task 9), gate (Task 10). All spec sections covered. `/listings/{id}` public-link deviation: the listings page does NOT link to a public listing (catalog not confirmed) — consistent with spec's "verify, else omit".
- **Placeholder scan:** Task 5 contains deliberate "notes for the implementer" correcting three draft bugs — these are explicit fix instructions, not placeholders. No "TODO"/"TBD".
- **Type consistency:** `Page<T>`, `AdminUser`, `AdminStatistics`, request-body types, `AdminUsersParams`, `Column<T>` signatures consistent across tasks. `getPendingListings(page, size, locale)` signature matches test and page usage.
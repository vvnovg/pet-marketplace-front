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
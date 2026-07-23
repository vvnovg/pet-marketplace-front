import { apiGet, apiPost, apiDelete, type ClientOpts } from "@/lib/api/client";
import type {
  Category, CategoryWithBreeds, Listing, Page, Favorite, Booking, ListingSearchParams,
} from "@/types/api";
import type { Locale } from "@/lib/i18n/config";

function withQuery(base: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `${base}?${q}` : base;
}

const lang = (locale: Locale, opts: ClientOpts): ClientOpts => ({ ...opts, headers: { "accept-language": locale, ...(opts.headers ?? {}) } });

export function getCategories(locale: Locale, opts: ClientOpts = {}): Promise<Category[]> {
  return apiGet<Category[]>("categories", lang(locale, opts));
}

export function getBreeds(categoryId: string, locale: Locale, opts: ClientOpts = {}): Promise<CategoryWithBreeds> {
  return apiGet<CategoryWithBreeds>(`categories/${categoryId}/breeds`, lang(locale, opts));
}

export function searchListings(params: ListingSearchParams, locale: Locale, opts: ClientOpts = {}): Promise<Page<Listing>> {
  return apiGet<Page<Listing>>(withQuery("listings", {
    categoryId: params.categoryId ?? null,
    breedId: params.breedId ?? null,
    city: params.city ?? null,
    minPrice: params.minPrice ?? null,
    maxPrice: params.maxPrice ?? null,
    gender: params.gender ?? null,
    minAge: params.minAge ?? null,
    maxAge: params.maxAge ?? null,
    sortBy: params.sortBy ?? "createdAt",
    sortDirection: params.sortDirection ?? "DESC",
    page: params.page ?? 0,
    size: params.size ?? 20,
  }), lang(locale, opts));
}

export function getListing(id: string, locale: Locale, opts: ClientOpts = {}): Promise<Listing> {
  return apiGet<Listing>(`listings/${id}`, lang(locale, opts));
}

export function listFavorites(opts: ClientOpts = {}): Promise<Favorite[]> {
  return apiGet<Favorite[]>("favorites", opts);
}

export function addFavorite(listingId: string, opts: ClientOpts = {}): Promise<void> {
  return apiPost<void>(`favorites/${listingId}`, {}, opts);
}

export function removeFavorite(listingId: string, opts: ClientOpts = {}): Promise<void> {
  return apiDelete(`favorites/${listingId}`, opts);
}

export function bookListing(listingId: string, message?: string, opts: ClientOpts = {}): Promise<Booking> {
  return apiPost<Booking>(withQuery(`listings/${listingId}/book`, { message: message ?? null }), {}, opts);
}
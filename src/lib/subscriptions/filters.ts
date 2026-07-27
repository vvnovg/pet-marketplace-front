import type { ListingGender, ListingSearchParams, SubscriptionCreate, SubscriptionFilters } from "@/types/api";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface DescribeDeps {
  /** Переводчик секции Dashboard.subscriptionsPage. */
  t: Translate;
  /** Переводчик пола живёт в другой секции (Status.*), поэтому приходит отдельно. */
  genderLabel: (g: ListingGender) => string;
  categoryName: string | null;
  breedName: string | null;
}

/**
 * BigDecimal приезжает с бэкенда числом, а в типах помечен как Money = string,
 * поэтому приводим значение к строке явно вместо того, чтобы полагаться на тип.
 */
function range(t: Translate, min: unknown, max: unknown): string {
  if (min != null && max != null) return t("rangeBetween", { min: String(min), max: String(max) });
  if (min != null) return t("rangeFrom", { min: String(min) });
  return t("rangeTo", { max: String(max) });
}

export function describeSubscription(f: SubscriptionFilters, d: DescribeDeps): string[] {
  const parts: string[] = [];
  if (f.categoryId) parts.push(d.categoryName ?? d.t("unknownRef"));
  if (f.breedId) parts.push(d.breedName ?? d.t("unknownRef"));
  if (f.city) parts.push(d.t("filterCity", { value: f.city }));
  if (f.minPrice != null || f.maxPrice != null) {
    parts.push(d.t("filterPrice", { value: range(d.t, f.minPrice, f.maxPrice) }));
  }
  if (f.gender) parts.push(d.genderLabel(f.gender));
  if (f.minAge != null || f.maxAge != null) {
    parts.push(d.t("filterAge", { value: range(d.t, f.minAge, f.maxAge) }));
  }
  if (f.hasVaccination) parts.push(d.t("filterVaccination"));
  if (f.hasDocuments) parts.push(d.t("filterDocuments"));
  return parts;
}

/**
 * Собирает ссылку на каталог. hasVaccination/hasDocuments опущены намеренно:
 * страница каталога такие query-параметры не читает.
 */
export function subscriptionToCatalogQuery(f: SubscriptionFilters): string {
  const sp = new URLSearchParams();
  if (f.categoryId) sp.set("categoryId", f.categoryId);
  if (f.breedId) sp.set("breedId", f.breedId);
  if (f.city) sp.set("city", f.city);
  if (f.minPrice != null) sp.set("minPrice", String(f.minPrice));
  if (f.maxPrice != null) sp.set("maxPrice", String(f.maxPrice));
  if (f.gender) sp.set("gender", f.gender);
  if (f.minAge != null) sp.set("minAge", String(f.minAge));
  if (f.maxAge != null) sp.set("maxAge", String(f.maxAge));
  const q = sp.toString();
  return q ? `/catalog?${q}` : "/catalog";
}

/** Отбрасывает sortBy/sortDirection/page/size — бэкенд их в подписке не принимает. */
export function filtersToSubscriptionCreate(f: ListingSearchParams): SubscriptionCreate {
  return {
    categoryId: f.categoryId ?? null,
    breedId: f.breedId ?? null,
    city: f.city && f.city.trim() !== "" ? f.city : null,
    minPrice: f.minPrice ?? null,
    maxPrice: f.maxPrice ?? null,
    gender: f.gender ?? null,
    minAge: f.minAge ?? null,
    maxAge: f.maxAge ?? null,
    hasVaccination: null,
    hasDocuments: null,
  };
}

export function hasAnyFilter(c: SubscriptionCreate): boolean {
  return Object.values(c).some((v) => v !== null && v !== undefined && v !== "");
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { searchListings } from "@/lib/api/endpoints/catalog";
import { FiltersPanel, type CatalogFilters } from "@/components/catalog/FiltersPanel";
import { ListingCard } from "@/components/catalog/ListingCard";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { useDebouncedValue } from "@/components/shared/useDebouncedValue";
import { Button } from "@/components/ui/button";
import type { Listing, ListingImage, Page } from "@/types/api";
import type { Locale } from "@/lib/i18n/config";

type Gender = "MALE" | "FEMALE";
type Filters = {
  categoryId: string | null; breedId: string | null; city: string | null;
  minPrice: number | null; maxPrice: number | null;
  gender: Gender | null; minAge: number | null; maxAge: number | null;
  sortBy: string; sortDirection: "ASC" | "DESC"; page: number; size: number;
};

const DEFAULTS: Filters = {
  categoryId: null, breedId: null, city: null, minPrice: null, maxPrice: null,
  gender: null, minAge: null, maxAge: null, sortBy: "createdAt", sortDirection: "DESC", page: 0, size: 12,
};

const readInitial = (): Filters => {
  if (typeof window === "undefined") return { ...DEFAULTS };
  const sp = new URLSearchParams(window.location.search);
  const str = (k: string): string | null => sp.get(k);
  const num = (k: string): number | null => { const v = sp.get(k); return v ? (Number(v) || null) : null; };
  const nndef = (k: string, d: number): number => { const v = sp.get(k); return v ? Math.max(0, Number(v) || d) : d; };
  return {
    categoryId: str("categoryId"), breedId: str("breedId"), city: str("city"),
    minPrice: num("minPrice"), maxPrice: num("maxPrice"),
    gender: (str("gender") as Gender | null) ?? null, minAge: num("minAge"), maxAge: num("maxAge"),
    sortBy: str("sortBy") ?? "createdAt",
    sortDirection: (str("sortDirection") as Filters["sortDirection"]) ?? "DESC",
    page: nndef("page", 0), size: nndef("size", 12),
  };
};

const mainImage = (images: ListingImage[]): string | null => images.find((i) => i.isMain)?.url ?? images[0]?.url ?? null;

export default function CatalogPage() {
  const t = useTranslations("Catalog");
  const locale = useLocale() as Locale;
  const [filters, setFilters] = useState<Filters>(readInitial);
  const debouncedCity = useDebouncedValue(filters.city ?? "", 300);
  const debouncedMinPrice = useDebouncedValue(filters.minPrice, 300);
  const debouncedMaxPrice = useDebouncedValue(filters.maxPrice, 300);
  const debouncedMinAge = useDebouncedValue(filters.minAge, 300);
  const debouncedMaxAge = useDebouncedValue(filters.maxAge, 300);

  const params: CatalogFilters = useMemo(() => ({
    categoryId: filters.categoryId, breedId: filters.breedId,
    city: debouncedCity || null,
    minPrice: debouncedMinPrice, maxPrice: debouncedMaxPrice,
    gender: filters.gender, minAge: debouncedMinAge, maxAge: debouncedMaxAge,
    sortBy: filters.sortBy, sortDirection: filters.sortDirection,
    page: filters.page, size: filters.size,
  }), [filters.categoryId, filters.breedId, debouncedCity, debouncedMinPrice, debouncedMaxPrice, filters.gender, debouncedMinAge, debouncedMaxAge, filters.sortBy, filters.sortDirection, filters.page, filters.size]);

  const { data, isLoading, isError, refetch } = useQuery<Page<Listing>>({
    queryKey: ["catalog", "search", params, locale],
    queryFn: () => searchListings(params, locale),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams();
    if (filters.categoryId) sp.set("categoryId", filters.categoryId);
    if (filters.breedId) sp.set("breedId", filters.breedId);
    if (filters.city) sp.set("city", filters.city);
    if (filters.minPrice != null) sp.set("minPrice", String(filters.minPrice));
    if (filters.maxPrice != null) sp.set("maxPrice", String(filters.maxPrice));
    if (filters.gender) sp.set("gender", filters.gender);
    if (filters.minAge != null) sp.set("minAge", String(filters.minAge));
    if (filters.maxAge != null) sp.set("maxAge", String(filters.maxAge));
    if (filters.sortBy !== "createdAt") sp.set("sortBy", filters.sortBy);
    if (filters.sortDirection !== "DESC") sp.set("sortDirection", filters.sortDirection);
    if (filters.page) sp.set("page", String(filters.page));
    if (filters.size !== 12) sp.set("size", String(filters.size));
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }, [filters]);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    setFilters((f) => ({ ...f, page: 0 }));
  }, [filters.categoryId, filters.breedId, debouncedCity, filters.gender, debouncedMinPrice, debouncedMaxPrice, debouncedMinAge, debouncedMaxAge, filters.sortBy, filters.sortDirection]);

  const onReset = () => setFilters({ ...DEFAULTS });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <FiltersPanel filters={filters} onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))} onReset={onReset} />
        <div className="space-y-4">
          {isError ? (
            <EmptyState><div className="space-y-2"><div>{t("loadError")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{t("retry")}</Button></div></EmptyState>
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : (data?.content ?? []).length === 0 ? (
            <EmptyState>{t("empty")}</EmptyState>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">{t("resultsCount", { count: data?.totalElements ?? 0 })}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data?.content ?? []).map((l) => (
                  <ListingCard key={l.id} id={l.id} title={l.title} price={l.price} currency={l.currency}
                    locationCity={l.locationCity} mainImageUrl={mainImage(l.images)} status={l.status} />
                ))}
              </div>
            </>
          )}
          {data ? <Pagination page={data} onPageChange={(n) => setFilters((f) => ({ ...f, page: n }))} onSizeChange={(s) => setFilters((f) => ({ ...f, size: s, page: 0 }))} /> : null}
        </div>
      </div>
    </div>
  );
}
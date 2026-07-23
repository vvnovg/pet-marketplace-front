"use client";

import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getCategories, getBreeds } from "@/lib/api/endpoints/catalog";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ListingGender, ListingSearchParams } from "@/types/api";
import type { Locale } from "@/lib/i18n/config";

export type CatalogFilters = ListingSearchParams;

const SORTS = [
  { value: "createdAt:DESC", sortBy: "createdAt", sortDirection: "DESC" as const, labelKey: "sort.newest" },
  { value: "price:ASC", sortBy: "price", sortDirection: "ASC" as const, labelKey: "sort.priceAsc" },
  { value: "price:DESC", sortBy: "price", sortDirection: "DESC" as const, labelKey: "sort.priceDesc" },
  { value: "viewsCount:DESC", sortBy: "viewsCount", sortDirection: "DESC" as const, labelKey: "sort.popular" },
  { value: "sellerRating:DESC", sortBy: "sellerRating", sortDirection: "DESC" as const, labelKey: "sort.sellerRating" },
];

export function FiltersPanel({ filters, onChange, onReset }: {
  filters: CatalogFilters;
  onChange: (f: CatalogFilters) => void;
  onReset: () => void;
}) {
  const t = useTranslations("Catalog");
  const tS = useTranslations("Status");
  const locale = useLocale() as Locale;
  const { data: categories } = useQuery({ queryKey: ["catalog", "categories", locale], queryFn: () => getCategories(locale) });
  const { data: breeds } = useQuery({ queryKey: ["catalog", "breeds", filters.categoryId, locale], queryFn: () => getBreeds(filters.categoryId!, locale), enabled: !!filters.categoryId });

  const set = (patch: Partial<CatalogFilters>) => onChange({ ...filters, ...patch });
  const sortValue = `${filters.sortBy ?? "createdAt"}:${filters.sortDirection ?? "DESC"}`;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t("category")}</label>
        <Select aria-label={t("category")} value={filters.categoryId ?? ""} className="h-9 w-full"
          onChange={(e) => set({ categoryId: e.target.value || null, breedId: null })}>
          <option value="">{t("genderAny")}</option>
          {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t("breed")}</label>
        <Select aria-label={t("breed")} value={filters.breedId ?? ""} className="h-9 w-full" disabled={!filters.categoryId}
          onChange={(e) => set({ breedId: e.target.value || null })}>
          <option value="">{t("breedPlaceholder")}</option>
          {(breeds?.breeds ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t("city")}</label>
        <Input aria-label={t("city")} placeholder={t("cityPlaceholder")} value={filters.city ?? ""}
          onChange={(e) => set({ city: e.target.value || null })} className="h-9" />
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">{t("priceMin")}</label>
          <Input type="number" aria-label={t("priceMin")} value={filters.minPrice ?? ""}
            onChange={(e) => set({ minPrice: e.target.value ? Number(e.target.value) : null })} className="h-9" />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">{t("priceMax")}</label>
          <Input type="number" aria-label={t("priceMax")} value={filters.maxPrice ?? ""}
            onChange={(e) => set({ maxPrice: e.target.value ? Number(e.target.value) : null })} className="h-9" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t("gender")}</label>
        <Select aria-label={t("gender")} value={filters.gender ?? ""} className="h-9 w-full"
          onChange={(e) => set({ gender: (e.target.value || null) as ListingGender | null })}>
          <option value="">{t("genderAny")}</option>
          <option value="MALE">{tS("MALE")}</option>
          <option value="FEMALE">{tS("FEMALE")}</option>
        </Select>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">{t("ageMin")}</label>
          <Input type="number" aria-label={t("ageMin")} value={filters.minAge ?? ""}
            onChange={(e) => set({ minAge: e.target.value ? Number(e.target.value) : null })} className="h-9" />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">{t("ageMax")}</label>
          <Input type="number" aria-label={t("ageMax")} value={filters.maxAge ?? ""}
            onChange={(e) => set({ maxAge: e.target.value ? Number(e.target.value) : null })} className="h-9" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t("sortBy")}</label>
        <Select aria-label={t("sortBy")} value={sortValue} className="h-9 w-full"
          onChange={(e) => {
            const s = SORTS.find((x) => x.value === e.target.value);
            if (s) set({ sortBy: s.sortBy, sortDirection: s.sortDirection });
          }}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey as never)}</option>)}
        </Select>
      </div>
      <Button variant="ghost" size="sm" onClick={onReset}>{t("reset")}</Button>
    </div>
  );
}
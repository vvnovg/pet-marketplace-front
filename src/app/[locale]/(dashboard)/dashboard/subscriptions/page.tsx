"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n";
import { listSubscriptions, createSubscription, deleteSubscription } from "@/lib/api/endpoints/subscriptions";
import { getCategories, getBreeds } from "@/lib/api/endpoints/catalog";
import { FiltersPanel, type CatalogFilters } from "@/components/catalog/FiltersPanel";
import {
  describeSubscription, subscriptionToCatalogQuery, filtersToSubscriptionCreate, hasAnyFilter,
  type Translate,
} from "@/lib/subscriptions/filters";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/errors";
import type { Category, ListingGender, Subscription } from "@/types/api";
import type { Locale } from "@/lib/i18n/config";

const EMPTY_FILTERS: CatalogFilters = {
  categoryId: null, breedId: null, city: null, minPrice: null, maxPrice: null,
  gender: null, minAge: null, maxAge: null,
};

/** Плоский список категорий: дерево может быть вложенным. */
function flatten(categories: Category[]): Category[] {
  return categories.flatMap((c) => [c, ...flatten(c.children ?? [])]);
}

export default function SubscriptionsPage() {
  const t = useTranslations("Dashboard.subscriptionsPage");
  const tStatus = useTranslations("Status");
  const locale = useLocale() as Locale;
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogFilters>({ ...EMPTY_FILTERS });
  const [pendingDelete, setPendingDelete] = useState<Subscription | null>(null);

  const subs = useQuery<Subscription[]>({
    queryKey: ["subscriptions"],
    queryFn: () => listSubscriptions(),
  });
  const categories = useQuery<Category[]>({
    queryKey: ["catalog", "categories", locale],
    queryFn: () => getCategories(locale),
  });

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of flatten(categories.data ?? [])) map.set(c.id, c.name);
    return map;
  }, [categories.data]);

  // Породы нужны только для тех категорий, которые реально встречаются в подписках.
  const breedCategoryIds = useMemo(
    () => Array.from(new Set((subs.data ?? []).map((s) => s.filters.categoryId).filter((id): id is string => !!id))),
    [subs.data],
  );
  const breedQueries = useQuery({
    queryKey: ["catalog", "breeds", "bulk", breedCategoryIds, locale],
    enabled: breedCategoryIds.length > 0,
    queryFn: async () => {
      const map = new Map<string, string>();
      const pages = await Promise.all(breedCategoryIds.map((id) => getBreeds(id, locale).catch(() => null)));
      for (const p of pages) for (const b of p?.breeds ?? []) map.set(b.id, b.name);
      return map;
    },
  });

  const onApiError = (e: unknown) => toast.error(t("error", { detail: e instanceof ApiError ? e.detail : "—" }));

  const createMutation = useMutation({
    mutationFn: () => createSubscription(filtersToSubscriptionCreate(draft)),
    onSuccess: () => {
      toast.success(t("created"));
      setCreateOpen(false);
      setDraft({ ...EMPTY_FILTERS });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: onApiError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSubscription(id),
    onSuccess: () => {
      toast.success(t("deleted"));
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: onApiError,
  });

  const canSubmit = hasAnyFilter(filtersToSubscriptionCreate(draft));
  const genderLabel = (g: ListingGender) => tStatus(g as never);
  // next-intl типизирует ключ узким литеральным объединением, а Translate принимает
  // любую строку — приводим явно, как это уже делает StatusBadge через `as never`.
  const describeT = t as unknown as Translate;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button onClick={() => setCreateOpen(true)}>{t("create")}</Button>
      </div>

      {subs.isError ? (
        <EmptyState>
          <div className="space-y-2">
            <div>{t("loadError")}</div>
            <Button variant="outline" size="sm" onClick={() => subs.refetch()}>{t("retry")}</Button>
          </div>
        </EmptyState>
      ) : subs.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : (subs.data ?? []).length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {(subs.data ?? []).map((s) => {
            const parts = describeSubscription(s.filters, {
              t: describeT,
              genderLabel,
              categoryName: s.filters.categoryId ? categoryNames.get(s.filters.categoryId) ?? null : null,
              breedName: s.filters.breedId ? breedQueries.data?.get(s.filters.breedId) ?? null : null,
            });
            return (
              <li key={s.id}>
                <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm">{parts.join(" · ")}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("createdAt", { date: new Date(s.createdAt).toLocaleDateString(locale) })}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={subscriptionToCatalogQuery(s.filters)} className="text-sm underline">
                      {t("openInCatalog")}
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => setPendingDelete(s)}>{t("delete")}</Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createTitle")}</DialogTitle>
            <DialogDescription>{t("needFilter")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <FiltersPanel
              filters={draft}
              onChange={(f) => setDraft(f)}
              onReset={() => setDraft({ ...EMPTY_FILTERS })}
              showSort={false}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {t("createSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete != null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

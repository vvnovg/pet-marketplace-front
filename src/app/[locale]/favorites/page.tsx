"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { listFavorites } from "@/lib/api/endpoints/catalog";
import { ListingCard } from "@/components/catalog/ListingCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/auth/useSession";
import type { Favorite } from "@/types/api";

export default function FavoritesPage() {
  const t = useTranslations("Favorites");
  const { user } = useSession();
  const { data, isLoading, isError, refetch } = useQuery<Favorite[]>({
    queryKey: ["favorites"],
    queryFn: () => listFavorites(),
    enabled: !!user,
  });

  if (!user) {
    return <EmptyState>{t("loginRequired")}</EmptyState>;
  }
  if (isLoading) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-lg bg-muted" />)}</div>;
  }
  if (isError) {
    return <EmptyState><div className="space-y-2"><div>{t("loadError")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{t("retry")}</Button></div></EmptyState>;
  }
  if (!data || data.length === 0) {
    return <EmptyState>{t("empty")}</EmptyState>;
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((f) => (
          <ListingCard key={f.id} id={f.listing.id} title={f.listing.title} price={f.listing.price}
            currency={f.listing.currency} locationCity={f.listing.locationCity}
            mainImageUrl={f.listing.mainImageUrl} status={f.listing.status} />
        ))}
      </div>
    </div>
  );
}
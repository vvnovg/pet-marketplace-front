"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getListing } from "@/lib/api/endpoints/catalog";
import { ImageGallery } from "@/components/catalog/ImageGallery";
import { FavoriteButton } from "@/components/catalog/FavoriteButton";
import { BookingDialog } from "@/components/catalog/BookingDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import type { Listing } from "@/types/api";
import type { Locale } from "@/lib/i18n/config";

function initials(seller: Listing["seller"]): string {
  const a = (seller.firstName ?? "").trim()[0] ?? "";
  const b = (seller.lastName ?? "").trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

export default function ListingDetailPage() {
  const t = useTranslations("Listing");
  const tS = useTranslations("Status");
  const locale = useLocale() as Locale;
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? (params.id[0] ?? "") : "";
  const [bookingOpen, setBookingOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Listing>({
    queryKey: ["listing", id, locale],
    queryFn: () => getListing(id, locale),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="space-y-4"><div className="aspect-[4/3] animate-pulse rounded-lg bg-muted" /><div className="h-8 w-1/2 animate-pulse rounded bg-muted" /></div>;
  }
  if (isError || !data) {
    return <EmptyState><div className="space-y-2"><div>{t("notFound")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{t("loadError")}</Button></div></EmptyState>;
  }

  const l = data;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <ImageGallery images={l.images} />
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-bold">{l.title}</h1>
            <StatusBadge value={l.status} />
          </div>
          <div className="text-xl font-semibold">{l.price} {l.currency}</div>
          <div className="text-sm text-muted-foreground">{t("location")}: {[l.locationCity, l.locationCountry].filter(Boolean).join(", ") || "—"}</div>
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted-foreground">{t("category")}: </dt><dd className="inline">{l.categoryName}</dd></div>
            <div><dt className="inline text-muted-foreground">{t("breed")}: </dt><dd className="inline">{l.breedName ?? "—"}</dd></div>
            <div><dt className="inline text-muted-foreground">{t("gender")}: </dt><dd className="inline">{l.gender ? tS(l.gender as never) : "—"}</dd></div>
            <div><dt className="inline text-muted-foreground">{t("age")}: </dt><dd className="inline">{l.ageMonths} {t("ageUnit")}</dd></div>
            {l.color ? <div><dt className="inline text-muted-foreground">{t("color")}: </dt><dd className="inline">{l.color}</dd></div> : null}
            {l.weightKg ? <div><dt className="inline text-muted-foreground">{t("weight")}: </dt><dd className="inline">{l.weightKg} {t("weightUnit")}</dd></div> : null}
            <div><dt className="inline text-muted-foreground">{t("hasVaccination")}: </dt><dd className="inline">{l.hasVaccination == null ? t("unknown") : l.hasVaccination ? t("yes") : t("no")}</dd></div>
            <div><dt className="inline text-muted-foreground">{t("hasDocuments")}: </dt><dd className="inline">{l.hasDocuments == null ? t("unknown") : l.hasDocuments ? t("yes") : t("no")}</dd></div>
            <div><dt className="inline text-muted-foreground">{t("views")}: </dt><dd className="inline">{l.viewsCount}</dd></div>
            <div><dt className="inline text-muted-foreground">{t("posted")}: </dt><dd className="inline">{new Date(l.createdAt).toLocaleDateString()}</dd></div>
          </dl>
          <div className="flex gap-2">
            <FavoriteButton listingId={l.id} />
            <BookingDialog listingId={l.id} open={bookingOpen} onOpenChange={setBookingOpen} />
          </div>
        </div>
      </div>
      {l.description ? (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("healthInfo")}</h2>
          <p className="text-sm whitespace-pre-wrap">{l.description}</p>
        </div>
      ) : null}
      {l.healthInfo ? (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("healthInfo")}</h2>
          <p className="text-sm whitespace-pre-wrap">{l.healthInfo}</p>
        </div>
      ) : null}
      <div className="space-y-1 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{t("seller")}</h2>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">{initials(l.seller)}</div>
          <div className="text-sm">
            <div>{[l.seller.firstName, l.seller.lastName].filter(Boolean).join(" ") || "—"}</div>
            <div className="text-muted-foreground">{[l.seller.city, l.seller.country].filter(Boolean).join(", ") || "—"}</div>
            <div className="text-muted-foreground">★ {l.seller.rating ?? "—"} · {l.seller.totalReviews ?? 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
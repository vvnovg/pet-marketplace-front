"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import type { ListingStatus } from "@/types/api";

export interface ListingCardProps {
  id: string;
  title: string;
  price: string;
  currency: string;
  locationCity: string | null;
  mainImageUrl: string | null;
  status: ListingStatus;
}

export function ListingCard({ id, title, price, currency, locationCity, mainImageUrl, status }: ListingCardProps) {
  const t = useTranslations("Status");
  return (
    <Link href={`/listings/${id}`} className="block rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-[4/3] bg-muted">
        {mainImageUrl ? <img src={mainImageUrl} alt={title} className="h-full w-full object-cover" /> : null}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{title}</span>
          <Badge variant="outline">{t(status as never)}</Badge>
        </div>
        <div className="font-semibold">{price} {currency}</div>
        <div className="text-xs text-muted-foreground truncate">{locationCity ?? ""}</div>
      </div>
    </Link>
  );
}
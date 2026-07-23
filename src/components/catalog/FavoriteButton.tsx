"use client";

import { useTranslations, useLocale } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter, usePathname } from "@/i18n";
import { listFavorites, addFavorite, removeFavorite } from "@/lib/api/endpoints/catalog";
import { ApiError } from "@/lib/api/errors";
import { useSession } from "@/components/auth/useSession";
import { safeCallbackUrl } from "@/lib/auth/redirects";
import { Button } from "@/components/ui/button";

type FavLite = { id: string; listing: { id: string } };

export function FavoriteButton({ listingId }: { listingId: string }) {
  const t = useTranslations("Listing");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { user } = useSession();
  const userRole = user?.role;

  const { data: favorites } = useQuery({ queryKey: ["favorites"], queryFn: () => listFavorites(), enabled: !!user });
  const isFav = !!user && !!favorites?.some((f) => f.listing.id === listingId);

  const toggle = useMutation({
    mutationFn: () => (isFav ? removeFavorite(listingId) : addFavorite(listingId)),
    onMutate: () => {
      if (!user) return undefined;
      const prev = qc.getQueryData<FavLite[]>(["favorites"]);
      if (prev) {
        const next = isFav ? prev.filter((f) => f.listing.id !== listingId) : [...prev, { id: "tmp", listing: { id: listingId } }];
        qc.setQueryData(["favorites"], next);
      }
      return { prev };
    },
    onError: (e: unknown, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["favorites"], ctx.prev);
      if (e instanceof ApiError) toast.error(e.detail || t("bookingError"));
      else toast.error(t("bookingError"));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  if (!user) {
    return (
      <Button variant="outline" size="sm"
        onClick={() => router.replace(`/login?callbackUrl=${encodeURIComponent(safeCallbackUrl(pathname, locale, userRole))}`)}>
        {t("loginToFav")}
      </Button>
    );
  }

  return (
    <Button variant={isFav ? "default" : "outline"} size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
      {isFav ? t("removeFromFavorites") : t("addToFavorites")}
    </Button>
  );
}
"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n";
import { getPendingListings, moderateListing } from "@/lib/api/endpoints/admin";
import { ApiError } from "@/lib/api/errors";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmModerationDialog } from "@/components/admin/ConfirmModerationDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Listing, Page } from "@/types/api";
import type { Locale } from "@/lib/i18n/config";

export default function ListingsPendingPage() {
  const t = useTranslations("Admin");
  const tc = useTranslations("Admin.common");
  const tl = useTranslations("Admin.pendingListings");
  const locale = useLocale() as Locale;
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [dialog, setDialog] = useState<{ listing: Listing; kind: "approve" | "reject" } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<Page<Listing>>({
    queryKey: ["admin", "listings", "pending", { page, size, locale }],
    queryFn: () => getPendingListings(page, size, locale),
  });

  const mut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status: "ACTIVE" | "REJECTED"; reason?: string } }) => moderateListing(id, body, locale),
    onSuccess: () => { toast.success(tc("saved")); qc.invalidateQueries({ queryKey: ["admin", "listings", "pending"] }); setDialog(null); },
    onError: (e) => {
      setDialog(null);
      if (e instanceof ApiError && e.status === 403) toast.error(tc("forbidden"));
      else if (e instanceof ApiError) toast.error(tc("error", { detail: e.detail }));
      else toast.error(tc("error", { detail: "—" }));
    },
  });

  const mainImage = (l: Listing) => l.images.find((i) => i.isMain)?.url ?? l.images[0]?.url ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tl("title")}</h1>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">{t("back")}</Link>
      </div>

      {isError ? (
        <EmptyState><div className="space-y-2"><div>{tc("loadingError")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{tc("retry")}</Button></div></EmptyState>
      ) : isLoading || !data || data.empty ? (
        <EmptyState>{isLoading ? "…" : tc("empty")}</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.content.map((l) => (
            <Card key={l.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex gap-3">
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                    {mainImage(l) ? <img src={mainImage(l)!} alt={l.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{tl("noImage")}</div>}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2"><span className="truncate font-medium">{l.title}</span><StatusBadge value={l.status} /></div>
                    <div className="text-xs text-muted-foreground">{l.categoryName}{l.breedName ? " · " + l.breedName : ""}</div>
                    <div className="text-sm">{l.price} {l.currency}</div>
                    <div className="text-xs text-muted-foreground">{tl("seller")}: {l.seller.firstName ?? ""} {l.seller.lastName ?? ""} · {tl("location")}: {l.locationCity ?? "—"}</div>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{l.description}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setDialog({ listing: l, kind: "approve" })}>{tl("approve")}</Button>
                  <Button size="sm" variant="destructive" onClick={() => setDialog({ listing: l, kind: "reject" })}>{tl("reject")}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data ? <Pagination page={data} onPageChange={setPage} onSizeChange={(s) => { setSize(s); setPage(0); }} /> : null}

      <ConfirmModerationDialog
        open={!!dialog}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        kind={dialog?.kind ?? "approve"}
        submitting={mut.isPending}
        requireReason={dialog?.kind === "reject"}
        title={dialog?.kind === "approve" ? tl("confirmApproveTitle") : tl("confirmRejectTitle")}
        description={dialog?.kind === "approve" ? tl("confirmApproveDesc") : tl("confirmRejectDesc")}
        onConfirm={(reason) => {
          if (!dialog) return;
          mut.mutate({ id: dialog.listing.id, body: { status: dialog.kind === "approve" ? "ACTIVE" : "REJECTED", reason } });
        }}
      />
    </div>
  );
}
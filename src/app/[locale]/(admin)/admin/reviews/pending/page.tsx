"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n";
import { getPendingReviews, moderateReview } from "@/lib/api/endpoints/admin";
import { ApiError } from "@/lib/api/errors";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmModerationDialog } from "@/components/admin/ConfirmModerationDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Review, Page } from "@/types/api";

function Stars({ rating }: { rating: number }) {
  return <span aria-label={String(rating)}>{"★".repeat(rating)}{"☆".repeat(Math.max(0, 5 - rating))}</span>;
}

export default function ReviewsPendingPage() {
  const t = useTranslations("Admin");
  const tc = useTranslations("Admin.common");
  const tr = useTranslations("Admin.pendingReviews");
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [dialog, setDialog] = useState<{ review: Review; kind: "approve" | "reject" } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<Page<Review>>({
    queryKey: ["admin", "reviews", "pending", { page, size }],
    queryFn: () => getPendingReviews(page, size),
  });

  const mut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status: "APPROVED" | "REJECTED"; reason?: string } }) => moderateReview(id, body),
    onSuccess: () => { toast.success(tc("saved")); qc.invalidateQueries({ queryKey: ["admin", "reviews", "pending"] }); setDialog(null); },
    onError: (e) => {
      setDialog(null);
      if (e instanceof ApiError && e.status === 403) toast.error(tc("forbidden"));
      else if (e instanceof ApiError) toast.error(tc("error", { detail: e.detail }));
      else toast.error(tc("error", { detail: "—" }));
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tr("title")}</h1>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">{t("back")}</Link>
      </div>

      {isError ? (
        <EmptyState><div className="space-y-2"><div>{tc("loadingError")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{tc("retry")}</Button></div></EmptyState>
      ) : isLoading || !data || data.empty ? (
        <EmptyState>{isLoading ? "…" : tc("empty")}</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.content.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm"><span className="font-medium">{r.author.firstName ?? ""} {r.author.lastName ?? ""}</span> → <span>{r.recipient.firstName ?? ""} {r.recipient.lastName ?? ""}</span></div>
                  <StatusBadge value={r.status} />
                </div>
                <div className="text-xs text-muted-foreground">{tr("booking")}: #{r.booking?.id.slice(0, 8) ?? "—"} · {tr("rating")}: <Stars rating={r.rating} /></div>
                <p className="text-sm">{r.comment}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setDialog({ review: r, kind: "approve" })}>{tr("approve")}</Button>
                  <Button size="sm" variant="destructive" onClick={() => setDialog({ review: r, kind: "reject" })}>{tr("reject")}</Button>
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
        title={dialog?.kind === "approve" ? tr("confirmApproveTitle") : tr("confirmRejectTitle")}
        description={dialog?.kind === "approve" ? tr("confirmApproveDesc") : tr("confirmRejectDesc")}
        onConfirm={(reason) => { if (!dialog) return; mut.mutate({ id: dialog.review.id, body: { status: dialog.kind === "approve" ? "APPROVED" : "REJECTED", reason } }); }}
      />
    </div>
  );
}
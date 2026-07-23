"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ConfirmModerationDialog({
  open, onOpenChange, kind, title, description, requireReason, submitting, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: "approve" | "reject" | "block" | "unblock" | "role";
  title: string;
  description?: string;
  requireReason: boolean;
  submitting: boolean;
  onConfirm: (reason?: string) => void;
}) {
  const t = useTranslations("Admin.common");
  const [reason, setReason] = useState("");
  const reasonInvalid = requireReason && reason.trim().length === 0;
  const reasonTooLong = reason.length > 1000;
  const submit = () => {
    if (reasonInvalid || reasonTooLong || submitting) return;
    onConfirm(reason.trim() || undefined);
  };
  const confirmLabel = kind === "reject" || kind === "block" ? t("confirmReject") : t("confirmApprove");
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setReason(""); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            aria-label={t("reason")}
            placeholder={t("reasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
          />
          <div className="text-xs text-muted-foreground">
            {requireReason ? t("reasonRequired") : t("reasonOptional")}
            {reasonTooLong ? <span className="text-destructive"> {t("reasonTooLong")}</span> : null}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={submitting}>{t("cancel")}</Button></DialogClose>
          <Button
            variant={kind === "reject" || kind === "block" ? "destructive" : "default"}
            disabled={reasonInvalid || reasonTooLong || submitting}
            onClick={submit}
          >
            {submitting ? t("submitting") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
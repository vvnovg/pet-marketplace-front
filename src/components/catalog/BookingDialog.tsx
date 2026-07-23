"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter, usePathname } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { bookListing } from "@/lib/api/endpoints/catalog";
import { ApiError } from "@/lib/api/errors";
import { useSession } from "@/components/auth/useSession";
import { safeCallbackUrl } from "@/lib/auth/redirects";

export function BookingDialog({ listingId, open, onOpenChange }: { listingId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("Listing");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSession();
  const userRole = user?.role;
  const [message, setMessage] = useState("");

  const mut = useMutation({
    mutationFn: () => bookListing(listingId, message.trim() || undefined),
    onSuccess: () => { toast.success(t("bookingSuccess")); onOpenChange(false); setMessage(""); },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 400) toast.error(t("bookingAlreadyExists"));
      else if (e instanceof ApiError) toast.error(e.detail || t("bookingError"));
      else toast.error(t("bookingError"));
    },
  });

  if (!user) {
    return (
      <Button variant="default" size="sm"
        onClick={() => router.replace(`/login?callbackUrl=${encodeURIComponent(safeCallbackUrl(pathname, locale, userRole))}`)}>
        {t("book")}
      </Button>
    );
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={() => onOpenChange(true)}>{t("book")}</Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o) setMessage(""); onOpenChange(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("book")}</DialogTitle>
            <DialogDescription>{t("bookingMessage")}</DialogDescription>
          </DialogHeader>
          <Textarea aria-label={t("bookingMessage")} placeholder={t("bookingMessagePlaceholder")} value={message}
            onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={mut.isPending}>{t("bookingCancel")}</Button></DialogClose>
            <Button disabled={mut.isPending} onClick={() => mut.mutate()}>{t("bookingSubmit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
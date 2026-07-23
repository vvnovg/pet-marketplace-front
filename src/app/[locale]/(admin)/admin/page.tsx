"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n";

export default function AdminPage() {
  const t = useTranslations("Admin");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <nav className="flex flex-wrap gap-4">
        <Link href="/admin/users" className="rounded border px-3 py-2">{t("users")}</Link>
        <Link href="/admin/listings/pending" className="rounded border px-3 py-2">{t("pendingListings")}</Link>
        <Link href="/admin/reviews/pending" className="rounded border px-3 py-2">{t("pendingReviews")}</Link>
        <Link href="/admin/statistics" className="rounded border px-3 py-2">{t("statistics")}</Link>
      </nav>
    </div>
  );
}
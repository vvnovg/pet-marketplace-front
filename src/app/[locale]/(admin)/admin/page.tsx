"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n";

export default function AdminPage() {
  const t = useTranslations("Admin");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <nav className="flex flex-wrap gap-4">
        {/* Each Admin.<section> is an object (title plus that page's own captions), so the
            label has to name the `.title` leaf — asking for the section itself yields no
            string and next-intl renders the raw key path instead. */}
        <Link href="/admin/users" className="rounded border px-3 py-2">{t("users.title")}</Link>
        <Link href="/admin/listings/pending" className="rounded border px-3 py-2">{t("pendingListings.title")}</Link>
        <Link href="/admin/reviews/pending" className="rounded border px-3 py-2">{t("pendingReviews.title")}</Link>
        <Link href="/admin/statistics" className="rounded border px-3 py-2">{t("statistics.title")}</Link>
      </nav>
    </div>
  );
}
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { useSession } from "@/components/auth/useSession";

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const { user } = useSession();
  if (!user) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("welcome", { email: user.email ?? "" })}</h1>
      <nav className="flex flex-wrap gap-4">
        <Link href="/dashboard/profile" className="rounded border px-3 py-2">{t("profile")}</Link>
        {(user.role === "SELLER" || user.role === "ADMIN") && (
          <Link href="/dashboard/listings" className="rounded border px-3 py-2">{t("myListings")}</Link>
        )}
        <Link href="/dashboard/bookings" className="rounded border px-3 py-2">{t("bookings")}</Link>
        <Link href="/dashboard/messages" className="rounded border px-3 py-2">{t("messages")}</Link>
        <Link href="/dashboard/favorites" className="rounded border px-3 py-2">{t("favorites")}</Link>
        <Link href="/dashboard/subscriptions" className="rounded border px-3 py-2">{t("subscriptions")}</Link>
      </nav>
      <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
    </div>
  );
}
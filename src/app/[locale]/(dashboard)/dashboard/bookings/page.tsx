"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/EmptyState";

export default function DashboardBookingsPage() {
  const t = useTranslations("Dashboard");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("bookings")}</h1>
      <EmptyState>{t("comingSoon")}</EmptyState>
    </div>
  );
}

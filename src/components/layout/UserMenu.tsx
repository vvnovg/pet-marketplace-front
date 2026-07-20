"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
// Phase 1 stub: real auth-aware menu lands in Phase 2.
export function UserMenu() {
  const t = useTranslations("Nav");
  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className="text-sm">{t("login")}</Link>
      <Link href="/register" className="text-sm">{t("register")}</Link>
    </div>
  );
}
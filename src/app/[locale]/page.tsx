"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { Button } from "@/components/ui/button";

export default function Home() {
  const t = useTranslations("Home");
  return (
    <div className="space-y-6 text-center py-12">
      <h1 className="text-3xl font-bold">{t("welcome")}</h1>
      <p className="text-muted-foreground">{t("subtitle")}</p>
      <Link href="/catalog"><Button size="lg">{t("goToCatalog")}</Button></Link>
    </div>
  );
}
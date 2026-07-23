"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { Page } from "@/types/api";

const SIZES = [10, 20, 50];

export function Pagination({
  page, onPageChange, onSizeChange,
}: {
  page: Page<unknown>;
  onPageChange: (n: number) => void;
  onSizeChange: (s: number) => void;
}) {
  const t = useTranslations("Admin.common");
  if (page.empty && page.totalElements === 0) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="text-sm text-muted-foreground">
        {t("pageInfo", { number: page.number + 1, total: page.totalPages, elements: page.totalElements })}
      </div>
      <div className="flex items-center gap-2">
        <Select
          aria-label={t("pageSize")}
          value={String(page.size)}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="h-9 w-20"
        >
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Button variant="outline" size="sm" disabled={page.first} onClick={() => onPageChange(page.number - 1)}>{t("prev")}</Button>
        <Button variant="outline" size="sm" disabled={page.last} onClick={() => onPageChange(page.number + 1)}>{t("next")}</Button>
      </div>
    </div>
  );
}
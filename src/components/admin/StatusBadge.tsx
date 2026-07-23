"use client";
import { useTranslations } from "next-intl";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const VARIANT: Record<string, BadgeProps["variant"]> = {
  ACTIVE: "success",
  PENDING_MODERATION: "warning",
  REJECTED: "destructive",
  PENDING: "warning",
  APPROVED: "success",
  CONFIRMED: "success",
  CANCELLED: "destructive",
  COMPLETED: "secondary",
  ADMIN: "default",
  MODERATOR: "secondary",
  SELLER: "outline",
  BUYER: "outline",
  SOLD: "secondary",
  RESERVED: "warning",
  DRAFT: "outline",
  ARCHIVED: "outline",
};

export function StatusBadge({ value }: { value: string }) {
  const t = useTranslations("Status");
  return <Badge variant={VARIANT[value] ?? "outline"}>{t(value as never)}</Badge>;
}
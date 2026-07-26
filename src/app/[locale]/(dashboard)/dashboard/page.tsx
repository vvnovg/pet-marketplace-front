"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n";
import { useSession } from "@/components/auth/useSession";
import { listFavorites } from "@/lib/api/endpoints/catalog";
import { getConversations } from "@/lib/api/endpoints/messages";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import type { Conversation, Favorite } from "@/types/api";

interface OverviewCard {
  href: string;
  labelKey: string;
  count?: number;
  loading?: boolean;
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const { user } = useSession();

  const favorites = useQuery<Favorite[]>({
    queryKey: ["favorites"],
    queryFn: () => listFavorites(),
    enabled: !!user,
    retry: false,
  });
  const conversations = useQuery<Conversation[]>({
    queryKey: ["messages", "conversations"],
    queryFn: () => getConversations(),
    enabled: !!user,
    retry: false,
  });

  if (!user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || (user.email ?? "");
  const initials = (
    (user.firstName ?? user.email ?? "?").slice(0, 1) + (user.lastName ?? "").slice(0, 1)
  ).toUpperCase();
  const unread = conversations.data?.reduce((sum, c) => sum + c.unreadCount, 0);

  const cards: OverviewCard[] = [
    { href: "/dashboard/profile", labelKey: "profile" },
    ...(user.role === "SELLER" || user.role === "ADMIN"
      ? [{ href: "/dashboard/listings", labelKey: "myListings" }]
      : []),
    { href: "/dashboard/bookings", labelKey: "bookings" },
    {
      href: "/dashboard/messages",
      labelKey: "messages",
      count: conversations.isError ? undefined : unread,
      loading: conversations.isLoading,
    },
    {
      href: "/favorites",
      labelKey: "favorites",
      count: favorites.isError ? undefined : favorites.data?.length,
      loading: favorites.isLoading,
    },
    { href: "/dashboard/subscriptions", labelKey: "subscriptions" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("welcome", { email: user.email ?? "" })}</h1>

      <Card className="flex items-center gap-4 p-4">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={name} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
            {initials}
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <div className="truncate font-medium">{name}</div>
          <StatusBadge value={user.role} />
          {user.totalReviews ? (
            <div className="text-sm text-muted-foreground">
              {t("ratingLine", { rating: String(user.rating ?? 0), count: user.totalReviews })}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-lg border p-4 transition-colors hover:bg-muted">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{t(c.labelKey as never)}</span>
              {c.loading ? (
                <span
                  data-testid={`skeleton-${c.labelKey}`}
                  className="h-5 w-8 shrink-0 animate-pulse rounded bg-muted"
                />
              ) : c.count != null ? (
                <span
                  data-testid={`count-${c.labelKey}`}
                  className="shrink-0 rounded bg-muted px-2 py-0.5 text-sm tabular-nums"
                >
                  {c.count}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t(`cards.${c.labelKey}` as never)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

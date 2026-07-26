"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n";
import { useSession } from "@/components/auth/useSession";
import { cn } from "@/lib/utils/cn";
import type { Role } from "@/types/api";

export interface NavItem {
  href: string;
  labelKey: string;
  roles?: Role[];
}

export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "overview" },
  { href: "/dashboard/profile", labelKey: "profile" },
  { href: "/dashboard/listings", labelKey: "myListings", roles: ["SELLER", "ADMIN"] },
  { href: "/dashboard/bookings", labelKey: "bookings" },
  { href: "/dashboard/messages", labelKey: "messages" },
  { href: "/favorites", labelKey: "favorites" },
  { href: "/dashboard/subscriptions", labelKey: "subscriptions" },
];

/**
 * `/dashboard` совпадает только точно, иначе обзор подсвечивался бы на всех
 * вложенных страницах. Для остальных пунктов — точное совпадение или префикс с
 * разделителем `/`, чтобы `/dashboard/listings` не совпадал с `/dashboard/listings-archive`.
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const t = useTranslations("Dashboard");
  const pathname = usePathname();
  const { user } = useSession();

  const items = DASHBOARD_NAV.filter((i) => !i.roles || (user != null && i.roles.includes(user.role)));

  return (
    <nav aria-label={t("navLabel")} className="md:w-56 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
        {items.map((i) => {
          const active = isNavItemActive(i.href, pathname);
          return (
            <li key={i.href} className="shrink-0 md:shrink">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded px-3 py-2 text-sm hover:bg-muted",
                  active && "bg-muted font-medium",
                )}
              >
                {t(i.labelKey as never)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

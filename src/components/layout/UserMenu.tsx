"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/auth/useSession";
import { logoutViaApi } from "@/lib/api/endpoints/auth";

export function UserMenu() {
  const t = useTranslations("Nav");
  const tAuth = useTranslations("Auth.userMenu");
  const { user } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="text-sm">{t("login")}</Link>
        <Link href="/register" className="text-sm">{t("register")}</Link>
      </div>
    );
  }

  const initials = ((user.firstName ?? user.email ?? "?").slice(0, 1) + (user.lastName ?? "").slice(0, 1)).toUpperCase();

  const onLogout = async () => {
    await logoutViaApi();
    qc.removeQueries({ queryKey: ["session"] });
    router.replace("/");
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={user.email ?? "user"}
        className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">{initials}</span>
        <span>{user.email}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-44 rounded border bg-background p-1 text-sm shadow">
          <Link href="/dashboard" className="block px-2 py-1 hover:bg-muted" onClick={() => setOpen(false)}>{tAuth("dashboard")}</Link>
          <Link href="/dashboard/profile" className="block px-2 py-1 hover:bg-muted" onClick={() => setOpen(false)}>{tAuth("profile")}</Link>
          {(user.role === "ADMIN" || user.role === "MODERATOR") && (
            <Link href="/admin" className="block px-2 py-1 hover:bg-muted" onClick={() => setOpen(false)}>{tAuth("admin")}</Link>
          )}
          <button type="button" className="block w-full px-2 py-1 text-left hover:bg-muted" onClick={onLogout}>{tAuth("logout")}</button>
        </div>
      )}
    </div>
  );
}
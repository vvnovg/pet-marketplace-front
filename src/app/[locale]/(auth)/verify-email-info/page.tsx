"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n";
import { verifyEmailViaApi } from "@/lib/api/endpoints/auth";
import { AuthCard } from "../auth-card";

export default function VerifyEmailInfoPage() {
  const t = useTranslations("Auth.verifyEmailInfo");
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isDev = process.env.NODE_ENV !== "production";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyEmailViaApi(token.trim());
      router.replace("/login?verified=1");
    } catch {
      setError(t("devHelperError"));
    }
  };

  return (
    <AuthCard title={t("title")}>
      <p className="mb-4 text-sm">{t("success")}</p>
      {isDev && (
        <form onSubmit={onSubmit} className="space-y-2 border-t pt-3">
          <label className="block">
            <span className="text-sm">{t("devHelperLabel")}</span>
            <input value={token} onChange={(e) => setToken(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1" />
          </label>
          <button type="submit" className="rounded bg-primary px-3 py-2 text-primary-foreground">{t("devHelperButton")}</button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      )}
      <div className="mt-3 text-sm">
        <Link href="/register">{t("backToRegister")}</Link>
      </div>
    </AuthCard>
  );
}
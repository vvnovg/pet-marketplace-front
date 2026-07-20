"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n";
import { resetSchema, type ResetInput } from "@/lib/validation/auth-schemas";
import { resetPasswordViaApi } from "@/lib/api/endpoints/auth";
import { AuthCard } from "../auth-card";

type SearchParams = { token?: string };

// Resolve a Promise<SearchParams> prop in a client-safe way.
//
// Mirrors the login page (Task 8) approved pattern: render synchronously, then
// resolve the Promise prop into state on the next microtask. Avoids React.use,
// which suspended indefinitely under React 19 + vitest/jsdom act in Task 8.
function useResolvedProp(searchParams?: Promise<SearchParams> | SearchParams): SearchParams {
  const [params, setParams] = useState<SearchParams>(
    searchParams instanceof Promise ? {} : (searchParams ?? {}),
  );
  useEffect(() => {
    if (searchParams instanceof Promise) {
      let active = true;
      searchParams.then((p) => { if (active) setParams(p); });
      return () => { active = false; };
    }
    setParams(searchParams ?? {});
  }, [searchParams]);
  return params;
}

export default function ResetPasswordPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const t = useTranslations("Auth.resetPassword");
  const locale = useLocale();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  // Prefer the URL query (browser, synchronous in production), fall back to the
  // resolved prop (test/SSR, resolves on the next microtask).
  const urlToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
  const propParams = useResolvedProp(searchParams);
  const token = urlToken ?? propParams.token ?? null;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirm: "" },
  });

  const onSubmit = async (data: ResetInput) => {
    setServerError(null);
    try {
      await resetPasswordViaApi(token ?? "", data.newPassword);
      router.replace(`/${locale}/login?reset=1`);
    } catch {
      setServerError(t("error"));
    }
  };

  if (!token) return <AuthCard title={t("title")}><p className="text-sm text-destructive">{t("error")}</p></AuthCard>;

  return (
    <AuthCard title={t("title")}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <label className="block">
          <span className="text-sm">{t("newPassword")}</span>
          <input type="password" {...register("newPassword")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.newPassword && <span className="text-xs text-destructive">{errors.newPassword.message}</span>}
        </label>
        <label className="block">
          <span className="text-sm">{t("confirm")}</span>
          <input type="password" {...register("confirm")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.confirm && <span className="text-xs text-destructive">{t("mismatch")}</span>}
        </label>
        {serverError && <p className="text-xs text-destructive">{serverError}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">{t("submit")}</button>
      </form>
      <div className="mt-3 text-sm"><Link href="/login">←</Link></div>
    </AuthCard>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n";
import { loginSchema, type LoginInput } from "@/lib/validation/auth-schemas";
import { loginViaApi } from "@/lib/api/endpoints/auth";
import { ApiError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/api/endpoints/users";
import { redirectAfterLogin } from "@/lib/auth/redirects";
import type { UserProfile } from "@/types/api";
import { AuthCard } from "../auth-card";

type SearchParams = { callbackUrl?: string; verified?: string; reset?: string };

// Resolve a Promise<SearchParams> prop in a client-safe way.
//
// Next 15 client components cannot reliably receive `searchParams` as a prop
// (that's a server-component feature), but the test supplies it as a Promise
// prop, so we support both: the URL (browser) and the resolved prop (test/SSR),
// preferring the URL. We resolve the Promise via useEffect+useState rather than
// React.use so the form renders synchronously (no Suspense boundary needed) and
// the resolved values land in state on the following microtask.
function useResolvedProp(searchParams: Promise<SearchParams> | SearchParams): SearchParams {
  const [params, setParams] = useState<SearchParams>(
    searchParams instanceof Promise ? {} : searchParams,
  );
  useEffect(() => {
    if (searchParams instanceof Promise) {
      let active = true;
      searchParams.then((p) => { if (active) setParams(p); });
      return () => { active = false; };
    }
    setParams(searchParams);
  }, [searchParams]);
  return params;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> | SearchParams }) {
  const t = useTranslations("Auth.login");
  const locale = useLocale();
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  // Prefer the URL query (browser), fall back to the resolved prop (test/SSR).
  const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const propParams = useResolvedProp(searchParams);
  const callbackUrl = sp.get("callbackUrl") ?? propParams.callbackUrl ?? null;
  const verified = (sp.get("verified") ?? propParams.verified) === "1";
  const reset = (sp.get("reset") ?? propParams.reset) === "1";

  const onSubmit = async (data: LoginInput) => {
    try {
      await loginViaApi(data.email, data.password);
      const me = await getCurrentUser().catch(() => null as UserProfile | null);
      const target = redirectAfterLogin(me, callbackUrl, locale);
      router.replace(target);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("password", { message: t("invalidCredentials") });
      } else if (e instanceof ApiError && e.violations.length) {
        for (const v of e.violations) {
          setError(v.field as keyof LoginInput, { message: v.message });
        }
      } else {
        setError("password", { message: t("invalidCredentials") });
      }
    }
  };

  return (
    <AuthCard title={t("title")}>
      {verified && <p className="mb-3 rounded bg-primary/10 p-2 text-sm">{t("verifiedBanner")}</p>}
      {reset && <p className="mb-3 rounded bg-primary/10 p-2 text-sm">{t("resetBanner")}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <label className="block">
          <span className="text-sm">{t("email")}</span>
          <input type="email" autoComplete="email" {...register("email")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
        </label>
        <label className="block">
          <span className="text-sm">{t("password")}</span>
          <input type="password" autoComplete="current-password" {...register("password")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.password && <span className="text-xs text-destructive">{errors.password.message}</span>}
        </label>
        <button type="submit" disabled={isSubmitting} className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">
          {t("submit")}
        </button>
      </form>
      <div className="mt-3 flex justify-between text-sm">
        <Link href="/forgot-password">{t("forgotLink")}</Link>
        <Link href="/register">{t("registerLink")}</Link>
      </div>
    </AuthCard>
  );
}
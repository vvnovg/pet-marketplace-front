"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { verifyEmailViaApi } from "@/lib/api/endpoints/auth";
import { AuthCard } from "../auth-card";

type SearchParams = { token?: string };

// Resolve a Promise<SearchParams> prop in a client-safe way.
//
// Next 15 client components cannot reliably receive `searchParams` as a prop
// (that's a server-component feature), but the test supplies it as a Promise
// prop, so we support both: the URL (browser) and the resolved prop (test/SSR),
// preferring the URL. We resolve the Promise via useEffect+useState rather than
// React.use so the page renders synchronously (no Suspense boundary needed) and
// the resolved values land in state on the following microtask. See the login
// page (Task 8) for the approved pattern this mirrors.
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

export default function VerifyEmailPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const t = useTranslations("Auth.verifyEmail");
  const [state, setState] = useState<"loading" | "success" | "error">("loading");

  // Prefer the URL query (browser), fall back to the resolved prop (test/SSR).
  const urlToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
  const propParams = useResolvedProp(searchParams);
  const token = urlToken ?? propParams.token ?? null;

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    let cancelled = false;
    verifyEmailViaApi(token)
      .then(() => { if (!cancelled) setState("success"); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <AuthCard title={t("success")}>
      {state === "loading" && <p>{t("loading")}</p>}
      {state === "success" && (
        <>
          <p className="mb-3 text-sm">{t("success")}</p>
          <Link href="/login" className="text-sm underline">{t("toLogin")}</Link>
        </>
      )}
      {state === "error" && (
        <>
          <p className="mb-3 text-sm text-destructive">{t("error")}</p>
          <Link href="/register" className="text-sm underline">{t("backToRegister")}</Link>
        </>
      )}
    </AuthCard>
  );
}
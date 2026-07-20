"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { forgotSchema, type ForgotInput } from "@/lib/validation/auth-schemas";
import { forgotPasswordViaApi } from "@/lib/api/endpoints/auth";
import { AuthCard } from "../auth-card";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth.forgotPassword");
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotInput>({ resolver: zodResolver(forgotSchema) });

  // Always show the success message — the backend must not reveal account
  // existence. We wrap in try/finally so the UX guarantee holds even when the
  // API throws (network error, 500, etc.); setDone(true) runs regardless.
  const onSubmit = async (_data: ForgotInput) => {
    try {
      await forgotPasswordViaApi(_data.email);
    } finally {
      setDone(true);
    }
  };

  return (
    <AuthCard title={t("title")}>
      {done ? (
        <p className="text-sm">{t("success")}</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <label className="block">
            <span className="text-sm">{t("email")}</span>
            <input type="email" {...register("email")} className="mt-1 block w-full rounded border px-2 py-1" />
            {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
          </label>
          <button type="submit" disabled={isSubmitting} className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">{t("submit")}</button>
        </form>
      )}
      <div className="mt-3 text-sm"><Link href="/login">←</Link></div>
    </AuthCard>
  );
}
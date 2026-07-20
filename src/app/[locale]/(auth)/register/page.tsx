"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth-schemas";
import { registerViaApi } from "@/lib/api/endpoints/auth";
import { ApiError } from "@/lib/api/errors";
import { AuthCard } from "../auth-card";

export default function RegisterPage() {
  const t = useTranslations("Auth.register");
  const locale = useLocale();
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    try {
      const body = {
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
      };
      await registerViaApi(body);
      router.replace(`/${locale}/verify-email-info`);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 409) setError("email", { message: e.detail || "exists" });
        for (const v of e.violations) setError(v.field as keyof RegisterInput, { message: v.message });
      }
    }
  };

  return (
    <AuthCard title={t("title")}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <label className="block">
          <span className="text-sm">{t("email")}</span>
          <input type="email" {...register("email")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
        </label>
        <label className="block">
          <span className="text-sm">{t("password")}</span>
          <input type="password" {...register("password")} className="mt-1 block w-full rounded border px-2 py-1" />
          {errors.password && <span className="text-xs text-destructive">{errors.password.message}</span>}
        </label>
        <label className="block">
          <span className="text-sm">{t("phone")}</span>
          <input type="tel" {...register("phone")} className="mt-1 block w-full rounded border px-2 py-1" />
        </label>
        <label className="block">
          <span className="text-sm">{t("firstName")}</span>
          <input {...register("firstName")} className="mt-1 block w-full rounded border px-2 py-1" />
        </label>
        <label className="block">
          <span className="text-sm">{t("lastName")}</span>
          <input {...register("lastName")} className="mt-1 block w-full rounded border px-2 py-1" />
        </label>
        <button type="submit" disabled={isSubmitting} className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">
          {t("submit")}
        </button>
      </form>
      <div className="mt-3 text-sm">
        <Link href="/login">{t("loginLink")}</Link>
      </div>
    </AuthCard>
  );
}
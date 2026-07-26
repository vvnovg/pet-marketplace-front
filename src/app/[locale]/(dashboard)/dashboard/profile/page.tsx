"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/components/auth/useSession";
import { updateProfile, uploadAvatar } from "@/lib/api/endpoints/profile";
import { profileSchema, toProfileUpdate, MAX_AVATAR_BYTES, type ProfileInput } from "@/lib/validation/profile-schemas";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

const FIELDS = ["firstName", "lastName", "phone", "country", "city", "address"] as const;

export default function ProfilePage() {
  const t = useTranslations("Dashboard.profilePage");
  const { user } = useSession();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    // `values` (а не defaultValues) перезаполняет форму, когда сессия догрузится.
    values: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
      bio: user?.bio ?? "",
      country: user?.country ?? "",
      city: user?.city ?? "",
      address: user?.address ?? "",
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      toast.success(t("avatarSaved"));
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e) => toast.error(t("error", { detail: e instanceof ApiError ? e.detail : "—" })),
  });

  const onSubmit = async (data: ProfileInput) => {
    try {
      await updateProfile(toProfileUpdate(data));
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["session"] });
    } catch (e) {
      if (e instanceof ApiError && e.violations.length) {
        for (const v of e.violations) setError(v.field as keyof ProfileInput, { message: v.message });
      } else {
        toast.error(t("error", { detail: e instanceof ApiError ? e.detail : "—" }));
      }
    }
  };

  const onPickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      // Бэкенд отклонит такой файл сам, но проверяем локально, чтобы не гонять его по сети.
      setAvatarError(t("avatarTooLarge"));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setAvatarError(null);
    avatarMutation.mutate(file);
  };

  if (!user) return null;

  const initials = (
    (user.firstName ?? user.email ?? "?").slice(0, 1) + (user.lastName ?? "").slice(0, 1)
  ).toUpperCase();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <Card className="space-y-3 p-4">
        <h2 className="font-medium">{t("avatarTitle")}</h2>
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
              {initials}
            </span>
          )}
          <label className="block text-sm">
            <span className="sr-only">{t("avatarTitle")}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label={t("avatarTitle")}
              disabled={avatarMutation.isPending}
              onChange={(e) => onPickAvatar(e.target.files?.[0])}
              className="block text-sm"
            />
          </label>
        </div>
        {avatarError && <p className="text-sm text-destructive">{avatarError}</p>}
      </Card>

      <Card className="p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f} className="block space-y-1">
                <span className="text-sm">{t(f)}</span>
                <Input id={`profile-${f}`} aria-label={t(f)} {...register(f)} />
                {errors[f] && <span className="text-xs text-destructive">{errors[f]?.message}</span>}
              </label>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-sm">{t("bio")}</span>
            <Textarea rows={5} aria-label={t("bio")} {...register("bio")} />
            {errors.bio && <span className="text-xs text-destructive">{errors.bio.message}</span>}
          </label>
          <Button type="submit" disabled={isSubmitting}>{t("save")}</Button>
        </form>
      </Card>
    </div>
  );
}

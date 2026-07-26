import { apiPut, apiUpload, type ClientOpts } from "@/lib/api/client";
import type { ProfileUpdate, UserProfile } from "@/types/api";

export function updateProfile(body: ProfileUpdate, opts: ClientOpts = {}): Promise<UserProfile> {
  return apiPut<UserProfile>("users/me", body, opts);
}

export function uploadAvatar(file: File | Blob, opts: ClientOpts = {}): Promise<UserProfile> {
  return apiUpload<UserProfile>("users/me/avatar", file, "file", opts);
}

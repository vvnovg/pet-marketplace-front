import { apiGet } from "@/lib/api/client";
import type { UserProfile, PublicProfile, Page, Listing } from "@/types/api";
import type { ClientOpts } from "@/lib/api/client";

export function getCurrentUser(opts: ClientOpts = {}): Promise<UserProfile> {
  return apiGet<UserProfile>("users/me", opts);
}
export function getPublicProfile(id: string, opts: ClientOpts = {}): Promise<PublicProfile> {
  return apiGet<PublicProfile>(`users/${id}`, opts);
}
export function getUserListings(id: string, page = 0, size = 20, opts: ClientOpts = {}): Promise<Page<Listing>> {
  return apiGet<Page<Listing>>(`users/${id}/listings?page=${page}&size=${size}`, opts);
}
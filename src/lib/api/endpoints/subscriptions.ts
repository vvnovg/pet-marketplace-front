import { apiGet, apiPost, apiDelete, type ClientOpts } from "@/lib/api/client";
import type { Subscription, SubscriptionCreate } from "@/types/api";

export function listSubscriptions(opts: ClientOpts = {}): Promise<Subscription[]> {
  return apiGet<Subscription[]>("subscriptions", opts);
}

export function createSubscription(body: SubscriptionCreate, opts: ClientOpts = {}): Promise<Subscription> {
  return apiPost<Subscription>("subscriptions", body, opts);
}

export function deleteSubscription(id: string, opts: ClientOpts = {}): Promise<void> {
  return apiDelete(`subscriptions/${id}`, opts);
}

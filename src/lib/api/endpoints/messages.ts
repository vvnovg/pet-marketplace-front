import { apiGet, type ClientOpts } from "@/lib/api/client";
import type { Conversation } from "@/types/api";

export function getConversations(opts: ClientOpts = {}): Promise<Conversation[]> {
  return apiGet<Conversation[]>("messages", opts);
}

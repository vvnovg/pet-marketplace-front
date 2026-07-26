import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { getConversations } from "@/lib/api/endpoints/messages";

let lastUrl = "";
const server = setupServer(
  http.get("*/api/proxy/messages", ({ request }) => {
    lastUrl = request.url;
    return HttpResponse.json([{ partner: { id: "p1" }, lastMessage: null, unreadCount: 3 }]);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { lastUrl = ""; server.resetHandlers(); });
afterAll(() => server.close());

describe("message endpoints", () => {
  it("getConversations GETs messages and returns unread counts", async () => {
    const res = await getConversations({ baseUrl: "http://t" });
    expect(lastUrl).toBe("http://t/api/proxy/messages");
    expect(res[0]!.unreadCount).toBe(3);
  });
});

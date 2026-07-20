import { describe, it, expect } from "vitest";
import { roleBasedHome, safeCallbackUrl, redirectAfterLogin } from "@/lib/auth/redirects";

describe("roleBasedHome", () => {
  it("admin → /{locale}/admin", () => expect(roleBasedHome("ru", "ADMIN")).toBe("/ru/admin"));
  it("moderator → /{locale}/admin", () => expect(roleBasedHome("ru", "MODERATOR")).toBe("/ru/admin"));
  it("buyer → /{locale}/dashboard", () => expect(roleBasedHome("ru", "BUYER")).toBe("/ru/dashboard"));
  it("seller → /{locale}/dashboard", () => expect(roleBasedHome("en", "SELLER")).toBe("/en/dashboard"));
  it("undefined role → dashboard", () => expect(roleBasedHome("ru", undefined)).toBe("/ru/dashboard"));
});

describe("safeCallbackUrl", () => {
  it("accepts same-origin path", () => expect(safeCallbackUrl("/ru/dashboard/messages", "ru", "BUYER")).toBe("/ru/dashboard/messages"));
  it("rejects protocol-relative //", () => expect(safeCallbackUrl("//evil.com", "ru", "BUYER")).toBe("/ru/dashboard"));
  it("rejects javascript scheme", () => expect(safeCallbackUrl("javascript:alert(1)", "ru", "BUYER")).toBe("/ru/dashboard"));
  it("rejects external https", () => expect(safeCallbackUrl("https://evil.com", "ru", "BUYER")).toBe("/ru/dashboard"));
  it("rejects empty → role home", () => expect(safeCallbackUrl("", "ru", "ADMIN")).toBe("/ru/admin"));
  it("rejects null → role home", () => expect(safeCallbackUrl(null, "ru", "BUYER")).toBe("/ru/dashboard"));
});

describe("redirectAfterLogin", () => {
  it("uses callbackUrl when safe", () =>
    expect(redirectAfterLogin({ role: "BUYER" }, "/ru/dashboard/messages", "ru")).toBe("/ru/dashboard/messages"));
  it("admin without callback → /admin", () => expect(redirectAfterLogin({ role: "ADMIN" }, null, "ru")).toBe("/ru/admin"));
  it("buyer without callback → /dashboard", () => expect(redirectAfterLogin({ role: "BUYER" }, null, "ru")).toBe("/ru/dashboard"));
  it("unsafe callback → role home", () =>
    expect(redirectAfterLogin({ role: "BUYER" }, "//evil.com", "ru")).toBe("/ru/dashboard"));
});
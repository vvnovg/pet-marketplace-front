import type { Role } from "@/types/api";

export function roleBasedHome(locale: string, role: Role | undefined | null): string {
  return role === "ADMIN" || role === "MODERATOR" ? `/${locale}/admin` : `/${locale}/dashboard`;
}

export function safeCallbackUrl(raw: string | null | undefined, locale: string, role: Role | undefined | null): string {
  if (raw) {
    const decoded = decodeURIComponent(raw);
    // Only same-origin absolute paths: starts with single "/", not "//", no scheme (":").
    if (decoded.startsWith("/") && !decoded.startsWith("//") && !decoded.includes(":")) {
      return decoded;
    }
  }
  return roleBasedHome(locale, role);
}

export function redirectAfterLogin(
  user: { role: Role } | null | undefined,
  callbackUrl: string | null | undefined,
  locale: string,
): string {
  return safeCallbackUrl(callbackUrl, locale, user?.role);
}
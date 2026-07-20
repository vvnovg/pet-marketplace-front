import { locales } from "@/lib/i18n/config";
import type { Role } from "@/types/api";

export function roleBasedHome(locale: string, role: Role | undefined | null): string {
  return role === "ADMIN" || role === "MODERATOR" ? `/${locale}/admin` : `/${locale}/dashboard`;
}

// Strip the leading /{locale} segment so the path can be handed to next-intl's
// useRouter (from createNavigation), which auto-prepends the locale prefix.
// Without this, passing "/ru/dashboard" to router.replace yields "/ru/ru/dashboard".
// Matches the locale only as the first path segment (followed by "/", "?" or end).
export function stripLocalePrefix(path: string): string {
  return path.replace(new RegExp(`^/(?:${locales.join("|")})(?=/|$|\\?)`), "");
}

export function safeCallbackUrl(raw: string | null | undefined, locale: string, role: Role | undefined | null): string {
  if (raw) {
    const decoded = decodeURIComponent(raw);
    // Only same-origin absolute paths: starts with single "/", not "//" or "/\",
    // no whitespace/control chars, and no scheme prefix (defense-in-depth).
    if (
      decoded.startsWith("/") &&
      !decoded.startsWith("//") &&
      !decoded.startsWith("/\\") &&
      !/[\x00-\x20]/.test(decoded) &&
      !/^[a-z][a-z0-9+.-]*:/i.test(decoded)
    ) {
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
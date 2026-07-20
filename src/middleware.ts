import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "@/lib/i18n/config";

const intlMiddleware = createMiddleware({ locales, defaultLocale, localePrefix: "always" });

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

const PROTECTED = ["/dashboard", "/admin"];

export async function middleware(req: NextRequest) {
  const intlRes = intlMiddleware(req);
  const pathname = req.nextUrl.pathname;
  const stripped = pathname.replace(new RegExp(`^/(${locales.join("|")})(?=/|$)`), "") || "/";
  const isProtected = PROTECTED.some((p) => stripped.startsWith(p));
  if (!isProtected) return intlRes;

  const cookie = req.headers.get("cookie") ?? "";
  const hasAccess = cookie.split(";").some((c) => c.trim().startsWith("pmp_access="));
  const accessMatch = cookie.match(/pmp_access=([^;]+)/);
  const accessToken = accessMatch ? accessMatch[1] : null;
  const locale = locales.find((l) => pathname.startsWith(`/${l}`)) ?? defaultLocale;

  const redirectToLogin = () => {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  };

  if (!hasAccess || !accessToken) return redirectToLogin();

  // Admin role check.
  // Middleware runs in the Next middleware runtime and cannot reach the
  // cookie-rotating /api/proxy route handler, so for /admin/** we fetch
  // ${API_BASE}/users/me directly with the access bearer. This is the ONE
  // sanctioned direct ${API_BASE} call (server-side middleware, not client).
  // A stale access token (refresh still valid) will NOT be refreshed here
  // (rare); the backend 401/403 remains the source of truth. See spec §3.4.
  if (stripped.startsWith("/admin")) {
    try {
      const meRes = await fetch(`${API_BASE}/users/me`, { headers: { authorization: `Bearer ${accessToken}` } });
      if (!meRes.ok) return redirectToLogin();
      const me = (await meRes.json()) as { role?: string };
      if (me.role !== "ADMIN" && me.role !== "MODERATOR") return redirectToLogin();
    } catch {
      return redirectToLogin();
    }
  }

  return intlRes;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
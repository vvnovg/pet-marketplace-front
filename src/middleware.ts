import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "@/lib/i18n/config";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

const PROTECTED = ["/dashboard", "/admin"];

export async function middleware(req: NextRequest) {
  const intlRes = intlMiddleware(req);
  // Determine the pathname without locale prefix
  const pathname = req.nextUrl.pathname;
  const stripped = pathname.replace(new RegExp(`^/(${locales.join("|")})`), "") || "/";
  const isProtected = PROTECTED.some((p) => stripped.startsWith(p));
  if (isProtected) {
    const cookie = req.headers.get("cookie") ?? "";
    const hasAccess = cookie.split(";").some((c) => c.trim().startsWith("pmp_access="));
    if (!hasAccess) {
      const locale = locales.find((l) => pathname.startsWith(`/${l}`)) ?? defaultLocale;
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/${locale}/login`;
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  return intlRes;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
import type { NextRequest, NextResponse } from "next/server";
import type { TokenResponse } from "@/types/api";

export const ACCESS_COOKIE = "pmp_access";
export const REFRESH_COOKIE = "pmp_refresh";

export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: undefined as number | undefined,
};

export function setAuthCookies(res: NextResponse, tokens: TokenResponse) {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...cookieOptions, maxAge: 60 * 15 });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
}

function parseCookie(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = v;
    }
  }
  return out;
}

export function getAuthCookies(req: NextRequest): { accessToken?: string; refreshToken?: string } {
  const c = parseCookie(req.headers.get("cookie"));
  return { accessToken: c[ACCESS_COOKIE], refreshToken: c[REFRESH_COOKIE] };
}

export function readAccessTokenFromRequest(req: NextRequest): string | undefined {
  return getAuthCookies(req).accessToken;
}
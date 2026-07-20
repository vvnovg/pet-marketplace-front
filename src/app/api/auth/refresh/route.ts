import { NextResponse, type NextRequest } from "next/server";
import { getAuthCookies, setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";
import type { TokenResponse } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function POST(req: NextRequest) {
  const { refreshToken } = getAuthCookies(req);
  if (!refreshToken) return NextResponse.json({ error: "no refresh token" }, { status: 401 });
  const upstream = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!upstream.ok) {
    const res = NextResponse.json({ error: "refresh failed" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
  const tokens = (await upstream.json()) as TokenResponse;
  const res = NextResponse.json({ ok: true }, { status: 200 });
  setAuthCookies(res, tokens);
  return res;
}
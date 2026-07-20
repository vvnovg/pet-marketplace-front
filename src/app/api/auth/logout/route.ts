import { NextResponse, type NextRequest } from "next/server";
import { getAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function POST(req: NextRequest) {
  const { accessToken } = getAuthCookies(req);
  if (accessToken) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    }).catch(() => void 0);
  }
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
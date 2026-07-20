import { NextResponse, type NextRequest } from "next/server";
import { getAuthCookies, setAuthCookies } from "@/lib/auth/cookies";
import { parseProblem } from "@/lib/api/errors";
import type { TokenResponse } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function forwardToBackend(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join("/");
  if (path.startsWith("auth/")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const target = new URL(`${API_BASE}/${path}`);
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  const { accessToken, refreshToken } = getAuthCookies(req);
  const headers = new Headers(req.headers);
  headers.delete("cookie");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  const doFetch = () => fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    duplex: "half",
  } as RequestInit);

  let upstream = await doFetch();

  if (upstream.status === 401 && refreshToken) {
    const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (refreshed.ok) {
      const tokens = (await refreshed.json()) as TokenResponse;
      headers.set("authorization", `Bearer ${tokens.accessToken}`);
      upstream = await doFetch();
      const res = NextResponse.next({ request: { headers } });
      // Build a new response from upstream body + set refreshed cookies
      const body = await upstream.text();
      const out = new NextResponse(body, { status: upstream.status, headers: new Headers(upstream.headers) });
      setAuthCookies(out, tokens);
      return out;
    }
  }

  const body = await upstream.text();
  return new NextResponse(body, { status: upstream.status, headers: new Headers(upstream.headers) });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forwardToBackend(req, path);
}
export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
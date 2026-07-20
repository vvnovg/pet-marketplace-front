import { NextResponse, type NextRequest } from "next/server";
import { getAuthCookies, setAuthCookies } from "@/lib/auth/cookies";
import type { TokenResponse } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

const HOP_BY_HOP_OR_ENCODING_HEADERS = [
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "set-cookie",
];

function sanitizeHeaders(src: Headers): Headers {
  const out = new Headers(src);
  for (const key of HOP_BY_HOP_OR_ENCODING_HEADERS) {
    out.delete(key);
  }
  return out;
}

export async function forwardToBackend(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join("/");
  if (pathSegments.some((seg) => seg === "auth")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const target = new URL(`${API_BASE}/${path}`);
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  const { accessToken, refreshToken } = getAuthCookies(req);
  const headers = new Headers(req.headers);
  headers.delete("cookie");
  // Never forward a client-supplied Authorization header; the backend should
  // only ever see a cookie-derived bearer (or none).
  headers.delete("authorization");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  // Buffer the request body once up front so the post-refresh retry can replay
  // the exact same payload without hitting a consumed/locked ReadableStream.
  const raw = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  const doFetch = () =>
    fetch(target, {
      method: req.method,
      headers,
      body: raw,
    });

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
      const body = await upstream.text();
      const out = new NextResponse(body, {
        status: upstream.status,
        headers: sanitizeHeaders(upstream.headers),
      });
      setAuthCookies(out, tokens);
      return out;
    }
  }

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: sanitizeHeaders(upstream.headers),
  });
}
import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";

export async function POST(req: NextRequest) {
  const upstream = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await req.text(),
  });
  if (!upstream.ok) {
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status, headers: { "content-type": "application/problem+json" } });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
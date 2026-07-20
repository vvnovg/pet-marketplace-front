import { type NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/api/proxy-handler";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forwardToBackend(req, path);
}
export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
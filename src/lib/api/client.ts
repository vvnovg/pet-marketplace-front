import { ApiError, parseProblem } from "@/lib/api/errors";

const DEFAULT_PROXY_BASE = "/api/proxy";

export interface ClientOpts {
  baseUrl?: string; // defaults to relative "/api/proxy" (browser) — tests pass absolute
  cache?: RequestCache;
}

function buildUrl(path: string, opts: ClientOpts): string {
  const origin = (opts.baseUrl ?? "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${origin}${DEFAULT_PROXY_BASE}/${p}`;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) return parseProblem(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiGet<T>(path: string, opts: ClientOpts = {}): Promise<T> {
  return handle<T>(await fetch(buildUrl(path, opts), { method: "GET", cache: opts.cache ?? "no-store" }));
}

export async function apiPost<T>(path: string, body: unknown, opts: ClientOpts = {}): Promise<T> {
  return handle<T>(await fetch(buildUrl(path, opts), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function apiPut<T>(path: string, body: unknown, opts: ClientOpts = {}): Promise<T> {
  return handle<T>(await fetch(buildUrl(path, opts), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function apiDelete(path: string, opts: ClientOpts = {}): Promise<void> {
  const res = await fetch(buildUrl(path, opts), { method: "DELETE" });
  if (!res.ok) return parseProblem(res);
}

export async function apiUpload<T>(path: string, file: File | Blob, fieldName = "file", opts: ClientOpts = {}): Promise<T> {
  const fd = new FormData();
  fd.append(fieldName, file);
  return handle<T>(await fetch(buildUrl(path, opts), { method: "POST", body: fd }));
}

export { ApiError };
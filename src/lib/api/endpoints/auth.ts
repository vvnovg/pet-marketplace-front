import { ApiError, parseProblem } from "@/lib/api/errors";
import type { RegisterInput } from "@/lib/validation/auth-schemas";

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseProblem(res);
}

export async function loginViaApi(email: string, password: string): Promise<void> {
  await postJson("/api/auth/login", { email, password });
}

export async function registerViaApi(body: RegisterInput): Promise<void> {
  await postJson("/api/auth/register", body);
}

export async function verifyEmailViaApi(token: string): Promise<void> {
  const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { method: "POST" });
  if (!res.ok) await parseProblem(res);
}

export async function forgotPasswordViaApi(email: string): Promise<void> {
  await postJson("/api/auth/forgot-password", { email });
}

export async function resetPasswordViaApi(token: string, newPassword: string): Promise<void> {
  await postJson("/api/auth/reset-password", { token, newPassword });
}

export async function logoutViaApi(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export { ApiError };
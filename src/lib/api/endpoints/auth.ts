// Auth forms call our own /api/auth/* route handlers (not the proxy), returning ok.
export async function loginViaApi(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("login failed");
}
export async function logoutViaApi(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
import { describe, it, expect } from "vitest";
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions, setAuthCookies, clearAuthCookies, getAuthCookies } from "@/lib/auth/cookies";
import type { TokenResponse } from "@/types/api";

function mockRes() {
  const headers = new Headers();
  return {
    cookies: { set: (k: string, v: string, _o: unknown) => headers.append("set-cookie", `${k}=${v}`),
               delete: (k: string) => headers.append("set-cookie", `${k}=; Max-Age=0`) },
    headers,
  } as unknown as { cookies: { set:(k:string,v:string,o:unknown)=>void; delete:(k:string)=>void }; headers: Headers };
}

describe("auth cookies", () => {
  it("exports names", () => {
    expect(ACCESS_COOKIE).toBe("pmp_access");
    expect(REFRESH_COOKIE).toBe("pmp_refresh");
  });
  it("cookieOptions is httpOnly+secure+sameSite lax", () => {
    expect(cookieOptions).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  });
  it("setAuthCookies sets both cookies", () => {
    const res = mockRes();
    const tokens: TokenResponse = { accessToken: "a", refreshToken: "r", tokenType: "Bearer", expiresIn: 900 };
    setAuthCookies(res as never, tokens);
    expect(res.headers.get("set-cookie")).toContain("pmp_access=a");
    expect(res.headers.get("set-cookie")).toContain("pmp_refresh=r");
  });
  it("clearAuthCookies deletes both", () => {
    const res = mockRes();
    clearAuthCookies(res as never);
    expect(res.headers.get("set-cookie")).toContain("pmp_access=; Max-Age=0");
    expect(res.headers.get("set-cookie")).toContain("pmp_refresh=; Max-Age=0");
  });
  it("getAuthCookies reads both from a cookie header", () => {
    const req = { headers: { get: () => "pmp_access=a; pmp_refresh=r" } };
    expect(getAuthCookies(req as never)).toEqual({ accessToken: "a", refreshToken: "r" });
  });
});
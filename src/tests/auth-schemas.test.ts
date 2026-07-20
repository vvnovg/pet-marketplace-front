import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, forgotSchema, resetSchema } from "@/lib/validation/auth-schemas";

describe("loginSchema", () => {
  it("accepts valid", () => expect(loginSchema.safeParse({ email: "a@b.co", password: "12345678" }).success).toBe(true));
  it("rejects short password", () => expect(loginSchema.safeParse({ email: "a@b.co", password: "1234567" }).success).toBe(false));
  it("rejects bad email", () => expect(loginSchema.safeParse({ email: "nope", password: "12345678" }).success).toBe(false));
});

describe("registerSchema", () => {
  const ok = { email: "a@b.co", password: "12345678" };
  it("accepts minimal", () => expect(registerSchema.safeParse(ok).success).toBe(true));
  it("accepts with optional fields", () =>
    expect(registerSchema.safeParse({ ...ok, phone: "+12345", firstName: "A", lastName: "B" }).success).toBe(true));
  it("rejects phone >20", () => expect(registerSchema.safeParse({ ...ok, phone: "x".repeat(21) }).success).toBe(false));
  it("rejects firstName >100", () => expect(registerSchema.safeParse({ ...ok, firstName: "x".repeat(101) }).success).toBe(false));
  it("rejects email >255", () => expect(registerSchema.safeParse({ email: "x".repeat(251) + "@b.co", password: "12345678" }).success).toBe(false));
});

describe("forgotSchema", () => {
  it("accepts valid email", () => expect(forgotSchema.safeParse({ email: "a@b.co" }).success).toBe(true));
  it("rejects bad email", () => expect(forgotSchema.safeParse({ email: "nope" }).success).toBe(false));
});

describe("resetSchema", () => {
  it("accepts matching passwords", () =>
    expect(resetSchema.safeParse({ newPassword: "12345678", confirm: "12345678" }).success).toBe(true));
  it("rejects short", () =>
    expect(resetSchema.safeParse({ newPassword: "1234567", confirm: "1234567" }).success).toBe(false));
  it("rejects mismatch", () =>
    expect(resetSchema.safeParse({ newPassword: "12345678", confirm: "87654321" }).success).toBe(false));
});
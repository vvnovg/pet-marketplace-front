import { z } from "zod";

const email = z.string().min(1).max(255).email();
const password = z.string().min(8).max(1000);
const optionalShort = (max: number) => z.string().max(max).optional().or(z.literal(""));

export const loginSchema = z.object({ email, password });
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email,
  password,
  phone: optionalShort(20),
  firstName: optionalShort(100),
  lastName: optionalShort(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotSchema = z.object({ email });
export type ForgotInput = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({ newPassword: password, confirm: password })
  .refine((d) => d.newPassword === d.confirm, { path: ["confirm"], message: "mismatch" });
export type ResetInput = z.infer<typeof resetSchema>;
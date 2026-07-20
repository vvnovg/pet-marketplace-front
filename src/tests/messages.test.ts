import { describe, it, expect } from "vitest";
import ru from "@/messages/ru.json";
import en from "@/messages/en.json";

describe("auth message keys exist in both locales", () => {
  const keys = [
    "Auth.login.title", "Auth.login.email", "Auth.login.password", "Auth.login.submit",
    "Auth.login.registerLink", "Auth.login.forgotLink", "Auth.login.verifiedBanner",
    "Auth.login.resetBanner", "Auth.login.invalidCredentials",
    "Auth.register.title", "Auth.register.submit", "Auth.register.success",
    "Auth.verifyEmailInfo.title", "Auth.verifyEmailInfo.success",
    "Auth.verifyEmailInfo.devHelperLabel", "Auth.verifyEmailInfo.devHelperButton",
    "Auth.verifyEmailInfo.devHelperError", "Auth.verifyEmailInfo.backToRegister",
    "Auth.verifyEmail.loading", "Auth.verifyEmail.success", "Auth.verifyEmail.error",
    "Auth.verifyEmail.backToRegister", "Auth.verifyEmail.toLogin",
    "Auth.forgotPassword.title", "Auth.forgotPassword.email", "Auth.forgotPassword.submit",
    "Auth.forgotPassword.success",
    "Auth.resetPassword.title", "Auth.resetPassword.newPassword", "Auth.resetPassword.confirm",
    "Auth.resetPassword.submit", "Auth.resetPassword.error", "Auth.resetPassword.mismatch",
    "Auth.userMenu.dashboard", "Auth.userMenu.profile", "Auth.userMenu.admin", "Auth.userMenu.logout",
    "Validation.emailInvalid", "Validation.passwordMin", "Validation.required", "Validation.tooLong",
    "Validation.mismatch",
    "Dashboard.welcome", "Admin.title",
  ] as const;

  const get = (obj: unknown, path: string): unknown =>
    path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);

  it.each(keys)("ru has %s", (k) => { expect(typeof get(ru, k)).toBe("string"); });
  it.each(keys)("en has %s", (k) => { expect(typeof get(en, k)).toBe("string"); });
});
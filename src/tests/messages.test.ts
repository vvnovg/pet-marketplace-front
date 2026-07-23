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
    "Dashboard.welcome", "Admin.title", "Admin.back",
    "Admin.common.refresh", "Admin.common.prev", "Admin.common.next", "Admin.common.pageInfo",
    "Admin.common.pageSize", "Admin.common.empty", "Admin.common.loadingError", "Admin.common.retry",
    "Admin.common.cancel", "Admin.common.confirmApprove", "Admin.common.confirmReject", "Admin.common.submitting",
    "Admin.common.reason", "Admin.common.reasonPlaceholder", "Admin.common.reasonRequired", "Admin.common.reasonOptional", "Admin.common.reasonTooLong",
    "Admin.common.yes", "Admin.common.no", "Admin.common.resetFilters", "Admin.common.forbidden", "Admin.common.saved", "Admin.common.error",
    "Admin.users.title", "Admin.users.search", "Admin.users.searchPlaceholder", "Admin.users.role", "Admin.users.active", "Admin.users.verified",
    "Admin.users.colUser", "Admin.users.colRole", "Admin.users.colVerified", "Admin.users.colActive", "Admin.users.colReviews", "Admin.users.colCreated", "Admin.users.colActions",
    "Admin.users.block", "Admin.users.unblock", "Admin.users.changeRole", "Admin.users.selfGuard", "Admin.users.blockAdminWarn",
    "Admin.users.confirmBlockTitle", "Admin.users.confirmBlockDesc", "Admin.users.confirmUnblockTitle",
    "Admin.users.allRoles", "Admin.users.allActive", "Admin.users.allVerified",
    "Admin.pendingListings.title", "Admin.pendingListings.seller", "Admin.pendingListings.category", "Admin.pendingListings.price",
    "Admin.pendingListings.location", "Admin.pendingListings.created", "Admin.pendingListings.status",
    "Admin.pendingListings.approve", "Admin.pendingListings.reject", "Admin.pendingListings.confirmApproveTitle", "Admin.pendingListings.confirmApproveDesc",
    "Admin.pendingListings.confirmRejectTitle", "Admin.pendingListings.confirmRejectDesc", "Admin.pendingListings.noImage",
    "Admin.pendingReviews.title", "Admin.pendingReviews.author", "Admin.pendingReviews.recipient", "Admin.pendingReviews.booking",
    "Admin.pendingReviews.rating", "Admin.pendingReviews.comment", "Admin.pendingReviews.created", "Admin.pendingReviews.status",
    "Admin.pendingReviews.approve", "Admin.pendingReviews.reject", "Admin.pendingReviews.confirmApproveTitle", "Admin.pendingReviews.confirmApproveDesc",
    "Admin.pendingReviews.confirmRejectTitle", "Admin.pendingReviews.confirmRejectDesc",
    "Admin.statistics.title", "Admin.statistics.totalUsers", "Admin.statistics.activeUsers",
    "Admin.statistics.listingsToday", "Admin.statistics.listingsWeek", "Admin.statistics.listingsMonth",
    "Admin.statistics.listingsByStatus", "Admin.statistics.bookingsByStatus", "Admin.statistics.reviewsByStatus",
    "Status.ACTIVE", "Status.RESERVED", "Status.SOLD", "Status.DRAFT", "Status.PENDING_MODERATION", "Status.ARCHIVED", "Status.REJECTED",
    "Status.PENDING", "Status.CONFIRMED", "Status.CANCELLED", "Status.COMPLETED", "Status.APPROVED",
    "Status.BUYER", "Status.SELLER", "Status.ADMIN", "Status.MODERATOR",
  ] as const;

  const get = (obj: unknown, path: string): unknown =>
    path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);

  it.each(keys)("ru has %s", (k) => { expect(typeof get(ru, k)).toBe("string"); });
  it.each(keys)("en has %s", (k) => { expect(typeof get(en, k)).toBe("string"); });
});
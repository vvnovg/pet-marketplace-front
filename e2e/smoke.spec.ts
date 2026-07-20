import { test, expect } from "@playwright/test";

test("home renders in ru and shows locale switch", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.getByText("Маркетплейс животных")).toBeVisible();
  await expect(page.getByLabel("locale")).toBeVisible();
});

test("locale switch navigates to en", async ({ page }) => {
  await page.goto("/ru");
  await page.getByLabel("locale").selectOption("en");
  await expect(page.getByText("Pet marketplace")).toBeVisible();
});

test("protected route redirects to login", async ({ page }) => {
  await page.goto("/ru/dashboard/profile");
  await expect(page).toHaveURL(/\/ru\/login/);
});
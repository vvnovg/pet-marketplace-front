import { test, expect } from "@playwright/test";

// Both tests below log into the same real demo account (buyer@demo.local)
// against the live stand (unlike the rest of e2e/, this spec deliberately
// does not stub the backend). Playwright's default `fullyParallel: true`
// runs the two tests in separate workers/contexts concurrently; logging into
// the same account from two workers at once races the session bootstrap
// (observed: the post-login page renders with the header still showing the
// logged-out nav because the ["session"] query hadn't resolved yet, so the
// heading assertion times out). Force this file to run serially to avoid it.
test.describe.configure({ mode: "serial" });

async function login(page: import("@playwright/test").Page) {
  await page.goto("/ru/login");
  await page.getByLabel("Email").fill("buyer@demo.local");
  await page.locator('input[type="password"]').fill("Demo12345");
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL("**/ru/dashboard");
}

test("dashboard navigation reaches profile and subscriptions", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("buyer@demo.local");

  await page.getByRole("link", { name: "Профиль" }).first().click();
  await page.waitForURL("**/ru/dashboard/profile");
  await expect(page.getByLabel("Имя")).toBeVisible();

  await page.getByRole("link", { name: "Подписки" }).first().click();
  await page.waitForURL("**/ru/dashboard/subscriptions");
  await expect(page.getByRole("button", { name: "Новая подписка" })).toBeVisible();
});

test("profile changes persist across a reload", async ({ page }) => {
  await login(page);
  await page.goto("/ru/dashboard/profile");
  const city = page.getByLabel("Город");
  const value = `Самара-${Date.now() % 100000}`;
  await city.fill(value);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Профиль сохранён")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Город")).toHaveValue(value);
});

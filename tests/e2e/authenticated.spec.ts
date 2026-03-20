import { expect, test, type Page } from "@playwright/test";

import { AuthenticatedFixture, cleanupAuthenticatedFixture, createAuthenticatedFixture } from "./helpers/supabase-fixtures";

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe.serial("Authenticated flows", () => {
  let fixture: AuthenticatedFixture | null = null;

  test.beforeAll(async ({}, testInfo) => {
    const baseUrl = testInfo.project.use.baseURL;
    if (typeof baseUrl !== "string") {
      throw new Error("Playwright baseURL is required for authenticated fixtures");
    }

    fixture = await createAuthenticatedFixture(baseUrl);
  });

  test.afterAll(async () => {
    await cleanupAuthenticatedFixture(fixture);
  });

  test("desktop workspace menu keeps signed-in routes reachable", async ({ page }) => {
    if (!fixture) throw new Error("Authenticated fixture was not created");

    await loginAs(page, fixture.actor.email, fixture.actor.password);
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start New Look" }).first()).toBeVisible();

    const workspaceButton = page.locator('button[aria-controls="desktop-workspace-menu"]');
    await expect(workspaceButton).toBeVisible();

    await workspaceButton.click();
    const workspaceMenu = page.locator("#desktop-workspace-menu");
    await expect(workspaceMenu).toBeVisible();
    await expect(workspaceMenu.getByRole("menuitem", { name: "Saved" })).toBeVisible();
    await expect(workspaceMenu.getByRole("menuitem", { name: "API Keys" })).toBeVisible();
    await expect(workspaceMenu.getByRole("link", { name: "Upgrade to Pro" })).toBeVisible();
    await expect(workspaceMenu.getByRole("button", { name: /Switch to (light|dark) mode/i })).toBeVisible();
    await expect(workspaceMenu.getByRole("button", { name: "Sign out" })).toBeVisible();

    await workspaceMenu.getByRole("menuitem", { name: "Saved" }).click();
    await expect(page).toHaveURL(/\/dashboard\/saved/);
    await expect(page.getByRole("heading", { name: "Saved Prompts", level: 1 })).toBeVisible();

    await workspaceButton.click();
    await page.locator("#desktop-workspace-menu").getByRole("menuitem", { name: "API Keys" }).click();
    await expect(page).toHaveURL(/\/dashboard\/api/);
    await expect(page.getByRole("heading", { name: "API Keys", level: 1 })).toBeVisible();
  });

  test("signed-in users can follow a creator and see their post in the following feed", async ({ page }) => {
    if (!fixture) throw new Error("Authenticated fixture was not created");

    await loginAs(page, fixture.actor.email, fixture.actor.password);
    await page.goto("/community");

    await page.getByPlaceholder("Search prompt title, creator, category").fill(fixture.promptTitle);
    await page.getByRole("button", { name: "Apply Filters" }).click();
    await expect(page).toHaveURL(new RegExp(`search=${fixture.promptTitle.replace(/\s+/g, "\\+")}`));

    const card = page
      .locator(".break-inside-avoid")
      .filter({ has: page.getByText(fixture.promptTitle, { exact: true }) })
      .first();

    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Follow" })).toBeVisible();
    await card.getByRole("button", { name: "Follow" }).click();
    await expect(card.getByRole("button", { name: "Following" })).toBeVisible();

    await page.getByRole("link", { name: "Following" }).click();
    await expect(page).toHaveURL(/scope=following/);
    await expect(page.getByRole("heading", { name: "Latest From Creators You Follow" })).toBeVisible();
    await expect(page.getByText("Login to see the creators you follow.")).toHaveCount(0);
    await expect(page.getByText(fixture.promptTitle, { exact: true }).first()).toBeVisible();
  });
});

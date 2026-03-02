import { expect, test } from "@playwright/test";

test.describe("Public smoke", () => {
  test("core public pages render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Transform Your Photos with AI Magic/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeAttached();

    await page.getByRole("link", { name: "Browse Prompts" }).first().click();
    await expect(page).toHaveURL(/\/gallery/);
    await expect(page.getByRole("heading", { name: "Prompt Gallery" })).toBeVisible();
    await expect(page.locator("#gallery-search")).toBeVisible();

    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: /Buy & Sell AI Prompts/i })).toBeVisible();
    await expect(page.locator("#marketplace-category")).toBeVisible();

    await page.goto("/generate");
    await expect(page.getByRole("heading", { name: "Generate" })).toBeVisible();
  });

  test("seo routes respond", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toContain("Sitemap:");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain("<urlset");
  });
});

import { test, expect } from "@playwright/test";

test.describe("FRAGIX-C1C campaign landing", () => {
  test("hero leads with identity CTAs and specimen card", async ({ page }) => {
    await page.goto("/campaigns/bgmi-season");
    await expect(
      page.getByRole("heading", { name: /Your game\. Your identity\. Your FRAGIX\./i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Create your player card/i }).first()
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Explore players/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Log in$/i }).first()).toBeVisible();
    await expect(page.getByText(/Illustrative specimen/i).first()).toBeVisible();
  });

  test("how-it-works and closing CTA preserve policy messaging", async ({ page }) => {
    await page.goto("/campaigns/bgmi-season");
    await expect(page.getByRole("heading", { name: /Three steps/i })).toBeVisible();
    await expect(page.getByText(/Ownership review is not registration/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Your squad is out there/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Create your FRAGIX identity/i })
    ).toBeVisible();
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).toContain("not affiliated");
    expect(body).not.toMatch(/\bofficial pmgc\b/);
  });

  test("signup CTA reaches registration", async ({ page }) => {
    await page.goto("/campaigns/bgmi-season");
    await page.getByRole("link", { name: /Create your player card/i }).first().click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByRole("heading", { name: /Sign up/i })).toBeVisible();
  });
});

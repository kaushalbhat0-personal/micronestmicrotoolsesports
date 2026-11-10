import { test, expect } from "@playwright/test";

test("home page renders the product headline", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "MicroNest Esports" })
  ).toBeVisible();
});

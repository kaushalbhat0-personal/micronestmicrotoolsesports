import { expect, test } from "@playwright/test";

test.describe("P15-M2B.3C verification settings surface", () => {
  test("settings profile requires sign-in and stays private (robots)", async ({ page }) => {
    const response = await page.goto("/settings/profile");
    expect(response).not.toBeNull();
    await expect(page.getByRole("heading", { name: /profile settings/i })).toBeVisible();
    // Unauthenticated owner gate — no verification upload controls exposed.
    await expect(page.getByText(/sign in to manage your player profile settings/i)).toBeVisible();
    await expect(page.locator("#bgmi-ownership-verification")).toHaveCount(0);
  });
});

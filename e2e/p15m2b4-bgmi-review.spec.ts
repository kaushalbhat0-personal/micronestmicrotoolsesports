import { expect, test } from "@playwright/test";

test.describe("P15-M2B.4 BGMI ownership review surface", () => {
  test("review queue requires auth and denies anonymous access to cards", async ({ page }) => {
    await page.goto("/workspace/moderation/bgmi-ownership");
    await expect(
      page.getByRole("heading", { name: /bgmi ownership review/i }),
    ).toBeVisible();
    // Unauthenticated: sign-in prompt, no approve controls.
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^approve$/i })).toHaveCount(0);
  });
});

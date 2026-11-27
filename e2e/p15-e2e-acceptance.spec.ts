import { expect, test } from "@playwright/test";
import path from "node:path";

const EVIDENCE = path.join(
  "docs",
  "product-development",
  "P15-M2-player-identity-verification",
  "P15-E2E",
  "evidence",
);

test.describe("P15-E2E surface acceptance (no secrets)", () => {
  test("anonymous cannot open reviewer queue controls", async ({ page }) => {
    await page.goto("/workspace/moderation/bgmi-ownership");
    await expect(
      page.getByRole("heading", { name: /bgmi ownership review/i }),
    ).toBeVisible();
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^approve$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^reject$/i })).toHaveCount(0);
    await page.screenshot({
      path: path.join(EVIDENCE, "moderation-anon-denied.png"),
      fullPage: true,
    });
  });

  test("anonymous settings hide verification upload", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page.getByRole("heading", { name: /profile settings/i })).toBeVisible();
    await expect(page.locator("#bgmi-ownership-verification")).toHaveCount(0);
    await page.screenshot({
      path: path.join(EVIDENCE, "settings-anon-gate.png"),
      fullPage: true,
    });
  });

  test("moderation index gates anonymous users before queue links", async ({ page }) => {
    await page.goto("/workspace/moderation");
    await expect(page.getByRole("heading", { name: /moderation workspace/i })).toBeVisible();
    // Unauthenticated: sign-in prompt only — BGMI review link is session-gated.
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /bgmi ownership evidence/i })).toHaveCount(0);
    await page.screenshot({
      path: path.join(EVIDENCE, "moderation-index-anon.png"),
      fullPage: true,
    });
  });
});

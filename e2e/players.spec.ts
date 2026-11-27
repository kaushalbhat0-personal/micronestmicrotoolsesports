// P14-B4 players directory E2E: shell, filter round-trip, states, mobile
// disclosure. Deterministic by design: assertions hold whether the reader
// returns rows, an empty set, or the honest unavailable state (all three are
// valid production outcomes — no data is seeded or assumed).

import { test, expect } from "@playwright/test";

test("players directory renders the Arena shell with working controls", async ({
  page,
}) => {
  await page.goto("/players");
  await expect(
    page.getByRole("heading", { name: "Discover esports players." })
  ).toBeVisible();
  await expect(page.getByLabel("Search players")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply filters" })
  ).toBeVisible();
  await expect(
    page.getByText("Only players who choose to be discoverable appear")
  ).toBeVisible();
});

test("players directory carries no placeholder or dead links", async ({
  page,
}) => {
  await page.goto("/players");
  expect(await page.locator('a[href="#"]').count()).toBe(0);
});

test("invalid filter values show an explained notice", async ({ page }) => {
  await page.goto("/players?page=999");
  await expect(page.getByText("Some filters were invalid")).toContainText(
    "page"
  );
});

test("applying a search filter shows a removable chip", async ({ page }) => {
  await page.goto("/players");
  await page.getByLabel("Search players").fill("novasearchprobe");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/query=novasearchprobe/);
  const chip = page.getByRole("link", {
    name: /Remove Search filter novasearchprobe/,
  });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page).not.toHaveURL(/query=novasearchprobe/);
  await expect(
    page.getByRole("link", { name: /Remove Search filter/ })
  ).toHaveCount(0);
});

test("results region always resolves to an honest state", async ({ page }) => {
  await page.goto("/players?query=zzz-no-such-player-zzz");
  const populated = page.getByText(/Showing \d+ public profiles?/);
  const empty = page.getByRole("heading", { name: "No players found" });
  const unavailable = page.getByRole("heading", {
    name: "Directory unavailable",
  });
  await expect(populated.or(empty).or(unavailable).first()).toBeVisible();
});

test("mobile filter disclosure opens and closes with Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/players");
  const toggle = page.getByRole("button", { name: /Show filters|Hide filters/ });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(
    page.getByRole("button", { name: "Hide filters" })
  ).toBeVisible();
  await expect(page.getByLabel("Search players")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /Show filters/ })
  ).toBeVisible();
});

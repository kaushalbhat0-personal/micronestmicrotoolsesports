// P7.1 Roster & Slot Builder interaction tests.
// Covers: plan defaults, add/assign/move, duplicate + occupied + shrink
// errors, confirmed remove, clipboard copy (stubbed), confirmed reset,
// progressbar semantics, keyboard activation, mobile viewport.

import { test, expect } from "@playwright/test";
import { stubClipboard, clipboardWrites, expectNoHorizontalOverflow, gotoMobile } from "./helpers";

const PATH = "/tools/roster-slot-builder";

test.beforeEach(async ({ page }) => {
  await stubClipboard(page);
  await page.goto(PATH);
  await expect(page.getByRole("heading", { name: "Use the tool" })).toBeVisible();
  await expect(page.getByText("No players yet")).toBeVisible();
});

test("adds a player to the bench with zero starters filled", async ({ page }) => {
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Add a player" }) });
  await section.getByLabel("Display name").fill("Nova");
  await section.getByRole("button", { name: "Add player" }).click();
  await expect(page.locator("span", { hasText: "Bench" }).first()).toBeVisible();
  const progress = page.getByRole("progressbar", { name: "Starter slots filled" });
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
});

test("assigns and moves a player between starter slots", async ({ page }) => {
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Add a player" }) });
  await section.getByLabel("Display name").fill("Nova");
  await section.getByRole("button", { name: "Add player" }).click();

  const card = page.locator("li", { has: page.getByText("Nova", { exact: true }) });
  await card.getByLabel("Slot").selectOption("starter:0");
  await expect(card.locator("span", { hasText: "Starter 1" })).toBeVisible();
  const progress = page.getByRole("progressbar", { name: "Starter slots filled" });
  await expect(progress).toHaveAttribute("aria-valuenow", "1");

  await card.getByLabel("Slot").selectOption("starter:1");
  await expect(card.locator("span", { hasText: "Starter 2" })).toBeVisible();
  await expect(page.getByText("Starter slot 1 is empty.", { exact: true }).first()).toBeVisible();
});

test("rejects duplicates, occupied slots, and blocked shrinks", async ({ page }) => {
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Add a player" }) });
  await section.getByLabel("Display name").fill("Nova");
  await section.getByRole("button", { name: "Add player" }).click();
  const nova = page.locator("li", { has: page.getByText("Nova", { exact: true }) });
  await nova.getByLabel("Slot").selectOption("starter:0");

  // Duplicate (case + whitespace variant).
  await section.getByLabel("Display name").fill("  NOVA  ");
  await section.getByRole("button", { name: "Add player" }).click();
  await expect(page.getByText(/already on this roster/)).toBeVisible();

  // Occupied slot via the add form's Place in control.
  await section.getByLabel("Display name").fill("Vex");
  await section.getByLabel("Place in").selectOption("starter:0");
  await section.getByRole("button", { name: "Add player" }).click();
  await expect(page.getByText(/held by "Nova"/)).toBeVisible();

  // Shrinking below occupancy is blocked by name: move Nova to slot 4,
  // then shrink to 1 starter.
  await nova.getByLabel("Slot").selectOption("starter:3");
  await expect(nova.locator("span", { hasText: "Starter 4" })).toBeVisible();
  await page.getByLabel("Starter slots", { exact: true }).selectOption("1");
  await expect(page.getByText(/Unassign "Nova" first/).first()).toBeVisible();
});

test("removes a player with confirmation and copies the summary", async ({ page }) => {
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Add a player" }) });
  await section.getByLabel("Display name").fill("Nova");
  await section.getByRole("button", { name: "Add player" }).click();

  const card = page.locator("li", { has: page.getByText("Nova", { exact: true }) });
  await card.getByRole("button", { name: "Remove Nova" }).click();
  await expect(card.getByRole("button", { name: "Confirm remove Nova" })).toBeVisible();
  await card.getByRole("button", { name: "Confirm remove Nova" }).click();
  await expect(page.getByText("No players yet")).toBeVisible();

  await page.getByRole("button", { name: "Copy summary" }).click();
  await expect(page.getByText("Copied to clipboard.")).toBeVisible();
  const writes = await clipboardWrites(page);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toContain("Roster Slot Builder");
});

test("reset requires confirmation and clears the roster", async ({ page }) => {
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Add a player" }) });
  await section.getByLabel("Display name").fill("Nova");
  await section.getByRole("button", { name: "Add player" }).click();

  await page.getByRole("button", { name: "Reset roster" }).click();
  await expect(page.getByRole("button", { name: "Confirm reset roster" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm reset roster" }).click();
  await expect(page.getByText("No players yet")).toBeVisible();
});

test("keyboard: Enter on the focused Add player button adds the row", async ({ page }) => {
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Add a player" }) });
  await section.getByLabel("Display name").fill("Nova");
  await section.getByRole("button", { name: "Add player" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Nova").first()).toBeVisible();
});

test("mobile viewport adds and assigns without horizontal overflow", async ({ page }) => {
  await gotoMobile(page, PATH);
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Add a player" }) });
  await section.getByLabel("Display name").fill("Nova");
  await section.getByRole("button", { name: "Add player" }).click();
  const card = page.locator("li", { has: page.getByText("Nova", { exact: true }) });
  await card.getByLabel("Slot").selectOption("starter:0");
  await expect(card.locator("span", { hasText: "Starter 1" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

// P7.1 Tie-Break & Qualification Simulator interaction tests.
// Covers: scenario setup, teams + criteria, score entry, priority reorder,
// resolved/unresolved ties, contested cutoff, snapshots (save/restore/
// delete), clipboard copy (stubbed), confirmed reset, keyboard activation,
// mobile viewport.

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { stubClipboard, clipboardWrites, expectNoHorizontalOverflow, gotoMobile } from "./helpers";

const PATH = "/tools/tiebreak-qualifier";

async function addCriterion(page: Page, name: string, weight: string, direction: "high" | "low"): Promise<void> {
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Scoring criteria" }) });
  await section.getByLabel("Criterion name").fill(name);
  await section.getByLabel("Weight").fill(weight);
  await section.getByLabel("Direction").selectOption(direction);
  await section.getByRole("button", { name: "Add criterion" }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

async function addTeam(page: Page, name: string): Promise<void> {
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Teams" }) });
  await section.getByLabel("Team name").fill(name);
  await section.getByRole("button", { name: "Add team" }).click();
}

function teamCard(page: Page, name: string) {
  return page
    .getByRole("list", { name: "Teams and their scores" })
    .locator("li", { has: page.getByText(name, { exact: true }) });
}

function standings(page: Page) {
  return page.getByRole("list", { name: "Simulated standings" }).locator(":scope > li");
}

test.beforeEach(async ({ page }) => {
  await stubClipboard(page);
  await page.goto(PATH);
  await expect(page.getByRole("heading", { name: "Use the tool" })).toBeVisible();
  await expect(page.getByText("No teams yet")).toBeVisible();
  await expect(page.getByText("Standings appear here once teams are added.")).toBeVisible();
});

test("ranks teams by exact totals with a named tie-break", async ({ page }) => {
  await addCriterion(page, "Placement", "10", "high");
  await addCriterion(page, "Eliminations", "1", "high");
  await addTeam(page, "Alpha");
  await addTeam(page, "Bravo");

  await teamCard(page, "Alpha").getByLabel(/Placement/).fill("5");
  await teamCard(page, "Alpha").getByLabel(/Eliminations/).fill("12");
  await teamCard(page, "Bravo").getByLabel(/Placement/).fill("3");
  await teamCard(page, "Bravo").getByLabel(/Eliminations/).fill("20");

  const rows = standings(page);
  await expect(rows.nth(0)).toContainText("Alpha");
  await expect(rows.nth(0)).toContainText("total 62");
  await expect(rows.nth(1)).toContainText("Bravo");
  await expect(page.getByText("Not an official tournament result").first()).toBeVisible();
});

test("priority reorder flips which team a tie-break favors", async ({ page }) => {
  await addCriterion(page, "Awards", "0", "high");
  await addCriterion(page, "Bonus", "0", "high");
  await addTeam(page, "Xray");
  await addTeam(page, "Yankee");

  await teamCard(page, "Xray").getByLabel(/Awards/).fill("9");
  await teamCard(page, "Xray").getByLabel(/Bonus/).fill("1");
  await teamCard(page, "Yankee").getByLabel(/Awards/).fill("5");
  await teamCard(page, "Yankee").getByLabel(/Bonus/).fill("9");

  // Priority [Awards, Bonus]: Awards differs first → Xray ahead.
  let rows = standings(page);
  await expect(rows.nth(0)).toContainText("Xray");
  await expect(page.getByText(/broken by "Awards"/).first()).toBeVisible();

  // Move Bonus above Awards → Bonus differs first → Yankee ahead.
  await page.getByRole("button", { name: "Move Bonus earlier in priority" }).click();
  rows = standings(page);
  await expect(rows.nth(0)).toContainText("Yankee");
  await expect(page.getByText(/broken by "Bonus"/).first()).toBeVisible();
});

test("leaves fully equal teams tied and contests a cutoff-crossing tie", async ({ page }) => {
  await addCriterion(page, "Points", "1", "high");
  await addTeam(page, "Alpha");
  await addTeam(page, "Bravo");
  await addTeam(page, "Charlie");

  await teamCard(page, "Alpha").getByLabel(/Points/).fill("9");
  await teamCard(page, "Bravo").getByLabel(/Points/).fill("9");
  await teamCard(page, "Charlie").getByLabel(/Points/).fill("2");

  const rows = standings(page);
  // Entry order on display, shared rank, no invented winner.
  await expect(rows.nth(0)).toContainText("Alpha");
  await expect(rows.nth(1)).toContainText("Bravo");
  await expect(page.getByText(/needs another criterion or a human decision/).first()).toBeVisible();

  // Cutoff 1 slices the tied pair → both contested, none auto-qualified.
  await page.getByLabel("Qualification cutoff (0 = off)").fill("1");
  await expect(page.getByText("Contested").first()).toBeVisible();
  await expect(page.getByText(/cuts through a tie/).first()).toBeVisible();
  const contested = await page.getByText("Contested", { exact: true }).count();
  expect(contested).toBe(2);
});

test("saves, restores, and deletes in-memory snapshots", async ({ page }) => {
  await page.getByLabel("Scenario name (optional)").fill("Group A");
  await addCriterion(page, "Points", "1", "high");
  await addTeam(page, "Alpha");
  await teamCard(page, "Alpha").getByLabel(/Points/).fill("7");

  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText("Snapshot 1 — Group A")).toBeVisible();

  // Diverge: the saved copy must survive the change.
  await teamCard(page, "Alpha").getByLabel(/Points/).fill("1");
  await expect(standings(page).nth(0)).toContainText("total 1");

  await page.getByRole("button", { name: "Restore Snapshot 1 — Group A" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm restore Snapshot 1 — Group A" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm restore Snapshot 1 — Group A" }).click();
  await expect(standings(page).nth(0)).toContainText("total 7");

  await page.getByRole("button", { name: "Delete Snapshot 1 — Group A" }).click();
  await expect(page.getByText("Snapshot 1 — Group A")).toHaveCount(0);
});

test("copies the summary and resets with confirmation", async ({ page }) => {
  await addCriterion(page, "Points", "1", "high");
  await addTeam(page, "Alpha");

  await page.getByRole("button", { name: "Copy summary" }).click();
  await expect(page.getByText("Copied to clipboard.")).toBeVisible();
  const writes = await clipboardWrites(page);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toContain("Tie-Break");

  await page.getByRole("button", { name: "Reset scenario" }).click();
  await expect(page.getByRole("button", { name: "Confirm reset scenario" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm reset scenario" }).click();
  await expect(page.getByText("No teams yet")).toBeVisible();
});

test("keyboard: Enter on the focused Add team button adds the row", async ({ page }) => {
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Teams" }) });
  await section.getByLabel("Team name").fill("Alpha");
  await section.getByRole("button", { name: "Add team" }).focus();
  await page.keyboard.press("Enter");
  await expect(teamCard(page, "Alpha")).toBeVisible();
});

test("mobile viewport ranks and explains without horizontal overflow", async ({ page }) => {
  await gotoMobile(page, PATH);
  await addCriterion(page, "Points", "1", "high");
  await addTeam(page, "Alpha");
  await teamCard(page, "Alpha").getByLabel(/Points/).fill("7");
  await expect(standings(page).nth(0)).toContainText("total 7");
  await expectNoHorizontalOverflow(page);
});

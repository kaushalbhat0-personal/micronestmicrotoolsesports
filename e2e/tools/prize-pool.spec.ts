// P7.1 Prize Pool Splitter interaction tests.
// Covers: valid pool calculation, unallocated remainder, clipboard copy
// (stubbed), two-step reset, validation feedback, keyboard activation,
// mobile viewport.

import { test, expect } from "@playwright/test";
import { stubClipboard, clipboardWrites, expectNoHorizontalOverflow, gotoMobile } from "./helpers";

const PATH = "/tools/prize-pool-splitter";

test.beforeEach(async ({ page }) => {
  await stubClipboard(page);
  await page.goto(PATH);
  await expect(page.getByRole("heading", { name: "Use the tool" })).toBeVisible();
});

test("calculates the default 50/30/20 breakdown exactly", async ({ page }) => {
  await page.getByRole("button", { name: "Calculate breakdown" }).click();
  await expect(page.getByRole("heading", { name: "Calculated breakdown" })).toBeVisible();
  await expect(page.getByText("1st", { exact: true })).toBeVisible();
  // 50/30/20 of 100000 distributes exactly: nothing left unallocated.
  await expect(page.getByText(/Unallocated.*0/).first()).toBeVisible();
  await expect(page.getByText("Copied to clipboard.")).toHaveCount(0);
});

test("shows the unallocated remainder when percentages sum below 100%", async ({ page }) => {
  // Default rows are 50/30/20. Removing one row leaves 50/30 → 20% unallocated.
  await page.getByRole("button", { name: /Remove row for position 3/ }).click();
  await page.getByRole("button", { name: "Calculate breakdown" }).click();
  await expect(page.getByText(/Unallocated.*20,000/).first()).toBeVisible();
});

test("copies the summary through the stubbed clipboard", async ({ page }) => {
  await page.getByRole("button", { name: "Calculate breakdown" }).click();
  await page.getByRole("button", { name: "Copy summary" }).click();
  await expect(page.getByText("Copied to clipboard.")).toBeVisible();
  const writes = await clipboardWrites(page);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toContain("Prize Pool Splitter");
});

test("validates an empty total and announces the issue", async ({ page }) => {
  await page.getByLabel("Total prize pool").fill("");
  await page.getByRole("button", { name: "Calculate breakdown" }).click();
  await expect(page.getByRole("heading", { name: "Check these fields" })).toBeVisible();
  await expect(page.getByRole("alert").first()).toBeVisible();
});

test("reset requires confirmation and restores defaults", async ({ page }) => {
  await page.getByLabel("Total prize pool").fill("5000");
  await page.getByRole("button", { name: "Reset calculation" }).click();
  // Armed: value untouched, escape hatch offered.
  await expect(page.getByRole("button", { name: "Confirm reset calculation" })).toBeVisible();
  await expect(page.getByLabel("Total prize pool")).toHaveValue("5000");
  await page.getByRole("button", { name: "Keep values" }).click();
  await expect(page.getByLabel("Total prize pool")).toHaveValue("5000");
  await expect(page.getByRole("button", { name: "Confirm reset calculation" })).toHaveCount(0);
  // Confirm: defaults restored.
  await page.getByRole("button", { name: "Reset calculation" }).click();
  await page.getByRole("button", { name: "Confirm reset calculation" }).click();
  await expect(page.getByLabel("Total prize pool")).toHaveValue("100000");
});

test("keyboard: Enter on the focused calculate button shows results", async ({ page }) => {
  await page.getByRole("button", { name: "Calculate breakdown" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Calculated breakdown" })).toBeVisible();
});

test("mobile viewport calculates without horizontal overflow", async ({ page }) => {
  await gotoMobile(page, PATH);
  await page.getByRole("button", { name: "Calculate breakdown" }).click();
  await expect(page.getByRole("heading", { name: "Calculated breakdown" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

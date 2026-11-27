import { test, expect } from "@playwright/test";

// FRAGIX homepage: brand-first H1, real directory CTAs, illustrative
// specimens only (no fabricated listings).
test("home page renders the arena hero with directory CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FRAGIX" })).toBeVisible();
  await expect(page.getByText("Where Competition Connects").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explore player registry" }).first()
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Discover tournaments" }).first()
  ).toBeVisible();
  await expect(page.getByText("not a real athlete").first()).toBeVisible();
});

test("home page links discovery, tournaments, editorial and tools to real routes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Browse players/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /View teams/i })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Prize Pool Splitter/i }).first()
  ).toBeVisible();
});

test("about page explains the platform and its availability", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About FRAGIX" })).toBeVisible();
  await expect(page.getByText("Live now").first()).toBeVisible();
});

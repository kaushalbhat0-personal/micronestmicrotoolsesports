import { test, expect, type Page, type Download } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const EVIDENCE = path.resolve("docs/product-development/P15-M1-share-kit-v1/evidence");
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function loadEnv() {
  const env = fs.readFileSync(".env", "utf8");
  const get = (k: string) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
    return m?.[1] !== undefined ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  };
  return {
    url: get("NEXT_PUBLIC_SUPABASE_URL"),
    service: get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function readPngSize(filePath: string): { width: number; height: number; bytes: number } {
  const buf = fs.readFileSync(filePath);
  expect(buf.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: buf.length,
  };
}

async function saveDownload(download: Download, destName: string): Promise<string> {
  const dest = path.join(EVIDENCE, destName);
  await download.saveAs(dest);
  return dest;
}

async function waitPath(page: Page, pathname: string, timeout = 60_000) {
  await page.waitForFunction((expected) => window.location.pathname === expected, pathname, {
    timeout,
  });
}

test.describe.configure({ mode: "serial" });

test("P15-M1-V Share Kit visual & functional acceptance", async ({ browser }) => {
  test.setTimeout(480_000);
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const findings: Array<{ id: string; severity: string; note: string }> = [];
  const sizes: Record<string, { width: number; height: number; bytes: number }> = {};
  const { url, service } = loadEnv();
  expect(new URL(url).host).toContain("knniommcyyhbyiwljisk");

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stamp = Date.now().toString(36);
  const password = `P15m1v!${randomBytes(6).toString("hex")}`;
  const email = `p15m1v-${stamp}@micronest-esports.invalid`;
  const handle = `p15m1v_${stamp.slice(-6)}`;
  const teamSlug = `p15m1v-${stamp.slice(-6)}`;
  const createdIds: string[] = [];

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  try {
    // Campaign desktop
    await page.goto(`${BASE}/campaigns/bgmi-season`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Your game\. Your identity\. Your FRAGIX\./i }),
    ).toBeVisible();
    for (const name of [
      /Create your player card/i,
      /Explore players/i,
      /Explore teams/i,
      /Prize Pool Splitter/i,
      /Roster & Slot Builder/i,
      /Tie-Break Simulator/i,
    ]) {
      await expect(page.getByRole("link", { name }).first()).toBeVisible();
    }
    const campaignText = (await page.locator("body").innerText()).toLowerCase();
    expect(campaignText).not.toContain("official pmgc");
    expect(campaignText).toContain("not affiliated");
    await page.screenshot({ path: path.join(EVIDENCE, "campaign-desktop.png"), fullPage: true });
    findings.push({ id: "campaign-desktop", severity: "PASS", note: "Links + disclaimer OK" });

    // Font / DPR probe on a live app page
    const canvasProbe = await page.evaluate(() => {
      const displayVar = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-display")
        .trim();
      const primary = displayVar.split(",")[0]?.trim() ?? "";
      return {
        dpr: window.devicePixelRatio,
        displayVarPresent: displayVar.length > 0,
        primaryFamily: primary,
        primaryReady: primary ? document.fonts.check(`700 28px ${primary}`) : false,
        oswaldLiteralReady: document.fonts.check('700 28px "Oswald"'),
      };
    });
    findings.push({
      id: "canvas-font-dpr",
      severity: canvasProbe.displayVarPresent ? "PASS" : "MAJOR",
      note: JSON.stringify(canvasProbe),
    });

    // Prize Pool — valid calc + PNG
    await page.goto(`${BASE}/tools/prize-pool-splitter`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Calculate breakdown/i }).click();
    await expect(page.getByRole("heading", { name: /Calculated breakdown/i })).toBeVisible();
    await expect(page.getByText(/Unallocated/i).first()).toBeVisible();
    await page.getByRole("button", { name: /Copy summary/i }).click();
    const [prizeDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download PNG card/i }).click(),
    ]);
    expect(prizeDl.suggestedFilename().toLowerCase()).toMatch(/prize-pool.*\.png$/);
    sizes["prize-pool.png"] = readPngSize(await saveDownload(prizeDl, "prize-pool.png"));
    expect(sizes["prize-pool.png"]).toMatchObject({ width: 1080, height: 1080 });
    await page.screenshot({ path: path.join(EVIDENCE, "prize-pool-desktop.png"), fullPage: true });

    // Over-allocation inline error: fixed 80 + 50% of 100 (+ third row 0%)
    await page.getByLabel(/Total prize pool/i).fill("100");
    const splitType = page.getByLabel(/Split type/i);
    await splitType.nth(0).selectOption("fixed");
    await page.getByLabel(/^Amount$/i).first().fill("80");
    await splitType.nth(1).selectOption("percent");
    await page.getByLabel(/Percent of total/i).first().fill("50");
    if ((await page.getByLabel(/Percent of total/i).count()) >= 2) {
      await page.getByLabel(/Percent of total/i).nth(1).fill("0");
    }
    await page.getByRole("button", { name: /Calculate breakdown/i }).click();
    await expect(page.getByText(/Check these fields/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Distribution exceeds the total prize pool/i)).toBeVisible();
    findings.push({
      id: "prize-over-allocation",
      severity: "PASS",
      note: "Inline alert; calculator stayed on page",
    });

    // Roster
    await page.goto(`${BASE}/tools/roster-slot-builder`, { waitUntil: "domcontentloaded" });
    const [rosterEmptyDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download PNG card/i }).click(),
    ]);
    sizes["roster-empty.png"] = readPngSize(await saveDownload(rosterEmptyDl, "roster-empty.png"));
    expect(sizes["roster-empty.png"].width).toBe(1080);

    // Default Place-in is bench — put Alpha/Bravo into starter slots for an honest partial PNG.
    await page.getByLabel(/^Place in$/i).selectOption("starter:0");
    await page.getByLabel(/^Display name$/i).fill("P15 Alpha");
    await page.getByRole("button", { name: /Add player/i }).click();
    await page.getByLabel(/^Place in$/i).selectOption("starter:1");
    await page.getByLabel(/^Display name$/i).fill("P15 Bravo");
    await page.getByRole("button", { name: /Add player/i }).click();
    const [rosterPartialDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download PNG card/i }).click(),
    ]);
    sizes["roster-partial.png"] = readPngSize(
      await saveDownload(rosterPartialDl, "roster-partial.png"),
    );
    await page.getByRole("button", { name: /Download CSV/i }).click();
    await expect(page.getByText(/CSV downloaded/i)).toBeVisible({ timeout: 8_000 });
    await page.screenshot({ path: path.join(EVIDENCE, "roster-desktop.png"), fullPage: true });
    findings.push({ id: "roster-exports", severity: "PASS", note: "Empty+partial PNG + CSV" });

    // Tie-break
    await page.goto(`${BASE}/tools/tiebreak-qualifier`, { waitUntil: "domcontentloaded" });
    const addCriterion = page.getByRole("button", { name: /Add criterion/i });
    const criterionName = page.getByPlaceholder("Placement").or(page.getByLabel(/^Name$/i).first());
    if (await criterionName.isVisible().catch(() => false)) {
      await criterionName.fill("WWCD");
      if (await addCriterion.isEnabled()) await addCriterion.click();
    }
    const addTeam = page.getByRole("button", { name: /Add team/i });
    const teamNameInput = page.getByLabel(/^Team name$/i).last();
    await teamNameInput.fill("P15 Team One");
    await addTeam.click();
    await teamNameInput.fill("P15 Team Two");
    await addTeam.click();
    // Tied scores if numeric inputs exist
    const scoreInputs = page.locator('input[inputmode="numeric"], input[placeholder="—"]');
    if ((await scoreInputs.count()) >= 2) {
      await scoreInputs.nth(0).fill("12");
      await scoreInputs.nth(1).fill("12");
    }
    const [tieDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download PNG card/i }).click(),
    ]);
    expect(tieDl.suggestedFilename().toLowerCase()).toMatch(/tiebreak.*\.png$/);
    sizes["tiebreak.png"] = readPngSize(await saveDownload(tieDl, "tiebreak.png"));
    expect(sizes["tiebreak.png"].width).toBe(1080);
    await page.screenshot({ path: path.join(EVIDENCE, "tiebreak-desktop.png"), fullPage: true });
    findings.push({ id: "tiebreak-export", severity: "PASS", note: "PNG 1080² downloaded" });
    // Mobile campaign + tool export
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/campaigns/bgmi-season`, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: path.join(EVIDENCE, "campaign-mobile.png"), fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2),
    ).toBe(false);
    await page.goto(`${BASE}/tools/prize-pool-splitter`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Calculate breakdown/i }).click();
    await expect(page.getByRole("button", { name: /Download PNG card/i })).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE, "prize-pool-mobile.png"), fullPage: true });
    const [prizeMobileDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download PNG card/i }).click(),
    ]);
    sizes["prize-pool-mobile-export.png"] = readPngSize(
      await saveDownload(prizeMobileDl, "prize-pool-mobile-export.png"),
    );
    expect(sizes["prize-pool-mobile-export.png"].width).toBe(1080);
    findings.push({ id: "mobile-export", severity: "PASS", note: "Campaign + prize PNG on 390px" });

    // Disposable signup → onboarding → discoverability → player PNG
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
    await page.getByLabel(/display name/i).fill("P15M1V Long Display Name Tester");
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByLabel(/confirm password/i).fill(password);
    await page.getByRole("button", { name: /create account/i }).click();
    await waitPath(page, "/onboarding/profile");
    await page.getByLabel(/^Handle$/i).fill(handle);
    await page.getByLabel(/^Display name$/i).fill("P15M1V Long Display Name Tester");
    await page.getByLabel(/Country/i).fill("IN");
    await page.getByLabel(/Short bio/i).fill("P15-M1-V acceptance fixture — self-reported only.");
    await page.getByLabel(/In-game name/i).fill(`IGN_${stamp.slice(-8)}`);
    await page.getByLabel(/Primary role/i).selectOption("Support");
    await page.getByLabel(/Game region/i).selectOption("india");
    await page.locator('input[name="play_modes"][value="squad"]').check();
    await page.getByRole("button", { name: /Save profile/i }).click();
    await waitPath(page, "/settings/profile");

    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = listed.data.users.find((u) => u.email === email);
    if (match?.id) {
      createdIds.push(match.id);
      // create_team RPC requires email_confirmed_at; confirm fixture without touching Auth settings.
      await admin.auth.admin.updateUserById(match.id, { email_confirm: true });
    }

    // Undiscoverable before opt-in
    const before = await page.request.get(`${BASE}/players/${handle}`);
    expect(before.status()).toBe(404);
    findings.push({
      id: "undiscoverable-404",
      severity: "PASS",
      note: "Public profile 404 before discoverability",
    });

    await page.goto(`${BASE}/settings/profile`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Enable discoverability/i }).click();
    await expect(page.getByText(/Current state:\s*Discoverable|Discoverable/i).first()).toBeVisible({
      timeout: 20_000,
    });
    // Per-game visibility is independent of the master switch (default true on create).
    const enabledShow = page.getByRole("button", { name: /^Show$/i }).and(page.locator(":enabled"));
    while ((await enabledShow.count()) > 0) {
      await enabledShow.first().click();
      await expect(page.getByText(/^Visible$/i).first()).toBeVisible({ timeout: 15_000 });
    }

    // Retry public profile briefly — force-dynamic should make consent immediate.
    let shareReady = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.goto(`${BASE}/players/${handle}`, { waitUntil: "domcontentloaded" });
      if (await page.getByRole("heading", { name: /Share card/i }).isVisible().catch(() => false)) {
        shareReady = true;
        break;
      }
      await page.waitForTimeout(1_500);
    }
    expect(shareReady).toBe(true);
    await expect(page.getByRole("heading", { name: /Share card/i })).toBeVisible();
    await expect(
      page.getByText(/not a verification|Discoverable player|Self-reported player profile/i).first(),
    ).toBeVisible();
    const [playerDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download player profile PNG/i }).click(),
    ]);
    expect(playerDl.suggestedFilename().toLowerCase()).toMatch(/player-.*\.png$/);
    sizes["player-card.png"] = readPngSize(await saveDownload(playerDl, "player-card.png"));
    expect(sizes["player-card.png"].width).toBe(1080);
    await page.screenshot({
      path: path.join(EVIDENCE, "player-profile-desktop.png"),
      fullPage: true,
    });
    findings.push({ id: "player-card", severity: "PASS", note: "Public share PNG OK" });

    // Fake handle
    const fakeRes = await page.goto(`${BASE}/players/no-such-p15m1v-handle-zzz`, {
      waitUntil: "domcontentloaded",
    });
    expect(fakeRes?.status() === 404 || (await page.getByText(/not found|404/i).count()) > 0).toBe(
      true,
    );

    // Team create + recruiting PNG (all required fields)
    await page.goto(`${BASE}/teams/new`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Create a team/i })).toBeVisible();
    await page.getByLabel(/^Team name$/i).fill("P15M1V Acceptance Wolves");
    await page.getByLabel(/^Team slug$/i).fill(teamSlug);
    await page.locator("#team-region").selectOption({ index: 1 });
    await page.locator("#team-current-level").selectOption({ index: 1 });
    await page.locator("#team-target-level").selectOption({ index: 1 });
    await page.locator("#team-recruiting").check();
    await page.locator("#team-public").check();
    await page.getByRole("button", { name: /Create team/i }).click();
    await expect(page.getByRole("status")).toBeVisible({ timeout: 30_000 });
    // Prefer redirect URL if present; otherwise open public slug directly.
    await page.waitForURL(/\/(teams|workspace)/, { timeout: 15_000 }).catch(() => undefined);
    let teamShareReady = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.goto(`${BASE}/teams/${teamSlug}`, { waitUntil: "domcontentloaded" });
      if (await page.getByRole("heading", { name: /Share card/i }).isVisible().catch(() => false)) {
        teamShareReady = true;
        break;
      }
      await page.waitForTimeout(1_500);
    }
    expect(teamShareReady).toBe(true);
    await expect(page.getByText(/Open to Recruitment|Recruiting/i).first()).toBeVisible();
    const [teamDl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download recruitment PNG|Download team profile PNG/i }).click(),
    ]);
    sizes["team-recruiting.png"] = readPngSize(await saveDownload(teamDl, "team-recruiting.png"));
    expect(sizes["team-recruiting.png"].width).toBe(1080);
    await page.screenshot({
      path: path.join(EVIDENCE, "team-profile-desktop.png"),
      fullPage: true,
    });
    findings.push({ id: "team-recruiting-card", severity: "PASS", note: "Recruiting PNG OK" });
    fs.writeFileSync(
      path.join(EVIDENCE, "acceptance-meta.json"),
      JSON.stringify(
        {
          findings,
          sizes,
          canvasProbe,
          browser: "chromium",
          viewports: ["1440x900", "390x844"],
          base: BASE,
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close().catch(() => {});
    for (const id of createdIds) {
      const { data: teams } = await admin.from("teams").select("id").eq("owner_user_id", id);
      for (const t of teams ?? []) {
        await admin.from("team_members").delete().eq("team_id", t.id);
        await admin.from("team_audit_events").delete().eq("team_id", t.id);
        await admin.from("teams").delete().eq("id", t.id);
      }
      await admin.from("player_game_profiles").delete().eq("player_user_id", id);
      await admin.from("player_profiles").delete().eq("user_id", id);
      await admin.from("app_users").delete().eq("id", id);
      await admin.auth.admin.deleteUser(id);
    }
  }
});

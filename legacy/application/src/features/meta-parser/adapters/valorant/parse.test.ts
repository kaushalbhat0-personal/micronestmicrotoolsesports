import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { htmlToLines } from "./html";
import { parseValorantArticle } from "./parse";

function article(name: string): { lines: Array<{ depth: number; text: string }> } {
  const html = readFileSync(
    join(process.cwd(), "src/features/meta-parser/adapters/valorant/fixtures", name),
    "utf8"
  );
  return { lines: htmlToLines(html) };
}

const ALIAS_MAP = new Map<string, string>();

describe("valorant 13.01 numeric changes", () => {
  it("parses Yoru Gatecrash duration as buff with numerics and unit", () => {
    const changes = parseValorantArticle({ block: article("patch-13-01.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const gatecrash = changes.find((change) => change.description.includes("Active Beacon Duration"));
    expect(gatecrash).toMatchObject({
      entityType: "agent",
      entityName: "Yoru",
      category: "Gatecrash",
      oldText: "15s",
      newText: "20s",
      oldNumeric: 15,
      newNumeric: 20,
      unit: "s",
      changeType: "buff",
    });
  });

  it("parses Outlaw recovery/spread/recoil as nerfs, preserving zero values", () => {
    const changes = parseValorantArticle({ block: article("patch-13-01.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const recovery = changes.find((change) => change.description.includes("Recovery from"));
    expect(recovery).toMatchObject({
      entityType: "weapon",
      entityName: "Outlaw",
      oldNumeric: 0.1,
      newNumeric: 0.15,
      changeType: "nerf",
    });
    const spread = changes.find((change) => change.description.includes("Spread from"));
    expect(spread).toMatchObject({ oldNumeric: 0, newNumeric: 2.25, changeType: "nerf" });
    expect(spread?.oldNumeric).not.toBeNull();
    const recoil = changes.find((change) => change.description.includes("Recoil from"));
    expect(recoil).toMatchObject({ oldNumeric: 0, newNumeric: 4, changeType: "nerf" });
  });

  it("preserves qualitative ability changes with null numerics", () => {
    const changes = parseValorantArticle({ block: article("patch-13-01.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const doubleTap = changes.find((change) => change.description.includes("now instant"));
    expect(doubleTap).toMatchObject({
      entityType: "agent",
      entityName: "Iso",
      category: "Double Tap",
      oldNumeric: null,
      newNumeric: null,
    });
    // Scoped TL;DR wording ("Iso buff ... Double Tap") upgrades the fallback.
    expect(doubleTap?.changeType).toBe("buff");
    expect(doubleTap?.metadata["tldr_hint"]).toBe(true);
    const fakeout = changes.find((change) => change.description.includes("deception fantasy"));
    expect(fakeout).toMatchObject({
      entityType: "agent",
      entityName: "Yoru",
      category: "Fakeout",
      oldNumeric: null,
      newNumeric: null,
      changeType: "adjustment",
      confidence: "low",
    });
  });

  it("classifies bug fixes as bugfix/high, never buff/nerf", () => {
    const changes = parseValorantArticle({ block: article("patch-13-01.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const astra = changes.find((change) => change.description.includes("cooldown timer could sometimes remain visible"));
    expect(astra).toMatchObject({ entityType: "agent", entityName: "Astra", changeType: "bugfix", confidence: "high" });
    // "- Cypher" lost a nesting level in the source: the fix still resolves via header memory.
    const cypher = changes.find((change) => change.description.includes("Cyber Cage") && change.description.includes("line-of-sight"));
    expect(cypher).toMatchObject({ entityType: "agent", entityName: "Cypher", changeType: "bugfix" });
    const general = changes.find((change) => change.description.includes("Packets Received"));
    expect(general).toMatchObject({ entityType: "system", entityName: "General", changeType: "bugfix" });
  });
});

describe("valorant 13.08 qualitative patch", () => {
  it("succeeds with a low deterministic yield (never a parser failure)", () => {
    const changes = parseValorantArticle({ block: article("patch-13-08.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    expect(changes.length).toBeGreaterThan(0);
  });

  it("preserves Corrode map changes as map entities", () => {
    const changes = parseValorantArticle({ block: article("patch-13-08.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const mid = changes.find((change) => change.description.includes("Mid half wall"));
    expect(mid).toMatchObject({ entityType: "map", entityName: "CORRODE", category: "Mid" });
    expect(mid?.oldNumeric).toBeNull();
  });

  it("keeps map-pool rotation as a system change and skips captions/known issues", () => {
    const changes = parseValorantArticle({ block: article("patch-13-08.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const pool = changes.filter((change) => change.entityName === "Map Pool");
    expect(pool.length).toBe(2);
    expect(changes.some((change) => change.description.includes("Before (Left)"))).toBe(false);
    expect(changes.some((change) => change.description.includes("Team MVP"))).toBe(false);
    expect(changes.some((change) => change.description.includes("Related Articles"))).toBe(false);
  });

  it("parses header-less agent leaves and system features", () => {
    const changes = parseValorantArticle({ block: article("patch-13-08.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const killjoy = changes.find((change) => change.description.includes("Alarmbot projectile"));
    expect(killjoy).toMatchObject({ entityType: "agent", entityName: "Killjoy" });
    const rating = changes.find((change) => change.description.includes("Map Rating evaluates"));
    expect(rating).toMatchObject({ entityType: "system", entityName: "Competitive", category: "Map Rating" });
    const warden = changes.find((change) => change.description.includes("Warden scope"));
    expect(warden).toMatchObject({ entityType: "weapon", changeType: "bugfix" });
  });
});

describe("valorant stable keys", () => {
  it("is deterministic across repeated parses", () => {
    const first = parseValorantArticle({ block: article("patch-13-01.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const second = parseValorantArticle({ block: article("patch-13-01.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    expect(second.map((change) => change.stableKey)).toEqual(first.map((change) => change.stableKey));
  });

  it("separates entities, categories, attributes, and repeated occurrences", () => {
    const changes = parseValorantArticle({ block: article("patch-13-01.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const keys = changes.map((change) => change.stableKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key.startsWith("valorant:")).toBe(true);
    }
    const repeated = parseValorantArticle({
      block: {
        lines: [
          { depth: 0, text: "AGENTS UPDATES" },
          { depth: 0, text: "Iso" },
          { depth: 1, text: "Double Tap" },
          { depth: 2, text: "Cooldown from 10s >>> 12s" },
          { depth: 2, text: "Cooldown from 12s >>> 14s" },
        ],
      },
      upstreamCommit: null,
      aliasMap: ALIAS_MAP,
    });
    expect(repeated).toHaveLength(2);
    expect(repeated[0]?.stableKey).not.toBe(repeated[1]?.stableKey);
    expect(repeated[0]?.stableKey.endsWith(":0")).toBe(true);
    expect(repeated[1]?.stableKey.endsWith(":1")).toBe(true);
  });

  it("returns [] for non-object blocks without throwing", () => {
    expect(parseValorantArticle({ block: null, upstreamCommit: null, aliasMap: ALIAS_MAP })).toEqual([]);
    expect(parseValorantArticle({ block: "just a string", upstreamCommit: null, aliasMap: ALIAS_MAP })).toEqual([]);
  });
});

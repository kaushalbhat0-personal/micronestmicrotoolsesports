import { describe, it, expect } from "vitest";
import type { DraftConfig } from "../types";
import { GAMES } from "@/config/games/catalog";
import { draftConfigSchema, TEMPLATES_PER_ORG_MAX } from "../schemas/draft-config";
import { applyAction, countPoolConsumingSteps, createState, deriveView, isComplete, validateConfig } from "./draft-engine";
import { buildDraftCopyText } from "./share-text";
import { shareRecordSchema } from "./share";
import { GAME_VETO_PRESETS, getGameVetoPresetById } from "./game-presets";
import {
  FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX,
} from "./template-service";

const SIDE_CONFIG: DraftConfig = {
  teamA: "TAG",
  teamB: "Rivals",
  pool: ["Map A", "Map B", "Map C"],
  sequence: [
    { team: "A", type: "ban" },
    { team: "B", type: "side" },
    { team: "A", type: "pick" },
    { team: "B", type: "side" },
  ],
};

const CTX = {
  organizationName: "Org",
  refCode: "DB-2026-00001",
  matchName: null,
  eventName: null,
  formatLabel: null,
  completedAt: null,
};

describe("side steps — engine", () => {
  it("accepts side in DraftActionType validation", () => {
    expect(validateConfig(SIDE_CONFIG).valid).toBe(true);
  });

  it("schema accepts side but still rejects unknown types", () => {
    const ok = draftConfigSchema.safeParse({
      teamA: "A",
      teamB: "B",
      pool: ["M1", "M2", "M3"],
      sequence: [{ team: "A", type: "side" }],
    });
    expect(ok.success).toBe(true);
    const bad = draftConfigSchema.safeParse({
      teamA: "A",
      teamB: "B",
      pool: ["M1", "M2"],
      sequence: [{ team: "A", type: "veto" }],
    });
    expect(bad.success).toBe(false);
  });

  it("normalizes side steps without retaining unknown fields", () => {
    const state = createState({
      ...SIDE_CONFIG,
      sequence: [{ team: "B", type: "side", extra: "dropped" } as unknown as DraftConfig["sequence"][number]],
    });
    expect(state.config.sequence).toEqual([{ team: "B", type: "side" }]);
  });

  it("side step does not consume pool (pool counts ban/pick only)", () => {
    // 2 pool-consuming steps, 3 pool items, 4 total steps — valid only
    // because side steps are exempt from the pool-size rule.
    expect(validateConfig(SIDE_CONFIG).valid).toBe(true);
    const tight = validateConfig({ ...SIDE_CONFIG, pool: ["Map A", "Map B"] });
    expect(tight.valid).toBe(true);
    const tooSmall = validateConfig({ ...SIDE_CONFIG, pool: ["Map A"] });
    expect(tooSmall.valid).toBe(false);
  });

  it("side accepts an item not in the pool", () => {
    let s = createState(SIDE_CONFIG);
    const ban = applyAction(s, { team: "A", item: "Map A" });
    expect(ban.ok).toBe(true);
    if (!ban.ok) return;
    s = ban.state;
    const side = applyAction(s, { team: "B", item: "CT" });
    expect(side.ok).toBe(true);
    if (!side.ok) return;
    expect(side.state.actions[1]).toMatchObject({ team: "B", type: "side", item: "CT" });
  });

  it("ban/pick still require unused pool items", () => {
    const s = createState(SIDE_CONFIG);
    const unknown = applyAction(s, { team: "A", item: "CT" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe("ITEM_UNKNOWN");
  });

  it("side does not remove anything from the pool", () => {
    let s = createState(SIDE_CONFIG);
    for (const input of [
      { team: "A" as const, item: "Map A" },
      { team: "B" as const, item: "CT" },
    ]) {
      const r = applyAction(s, input);
      if (!r.ok) throw new Error(`setup failed: ${r.error.code}`);
      s = r.state;
    }
    const view = deriveView(s);
    const names = view.available.filter((p) => p.status === "available").map((p) => p.name);
    expect(names).toEqual(["Map B", "Map C"]);
  });

  it("side item colliding with a pool name does not mark it used", () => {
    const s = createState(SIDE_CONFIG);
    const ban = applyAction(s, { team: "A", item: "Map A" });
    if (!ban.ok) throw new Error("setup failed");
    const side = applyAction(ban.state, { team: "B", item: "Map B" });
    expect(side.ok).toBe(true);
    if (!side.ok) return;
    const view = deriveView(side.state);
    const mapB = view.available.find((p) => p.name === "Map B");
    expect(mapB?.status).toBe("available");
  });

  it("turn ownership works for side steps", () => {
    const s = createState(SIDE_CONFIG);
    const ban = applyAction(s, { team: "A", item: "Map A" });
    if (!ban.ok) throw new Error("setup failed");
    const wrong = applyAction(ban.state, { team: "A", item: "T" });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("WRONG_TURN");
    expect(deriveView(ban.state).whoseTurn).toBe("B");
  });

  it("completes a mixed ban/side/pick sequence", () => {
    let s = createState(SIDE_CONFIG);
    for (const input of [
      { team: "A" as const, item: "Map A" },
      { team: "B" as const, item: "CT" },
      { team: "A" as const, item: "Map B" },
      { team: "B" as const, item: "T" },
    ]) {
      const r = applyAction(s, input);
      if (!r.ok) throw new Error(`setup failed: ${r.error.code} ${r.error.message}`);
      s = r.state;
    }
    expect(isComplete(s)).toBe(true);
  });
});

describe("side steps — selections and decider", () => {
  it("final selections ignore side actions", () => {
    let s = createState(SIDE_CONFIG);
    for (const input of [
      { team: "A" as const, item: "Map A" },
      { team: "B" as const, item: "CT" },
      { team: "A" as const, item: "Map B" },
      { team: "B" as const, item: "T" },
    ]) {
      const r = applyAction(s, input);
      if (!r.ok) throw new Error("setup failed");
      s = r.state;
    }
    const text = buildDraftCopyText(s, CTX);
    expect(text).toContain("FINAL SELECTIONS");
    expect(text).toContain("Map B — TAG pick");
    expect(text).not.toMatch(/CT — .* pick|T — .* pick/);
  });

  it("decider/unpicked calculations ignore side actions", () => {
    let s = createState(SIDE_CONFIG);
    for (const input of [
      { team: "A" as const, item: "Map A" },
      { team: "B" as const, item: "CT" },
      { team: "A" as const, item: "Map B" },
      { team: "B" as const, item: "T" },
    ]) {
      const r = applyAction(s, input);
      if (!r.ok) throw new Error("setup failed");
      s = r.state;
    }
    const text = buildDraftCopyText(s, CTX);
    expect(text).toContain("DECIDER: Map C");
  });

  it("share text renders Side distinctly, never as Pick", () => {
    const s = createState(SIDE_CONFIG);
    const ban = applyAction(s, { team: "A", item: "Map A" });
    if (!ban.ok) throw new Error("setup failed");
    const side = applyAction(ban.state, { team: "B", item: "CT" });
    if (!side.ok) throw new Error("setup failed");
    const text = buildDraftCopyText(side.state, CTX);
    expect(text).toContain("Rivals — Side — CT");
    expect(text).not.toContain("Rivals — Pick — CT");
  });
});

describe("side steps — share compatibility", () => {
  const oldPayload = {
    ref_code: "DB-2026-00001",
    match_name: null,
    event_name: null,
    format_label: null,
    team_a: "TAG",
    team_b: "Rivals",
    sequence: [{ team: "A", type: "ban" }],
    pool: ["Map A", "Map B"],
    actions: [{ stepIndex: 0, team: "A", type: "ban", item: "Map A", at: "2026-01-01T00:00:00.000Z" }],
    completed_at: "2026-01-01T00:00:00.000Z",
    organization_name: "Org",
    organization_logo_url: null,
  };

  it("old ban/pick payloads remain valid", () => {
    expect(shareRecordSchema.safeParse(oldPayload).success).toBe(true);
  });

  it("new side payloads serialize and parse", () => {
    const next = {
      ...oldPayload,
      sequence: [...oldPayload.sequence, { team: "B", type: "side" }],
      actions: [
        ...oldPayload.actions,
        { stepIndex: 1, team: "B", type: "side", item: "CT", at: "2026-01-01T00:00:01.000Z" },
      ],
    };
    const parsed = shareRecordSchema.safeParse(next);
    expect(parsed.success).toBe(true);
  });
});

describe("game veto presets", () => {
  it("every preset references a valid catalog GameSlug", () => {
    const slugs = new Set(GAMES.map((game) => game.slug));
    for (const preset of GAME_VETO_PRESETS) {
      expect(slugs.has(preset.gameSlug)).toBe(true);
    }
  });

  it("covers CS2, Valorant, and R6 only — no MOBA/battle-royale presets", () => {
    const slugs = GAME_VETO_PRESETS.map((preset) => preset.gameSlug);
    expect(slugs).toContain("cs2");
    expect(slugs).toContain("valorant");
    expect(slugs).toContain("rainbow-six-siege");
    for (const forbidden of ["dota-2", "league-of-legends", "pubg-mobile", "fortnite", "apex-legends", "rocket-league", "call-of-duty"]) {
      expect(slugs).not.toContain(forbidden);
    }
  });

  it("has unique preset ids", () => {
    const ids = GAME_VETO_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset sequence passes real engine validation", () => {
    for (const preset of GAME_VETO_PRESETS) {
      const valid = validateConfig({
        teamA: "Team A",
        teamB: "Team B",
        pool: ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"],
        sequence: preset.sequence.map((s) => ({ team: s.team, type: s.type })),
      });
      expect(valid.errors).toEqual([]);
      expect(valid.valid).toBe(true);
    }
  });

  it("preset lookup resolves known ids and misses unknown ids", () => {
    expect(getGameVetoPresetById("cs2-major-bo3")?.gameSlug).toBe("cs2");
    expect(getGameVetoPresetById("valorant-vct-bo5")?.gameSlug).toBe("valorant");
    expect(getGameVetoPresetById("nope")).toBeUndefined();
  });

  it("template caps are unchanged (Free 3, paid 20)", () => {
    expect(FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX).toBe(3);
    expect(TEMPLATES_PER_ORG_MAX).toBe(20);
  });
});

describe("pool-consuming step count (setup display)", () => {
  it("all ban/pick template counts every step", () => {
    expect(
      countPoolConsumingSteps([
        { type: "ban" },
        { type: "pick" },
        { type: "ban" },
      ])
    ).toBe(3);
  });

  it("one side step is excluded", () => {
    expect(
      countPoolConsumingSteps([
        { type: "ban" },
        { type: "side" },
        { type: "pick" },
      ])
    ).toBe(2);
  });

  it("multiple side steps are all excluded", () => {
    expect(
      countPoolConsumingSteps([
        { type: "side" },
        { type: "ban" },
        { type: "side" },
        { type: "side" },
      ])
    ).toBe(1);
  });

  it("released presets report pool-consuming counts, not total steps", () => {
    const counts: Record<string, number> = {};
    for (const preset of GAME_VETO_PRESETS) {
      counts[preset.id] = countPoolConsumingSteps(preset.sequence);
    }
    expect(counts["cs2-major-bo1"]).toBe(6);
    expect(counts["cs2-major-bo3"]).toBe(6);
    expect(counts["valorant-vct-bo1"]).toBe(6);
    expect(counts["valorant-vct-bo3"]).toBe(6);
    expect(counts["valorant-vct-bo5"]).toBe(6);
    expect(counts["r6-bo1"]).toBe(8);
    expect(counts["r6-bo3"]).toBe(8);
  });
});

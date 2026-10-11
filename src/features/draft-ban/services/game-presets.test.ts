import { describe, expect, it } from "vitest";
import {
  GAME_VETO_PRESETS,
  buildGamePresetSetupHref,
  getGameVetoPresetById,
  resolveGamePresetSetupNavigation,
} from "./game-presets";
import type { DraftStep } from "../types";

describe("game preset setup navigation", () => {
  it("builds the existing match-setup route with the created template id", () => {
    expect(buildGamePresetSetupHref("acme", "091722c2-cf0c-4873-be4a-a05243a00e1f")).toBe(
      "/dashboard/acme/draft-ban/new?template=091722c2-cf0c-4873-be4a-a05243a00e1f"
    );
  });

  it("successful creation navigates to match setup with the returned template id", () => {
    const preset = getGameVetoPresetById("cs2-major-bo1");
    expect(preset).toBeDefined();
    const href = resolveGamePresetSetupNavigation("acme", { templateId: "template-123" });
    expect(href).toBe("/dashboard/acme/draft-ban/new?template=template-123");
  });

  it("failed creation does not navigate", () => {
    expect(resolveGamePresetSetupNavigation("acme", { error: "Template limit reached" })).toBeNull();
    expect(resolveGamePresetSetupNavigation("acme", {})).toBeNull();
    expect(resolveGamePresetSetupNavigation("acme", { templateId: "" })).toBeNull();
  });

  it("existing error handling stays intact (error message preserved by caller)", () => {
    const result = { error: "A template with this name already exists" };
    expect(resolveGamePresetSetupNavigation("acme", result)).toBeNull();
    expect(result.error).toBe("A template with this name already exists");
  });
});

function stepSequence(id: string): readonly DraftStep[] {
  const preset = getGameVetoPresetById(id);
  expect(preset).toBeDefined();
  return preset?.sequence ?? [];
}

describe("R6 ruleset-copy hardening (sequences frozen, copy scoped)", () => {
  it("R6 BO3 sequence is byte-for-byte unchanged (11 steps, fixed order/ownership)", () => {
    expect(stepSequence("r6-bo3")).toEqual([
      { team: "A", type: "ban" },
      { team: "B", type: "ban" },
      { team: "A", type: "ban" },
      { team: "B", type: "ban" },
      { team: "A", type: "pick" },
      { team: "B", type: "side" },
      { team: "B", type: "pick" },
      { team: "A", type: "side" },
      { team: "A", type: "ban" },
      { team: "B", type: "ban" },
      { team: "A", type: "side" },
    ]);
  });

  it("R6 BO3 copy carries decider-side confirmation guidance without claiming A is universal", () => {
    const preset = getGameVetoPresetById("r6-bo3");
    expect(preset).toBeDefined();
    const copy = `${preset?.description ?? ""} ${preset?.sourceNote ?? ""}`.toLowerCase();
    expect(copy).toContain("decider side");
    expect(copy).toContain("confirm");
    expect(copy).toContain("varies by event rule");
    expect(preset?.sourceNote.toLowerCase()).toContain("not universally team a");
  });

  it("R6 BO1 sequence is byte-for-byte unchanged (7 bans + B pick + A side)", () => {
    expect(stepSequence("r6-bo1")).toEqual([
      { team: "A", type: "ban" },
      { team: "B", type: "ban" },
      { team: "A", type: "ban" },
      { team: "B", type: "ban" },
      { team: "A", type: "ban" },
      { team: "B", type: "ban" },
      { team: "A", type: "ban" },
      { team: "B", type: "pick" },
      { team: "A", type: "side" },
    ]);
  });

  it("R6 BO1 copy scopes to the 2026 EU/BLAST form and warns about the 8-ban remainder variant", () => {
    const preset = getGameVetoPresetById("r6-bo1");
    expect(preset).toBeDefined();
    const copy = `${preset?.description ?? ""} ${preset?.sourceNote ?? ""}`.toLowerCase();
    expect(copy).toContain("2026 eu/blast form");
    expect(copy).toContain("8-ban remainder");
    expect(copy).toContain("edit the sequence for your event");
  });

  it("all 7 official preset ids, slugs, and step counts remain unchanged", () => {
    expect(GAME_VETO_PRESETS.map((p) => p.id)).toEqual([
      "cs2-major-bo1",
      "cs2-major-bo3",
      "valorant-vct-bo1",
      "valorant-vct-bo3",
      "valorant-vct-bo5",
      "r6-bo1",
      "r6-bo3",
    ]);
    const steps = new Map(GAME_VETO_PRESETS.map((p) => [p.id, p.sequence.length] as const));
    expect(steps.get("cs2-major-bo1")).toBe(7);
    expect(steps.get("cs2-major-bo3")).toBe(9);
    expect(steps.get("valorant-vct-bo1")).toBe(7);
    expect(steps.get("valorant-vct-bo3")).toBe(9);
    expect(steps.get("valorant-vct-bo5")).toBe(11);
    expect(steps.get("r6-bo1")).toBe(9);
    expect(steps.get("r6-bo3")).toBe(11);
    expect(getGameVetoPresetById("r6-bo1")?.gameSlug).toBe("rainbow-six-siege");
    expect(getGameVetoPresetById("r6-bo3")?.gameSlug).toBe("rainbow-six-siege");
  });
});

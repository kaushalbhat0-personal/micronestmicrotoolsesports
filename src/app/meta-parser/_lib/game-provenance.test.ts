import { describe, expect, it } from "vitest";
import { resolveGameProvenance } from "./game-provenance";
import type { PublishedGame } from "@/features/meta-parser/repositories/reads";

function game(partial: Partial<PublishedGame> & { slug: string; name: string }): PublishedGame {
  return {
    provenance: { sourceLabel: null, datasetLabel: null, datasetUrl: null, license: null },
    ...partial,
  };
}

describe("game provenance resolution", () => {
  it("renders Dota/OpenDota attribution exactly as production when catalog has no provenance", () => {
    const resolved = resolveGameProvenance(game({ slug: "dota-2", name: "Dota 2" }));
    expect(resolved).toEqual({
      sourceLabel: "Valve — Dota 2",
      datasetLabel: "OpenDota dotaconstants",
      datasetUrl: "https://github.com/odota/dotaconstants",
      license: "MIT License, © 2017 The OpenDota Project",
    });
  });

  it("prefers catalog expected_fields.provenance over fallbacks", () => {
    const resolved = resolveGameProvenance(
      game({
        slug: "test-game",
        name: "Test Game",
        provenance: {
          sourceLabel: "Test Official",
          datasetLabel: "Test Dataset",
          datasetUrl: "https://example.com/dataset",
          license: "Test License",
        },
      })
    );
    expect(resolved.sourceLabel).toBe("Test Official");
    expect(resolved.datasetLabel).toBe("Test Dataset");
    expect(resolved.datasetUrl).toBe("https://example.com/dataset");
    expect(resolved.license).toBe("Test License");
  });

  it("falls back generically for unknown games without fabricating licenses", () => {
    const resolved = resolveGameProvenance(game({ slug: "new-game", name: "New Game" }));
    expect(resolved.sourceLabel).toBe("New Game official patch notes");
    expect(resolved.datasetLabel).toBeNull();
    expect(resolved.datasetUrl).toBeNull();
    expect(resolved.license).toBeNull();
  });

  it("provenance component is data-driven (no hardcoded game literals)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const code = readFileSync(
      join(process.cwd(), "src/app/meta-parser/_components/provenance.tsx"),
      "utf8"
    );
    expect(code).not.toContain("Valve");
    expect(code).not.toContain("dotaconstants");
    expect(code).not.toContain("dota");
    expect(code).not.toContain("Dota");
  });
});

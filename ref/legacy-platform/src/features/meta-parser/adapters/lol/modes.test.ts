import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { htmlToLines } from "./html";
import { parseLoLArticle } from "./parse";

function article(name: string): { lines: Array<{ depth: number; text: string; heading?: boolean; quote?: boolean }> } {
  const html = readFileSync(
    join(process.cwd(), "src/features/meta-parser/adapters/lol/fixtures", name),
    "utf8"
  );
  return { lines: htmlToLines(html) };
}

const ALIAS_MAP = new Map<string, string>();

describe("lol mode isolation (26.20)", () => {
  it("emits zero facts from ARAM: Mayhem subtrees", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    expect(changes.some((change) => change.entityName === "Bard")).toBe(false);
    expect(changes.some((change) => change.entityName === "Garen")).toBe(false);
    expect(changes.some((change) => change.description.includes("Meep"))).toBe(false);
  });

  it("keeps Rift facts while Mayhem lookalikes are excluded", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    // Rift Diana row survives; Mayhem lookalike rows do not pollute it.
    const diana = changes.filter((change) => change.entityName === "Diana");
    expect(diana.length).toBe(1);
    expect(diana[0]).toMatchObject({ category: "W - Pale Cascade" });
  });
});

describe("lol mode isolation (26.19)", () => {
  it("emits zero facts from Classic subtrees, including nested rows", () => {
    const changes = parseLoLArticle({ block: article("patch-26-19.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    expect(changes.some((change) => change.entityName === "Akali")).toBe(false);
    expect(changes.some((change) => change.description.includes("Crescent Slash"))).toBe(false);
    expect(changes.some((change) => change.description.includes("Energy Cost"))).toBe(false);
    expect(changes.some((change) => change.description.includes("True Grit"))).toBe(false);
  });

  it("emits zero facts from Arena subtrees despite Rift-identical grammar", () => {
    const changes = parseLoLArticle({ block: article("patch-26-19.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    expect(changes.some((change) => change.entityName === "Aphelios")).toBe(false);
    expect(changes.some((change) => change.description.includes("Health Growth"))).toBe(false);
    expect(changes.some((change) => change.description.includes("Move Speed") && change.description.includes("330"))).toBe(false);
  });

  it("keeps Rift entities distinct from excluded mode entities", () => {
    const changes = parseLoLArticle({ block: article("patch-26-19.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const riftEntities = new Set(changes.map((change) => change.entityName));
    expect(riftEntities.has("Nasus")).toBe(true);
    expect(riftEntities.has("Rumble")).toBe(true);
    expect(riftEntities.has("Vi")).toBe(true);
    expect(riftEntities.has("Graves")).toBe(true);
    expect(riftEntities.has("World Atlas and Runic Compass")).toBe(true);
    expect(riftEntities.has("Teleport Cooldown")).toBe(true);
  });
});

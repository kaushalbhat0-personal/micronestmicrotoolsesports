import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildLoLAliasMap,
  canonicalizeLoLName,
  fetchLoLAliasMap,
  parseChampionEntries,
  parseItemEntries,
  resolveLoLName,
  selectDdragonVersion,
  type DdragonChampionEntry,
  type DdragonItemEntry,
} from "./aliases";

afterEach(() => {
  vi.unstubAllGlobals();
});

const CHAMPIONS: DdragonChampionEntry[] = [
  { id: "MonkeyKing", name: "Wukong" },
  { id: "Nunu", name: "Nunu & Willump" },
  { id: "KSante", name: "K'Sante" },
  { id: "Kaisa", name: "Kai'Sa" },
  { id: "Chogath", name: "Cho'Gath" },
  { id: "RekSai", name: "Rek'Sai" },
  { id: "DrMundo", name: "Dr. Mundo" },
  { id: "Belveth", name: "Bel'Veth" },
  { id: "Khazix", name: "Kha'Zix" },
  { id: "Velkoz", name: "Vel'Koz" },
  { id: "Leblanc", name: "LeBlanc" },
  { id: "Renata", name: "Renata Glasc" },
  { id: "LeeSin", name: "Lee Sin" },
  { id: "MissFortune", name: "Miss Fortune" },
  { id: "TwistedFate", name: "Twisted Fate" },
  { id: "Ashe", name: "Ashe" },
];

const ITEMS: DdragonItemEntry[] = [
  { id: "223152", name: "Hextech Rocketbelt" },
  { id: "773085", name: "Runaan's Hurricane" },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lol aliases (Data Dragon)", () => {
  it("resolves all 15 verified champion edge cases to stable IDs", () => {
    const map = buildLoLAliasMap(CHAMPIONS, ITEMS);
    const expected: Array<[string, string]> = [
      ["Wukong", "MonkeyKing"],
      ["Nunu & Willump", "Nunu"],
      ["K'Sante", "KSante"],
      ["Kai'Sa", "Kaisa"],
      ["Cho'Gath", "Chogath"],
      ["Rek'Sai", "RekSai"],
      ["Dr. Mundo", "DrMundo"],
      ["Bel'Veth", "Belveth"],
      ["Kha'Zix", "Khazix"],
      ["Vel'Koz", "Velkoz"],
      ["LeBlanc", "Leblanc"],
      ["Renata Glasc", "Renata"],
      ["Lee Sin", "LeeSin"],
      ["Miss Fortune", "MissFortune"],
      ["Twisted Fate", "TwistedFate"],
    ];
    for (const [heading, id] of expected) {
      expect(resolveLoLName(heading, map)).toMatchObject({
        displayName: heading,
        entityKey: id,
        hit: "canonical",
      });
    }
  });

  it("resolves dataset IDs and item names without invention", () => {
    const map = buildLoLAliasMap(CHAMPIONS, ITEMS);
    expect(resolveLoLName("MonkeyKing", map)).toMatchObject({ entityKey: "MonkeyKing", hit: "canonical" });
    expect(resolveLoLName("Hextech Rocketbelt", map)).toMatchObject({ entityKey: "223152", hit: "canonical" });
  });

  it("falls back to the cleaned heading for unknown names", () => {
    const map = buildLoLAliasMap(CHAMPIONS, ITEMS);
    expect(resolveLoLName("Some Future Champion", map)).toMatchObject({
      displayName: "Some Future Champion",
      entityKey: null,
      hit: "fallback",
    });
    expect(canonicalizeLoLName("  K'Sante ")).toBe("K'Sante");
  });

  it("skips malformed dataset rows without failing", () => {
    expect(parseChampionEntries(null)).toEqual([]);
    expect(parseChampionEntries({ data: null })).toEqual([]);
    expect(
      parseChampionEntries({ data: { a: { id: "A", name: "A" }, b: { id: "", name: "B" }, c: { id: "C" } } })
    ).toEqual([{ id: "A", name: "A" }]);
    expect(parseItemEntries({ data: { x: { name: "" }, y: { name: "Real Item" } } })).toEqual([
      { id: "y", name: "Real Item" },
    ]);
  });

  it("pins the newest versions.json entry and rejects bad shapes", () => {
    expect(selectDdragonVersion(["16.20.1", "16.19.1", "16.18.1"])).toBe("16.20.1");
    expect(() => selectDdragonVersion([])).toThrow();
    expect(() => selectDdragonVersion(["not-a-version"])).toThrow();
    expect(() => selectDdragonVersion(null)).toThrow();
  });

  it("returns map and pin together with no shared mutable state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        const payload =
          target.endsWith("/api/versions.json")
            ? ["16.20.1", "16.19.1"]
            : target.includes("/champion.json")
              ? { data: { MonkeyKing: { id: "MonkeyKing", name: "Wukong" } } }
              : { data: { "223152": { name: "Hextech Rocketbelt" } } };
        const encoded = new TextEncoder().encode(JSON.stringify(payload));
        return {
          ok: true,
          status: 200,
          url: target,
          headers: new Headers(),
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoded);
              controller.close();
            },
          }),
        };
      })
    );
    const first = await fetchLoLAliasMap();
    expect(first.aliasVersion).toBe("16.20.1");
    expect(first.aliasMap.get("wukong")).toBe("MonkeyKing");
    // A failed versions lookup rejects outright: with no global to hold
    // the pin, no stale previous pin can survive the failure.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("upstream down");
      })
    );
    await expect(fetchLoLAliasMap()).rejects.toThrow();
  });
});

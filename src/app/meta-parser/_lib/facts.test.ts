import { describe, expect, it } from "vitest";
import {
  CHANGE_TYPE_OPTIONS,
  ENTITY_TYPE_LABELS,
  categoryLabel,
  changeTypeBadgeVariant,
  changeTypeLabel,
  entitySearchPlaceholder,
  entityTypeLabel,
  factsHref,
  factsRangeLabel,
  humanizeAttribute,
  isVersionParam,
  parseFactsQuery,
} from "./facts";

describe("facts query parsing", () => {
  it("defaults to page 1 with the reader page size and zero offset", async () => {
    const { META_PARSER_READ_DEFAULT_LIMIT } = await import(
      "@/features/meta-parser/repositories/reads"
    );
    const query = parseFactsQuery({});
    expect(query.page).toBe(1);
    expect(query.limit).toBe(META_PARSER_READ_DEFAULT_LIMIT);
    expect(query.offset).toBe(0);
    expect(query.entityType).toBeNull();
    expect(query.changeType).toBeNull();
    expect(query.entity).toBeNull();
  });

  it("parses page and filters, passing values through for repository validation", () => {
    const query = parseFactsQuery({
      page: "3",
      entity_type: "hero",
      change_type: "buff",
      entity: " Clockwerk ",
    });
    expect(query.page).toBe(3);
    expect(query.offset).toBe(query.limit * 2);
    expect(query.entityType).toBe("hero");
    expect(query.changeType).toBe("buff");
    // Trimmed here; repository normalizes case/format server-side.
    expect(query.entity).toBe("Clockwerk");
  });

  it("falls back to page 1 for missing, zero, negative, or non-integer pages", () => {
    for (const page of [undefined, "0", "-2", "abc", "1.5", ["2", "3"]]) {
      expect(parseFactsQuery({ page: page as string }).page, JSON.stringify(page)).toBe(1);
    }
  });

  it("treats blank filter values as absent", () => {
    const query = parseFactsQuery({ entity_type: "  ", entity: "" });
    expect(query.entityType).toBeNull();
    expect(query.entity).toBeNull();
  });
});

describe("facts href builder", () => {
  const base = "/meta-parser/dota-2/7.41";

  it("returns the bare path with no query", () => {
    expect(factsHref(base, {})).toBe(base);
  });

  it("omits page 1 for canonical shape and keeps page 2+", () => {
    expect(factsHref(base, { page: 1 })).toBe(base);
    expect(factsHref(base, { page: 2 })).toBe(`${base}?page=2`);
  });

  it("preserves active filters while navigating pages", () => {
    expect(
      factsHref(base, { entityType: "hero", changeType: "buff", entity: "clockwerk", page: 2 })
    ).toBe(`${base}?entity_type=hero&change_type=buff&entity=clockwerk&page=2`);
  });
});

describe("facts presentation maps", () => {
  it("labels every change-type enum value (single source of truth)", () => {
    for (const option of CHANGE_TYPE_OPTIONS) {
      expect(changeTypeLabel(option.value)).toBe(option.label);
    }
    expect(Object.keys(CHANGE_TYPE_OPTIONS).length).toBeGreaterThan(0);
  });

  it("labels known entity types and Title-Cases unknown future types", () => {
    for (const [value, label] of Object.entries(ENTITY_TYPE_LABELS)) {
      expect(entityTypeLabel(value)).toBe(label);
    }
    expect(entityTypeLabel("champion")).toBe("Champion");
    expect(entityTypeLabel("agent")).toBe("Agent");
    expect(entityTypeLabel("operator")).toBe("Operator");
    expect(entityTypeLabel("weapon")).toBe("Weapon");
    expect(entityTypeLabel("mystery-boss")).toBe("Mystery Boss");
  });

  it("falls back to the raw value for unknown change types (never blank)", () => {
    expect(changeTypeLabel("mystery")).toBe("mystery");
    expect(changeTypeBadgeVariant("mystery")).toBe("outline");
  });

  it("maps buff/nerf to success/destructive variants", () => {
    expect(changeTypeBadgeVariant("buff")).toBe("success");
    expect(changeTypeBadgeVariant("nerf")).toBe("destructive");
  });

  it("formats range labels without inventing totals", () => {
    expect(factsRangeLabel(0, 50, 1726)).toBe("1–50 of 1,726");
    expect(factsRangeLabel(1700, 26, 1726)).toBe("1,701–1,726 of 1,726");
    expect(factsRangeLabel(0, 0, 0)).toBe("0 changes");
  });
});

describe("version param guard", () => {
  it("accepts safe generic version identifiers (dota, lol, valorant, date, season)", () => {
    for (const v of ["7.41", "7.40", "7.38c", "14.10", "10.08", "EP09", "2.2.16a", "2026-03-12", "Y10S1.1", "7", "7.41.1", "v7.41"]) {
      expect(isVersionParam(v), v).toBe(true);
    }
  });

  it("rejects unsafe versions (repository remains the validator)", () => {
    for (const v of ["", "seven", "../etc", "7,41", "7 41", "a/b", ".", "-"]) {
      expect(isVersionParam(v), v).toBe(false);
    }
  });
});

describe("plain-language presentation (RCCF-META-PARSER-UX-03)", () => {
  it("humanizes categories without changing stored values", () => {
    expect(categoryLabel("ability")).toBe("Ability");
    expect(categoryLabel("talents")).toBe("Talents");
    expect(categoryLabel("system")).toBe("System");
    expect(categoryLabel("mystery-bucket")).toBe("Mystery Bucket");
  });

  it("humanizes machine-normalized attributes for display only (F1)", () => {
    expect(humanizeAttribute("unseeing_shield_base_barrier_magic_block")).toBe(
      "Unseeing Shield Base Barrier Magic Block"
    );
    expect(humanizeAttribute("respawn_time")).toBe("Respawn Time");
    // Already-readable values pass through with title casing.
    expect(humanizeAttribute("damage")).toBe("Damage");
    expect(humanizeAttribute("Cooldown")).toBe("Cooldown");
    // Numeric and punctuated content stays intact.
    expect(humanizeAttribute("50")).toBe("50");
    expect(humanizeAttribute("attack-speed")).toBe("Attack Speed");
    expect(humanizeAttribute("")).toBe("");
  });

  it("builds game-aware search placeholders from known categories", () => {
    expect(entitySearchPlaceholder(["hero", "item", "system"])).toBe("Search heroes…");
    expect(entitySearchPlaceholder(["champion", "item", "system"])).toBe("Search champions…");
    expect(entitySearchPlaceholder(["agent", "weapon", "map", "system"])).toBe("Search agents…");
    expect(entitySearchPlaceholder(["weapon", "system"])).toBe("Search weapons…");
    expect(entitySearchPlaceholder([])).toBe("Search names…");
    expect(entitySearchPlaceholder(["unknown-thing"])).toBe("Search names…");
  });

  it("keeps URL query keys stable (entity_type, change_type, entity, page)", () => {
    const query = parseFactsQuery({
      entity_type: "hero",
      change_type: "buff",
      entity: "clockwerk",
      page: "2",
    });
    expect(query.entityType).toBe("hero");
    expect(query.changeType).toBe("buff");
    expect(query.entity).toBe("clockwerk");
    expect(query.page).toBe(2);
    expect(
      factsHref("/meta-parser/dota-2/7.41", {
        entityType: "hero",
        changeType: "nerf",
        entity: "clockwerk",
        page: 2,
      })
    ).toBe("/meta-parser/dota-2/7.41?entity_type=hero&change_type=nerf&entity=clockwerk&page=2");
  });
});

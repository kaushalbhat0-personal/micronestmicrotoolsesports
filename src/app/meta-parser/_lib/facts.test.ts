import { describe, expect, it } from "vitest";
import {
  CHANGE_TYPE_OPTIONS,
  ENTITY_TYPE_OPTIONS,
  changeTypeBadgeVariant,
  changeTypeLabel,
  entityTypeLabel,
  factsHref,
  factsRangeLabel,
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

  it("labels every entity-type enum value", () => {
    for (const option of ENTITY_TYPE_OPTIONS) {
      expect(entityTypeLabel(option.value)).toBe(option.label);
    }
  });

  it("falls back to the raw value for unknown types (never blank)", () => {
    expect(changeTypeLabel("mystery")).toBe("mystery");
    expect(entityTypeLabel("mystery")).toBe("mystery");
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
  it("accepts dotted numeric versions with optional letter suffix", () => {
    for (const v of ["7.41", "7.40", "7.38c"]) expect(isVersionParam(v)).toBe(true);
  });

  it("rejects malformed versions (repository remains the validator)", () => {
    for (const v of ["", "seven", "7", "7.41.1", "../etc", "7,41", "v7.41"]) {
      expect(isVersionParam(v), v).toBe(false);
    }
  });
});

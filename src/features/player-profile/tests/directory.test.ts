import { describe, expect, it } from "vitest";
import {
  getPlayerByHandleInputSchema,
  searchDirectoryInputSchema,
} from "../schemas/directory";

describe("searchDirectoryInputSchema (05 §5, 11 §3)", () => {
  it("applies frozen defaults", () => {
    expect(searchDirectoryInputSchema.parse({})).toEqual({
      limit: 24,
      offset: 0,
    });
  });

  it("enforces LIMIT 1..48 and non-negative OFFSET", () => {
    expect(searchDirectoryInputSchema.parse({ limit: 48 }).limit).toBe(48);
    expect(searchDirectoryInputSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(searchDirectoryInputSchema.safeParse({ limit: 49 }).success).toBe(false);
    expect(searchDirectoryInputSchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  it("bounds the free-text query", () => {
    expect(searchDirectoryInputSchema.parse({ query: "nova" }).query).toBe("nova");
    expect(
      searchDirectoryInputSchema.safeParse({ query: "x".repeat(121) }).success,
    ).toBe(false);
  });

  it("rejects unknown keys (mass assignment)", () => {
    expect(
      searchDirectoryInputSchema.safeParse({ limit: 10, user_id: "x" }).success,
    ).toBe(false);
  });
});

describe("getPlayerByHandleInputSchema (05 §5)", () => {
  it("accepts valid handles, normalized", () => {
    expect(getPlayerByHandleInputSchema.parse({ handle: "Nova_01" })).toEqual({
      handle: "nova_01",
    });
  });

  it("rejects invalid handle syntax", () => {
    expect(
      getPlayerByHandleInputSchema.safeParse({ handle: "ab" }).success,
    ).toBe(false);
    expect(
      getPlayerByHandleInputSchema.safeParse({ handle: "../admin" }).success,
    ).toBe(false);
  });
});

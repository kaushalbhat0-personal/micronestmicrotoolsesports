import { describe, expect, it } from "vitest";
import {
  isConflictError,
  isUniqueViolationMessage,
  KNOWN_UNIQUE_CONSTRAINTS,
  META_PARSER_CONFLICT_CODE,
} from "./conflict";

describe("conflict detection", () => {
  it("accepts PostgreSQL 23505", () => {
    expect(isUniqueViolationMessage('duplicate key value violates unique constraint "t_pkey" (23505)')).toBe(true);
  });

  it("accepts known Meta-Parser constraints even without a code", () => {
    for (const name of KNOWN_UNIQUE_CONSTRAINTS) {
      expect(isUniqueViolationMessage(`duplicate key value violates unique constraint "${name}"`)).toBe(true);
    }
  });

  it("rejects bare duplicate wording without code or known constraint", () => {
    expect(isUniqueViolationMessage("duplicate entry rejected by custom hook")).toBe(false);
    expect(isUniqueViolationMessage("a duplicate was found somewhere")).toBe(false);
    expect(isUniqueViolationMessage("")).toBe(false);
  });

  it("recognizes coded conflict errors and nothing else", () => {
    const coded = new Error("original message preserved");
    (coded as { code?: string }).code = META_PARSER_CONFLICT_CODE;
    expect(isConflictError(coded)).toBe(true);
    expect(isConflictError(new Error("connection reset"))).toBe(false);
    expect(isConflictError(null)).toBe(false);
    expect(isConflictError("23505")).toBe(false);
  });
});

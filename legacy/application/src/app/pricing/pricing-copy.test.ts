import { describe, expect, it } from "vitest";
import {
  ALL_ACCESS_COVERAGE_BULLET,
  ALL_ACCESS_ROSTER_NOTE,
  ALL_ACCESS_SCOPE_NOTE,
} from "./pricing-client";

/**
 * All Access copy accuracy (RCCF-TOOLBOX-IA-02). Copy only — no prices,
 * slugs, entitlement, or billing semantics are asserted here beyond
 * "no amounts or plan slugs leaked into marketing copy".
 */
describe("all access copy", () => {
  it("names every released paid tool", () => {
    for (const tool of [
      "Sponsorship Tracking",
      "Prize Pool Splitter",
      "Draft & Ban",
      "Tie-Breaker Resolver",
      "Prize Payout Tracker",
    ]) {
      expect(ALL_ACCESS_COVERAGE_BULLET).toContain(tool);
    }
  });

  it("states the Roster Builder relationship instead of excluding it", () => {
    expect(ALL_ACCESS_ROSTER_NOTE).toMatch(/Roster/i);
    expect(ALL_ACCESS_ROSTER_NOTE).toMatch(/free/i);
  });

  it("scopes coverage to currently available tools", () => {
    expect(ALL_ACCESS_SCOPE_NOTE).toMatch(/currently available/i);
  });

  it("hardcodes no prices or plan slugs", () => {
    const copy = `${ALL_ACCESS_COVERAGE_BULLET} ${ALL_ACCESS_ROSTER_NOTE} ${ALL_ACCESS_SCOPE_NOTE}`;
    expect(copy).not.toMatch(/₹/);
    expect(copy).not.toMatch(/-monthly|-yearly/);
  });
});

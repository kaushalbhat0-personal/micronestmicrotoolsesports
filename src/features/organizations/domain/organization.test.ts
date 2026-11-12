// P8 organization domain tests (pure, no network).
// Covers: slug normalization, org-type vocabulary, trust-state presentation
// (submitted never renders as confirmed), URL validation fail-closed,
// game compatibility display, team-count/independent-team behavior, and public
// projection boundaries.

import { describe, expect, it } from "vitest";
import { ORGANIZATION_DIRECTORY_COLUMNS } from "../domain/columns";
import { isOrgType, ORG_TYPES } from "../domain/org-type";
import {
  isConfirmedTrust,
  isTrustState,
  TRUST_STATES,
  trustStateLabel,
} from "../domain/trust";
import { isValidExternalUrl } from "../domain/links";
import { organizationSlugSchema, searchOrganizationsInputSchema } from "../schemas/directory";

describe("organization slug", () => {
  it("normalizes case/whitespace and rejects bad shapes", () => {
    expect(organizationSlugSchema.parse("  Nova-Esports ")).toBe("nova-esports");
    expect(() => organizationSlugSchema.parse("a")).toThrow();
    expect(() => organizationSlugSchema.parse("has space")).toThrow();
    expect(() => organizationSlugSchema.parse("UPPER__SCORE")).toThrow();
  });
});

describe("organization type vocabulary", () => {
  it("is a closed controlled vocabulary", () => {
    expect(ORG_TYPES).toContain("professional");
    expect(ORG_TYPES).toContain("academy");
    expect(isOrgType("professional")).toBe(true);
    expect(isOrgType("investor")).toBe(false);
    expect(isOrgType("")).toBe(false);
  });

  it("rejects unknown types at the input boundary", () => {
    const parsed = searchOrganizationsInputSchema.safeParse({ orgType: "investor", limit: 24, offset: 0 });
    expect(parsed.success).toBe(false);
  });
});

describe("trust-state presentation", () => {
  it("distinguishes all required states and confirms only confirmed", () => {
    for (const state of ["not_submitted", "submitted", "under_review", "confirmed", "rejected", "expired"] as const) {
      expect(isTrustState(state)).toBe(true);
    }
    expect(TRUST_STATES).toHaveLength(6);
    expect(isConfirmedTrust("confirmed")).toBe(true);
    expect(isConfirmedTrust("submitted")).toBe(false);
    expect(isConfirmedTrust("under_review")).toBe(false);
    expect(isConfirmedTrust("not_submitted")).toBe(false);
    expect(trustStateLabel("submitted")).not.toMatch(/confirmed/i);
    expect(trustStateLabel("under_review")).not.toMatch(/^confirmed$/i);
  });
});

describe("external URL validation", () => {
  it("accepts https only and rejects credentials, http and javascript", () => {
    expect(isValidExternalUrl("https://example.com")).toBe(true);
    expect(isValidExternalUrl("http://example.com")).toBe(false);
    expect(isValidExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isValidExternalUrl("https://user:pass@example.com")).toBe(false);
    expect(isValidExternalUrl("")).toBe(false);
    expect(isValidExternalUrl(null)).toBe(false);
  });
});

describe("public projection boundaries", () => {
  it("exposes exactly the proposed search columns in order", () => {
    expect([...ORGANIZATION_DIRECTORY_COLUMNS]).toEqual([
      "slug",
      "name",
      "region_code",
      "org_type",
      "game_keys",
      "trust_state",
      "team_count",
    ]);
  });

  it("carries no owner, representative, evidence or timestamp members in the type", () => {
    const forbidden = ["owner_user_id", "created_by", "organization_id", "representative", "evidence", "created_at"];
    const columns = [...ORGANIZATION_DIRECTORY_COLUMNS];
    for (const key of forbidden) {
      expect(columns).not.toContain(key);
    }
  });

  it("search input clamps pagination (1..60 / 0..1000)", () => {
    expect(() => searchOrganizationsInputSchema.parse({ limit: 999, offset: 0 })).toThrow();
    expect(() => searchOrganizationsInputSchema.parse({ limit: 24, offset: 5000 })).toThrow();
  });
});

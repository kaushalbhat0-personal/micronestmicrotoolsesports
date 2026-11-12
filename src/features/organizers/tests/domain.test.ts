// P9 organizer domain tests (pure, no database).
// Covers: slug normalization, organizer type vocabulary, public projection
// column contract, game compatibility pass-through, trust-state presentation
// rules, published-count derivation honesty, permission matrix, and lifecycle
// transition table invariants.

import { describe, expect, it } from "vitest";
import { ORGANIZER_DIRECTORY_COLUMNS } from "../domain/columns";
import { isOrganizerType, organizerTypeLabel } from "../domain/organizer-type";
import {
  isConfirmedOrganizerTrust,
  isOrganizerTrustState,
  organizerTrustLabel,
  organizerTrustNote,
} from "../domain/trust";
import {
  canEditTournaments,
  canManageMembers,
  canManageOrganizerProfile,
  canRoleTransition,
  canTouchVerification,
  findTransition,
  LIFECYCLE_TRANSITIONS,
} from "../domain/permissions";

describe("organizer type vocabulary", () => {
  it("accepts exactly the three frozen values", () => {
    expect(isOrganizerType("independent")).toBe(true);
    expect(isOrganizerType("organization")).toBe(true);
    expect(isOrganizerType("professional")).toBe(true);
    expect(isOrganizerType("brand")).toBe(false);
    expect(isOrganizerType("player")).toBe(false);
    expect(isOrganizerType("")).toBe(false);
  });

  it("labels each type without implying authority", () => {
    expect(organizerTypeLabel("independent")).toContain("Independent");
    expect(organizerTypeLabel("organization")).toContain("Organization");
    expect(organizerTypeLabel("professional")).toContain("Professional");
  });
});

describe("organizer directory columns", () => {
  it("freezes the 8-column search contract with derived count, no internals", () => {
    expect([...ORGANIZER_DIRECTORY_COLUMNS]).toEqual([
      "slug",
      "name",
      "region_code",
      "organizer_type",
      "game_keys",
      "trust_state",
      "published_tournament_count",
      "is_public",
    ]);
    expect(ORGANIZER_DIRECTORY_COLUMNS).not.toContain("created_by");
    expect(ORGANIZER_DIRECTORY_COLUMNS).not.toContain("owner_user_id");
    expect(ORGANIZER_DIRECTORY_COLUMNS).not.toContain("trust_evidence");
  });
});

describe("organizer trust presentation", () => {
  it("confirms only the confirmed state", () => {
    expect(isOrganizerTrustState("confirmed")).toBe(true);
    expect(isConfirmedOrganizerTrust("confirmed")).toBe(true);
    for (const state of [
      "not_submitted",
      "submitted",
      "under_review",
      "rejected",
      "expired",
    ] as const) {
      expect(isOrganizerTrustState(state)).toBe(true);
      expect(isConfirmedOrganizerTrust(state)).toBe(false);
    }
    expect(isOrganizerTrustState("verified")).toBe(false);
  });

  it("never words unconfirmed states as confirmed", () => {
    for (const state of [
      "not_submitted",
      "submitted",
      "under_review",
      "rejected",
      "expired",
    ] as const) {
      expect(organizerTrustLabel(state)).not.toBe("Confirmed");
      const note = organizerTrustNote(state).toLowerCase();
      expect(note).not.toMatch(/is confirmed|confirmed by/);
    }
    expect(organizerTrustNote("confirmed")).toMatch(/confirmed/i);
  });
});

describe("organizer permissions", () => {
  it("separates profile, member and tournament powers", () => {
    expect(canManageOrganizerProfile("owner")).toBe(true);
    expect(canManageOrganizerProfile("admin")).toBe(true);
    expect(canManageOrganizerProfile("editor")).toBe(false);
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(false);
    expect(canManageMembers("editor")).toBe(false);
    expect(canEditTournaments("owner")).toBe(true);
    expect(canEditTournaments("admin")).toBe(true);
    expect(canEditTournaments("editor")).toBe(true);
  });

  it("never permits verification self-approval", () => {
    expect(canTouchVerification("owner")).toBe(false);
    expect(canTouchVerification("admin")).toBe(false);
    expect(canTouchVerification("editor")).toBe(false);
    expect(canTouchVerification("moderator")).toBe(false);
  });

  it("keeps the moderation-gated transitions disabled with reasons", () => {
    const publish = findTransition("submitted", "published");
    expect(publish).not.toBeNull();
    expect(publish?.allowedBy).toEqual(["moderator"]);
    expect(publish?.disabledReason).toMatch(/moderation/i);
    expect(canRoleTransition("owner", "submitted", "published")).toBe(false);
    expect(canRoleTransition("moderator", "submitted", "published")).toBe(true);
  });

  it("allows owner/admin unpublish but never silent republication", () => {
    expect(canRoleTransition("owner", "published", "unpublished")).toBe(true);
    expect(canRoleTransition("admin", "published", "unpublished")).toBe(true);
    expect(canRoleTransition("editor", "published", "unpublished")).toBe(false);
    const republish = findTransition("unpublished", "published");
    expect(republish?.allowedBy).toEqual(["moderator"]);
    expect(canRoleTransition("owner", "unpublished", "published")).toBe(false);
  });

  it("forbids every unlisted transition", () => {
    expect(findTransition("draft", "published")).toBeNull();
    expect(findTransition("draft", "archived")).toBeNull();
    expect(findTransition("archived", "published")).toBeNull();
    expect(canRoleTransition("moderator", "draft", "published")).toBe(false);
  });

  it("represents rejection as submitted → draft, never a stored rejected state", () => {
    const returned = findTransition("submitted", "draft");
    expect(returned).not.toBeNull();
    expect(returned?.allowedBy).toEqual(["moderator"]);
    expect(LIFECYCLE_TRANSITIONS.some((t) => (t.to as string) === "rejected")).toBe(false);
    expect(LIFECYCLE_TRANSITIONS.some((t) => (t.from as string) === "rejected")).toBe(false);
  });
});

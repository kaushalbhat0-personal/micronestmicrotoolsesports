// P3 tournament schema tests (pure Zod boundaries, no database).
// Covers: draft acceptance + strict protected-key rejection, date ordering,
// eligibility team-size coherence, registration URL rules, unpublish
// contract, and the directory input shape (limit/offset bounds).

import { describe, expect, it } from "vitest";
import {
  eligibilitySchema,
  getTournamentBySlugInputSchema,
  searchTournamentsInputSchema,
  tournamentDraftSchema,
  tournamentUpdateSchema,
  unpublishSchema,
} from "../schemas/tournament";

const DRAFT_BASE = {
  slug: "monsoon-showdown-cup",
  title: "Monsoon Showdown Cup",
  description: "A weekend BGMI open.",
  gameKey: "bgmi",
  regionCode: "india",
  format: "team",
  startsAt: "2026-12-01T10:00:00.000Z",
  endsAt: "2026-12-03T18:00:00.000Z",
  timezone: "Asia/Kolkata",
  entryFee: { amountMinor: 0, currency: "INR" },
  prizePool: { amountMinor: 10000000, currency: "INR" },
  organizer: { kind: "independent", name: "Nova Events", verified: false },
  registration: { method: "external", url: "https://events.example.com/register" },
  eligibility: { minTeamSize: 4, maxTeamSize: 4, regionCodes: ["india"], note: "Bring your squad." },
} as const;

describe("tournamentDraftSchema", () => {
  it("accepts a complete valid draft", () => {
    expect(tournamentDraftSchema.safeParse({ ...DRAFT_BASE }).success).toBe(true);
  });

  it("accepts undisclosed fees and minimal drafts", () => {
    const { entryFee: _fee, prizePool: _prize, eligibility: _elig, description: _desc, ...minimal } =
      DRAFT_BASE;
    expect(tournamentDraftSchema.safeParse({ ...minimal }).success).toBe(true);
  });

  it("rejects protected keys instead of dropping them", () => {
    for (const extra of [
      { id: "11111111-1111-4111-8111-111111111111" },
      { owner_user_id: "11111111-1111-4111-8111-111111111111" },
      { organizer_verified: true },
      { lifecycle: "published" },
      { status: "upcoming" },
    ]) {
      expect(tournamentDraftSchema.safeParse({ ...DRAFT_BASE, ...extra }).success).toBe(false);
    }
  });

  it("rejects bad slugs, other games, bad dates and bad regions", () => {
    expect(
      tournamentDraftSchema.safeParse({ ...DRAFT_BASE, slug: "BAD SLUG!" }).success,
    ).toBe(false);
    expect(
      tournamentDraftSchema.safeParse({ ...DRAFT_BASE, gameKey: "valorant" }).success,
    ).toBe(false);
    expect(
      tournamentDraftSchema.safeParse({
        ...DRAFT_BASE,
        startsAt: "2026-12-03T18:00:00.000Z",
        endsAt: "2026-12-01T10:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      tournamentDraftSchema.safeParse({ ...DRAFT_BASE, regionCode: "atlantis" }).success,
    ).toBe(false);
  });

  it("rejects non-https registration URLs and credentialed URLs", () => {
    expect(
      tournamentDraftSchema.safeParse({
        ...DRAFT_BASE,
        registration: { method: "external", url: "http://events.example.com/x" },
      }).success,
    ).toBe(false);
    expect(
      tournamentDraftSchema.safeParse({
        ...DRAFT_BASE,
        registration: { method: "external", url: "https://user:pw@events.example.com/" },
      }).success,
    ).toBe(false);
    expect(
      tournamentDraftSchema.safeParse({
        ...DRAFT_BASE,
        registration: { method: "micronest", url: "https://events.example.com/x" },
      }).success,
    ).toBe(false);
  });

  it("rejects incoherent eligibility and overlong notes", () => {
    expect(
      eligibilitySchema.safeParse({ minTeamSize: 5, maxTeamSize: 4 }).success,
    ).toBe(false);
    expect(eligibilitySchema.safeParse({ note: "x".repeat(501) }).success).toBe(false);
    expect(eligibilitySchema.safeParse({ minAge: 9 }).success).toBe(false);
  });
});

describe("tournamentUpdateSchema", () => {
  it("drops slug/gameKey from the editable set and stays strict", () => {
    const { slug: _slug, gameKey: _game, ...rest } = DRAFT_BASE;
    expect(tournamentUpdateSchema.safeParse({ ...rest }).success).toBe(true);
    expect(tournamentUpdateSchema.safeParse({ ...rest, slug: "other" }).success).toBe(false);
    expect(tournamentUpdateSchema.safeParse({ ...rest, gameKey: "bgmi" }).success).toBe(false);
  });
});

describe("unpublishSchema", () => {
  it("accepts slug-only and slug-with-reason, rejects short reasons", () => {
    expect(unpublishSchema.safeParse({ slug: "monsoon-showdown-cup" }).success).toBe(true);
    expect(
      unpublishSchema.safeParse({ slug: "monsoon-showdown-cup", reason: "Sponsor pulled out." })
        .success,
    ).toBe(true);
    expect(unpublishSchema.safeParse({ slug: "monsoon-showdown-cup", reason: "x" }).success).toBe(
      false,
    );
    expect(unpublishSchema.safeParse({ slug: "BAD!" }).success).toBe(false);
  });
});

describe("directory input schemas", () => {
  it("bounds limit/offset and accepts the status enum", () => {
    expect(
      searchTournamentsInputSchema.safeParse({ status: "upcoming", limit: 25, offset: 0 }).success,
    ).toBe(true);
    expect(searchTournamentsInputSchema.safeParse({ status: "live" }).success).toBe(false);
    expect(searchTournamentsInputSchema.safeParse({ limit: 999 }).success).toBe(false);
    expect(searchTournamentsInputSchema.safeParse({ offset: -1 }).success).toBe(false);
    expect(searchTournamentsInputSchema.safeParse({ limit: 25, offset: 0, owner: "x" }).success).toBe(
      false,
    );
  });

  it("validates detail slugs", () => {
    expect(getTournamentBySlugInputSchema.safeParse({ slug: "monsoon-showdown-cup" }).success).toBe(
      true,
    );
    expect(getTournamentBySlugInputSchema.safeParse({ slug: "BAD SLUG!" }).success).toBe(false);
  });
});

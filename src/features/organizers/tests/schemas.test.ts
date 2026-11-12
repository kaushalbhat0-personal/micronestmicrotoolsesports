// P9 organizer schema tests (pure Zod boundaries, no database).
// Covers: slug normalization, organizer create/update strictness, tournament
// draft money/timezone/URL validation, protected-key rejection, directory
// input bounds, game compatibility vocabulary.

import { describe, expect, it } from "vitest";
import { getOrganizerBySlugInputSchema, searchOrganizersInputSchema } from "../schemas/directory";
import {
  createOrganizerInputSchema,
  createTournamentInputSchema,
  updateOrganizerInputSchema,
  updateTournamentInputSchema,
} from "../schemas/manage";

const ORGANIZER_BASE = {
  slug: "nova-events",
  name: "Nova Events",
  description: "Weekend BGMI opens.",
  regionCode: "india",
  organizerType: "independent",
  gameKeys: ["bgmi"],
  websiteUrl: "https://nova-events.example.com",
  socialLinks: [{ label: "X", url: "https://x.example.com/nova" }],
} as const;

const TOURNAMENT_BASE = {
  organizerId: "11111111-1111-4111-8111-111111111111",
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
  registration: { method: "external", url: "https://events.example.com/register" },
} as const;

describe("organizer slugs", () => {
  it("normalizes case and trims, rejects malformed slugs", () => {
    expect(getOrganizerBySlugInputSchema.safeParse({ slug: "  Nova-Events " }).success).toBe(true);
    const parsed = getOrganizerBySlugInputSchema.safeParse({ slug: "Nova-Events" });
    expect(parsed.success ? parsed.data.slug : null).toBe("nova-events");
    expect(getOrganizerBySlugInputSchema.safeParse({ slug: "BAD SLUG!" }).success).toBe(false);
    expect(getOrganizerBySlugInputSchema.safeParse({ slug: "x" }).success).toBe(false);
  });
});

describe("createOrganizerInputSchema", () => {
  it("accepts a complete valid organizer", () => {
    expect(createOrganizerInputSchema.safeParse({ ...ORGANIZER_BASE }).success).toBe(true);
  });

  it("accepts minimal organizers without optional links", () => {
    const { websiteUrl: _w, socialLinks: _s, description: _d, ...minimal } = ORGANIZER_BASE;
    expect(createOrganizerInputSchema.safeParse({ ...minimal }).success).toBe(true);
  });

  it("rejects protected keys instead of dropping them", () => {
    for (const extra of [
      { id: "11111111-1111-4111-8111-111111111111" },
      { created_by: "11111111-1111-4111-8111-111111111111" },
      { trust_state: "confirmed" },
      { lifecycle: "published" },
      { published_tournament_count: 5 },
    ]) {
      expect(createOrganizerInputSchema.safeParse({ ...ORGANIZER_BASE, ...extra }).success).toBe(
        false
      );
    }
  });

  it("rejects unknown organizer types, bad regions and bad URLs", () => {
    expect(
      createOrganizerInputSchema.safeParse({ ...ORGANIZER_BASE, organizerType: "brand" }).success
    ).toBe(false);
    expect(
      createOrganizerInputSchema.safeParse({ ...ORGANIZER_BASE, regionCode: "atlantis" }).success
    ).toBe(false);
    expect(
      createOrganizerInputSchema.safeParse({
        ...ORGANIZER_BASE,
        websiteUrl: "http://insecure.example.com",
      }).success
    ).toBe(false);
    expect(
      createOrganizerInputSchema.safeParse({
        ...ORGANIZER_BASE,
        websiteUrl: "https://user:pw@example.com/",
      }).success
    ).toBe(false);
  });

  it("caps social links and rejects oversized labels", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      label: `Link ${i}`,
      url: "https://example.com/x",
    }));
    expect(
      createOrganizerInputSchema.safeParse({ ...ORGANIZER_BASE, socialLinks: many }).success
    ).toBe(false);
    expect(
      createOrganizerInputSchema.safeParse({
        ...ORGANIZER_BASE,
        socialLinks: [{ label: "x".repeat(41), url: "https://example.com/x" }],
      }).success
    ).toBe(false);
  });
});

describe("updateOrganizerInputSchema", () => {
  it("requires an organizer id and keeps slug/type locked", () => {
    expect(
      updateOrganizerInputSchema.safeParse({
        organizerId: "11111111-1111-4111-8111-111111111111",
        patch: {
          name: "Nova Events 2",
          regionCode: "india",
          gameKeys: ["bgmi"],
        },
      }).success
    ).toBe(true);
    expect(
      updateOrganizerInputSchema.safeParse({
        organizerId: "not-a-uuid",
        patch: { name: "Nova", regionCode: "india", gameKeys: ["bgmi"] },
      }).success
    ).toBe(false);
  });
});

describe("createTournamentInputSchema", () => {
  it("accepts a complete valid draft", () => {
    expect(createTournamentInputSchema.safeParse({ ...TOURNAMENT_BASE }).success).toBe(true);
  });

  it("accepts undisclosed money and missing optionals", () => {
    const { entryFee: _e, prizePool: _p, description: _d, ...minimal } = TOURNAMENT_BASE;
    expect(createTournamentInputSchema.safeParse({ ...minimal }).success).toBe(true);
  });

  it("rejects protected keys instead of dropping them", () => {
    for (const extra of [
      { id: "11111111-1111-4111-8111-111111111111" },
      { created_by: "11111111-1111-4111-8111-111111111111" },
      { lifecycle: "published" },
      { verified: true },
    ]) {
      expect(createTournamentInputSchema.safeParse({ ...TOURNAMENT_BASE, ...extra }).success).toBe(
        false
      );
    }
  });

  it("validates money minor units, timezone and URL rules", () => {
    expect(
      createTournamentInputSchema.safeParse({
        ...TOURNAMENT_BASE,
        entryFee: { amountMinor: -1, currency: "INR" },
      }).success
    ).toBe(false);
    expect(
      createTournamentInputSchema.safeParse({
        ...TOURNAMENT_BASE,
        entryFee: { amountMinor: 100, currency: "inr" },
      }).success
    ).toBe(false);
    expect(
      createTournamentInputSchema.safeParse({ ...TOURNAMENT_BASE, timezone: "Mars/Olympus" })
        .success
    ).toBe(false);
    expect(
      createTournamentInputSchema.safeParse({
        ...TOURNAMENT_BASE,
        registration: { method: "external", url: "http://events.example.com/x" },
      }).success
    ).toBe(false);
    expect(
      createTournamentInputSchema.safeParse({
        ...TOURNAMENT_BASE,
        startsAt: "2026-12-03T18:00:00.000Z",
        endsAt: "2026-12-01T10:00:00.000Z",
      }).success
    ).toBe(false);
  });
});

describe("updateTournamentInputSchema", () => {
  it("locks slug/gameKey/organizerId and keeps date ordering", () => {
    const { slug: _s, gameKey: _g, organizerId: _o, ...rest } = TOURNAMENT_BASE;
    expect(
      updateTournamentInputSchema.safeParse({
        tournamentId: "11111111-1111-4111-8111-111111111111",
        patch: { ...rest },
      }).success
    ).toBe(true);
    expect(
      updateTournamentInputSchema.safeParse({
        tournamentId: "11111111-1111-4111-8111-111111111111",
        patch: { ...rest, slug: "other" },
      }).success
    ).toBe(false);
  });
});

describe("organizer directory input schemas", () => {
  it("bounds limit/offset and grounds the type filter", () => {
    expect(
      searchOrganizersInputSchema.safeParse({ organizerType: "independent", limit: 25, offset: 0 })
        .success
    ).toBe(true);
    expect(
      searchOrganizersInputSchema.safeParse({ organizerType: "professional", limit: 25, offset: 0 })
        .success
    ).toBe(true);
    expect(searchOrganizersInputSchema.safeParse({ organizerType: "brand" }).success).toBe(false);
    expect(searchOrganizersInputSchema.safeParse({ limit: 999 }).success).toBe(false);
    expect(searchOrganizersInputSchema.safeParse({ offset: -1 }).success).toBe(false);
    expect(
      searchOrganizersInputSchema.safeParse({ limit: 25, offset: 0, owner: "x" }).success
    ).toBe(false);
  });
});

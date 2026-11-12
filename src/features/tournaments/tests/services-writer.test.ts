// P3 tournament search-parser + writer-gate tests (pure, no database).
// Covers: parser defaults (bgmi, limit 60), unknown-enum dropping, and the
// publishing kill switch (validation runs, writes always throw disabled).

import { describe, expect, it } from "vitest";
import {
  TournamentWriteDisabledError,
  TournamentDirectoryValidationError,
} from "../domain/public-card";
import {
  TOURNAMENT_WRITES_ENABLED,
  parseTournamentDraft,
  parseTournamentUpdate,
  publishTournamentOp,
  unpublishTournamentOp,
  updateTournamentOp,
} from "../server/tournament-writer";
import { parseTournamentSearchParams } from "../services/search";

describe("parseTournamentSearchParams", () => {
  it("defaults bgmi with limit 60 and no filters", () => {
    expect(parseTournamentSearchParams({})).toEqual({ game: "bgmi", limit: 60 });
  });

  it("keeps valid region/status/query and drops unknown enums", () => {
    expect(
      parseTournamentSearchParams({ region: "india", status: "upcoming", q: "monsoon" }),
    ).toEqual({
      game: "bgmi",
      regionCode: "india",
      status: "upcoming",
      query: "monsoon",
      limit: 60,
    });
    expect(parseTournamentSearchParams({ region: "atlantis" }).regionCode).toBeUndefined();
    expect(parseTournamentSearchParams({ status: "live" }).status).toBeUndefined();
    expect(parseTournamentSearchParams({ q: "   " }).query).toBeUndefined();
  });
});

const DRAFT = {
  slug: "monsoon-showdown-cup",
  title: "Monsoon Showdown Cup",
  gameKey: "bgmi",
  regionCode: "india",
  format: "team",
  startsAt: "2026-12-01T10:00:00.000Z",
  endsAt: "2026-12-03T18:00:00.000Z",
  timezone: "Asia/Kolkata",
  organizer: { kind: "independent", name: "Nova Events", verified: false },
  registration: { method: "external", url: "https://events.example.com/register" },
} as const;

describe("publishing kill switch", () => {
  it("stays OFF: enabling requires the acceptance sequence and breaks the gate test by design", () => {
    expect(TOURNAMENT_WRITES_ENABLED).toBe(false);
  });

  it("validates drafts, then always throws disabled (never a fake success)", () => {
    expect(parseTournamentDraft({ ...DRAFT }).slug).toBe("monsoon-showdown-cup");
    expect(() => publishTournamentOp({ ...DRAFT })).toThrow(TournamentWriteDisabledError);
    expect(() => publishTournamentOp({ ...DRAFT, slug: "BAD!" })).toThrow(
      TournamentDirectoryValidationError,
    );
  });

  it("gates update and unpublish identically", () => {
    const { slug: _slug, gameKey: _game, ...rest } = DRAFT;
    expect(() => updateTournamentOp({ ...rest })).toThrow(TournamentWriteDisabledError);
    expect(() => unpublishTournamentOp({ slug: "monsoon-showdown-cup" })).toThrow(
      TournamentWriteDisabledError,
    );
    expect(() => unpublishTournamentOp({ slug: "BAD!" })).toThrow(
      TournamentDirectoryValidationError,
    );
  });

  it("update parsing rejects smuggled identity keys", () => {
    const { slug: _slug, gameKey: _game, ...rest } = DRAFT;
    expect(() => parseTournamentUpdate({ ...rest, slug: "other" })).toThrow(
      TournamentDirectoryValidationError,
    );
    expect(() => parseTournamentUpdate({ ...rest, owner_user_id: "x" })).toThrow(
      TournamentDirectoryValidationError,
    );
  });
});

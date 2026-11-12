// P9 authorization + writer-gate tests (no database).
// Covers: unauthenticated access, forged user IDs, immutable metadata,
// cross-organizer isolation shapes, unauthorized publication/unpublish,
// verification privilege separation, and the disabled kill switch.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OrganizerWriteDisabledError } from "../domain/organizer";
import {
  ORGANIZER_WRITES_ENABLED,
  parseCreateOrganizerInput,
  parseCreateTournamentInput,
} from "../server/organizer-writer";
import { canRoleTransition } from "../domain/permissions";

const here = dirname(fileURLToPath(import.meta.url));

function fakeAuthedClient(userId: string | null): {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
  rpc: () => Promise<{ data: unknown; error: null }>;
} {
  return {
    auth: {
      getUser: async () => ({
        data: { user: userId === null ? null : { id: userId } },
      }),
    },
    // ensure_app_user bootstrap shape: the caller's own active row.
    rpc: async () => ({
      data: userId === null ? [] : [{ id: userId, status: "active" }],
      error: null,
    }),
  };
}

describe("organizer write gate", () => {
  it("stays disabled: the kill switch is OFF", () => {
    expect(ORGANIZER_WRITES_ENABLED).toBe(false);
  });

  it("parses organizer drafts without touching identity, then blocks", async () => {
    const { createOrganizerOp } = await import("../server/organizer-writer");
    const input = {
      slug: "nova-events",
      name: "Nova Events",
      regionCode: "india",
      organizerType: "independent",
      gameKeys: ["bgmi"],
    };
    expect(() => parseCreateOrganizerInput(input)).not.toThrow();
    await expect(
      createOrganizerOp(fakeAuthedClient("11111111-1111-4111-8111-111111111111") as never, input)
    ).rejects.toBeInstanceOf(OrganizerWriteDisabledError);
  });

  it("parses tournament drafts, then blocks before any table touch", async () => {
    const { createTournamentDraftOp } = await import("../server/organizer-writer");
    const input = {
      organizerId: "11111111-1111-4111-8111-111111111111",
      slug: "monsoon-showdown-cup",
      title: "Monsoon Showdown Cup",
      gameKey: "bgmi",
      regionCode: "india",
      format: "team",
      startsAt: "2026-12-01T10:00:00.000Z",
      endsAt: "2026-12-03T18:00:00.000Z",
      timezone: "Asia/Kolkata",
      registration: { method: "external", url: "https://events.example.com/register" },
    };
    expect(() => parseCreateTournamentInput(input)).not.toThrow();
    await expect(
      createTournamentDraftOp(
        fakeAuthedClient("11111111-1111-4111-8111-111111111111") as never,
        input
      )
    ).rejects.toBeInstanceOf(OrganizerWriteDisabledError);
  });
});

describe("authorization boundaries (static + matrix)", () => {
  it("workspace reader derives identity from the session (no user_id parameter)", () => {
    const source = readFileSync(join(here, "..", "server", "organizer-workspace.ts"), "utf8");
    expect(source).toContain("ensureAppUser");
    expect(source).not.toMatch(/userId\s*:\s*string/);
    expect(source).not.toContain("auth.uid()");
  });

  it("writer derives identity from the session (no caller-supplied user_id)", () => {
    const source = readFileSync(join(here, "..", "server", "organizer-writer.ts"), "utf8");
    expect(source).toContain("ensureAppUser");
    expect(source).not.toMatch(/owner_user_id/);
  });

  it("forged verification and lifecycle values cannot pass parsing", () => {
    expect(() =>
      parseCreateOrganizerInput({
        slug: "nova-events",
        name: "Nova Events",
        regionCode: "india",
        organizerType: "independent",
        gameKeys: ["bgmi"],
        trust_state: "confirmed",
      })
    ).toThrow();
    expect(() =>
      parseCreateTournamentInput({
        organizerId: "11111111-1111-4111-8111-111111111111",
        slug: "monsoon-showdown-cup",
        title: "Monsoon Showdown Cup",
        gameKey: "bgmi",
        regionCode: "india",
        format: "team",
        startsAt: "2026-12-01T10:00:00.000Z",
        endsAt: "2026-12-03T18:00:00.000Z",
        timezone: "Asia/Kolkata",
        registration: { method: "external", url: "https://events.example.com/register" },
        lifecycle: "published",
      })
    ).toThrow();
  });

  it("cross-organizer edits are unrepresentable: update locks organizerId", () => {
    const source = readFileSync(join(here, "..", "schemas", "manage.ts"), "utf8");
    expect(source).toContain("omit({ organizerId: true, slug: true, gameKey: true })");
  });

  it("unauthorized publication is denied for every organizer role", () => {
    expect(canRoleTransition("owner", "submitted", "published")).toBe(false);
    expect(canRoleTransition("admin", "submitted", "published")).toBe(false);
    expect(canRoleTransition("editor", "submitted", "published")).toBe(false);
  });

  it("unauthorized unpublish is denied for editors", () => {
    expect(canRoleTransition("editor", "published", "unpublished")).toBe(false);
  });

  it("moderation transitions throw the disabled error even when named", async () => {
    const { assertModerationTransitionAllowed } = await import("../server/organizer-writer");
    expect(() => assertModerationTransitionAllowed("submitted→published")).toThrow(
      OrganizerWriteDisabledError
    );
  });
});

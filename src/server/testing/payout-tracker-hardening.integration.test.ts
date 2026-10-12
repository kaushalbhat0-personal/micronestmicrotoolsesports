/**
 * Real-Postgres hardening proofs for Prize Payout Tracker
 * (RCCF-PRIZE-PAYOUT-FIX-01: F1/F2/F3/F4).
 *
 * Runs the ACTUAL shipped SQL (core guards/RPCs + the hardening migration,
 * applied verbatim by the harness) on embedded-postgres with concurrent
 * connections — so the F3 cap race is proven against real serialization,
 * not simulated with sequential mocks.
 *
 * Assertion policy: guards are proven by fail-closed behavior (the write is
 * rejected AND the row/state is unchanged AND exact counts hold) plus the
 * exact five-character SQLSTATE (F7: PTPK1/PTPN1/PTPD1/PTPQ1 survive RAISE;
 * the pre-FIX-02 six-character codes did not and surfaced as 42704).
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000 });

import {
  startPayoutTrackerTestPostgres,
  truncatePayoutTrackerTables,
  seedPayoutTrackerWorkspace,
  insertDraftTracker,
  type TestPostgres,
} from "./payout-tracker-pg-harness";

let pg: TestPostgres;

beforeAll(async () => {
  pg = await startPayoutTrackerTestPostgres();
}, 180_000);

afterAll(async () => {
  await pg.stop();
});

beforeEach(async () => {
  await truncatePayoutTrackerTables(pg);
});

async function createRecipient(orgId: string, trackerId: string, userId: string, name: string) {
  await pg.query("select public.create_payout_recipient($1, $2, $3, $4, 1000, null, null)", [
    orgId,
    trackerId,
    userId,
    name,
  ]);
}

/** Capture the Postgres error code of a rejected query (F7: five-char codes survive RAISE). */
async function rejectionCode(query: Promise<unknown>): Promise<string> {
  try {
    await query;
    return "NO_ERROR";
  } catch (e) {
    return String((e as { code?: unknown })?.code ?? e);
  }
}

describe("F1 — draft-only direct tracker INSERT", () => {
  it("rejects manufactured published rows and timestamp smuggling, allows drafts", async () => {
    const seed = await seedPayoutTrackerWorkspace(pg);

    // Manufactured publication: rejected with the integrity code, nothing stored.
    expect(
      await rejectionCode(
        pg.query(
          "insert into public.payout_trackers (organization_id, created_by, event_name, currency, status, published_at) values ($1, $2, 'Cup', 'INR', 'published', now())",
          [seed.orgId, seed.userId],
        ),
      ),
    ).toBe("PTPK1");
    // Timestamp smuggling on a draft: rejected, nothing stored.
    await expect(
      pg.query(
        "insert into public.payout_trackers (organization_id, created_by, event_name, currency, status, published_at) values ($1, $2, 'Cup', 'INR', 'draft', now())",
        [seed.orgId, seed.userId],
      ),
    ).rejects.toThrow();
    const blocked = await pg.query("select count(*) as n from public.payout_trackers where organization_id = $1", [
      seed.orgId,
    ]);
    expect(String(blocked.rows[0]?.n)).toBe("0");

    const id = await insertDraftTracker(pg, seed);
    const row = await pg.query("select status, published_at from public.payout_trackers where id = $1", [id]);
    expect(row.rows[0]?.status).toBe("draft");
  });

  it("still publishes drafts through the official quota RPC", async () => {
    const seed = await seedPayoutTrackerWorkspace(pg);
    const trackerId = await insertDraftTracker(pg, seed);
    await createRecipient(seed.orgId, trackerId, seed.userId, "Team Alpha");
    const published = await pg.query("select public.consume_payout_tracker_publish($1, $2, $3)", [
      seed.orgId,
      trackerId,
      seed.userId,
    ]);
    expect(published.rowCount).not.toBeNull();
    const row = await pg.query("select status from public.payout_trackers where id = $1", [trackerId]);
    expect(row.rows[0]?.status).toBe("published");
  });

  it("rejects a second free publication with the quota code and no ledger corruption", async () => {
    const seed = await seedPayoutTrackerWorkspace(pg, { grant: "free" });
    const first = await insertDraftTracker(pg, seed);
    await createRecipient(seed.orgId, first, seed.userId, "Team Alpha");
    await pg.query("select public.consume_payout_tracker_publish($1, $2, $3)", [seed.orgId, first, seed.userId]);

    const second = await insertDraftTracker(pg, seed, "Second Cup");
    await createRecipient(seed.orgId, second, seed.userId, "Team Beta");
    expect(
      await rejectionCode(pg.query("select public.consume_payout_tracker_publish($1, $2, $3)", [seed.orgId, second, seed.userId])),
    ).toBe("PTPQ1");

    // Quota intact: exactly one ledger row, second tracker still a draft.
    const ledger = await pg.query(
      "select count(*) as n from public.payout_tracker_monthly_publishes where organization_id = $1",
      [seed.orgId],
    );
    expect(String(ledger.rows[0]?.n)).toBe("1");
    const status = await pg.query("select status from public.payout_trackers where id = $1", [second]);
    expect(status.rows[0]?.status).toBe("draft");
  });
});

describe("F2 — recipient status/paid_at only via the atomic RPC", () => {
  it("rejects direct status/paid_at writes and pending-bypassing inserts", async () => {
    const seed = await seedPayoutTrackerWorkspace(pg);
    const trackerId = await insertDraftTracker(pg, seed);
    await createRecipient(seed.orgId, trackerId, seed.userId, "Team Alpha");
    const existing = await pg.query("select id from public.payout_recipients where tracker_id = $1", [trackerId]);
    const recipientId = String(existing.rows[0]?.id);

    expect(
      await rejectionCode(
        pg.query("update public.payout_recipients set status = 'paid', paid_at = now() where id = $1", [recipientId]),
      ),
    ).toBe("PTPK1");

    expect(
      await rejectionCode(pg.query("update public.payout_recipients set paid_at = now() where id = $1", [recipientId])),
    ).toBe("PTPK1");

    expect(
      await rejectionCode(
        pg.query(
          "insert into public.payout_recipients (tracker_id, recipient_name, amount_minor, status, paid_at) values ($1, 'Sneaky', 1000, 'paid', now())",
          [trackerId],
        ),
      ),
    ).toBe("PTPK1");

    // Guard held: the row is untouched.
    const held = await pg.query("select status, paid_at from public.payout_recipients where id = $1", [recipientId]);
    expect(held.rows[0]?.status).toBe("pending");
    expect(held.rows[0]?.paid_at).toBeNull();

    // Non-status edits (name/amount) still work directly.
    await pg.query("update public.payout_recipients set recipient_name = 'Renamed' where id = $1", [recipientId]);
    const renamed = await pg.query("select recipient_name from public.payout_recipients where id = $1", [recipientId]);
    expect(renamed.rows[0]?.recipient_name).toBe("Renamed");
  });

  it("toggles through the RPC with atomic completion derivation", async () => {
    const seed = await seedPayoutTrackerWorkspace(pg);
    const trackerId = await insertDraftTracker(pg, seed);
    await createRecipient(seed.orgId, trackerId, seed.userId, "Team Alpha");
    await pg.query("select public.consume_payout_tracker_publish($1, $2, $3)", [seed.orgId, trackerId, seed.userId]);
    const existing = await pg.query("select id from public.payout_recipients where tracker_id = $1", [trackerId]);
    const recipientId = String(existing.rows[0]?.id);

    await pg.query("select public.apply_payout_recipient_status($1, $2, $3, 'paid', $4)", [
      seed.orgId,
      trackerId,
      recipientId,
      seed.userId,
    ]);
    const completed = await pg.query("select status, completed_at from public.payout_trackers where id = $1", [
      trackerId,
    ]);
    expect(completed.rows[0]?.status).toBe("completed");
    expect(completed.rows[0]?.completed_at).not.toBeNull();

    await pg.query("select public.apply_payout_recipient_status($1, $2, $3, 'pending', $4)", [
      seed.orgId,
      trackerId,
      recipientId,
      seed.userId,
    ]);
    const reopened = await pg.query("select status, completed_at from public.payout_trackers where id = $1", [
      trackerId,
    ]);
    expect(reopened.rows[0]?.status).toBe("published");
    expect(reopened.rows[0]?.completed_at).toBeNull();
  });
});

describe("F3 — atomic recipient cap under concurrency", () => {
  it("free workspaces hold at most 20, sequentially and concurrently", async () => {
    const seed = await seedPayoutTrackerWorkspace(pg, { grant: "free" });
    const trackerId = await insertDraftTracker(pg, seed);

    for (let i = 0; i < 20; i++) {
      await createRecipient(seed.orgId, trackerId, seed.userId, `Team ${i}`);
    }
    expect(await rejectionCode(createRecipient(seed.orgId, trackerId, seed.userId, "Team 21"))).toBe("PTPD1");
    const held = await pg.query("select count(*) as n from public.payout_recipients where tracker_id = $1", [
      trackerId,
    ]);
    expect(String(held.rows[0]?.n)).toBe("20");

    // Fresh tracker: 30 genuinely concurrent creates collapse to exactly 20.
    const raceTracker = await insertDraftTracker(pg, seed, "Race Cup");
    const outcomes = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) => createRecipient(seed.orgId, raceTracker, seed.userId, `Racer ${i}`)),
    );
    const succeeded = outcomes.filter((o) => o.status === "fulfilled").length;
    const rejected = outcomes.filter((o) => o.status === "rejected");
    expect(succeeded).toBe(20);
    expect(rejected).toHaveLength(10);
    for (const r of rejected) {
      expect(String(((r as PromiseRejectedResult).reason as { code?: unknown })?.code)).toBe("PTPD1");
    }
    const count = await pg.query("select count(*) as n from public.payout_recipients where tracker_id = $1", [
      raceTracker,
    ]);
    expect(String(count.rows[0]?.n)).toBe("20");
  });

  it("paid workspaces hold at most 200", async () => {
    const seed = await seedPayoutTrackerWorkspace(pg, { grant: "paid" });
    const trackerId = await insertDraftTracker(pg, seed);
    for (let i = 0; i < 25; i++) {
      await createRecipient(seed.orgId, trackerId, seed.userId, `Club ${i}`);
    }
    const mid = await pg.query("select count(*) as n from public.payout_recipients where tracker_id = $1", [
      trackerId,
    ]);
    expect(String(mid.rows[0]?.n)).toBe("25");

    for (let i = 25; i < 200; i++) {
      await createRecipient(seed.orgId, trackerId, seed.userId, `Club ${i}`);
    }
    expect(await rejectionCode(createRecipient(seed.orgId, trackerId, seed.userId, "Club 201"))).toBe("PTPD1");
    const held200 = await pg.query("select count(*) as n from public.payout_recipients where tracker_id = $1", [
      trackerId,
    ]);
    expect(String(held200.rows[0]?.n)).toBe("200");
  });

  it("workspaces without coverage cannot create recipients", async () => {
    const seed = await seedPayoutTrackerWorkspace(pg, { grant: null });
    const trackerId = await insertDraftTracker(pg, seed);
    expect(await rejectionCode(createRecipient(seed.orgId, trackerId, seed.userId, "Nope"))).toBe("PTPN1");
    const held = await pg.query("select count(*) as n from public.payout_recipients where tracker_id = $1", [
      trackerId,
    ]);
    expect(String(held.rows[0]?.n)).toBe("0");
  });
});

describe("F4 — day-granular public share", () => {
  it("exposes dates without time/timezone precision", async () => {
    const seed = await seedPayoutTrackerWorkspace(pg);
    const trackerId = await insertDraftTracker(pg, seed);
    await pg.query("update public.payout_trackers set deadline = now() where id = $1", [trackerId]);
    await createRecipient(seed.orgId, trackerId, seed.userId, "Team Alpha");
    await pg.query("select public.consume_payout_tracker_publish($1, $2, $3)", [seed.orgId, trackerId, seed.userId]);
    const tokenRow = await pg.query("select share_token from public.payout_trackers where id = $1", [trackerId]);
    const token = String(tokenRow.rows[0]?.share_token);

    const res = await pg.query("select public.get_published_payout_tracker($1) as payload", [token]);
    const payload = res.rows[0]?.payload as Record<string, unknown>;
    const dayRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const field of ["deadline", "published_at", "updated_at"] as const) {
      expect(String(payload[field])).toMatch(dayRe);
    }
    expect(payload.completed_at).toBeNull();
    const recipient = (payload.recipients as Array<Record<string, unknown>>)[0];
    expect(recipient?.paid_at).toBeNull();
    // No time/timezone precision anywhere in the serialized payload.
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/\d{2}:\d{2}/);
    expect(serialized).not.toMatch(/\dT\d/);
    // Allowlist intact: no internal identifiers.
    expect(serialized).not.toContain("organization_id");
  });
});

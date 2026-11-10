import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createTracker,
  deleteTracker,
  getTrackerDetail,
  listTrackers,
  publishTracker,
  requirePayoutTrackerOwned,
  revokeShareLink,
  updateTracker,
} from "./tracker-service";
import type { PayoutTrackerRow } from "../types";
import * as trackerRepo from "@/server/repositories/payout-trackers";
import * as recipientRepo from "@/server/repositories/payout-recipients";
import * as policy from "@/server/services/payout-tracker-policy";

vi.mock("@/server/repositories/payout-trackers");
vi.mock("@/server/repositories/payout-recipients");
vi.mock("@/server/services/payout-tracker-policy", async (importOriginal) => ({
  ...(await importOriginal<typeof policy>()),
  resolvePayoutTrackerAccessLevel: vi.fn(async () => "free" as const),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

const supabase = {} as SupabaseClient;
const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const TRACKER = "33333333-3333-4333-8333-333333333333";

function trackerRow(overrides: Partial<PayoutTrackerRow> = {}): PayoutTrackerRow {
  return {
    id: TRACKER,
    organization_id: ORG,
    created_by: USER,
    event_name: "Monsoon Cup",
    currency: "INR",
    deadline: null,
    status: "draft",
    share_token: "44444444-4444-4434-8444-444444444444",
    published_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(policy.resolvePayoutTrackerAccessLevel).mockResolvedValue("free");
  vi.mocked(trackerRepo.findPayoutTrackerById).mockResolvedValue(trackerRow());
  vi.mocked(recipientRepo.listPayoutRecipientsByTracker).mockResolvedValue([]);
});

describe("tracker ownership", () => {
  it("rejects missing trackers and foreign-org trackers", () => {
    expect(() => requirePayoutTrackerOwned(null, ORG)).toThrow("Tracker not found");
    expect(() => requirePayoutTrackerOwned(trackerRow({ organization_id: "55555555-5555-4555-8555-555555555555" }), ORG)).toThrow();
  });
});

describe("create tracker", () => {
  it("creates a draft with recipients in minor units", async () => {
    vi.mocked(trackerRepo.createPayoutTracker).mockResolvedValue(trackerRow());
    vi.mocked(recipientRepo.createPayoutRecipient).mockImplementation(async (_, input) => ({
      id: `r-${input.sort_order}`,
      tracker_id: TRACKER,
      recipient_name: input.recipient_name,
      amount_minor: input.amount_minor,
      status: "pending",
      paid_at: null,
      reference_last4: null,
      proof_url: null,
      sort_order: input.sort_order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const detail = await createTracker(supabase, ORG, USER, {
      eventName: "Monsoon Cup",
      currency: "INR",
      deadline: "2026-12-20",
      recipients: [{ name: "A", amountMajor: 100.5 }],
    });
    expect(detail.tracker.status).toBe("draft");
    expect(detail.recipients).toHaveLength(1);
    expect(detail.recipients[0]?.amount_minor).toBe(10050);
  });

  it("enforces the free 20-recipient cap", async () => {
    const recipients = Array.from({ length: 21 }, (_, i) => ({ name: `Team ${i}`, amountMajor: 10 }));
    await expect(
      createTracker(supabase, ORG, USER, { eventName: "Cup", currency: "INR", recipients }),
    ).rejects.toThrow(/at most 20/);
  });

  it("fails closed when the workspace has no coverage (level none)", async () => {
    vi.mocked(policy.resolvePayoutTrackerAccessLevel).mockResolvedValue("none");
    await expect(
      createTracker(supabase, ORG, USER, { eventName: "Cup", currency: "INR", recipients: [{ name: "A", amountMajor: 10 }] }),
    ).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
    expect(trackerRepo.createPayoutTracker).not.toHaveBeenCalled();
  });

  it("allows 200 recipients when paid", async () => {
    vi.mocked(policy.resolvePayoutTrackerAccessLevel).mockResolvedValue("paid");
    vi.mocked(trackerRepo.createPayoutTracker).mockResolvedValue(trackerRow());
    vi.mocked(recipientRepo.createPayoutRecipient).mockImplementation(async (_, input) => ({
      id: `r-${input.sort_order}`,
      tracker_id: TRACKER,
      recipient_name: input.recipient_name,
      amount_minor: input.amount_minor,
      status: "pending",
      paid_at: null,
      reference_last4: null,
      proof_url: null,
      sort_order: input.sort_order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const recipients = Array.from({ length: 200 }, (_, i) => ({ name: `Team ${i}`, amountMajor: 10 }));
    const detail = await createTracker(supabase, ORG, USER, { eventName: "Cup", currency: "INR", recipients });
    expect(detail.recipients).toHaveLength(200);
  });
});

describe("list trackers", () => {
  it("caps free history to latest 3 non-drafts while keeping all drafts", async () => {
    const drafts = [trackerRow({ id: "d1" }), trackerRow({ id: "d2" })];
    const published = [1, 2, 3, 4, 5].map((n) => trackerRow({ id: `p${n}`, status: "published" }));
    vi.mocked(trackerRepo.listPayoutTrackersByOrg).mockResolvedValue([...drafts, ...published]);
    const { summaries } = await listTrackers(supabase, ORG);
    expect(summaries.map((s) => s.tracker.id)).toEqual(["d1", "d2", "p1", "p2", "p3"]);
  });

  it("shows everything when paid", async () => {
    vi.mocked(policy.resolvePayoutTrackerAccessLevel).mockResolvedValue("paid");
    const published = [1, 2, 3, 4, 5].map((n) => trackerRow({ id: `p${n}`, status: "published" }));
    vi.mocked(trackerRepo.listPayoutTrackersByOrg).mockResolvedValue(published);
    const { summaries } = await listTrackers(supabase, ORG);
    expect(summaries).toHaveLength(5);
  });
});

describe("publish / revoke / delete", () => {
  it("publishes drafts through the quota RPC", async () => {
    vi.mocked(trackerRepo.publishPayoutTrackerViaQuota).mockResolvedValue(trackerRow({ status: "published" }));
    const published = await publishTracker(supabase, ORG, USER, TRACKER);
    expect(published.status).toBe("published");
  });

  it("re-publishes idempotently through the RPC (no extra quota)", async () => {
    vi.mocked(trackerRepo.findPayoutTrackerById).mockResolvedValue(trackerRow({ status: "published" }));
    vi.mocked(trackerRepo.publishPayoutTrackerViaQuota).mockResolvedValue(trackerRow({ status: "published" }));
    const republished = await publishTracker(supabase, ORG, USER, TRACKER);
    expect(republished.status).toBe("published");
    expect(trackerRepo.publishPayoutTrackerViaQuota).toHaveBeenCalled();
  });

  it("maps quota errors from the publish RPC", async () => {
    vi.mocked(trackerRepo.publishPayoutTrackerViaQuota).mockRejectedValue({ code: "PTPQ1", message: "quota_exceeded" });
    await expect(publishTracker(supabase, ORG, USER, TRACKER)).rejects.toThrow(/free published tracker/);
  });

  it("revokes share links on published trackers, never drafts", async () => {
    vi.mocked(trackerRepo.rotatePayoutTrackerTokenViaRpc).mockResolvedValue(trackerRow({ status: "published", share_token: "token-2" }));
    vi.mocked(trackerRepo.findPayoutTrackerById).mockResolvedValue(trackerRow({ status: "published" }));
    const rotated = await revokeShareLink(supabase, ORG, USER, TRACKER);
    expect(rotated.share_token).toBe("token-2");

    vi.mocked(trackerRepo.findPayoutTrackerById).mockResolvedValue(trackerRow({ status: "draft" }));
    await expect(revokeShareLink(supabase, ORG, USER, TRACKER)).rejects.toThrow(/no public link/);
  });

  it("updates meta and deletes owned trackers", async () => {
    vi.mocked(trackerRepo.updatePayoutTrackerMeta).mockResolvedValue(trackerRow({ event_name: "New" }));
    const updated = await updateTracker(supabase, ORG, TRACKER, { eventName: "New" });
    expect(updated.event_name).toBe("New");

    await deleteTracker(supabase, ORG, TRACKER);
    expect(trackerRepo.deletePayoutTracker).toHaveBeenCalledWith(supabase, TRACKER);
  });

  it("loads detail with recipients", async () => {
    const detail = await getTrackerDetail(supabase, ORG, TRACKER);
    expect(detail.tracker.id).toBe(TRACKER);
    expect(detail.recipients).toEqual([]);
  });
});

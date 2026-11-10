import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addRecipient, removeRecipient, setRecipientStatus, updateRecipient } from "./recipient-service";
import type { PayoutRecipientRow, PayoutTrackerRow } from "../types";
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
const RECIPIENT = "66666666-6666-4666-8666-666666666666";

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

function recipientRow(overrides: Partial<PayoutRecipientRow> = {}): PayoutRecipientRow {
  return {
    id: RECIPIENT,
    tracker_id: TRACKER,
    recipient_name: "Team Alpha",
    amount_minor: 5000000,
    status: "pending",
    paid_at: null,
    reference_last4: null,
    proof_url: null,
    sort_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(policy.resolvePayoutTrackerAccessLevel).mockResolvedValue("free");
  vi.mocked(trackerRepo.findPayoutTrackerById).mockResolvedValue(trackerRow());
  vi.mocked(recipientRepo.findPayoutRecipientById).mockResolvedValue(recipientRow());
});

describe("recipient mutations", () => {
  it("adds recipients through the atomic create RPC", async () => {
    vi.mocked(recipientRepo.createPayoutRecipientViaRpc).mockImplementation(async (_, orgId, trackerId, userId, input) =>
      recipientRow({
        recipient_name: input.recipient_name,
        amount_minor: input.amount_minor,
        reference_last4: input.reference_last4,
        proof_url: input.proof_url,
      }),
    );
    const added = await addRecipient(supabase, ORG, USER, TRACKER, {
      name: "Team Alpha",
      amountMajor: 500,
      referenceLast4: "a1B2",
      proofUrl: "https://bank.example/r/1",
    });
    expect(added.amount_minor).toBe(50000);
    expect(added.reference_last4).toBe("a1B2");
    expect(recipientRepo.createPayoutRecipientViaRpc).toHaveBeenCalledWith({}, ORG, TRACKER, USER, {
      recipient_name: "Team Alpha",
      amount_minor: 50000,
      reference_last4: "a1B2",
      proof_url: "https://bank.example/r/1",
    });
  });

  it("enforces the free recipient cap through the RPC guard", async () => {
    vi.mocked(recipientRepo.createPayoutRecipientViaRpc).mockRejectedValue(
      new Error("recipient_limit: tracker already holds the maximum recipients for this plan"),
    );
    await expect(addRecipient(supabase, ORG, USER, TRACKER, { name: "X", amountMajor: 10 })).rejects.toThrow(
      /at most 20/,
    );
  });

  it("reports the paid cap when the RPC guard rejects a paid workspace", async () => {
    vi.mocked(policy.resolvePayoutTrackerAccessLevel).mockResolvedValue("paid");
    vi.mocked(recipientRepo.createPayoutRecipientViaRpc).mockRejectedValue(
      new Error("recipient_limit: tracker already holds the maximum recipients for this plan"),
    );
    await expect(addRecipient(supabase, ORG, USER, TRACKER, { name: "X", amountMajor: 10 })).rejects.toThrow(
      /at most 200/,
    );
  });

  it("fails closed when the workspace has no coverage (level none)", async () => {
    vi.mocked(policy.resolvePayoutTrackerAccessLevel).mockResolvedValue("none");
    await expect(addRecipient(supabase, ORG, USER, TRACKER, { name: "X", amountMajor: 10 })).rejects.toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
    });
    expect(recipientRepo.createPayoutRecipientViaRpc).not.toHaveBeenCalled();
  });

  it("maps RPC membership failures to forbidden", async () => {
    vi.mocked(recipientRepo.createPayoutRecipientViaRpc).mockRejectedValue({
      code: "PTPN1",
      message: "no_access: user is not a member of organization",
    });
    await expect(addRecipient(supabase, ORG, USER, TRACKER, { name: "X", amountMajor: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects cross-tracker recipient IDs", async () => {
    vi.mocked(recipientRepo.findPayoutRecipientById).mockResolvedValue(recipientRow({ tracker_id: "other" }));
    await expect(updateRecipient(supabase, ORG, USER, TRACKER, RECIPIENT, { name: "X", amountMajor: 10, referenceLast4: null, proofUrl: null })).rejects.toThrow();
    await expect(removeRecipient(supabase, ORG, USER, TRACKER, RECIPIENT)).rejects.toThrow();
  });

  it("updates and removes owned recipients", async () => {
    vi.mocked(recipientRepo.updatePayoutRecipient).mockResolvedValue(recipientRow({ recipient_name: "Renamed" }));
    const updated = await updateRecipient(supabase, ORG, USER, TRACKER, RECIPIENT, { name: "Renamed", amountMajor: 50, referenceLast4: null, proofUrl: null });
    expect(updated.recipient_name).toBe("Renamed");

    await removeRecipient(supabase, ORG, USER, TRACKER, RECIPIENT);
    expect(recipientRepo.deletePayoutRecipient).toHaveBeenCalledWith(supabase, RECIPIENT);
  });

  it("toggles status through the atomic RPC", async () => {
    vi.mocked(trackerRepo.findPayoutTrackerById).mockResolvedValue(trackerRow({ status: "published" }));
    vi.mocked(recipientRepo.applyPayoutRecipientStatusViaRpc).mockResolvedValue(recipientRow({ status: "paid" }));
    const toggled = await setRecipientStatus(supabase, ORG, USER, TRACKER, RECIPIENT, "paid");
    expect(toggled.status).toBe("paid");
    expect(recipientRepo.applyPayoutRecipientStatusViaRpc).toHaveBeenCalledWith({}, ORG, TRACKER, RECIPIENT, "paid", USER);
  });

  it("rejects invalid toggle values", async () => {
    await expect(setRecipientStatus(supabase, ORG, USER, TRACKER, RECIPIENT, "verified")).rejects.toThrow();
  });
});

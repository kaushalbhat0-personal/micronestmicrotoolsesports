import { describe, expect, it, vi } from "vitest";
import {
  fetchPublishedPayoutShare,
  parsePayoutShareToken,
  shareRecordSchema,
  shareUrlForToken,
} from "./share";

const validRecord = {
  event_name: "Monsoon Cup",
  currency: "INR",
  deadline: "2026-12-20",
  status: "published",
  published_at: "2026-11-01",
  completed_at: null,
  updated_at: "2026-11-02",
  organization_name: "Acme Org",
  recipients: [
    {
      recipient_name: "Team Alpha",
      amount_minor: 5000000,
      status: "paid",
      paid_at: "2026-11-02",
      reference_last4: "a1B2",
      proof_url: null,
    },
  ],
};

function mockAdmin(rpcResult: { data: unknown; error: unknown }) {
  return { rpc: vi.fn(async () => rpcResult) } as never;
}

describe("payout-tracker share boundary", () => {
  it("parses uuid tokens, rejects malformed ones without existence oracle", () => {
    const token = "123e4567-e89b-12d3-a456-426614174000";
    expect(parsePayoutShareToken(token)).toBe(token);
    expect(() => parsePayoutShareToken("not-a-token")).toThrow();
    expect(() => parsePayoutShareToken("1")).toThrow();
  });

  it("accepts a well-formed published record", () => {
    expect(shareRecordSchema.safeParse(validRecord).success).toBe(true);
  });

  it("rejects draft records and extra keys (strict DTO)", () => {
    expect(shareRecordSchema.safeParse({ ...validRecord, status: "draft" }).success).toBe(false);
    expect(
      shareRecordSchema.safeParse({ ...validRecord, organization_id: "x", created_by: "y" }).success,
    ).toBe(false);
  });

  it("rejects full timestamp precision in every date field (day granularity only)", () => {
    const fullStamp = "2026-11-01T00:00:00.000Z";
    for (const field of ["deadline", "published_at", "completed_at", "updated_at"] as const) {
      expect(shareRecordSchema.safeParse({ ...validRecord, [field]: fullStamp }).success).toBe(false);
    }
    expect(
      shareRecordSchema.safeParse({
        ...validRecord,
        recipients: [{ ...validRecord.recipients[0], paid_at: fullStamp }],
      }).success,
    ).toBe(false);
    // Offset-carrying and space-separated datetimes are also rejected.
    expect(shareRecordSchema.safeParse({ ...validRecord, published_at: "2026-11-01+05:30" }).success).toBe(false);
    expect(shareRecordSchema.safeParse({ ...validRecord, published_at: "2026-11-01 00:00:00" }).success).toBe(false);
  });

  it("rejects non-https proof URLs and over-long references", () => {
    const badProof = {
      ...validRecord,
      recipients: [{ ...validRecord.recipients[0], proof_url: "javascript:alert(1)" }],
    };
    expect(shareRecordSchema.safeParse(badProof).success).toBe(false);
    const badRef = {
      ...validRecord,
      recipients: [{ ...validRecord.recipients[0], reference_last4: "full-reference-value" }],
    };
    expect(shareRecordSchema.safeParse(badRef).success).toBe(false);
  });

  it("returns null on RPC error, missing data, or schema mismatch", async () => {
    expect(await fetchPublishedPayoutShare(mockAdmin({ data: null, error: new Error("db down") }), "123e4567-e89b-12d3-a456-426614174000")).toBeNull();
    expect(await fetchPublishedPayoutShare(mockAdmin({ data: null, error: null }), "123e4567-e89b-12d3-a456-426614174000")).toBeNull();
    expect(await fetchPublishedPayoutShare(mockAdmin({ data: { status: "draft" }, error: null }), "123e4567-e89b-12d3-a456-426614174000")).toBeNull();
  });

  it("returns the record on valid RPC payload", async () => {
    const record = await fetchPublishedPayoutShare(mockAdmin({ data: validRecord, error: null }), "123e4567-e89b-12d3-a456-426614174000");
    expect(record?.event_name).toBe("Monsoon Cup");
  });

  it("builds share URLs without double slashes", () => {
    expect(shareUrlForToken("https://example.com/", "tok")).toBe("https://example.com/share/payout/tok");
  });
});

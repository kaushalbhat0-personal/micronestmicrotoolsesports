import { describe, expect, it } from "vitest";
import {
  addRecipientSchema,
  amountMajorSchema,
  createTrackerSchema,
  deadlineSchema,
  optionalProofUrlSchema,
  optionalReferenceLast4Schema,
  proofUrlSchema,
  recipientStatusSchema,
  referenceLast4Schema,
  updateRecipientSchema,
  updateTrackerSchema,
} from "./index";

describe("payout-tracker schemas", () => {
  it("accepts a valid tracker with recipients", () => {
    const parsed = createTrackerSchema.safeParse({
      eventName: "Monsoon Cup",
      currency: "INR",
      deadline: "2026-12-20",
      recipients: [
        { name: "Team Alpha", amountMajor: 50000 },
        { name: "Team Bravo", amountMajor: 30000 },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty event names and over-long names", () => {
    expect(createTrackerSchema.safeParse({ eventName: "", currency: "INR", recipients: [{ name: "A", amountMajor: 10 }] }).success).toBe(false);
    expect(createTrackerSchema.safeParse({ eventName: "x".repeat(81), currency: "INR", recipients: [{ name: "A", amountMajor: 10 }] }).success).toBe(false);
  });

  it("rejects unsupported currencies", () => {
    expect(createTrackerSchema.safeParse({ eventName: "Cup", currency: "JPY", recipients: [{ name: "A", amountMajor: 10 }] }).success).toBe(false);
  });

  it("rejects zero, negative, oversized, and sub-paise amounts", () => {
    expect(amountMajorSchema.safeParse(0).success).toBe(false);
    expect(amountMajorSchema.safeParse(-5).success).toBe(false);
    expect(amountMajorSchema.safeParse(1_000_000_001).success).toBe(false);
    expect(amountMajorSchema.safeParse(10.001).success).toBe(false);
    expect(amountMajorSchema.safeParse(10.5).success).toBe(true);
  });

  it("requires at least one and at most 200 recipients per request", () => {
    const base = { eventName: "Cup", currency: "INR" as const };
    expect(createTrackerSchema.safeParse({ ...base, recipients: [] }).success).toBe(false);
    const many = Array.from({ length: 201 }, (_, i) => ({ name: `Team ${i}`, amountMajor: 10 }));
    expect(createTrackerSchema.safeParse({ ...base, recipients: many }).success).toBe(false);
  });

  it("accepts exactly-4 alphanumeric references, rejects everything else", () => {
    expect(referenceLast4Schema.safeParse("a1B2").success).toBe(true);
    expect(referenceLast4Schema.safeParse("123").success).toBe(false);
    expect(referenceLast4Schema.safeParse("12345").success).toBe(false);
    expect(referenceLast4Schema.safeParse("12-4").success).toBe(false);
    expect(referenceLast4Schema.safeParse("").success).toBe(false);
    // Optional variant treats empty as absent.
    expect(optionalReferenceLast4Schema.safeParse("").success).toBe(true);
  });

  it("accepts https proof URLs, rejects javascript:/data:/http:/malformed", () => {
    expect(proofUrlSchema.safeParse("https://bank.example/receipt/123").success).toBe(true);
    expect(proofUrlSchema.safeParse("http://bank.example/receipt").success).toBe(false);
    expect(proofUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(proofUrlSchema.safeParse("data:text/html,hi").success).toBe(false);
    expect(proofUrlSchema.safeParse("not a url").success).toBe(false);
    expect(optionalProofUrlSchema.safeParse("").success).toBe(true);
  });

  it("accepts calendar-date deadlines, rejects malformed ones", () => {
    expect(deadlineSchema.safeParse("2026-12-20").success).toBe(true);
    expect(deadlineSchema.safeParse("20-12-2026").success).toBe(false);
    expect(deadlineSchema.safeParse("tomorrow").success).toBe(false);
  });

  it("update schemas allow clearing optional recipient fields", () => {
    const parsed = updateRecipientSchema.safeParse({ name: "A", amountMajor: 10, referenceLast4: "", proofUrl: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.referenceLast4).toBeNull();
      expect(parsed.data.proofUrl).toBeNull();
    }
  });

  it("update tracker schema requires event name, deadline optional", () => {
    expect(updateTrackerSchema.safeParse({ eventName: "New name" }).success).toBe(true);
    expect(updateTrackerSchema.safeParse({ eventName: "" }).success).toBe(false);
  });

  it("recipient status is a closed enum", () => {
    expect(recipientStatusSchema.safeParse("paid").success).toBe(true);
    expect(recipientStatusSchema.safeParse("pending").success).toBe(true);
    expect(recipientStatusSchema.safeParse("verified").success).toBe(false);
  });

  it("add-recipient accepts minimal input", () => {
    expect(addRecipientSchema.safeParse({ name: "Solo", amountMajor: 100 }).success).toBe(true);
  });
});

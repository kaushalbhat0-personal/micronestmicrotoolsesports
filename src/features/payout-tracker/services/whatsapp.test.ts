import { describe, expect, it } from "vitest";
import { buildPayoutWhatsAppMessage } from "./whatsapp";

const URL = "https://example.com/share/payout/token-9";

describe("buildPayoutWhatsAppMessage", () => {
  it("includes event, status, and the public URL", () => {
    const msg = buildPayoutWhatsAppMessage({ eventName: "City Cup", status: "published", publicUrl: URL });
    expect(msg).toContain("City Cup");
    expect(msg).toContain("Prize payout record is published.");
    expect(msg).toContain(URL);
  });

  it("completed status reflects paid completion without amounts", () => {
    const msg = buildPayoutWhatsAppMessage({ eventName: "City Cup", status: "completed", publicUrl: URL });
    expect(msg).toContain("all recipients marked paid");
  });

  it("never inlines recipient names, amounts, references, or proof links", () => {
    const msg = buildPayoutWhatsAppMessage({ eventName: "City Cup", status: "published", publicUrl: URL, note: "Thanks to everyone!" });
    expect(msg).toContain("Thanks to everyone!");
    for (const secret of ["Rohan", "5000", "₹", "pay_", "reference", "last4", "LAST4", "proof", "upi@", "UPI"]) {
      expect(msg).not.toContain(secret);
    }
    // The single public payout URL is the only link.
    const urls = msg.match(/https:\/\/\S+/g) ?? [];
    expect(urls).toEqual([URL]);
  });

  it("puts no payout data in query parameters", () => {
    const msg = buildPayoutWhatsAppMessage({ eventName: "City Cup", status: "published", publicUrl: URL });
    const query = URL.split("?")[1] ?? "";
    expect(query).toBe("");
    expect(msg).not.toMatch(/\?\w+=/);
  });
});

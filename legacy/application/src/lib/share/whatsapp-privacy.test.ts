import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * WhatsApp sharing privacy/purity static checks.
 *
 * The feature is strictly client-side message composition + an official
 * wa.me click-to-chat link. These tests pin that no WhatsApp-related
 * module touches the network, storage, analytics, or any Business-API
 * surface — and that Sponsorship Tracking stays out.
 */

const NEW_FILES = [
  "src/lib/share/whatsapp.ts",
  "src/features/prize-splitter/services/whatsapp.ts",
  "src/features/tie-breaker/services/whatsapp.ts",
  "src/features/draft-ban/services/whatsapp.ts",
  "src/features/payout-tracker/services/whatsapp.ts",
  "src/features/roster-builder/services/whatsapp.ts",
  "src/components/shared/whatsapp-share.tsx",
  "src/features/tie-breaker/components/whatsapp-share.tsx",
  "src/features/draft-ban/components/whatsapp-share.tsx",
  "src/features/payout-tracker/components/whatsapp-share.tsx",
];

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function allFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...allFilesUnder(full));
    else out.push(full);
  }
  return out;
}

describe("whatsapp privacy/purity", () => {
  it("no network, storage, analytics, or Business-API surface in any WhatsApp module", () => {
    const banned = [
      "fetch(",
      "XMLHttpRequest",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "analytics",
      "telemetry",
      "/api/",
      "api.whatsapp.com",
      "web.whatsapp.com/send",
      "Business API",
      "business-api",
      "WHATSAPP_TOKEN",
      "WHATSAPP_API",
    ];
    for (const file of NEW_FILES) {
      const content = src(file);
      for (const token of banned) {
        expect(content, `${file} :: ${token}`).not.toContain(token);
      }
    }
  });

  it("only the canonical wa.me click-to-chat base URL, never a send/number endpoint", () => {
    const primitive = src("src/lib/share/whatsapp.ts");
    expect(primitive).toContain("https://wa.me/?text=");
    expect(primitive).not.toMatch(/wa\.me\/\d/);
    expect(primitive).not.toContain("send?");
  });

  it("no server actions, database clients, or secrets in WhatsApp modules", () => {
    for (const file of NEW_FILES) {
      const content = src(file);
      expect(content, file).not.toMatch(/"use server"/);
      expect(content, file).not.toMatch(/supabase|service_role|SECRET|API_KEY/);
    }
  });

  it("sponsorship tracking has no WhatsApp surface", () => {
    const dir = join(process.cwd(), "src/features/sponsor-sentinel");
    const hits: string[] = [];
    for (const file of allFilesUnder(dir)) {
      const content = readFileSync(file, "utf8");
      if (/whatsapp/i.test(content)) hits.push(file);
    }
    expect(hits).toEqual([]);
  });

  it("payout composer only knows event/status/url/note — never share-record row fields", () => {
    const composer = src("src/features/payout-tracker/services/whatsapp.ts");
    for (const field of ["amount_minor", "proof_url", "reference_last4", "recipient_name", "paid_at"]) {
      expect(composer, `composer :: ${field}`).not.toContain(field);
    }
    expect(composer).toContain("eventName");
    expect(composer).toContain("publicUrl");
  });

  it("roster composer never references contact columns", () => {
    const composer = src("src/features/roster-builder/services/whatsapp.ts");
    expect(composer).not.toContain("contactDisplay");
    expect(composer).not.toContain("contact_display");
  });
});


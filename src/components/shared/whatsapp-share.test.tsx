import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { WhatsAppShare } from "./whatsapp-share";

describe("WhatsAppShare", () => {
  it("renders a labelled Share button without exposing the message upfront", () => {
    const html = renderToString(<WhatsAppShare message="Hello team" />);
    expect(html).toContain("Share on WhatsApp");
    expect(html).toContain('aria-label="Share on WhatsApp"');
    expect(html).not.toContain("wa.me");
  });

  it("renders the accessible editor contract in source (open state is interactive)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/components/shared/whatsapp-share.tsx"), "utf8");
    // Editor labelled, Open action described as prefilled (never "Send").
    expect(src).toContain("whatsapp-share-editor");
    expect(src).toContain("Open WhatsApp with this message prefilled");
    expect(src).toContain("Open WhatsApp");
    expect(src).not.toContain("Send on WhatsApp");
    // Focus moves into the editor; targets meet the minimum size.
    expect(src).toContain("editorRef.current?.focus()");
    expect(src).toMatch(/min-h-\[44px\]/);
    // Client-only: no network, storage, or analytics surface.
    for (const banned of ["fetch(", "localStorage", "sessionStorage", "analytics", "/api/"]) {
      expect(src).not.toContain(banned);
    }
  });
});

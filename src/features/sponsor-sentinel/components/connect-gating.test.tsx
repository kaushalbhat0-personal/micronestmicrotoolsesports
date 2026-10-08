import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ConnectTwitchForm } from "./connect-twitch-form";
import { ConnectKickForm } from "./connect-kick-form";
import { ConnectYouTubeForm } from "./connect-youtube-form";

describe("manual channel entry gating", () => {
  it("Twitch without OAuth → connect action, manual entry disabled", () => {
    const html = renderToString(<ConnectTwitchForm orgSlug="org-1" hasCredentials={false} />);
    expect(html).toContain("/dashboard/org-1/connections");
    expect(html).toContain("Connect Twitch");
    expect(html).toContain("OAuth is required for Twitch");
    expect(html).toContain("disabled=\"\"");
  });

  it("Twitch with OAuth → manual path enabled, no misleading gate", () => {
    const html = renderToString(<ConnectTwitchForm orgSlug="org-1" hasCredentials={true} />);
    expect(html).not.toContain("OAuth is required for Twitch");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("Kick without OAuth → connect action, manual entry disabled", () => {
    const html = renderToString(<ConnectKickForm orgSlug="org-1" hasCredentials={false} />);
    expect(html).toContain("/dashboard/org-1/connections");
    expect(html).toContain("Connect Kick");
    expect(html).toContain("OAuth is required for Kick");
    expect(html).toContain("disabled=\"\"");
  });

  it("Kick with OAuth → manual path enabled", () => {
    const html = renderToString(<ConnectKickForm orgSlug="org-1" hasCredentials={true} />);
    expect(html).not.toContain("OAuth is required for Kick");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("YouTube with OAuth → manual path works as supported", () => {
    const html = renderToString(<ConnectYouTubeForm orgSlug="org-1" hasCredentials={true} hasOAuth={true} />);
    expect(html).not.toContain("disabled=\"\"");
    expect(html).not.toContain("OAuth is preferred");
  });

  it("YouTube with platform key fallback (no OAuth) → manual path remains available", () => {
    const html = renderToString(<ConnectYouTubeForm orgSlug="org-1" hasCredentials={true} hasOAuth={false} />);
    expect(html).not.toContain("disabled=\"\"");
    expect(html).toContain("OAuth is preferred");
  });

  it("YouTube with neither → connect action, manual entry disabled", () => {
    const html = renderToString(<ConnectYouTubeForm orgSlug="org-1" hasCredentials={false} />);
    expect(html).toContain("/dashboard/org-1/connections");
    expect(html).toContain("Connect YouTube");
    expect(html).toContain("disabled=\"\"");
  });

  it("server error paths point at Connections (static)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/features/sponsor-sentinel/actions/channel-actions.ts"), "utf8");
    // User-facing OAuth directions must land on Connections, not the legacy page.
    expect(src).not.toMatch(/Go to \/dashboard.*settings\/integrations/);
    expect(src).toContain("Connect Twitch via OAuth first");
    expect(src).toContain("Connect Kick via OAuth first");
    expect(src).toContain("Connect YouTube via OAuth first");
  });

});

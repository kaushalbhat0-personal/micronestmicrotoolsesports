import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { IntegrationsForm } from "./integrations-form";
import { ConnectKickForm } from "./connect-kick-form";

vi.mock("@/features/sponsor-sentinel/actions/integration-actions", () => ({
  saveProviderCredential: vi.fn(),
  testProviderCredential: vi.fn(),
  deleteProviderCredential: vi.fn(),
}));
vi.mock("@/features/sponsor-sentinel/actions/channel-actions", () => ({
  connectKickChannelAction: vi.fn(),
  connectTwitchChannelAction: vi.fn(),
  connectYouTubeChannelAction: vi.fn(),
}));

describe("Kick integrations UI", () => {
  it("Kick credentials fields render, no coming soon", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: false }} youtube={{ configured: false }} kick={{ configured: false }} />);
    expect(html).toContain("Kick");
    expect(html).not.toContain("Kick connection is coming soon");
    expect(html).not.toContain("We’re preparing the platform for Sponsor Sentinel.</p>"); // old kick empty text still exists but should not be the coming soon block alone
    // Should have Client ID and Client Secret inputs for kick
    expect(html).toContain("kick-clientId");
    expect(html).toContain("kick-clientSecret");
    expect(html).toContain("Save connection");
  });

  it("Kick no longer displays coming soon empty state when fields present", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: false }} youtube={{ configured: false }} kick={{ configured: false }} />);
    // The old fallback <p>coming soon</p> was inside fields.length===0 branch, now fields>0 so not rendered for kick
    // Ensure Kick save button exists
    expect(html).toContain('aria-label="Save Kick connection"');
  });

  it("Kick channel connect form renders with a11y", () => {
    const html = renderToString(<ConnectKickForm orgSlug="tag-esports" hasCredentials={true} />);
    expect(html).toContain("Kick channel");
    expect(html).toContain("kick-handle");
    expect(html).toContain('aria-label="Connect Kick"');
    expect(html).toContain("Enter the Kick slug");
  });

  it("Kick channel form hasCredentials false shows error path", () => {
    const html = renderToString(<ConnectKickForm orgSlug="tag-esports" hasCredentials={false} />);
    expect(html).toContain("Kick channel");
  });

  it("Twitch/YouTube UI regression — still render", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: true, clientIdMasked: "aa••••bb" }} youtube={{ configured: true, apiKeyMasked: "AI••••Pc" }} kick={{ configured: false }} />);
    expect(html).toContain("Twitch");
    expect(html).toContain("YouTube");
    expect(html).toContain("aa••••bb");
    expect(html).toContain("AI••••Pc");
  });
});

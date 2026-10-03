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
  it("Kick OAuth-only — no legacy fields, shows OAuth connect", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: false }} youtube={{ configured: false }} kick={{ configured: false }} />);
    expect(html).toContain("Kick");
    expect(html).toContain("Connect Kick");
    expect(html).not.toContain("kick-clientId");
    expect(html).not.toContain("kick-clientSecret");
    expect(html).not.toContain('aria-label="Save Kick connection"');
  });

  it("Kick OAuth card shows Connect without legacy form", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: false }} youtube={{ configured: false }} kick={{ configured: false }} />);
    expect(html).toContain('aria-label="Connect Kick"');
    expect(html).toContain("Connect your Kick account via OAuth");
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

  it("Twitch/YouTube UI regression — still render OAuth", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: true, hasOAuth: true, externalAccountLogin: "twitchUser" }} youtube={{ configured: true, hasOAuth: true, externalAccountLogin: "@mystic" }} kick={{ configured: false }} />);
    expect(html).toContain("Twitch");
    expect(html).toContain("YouTube");
    expect(html).toContain("Connected as");
    expect(html).toContain("twitchUser");
  });
});

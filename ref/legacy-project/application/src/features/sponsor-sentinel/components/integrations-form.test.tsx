import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { IntegrationsForm } from "./integrations-form";

vi.mock("@/features/sponsor-sentinel/actions/integration-actions", () => ({
  saveProviderCredential: vi.fn(),
  testProviderCredential: vi.fn(),
  deleteProviderCredential: vi.fn(),
}));

describe("IntegrationsForm", () => {
  it("renders YouTube credential empty state", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: false }} youtube={{ configured: false }} kick={{ configured: false }} />);
    expect(html).toContain("YouTube");
    expect(html).toContain("isn’t connected");
    expect(html).toContain("Connect your YouTube account to verify creator channels");
    expect(html).toContain("Connect YouTube");
  });

  it("renders YouTube configured state with connected account", () => {
    const html = renderToString(
      <IntegrationsForm orgSlug="org-1" twitch={{ configured: false }} youtube={{ configured: true, hasOAuth: true, externalAccountLogin: "@mystic", authorizedAt: "2026-10-02T00:00:00Z", lastTestStatus: "success" }} kick={{ configured: false }} />
    );
    expect(html).toContain("YouTube");
    expect(html).toContain("Connected as");
    expect(html).toContain("Connected ✓");
    expect(html).not.toContain("YouTube API key is invalid");
  });

  it("shows test connection states", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: true, clientIdMasked: "12••••34", lastTestStatus: "failed" }} youtube={{ configured: false }} kick={{ configured: false }} />);
    expect(html).toContain("Twitch");
    expect(html).toContain("Test connection");
    expect(html).toContain("Test: Failed");
  });

  it("renders Kick connect-only — no legacy fields", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: false }} youtube={{ configured: false }} kick={{ configured: false }} />);
    expect(html).toContain("Kick");
    expect(html).toContain("Connect Kick");
    expect(html).not.toContain("kick-clientId");
    expect(html).not.toContain("kick-clientSecret");
    expect(html).not.toContain('aria-label="Save Kick connection"');
  });

  it("does not expose secrets", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: true, hasOAuth: true, externalAccountLogin: "twitchUser" }} youtube={{ configured: true, hasOAuth: true, externalAccountLogin: "@mystic" }} kick={{ configured: false }} />);
    expect(html).not.toContain("secret");
    expect(html).not.toContain("clientId");
    expect(html).toContain("Connected as");
  });

  it("connected Twitch shows Connected as and Test available", () => {
    const html = renderToString(
      <IntegrationsForm
        orgSlug="tag-esports"
        twitch={{ configured: true, hasOAuth: true, externalAccountLogin: "divine1701", authorizedAt: "2026-10-02T20:16:00Z", lastTestStatus: "success" }}
        youtube={{ configured: false }}
        kick={{ configured: false }}
      />,
    );
    expect(html).toContain("Connected as");
    expect(html).toContain("divine1701");
    expect(html).toContain("Test Twitch connection");
    expect(html).toContain("Reconnect Twitch");
    expect(html).not.toContain("Add your credentials first");
    expect(html).toContain("Authorized:");
  });

  it("connected account without test shows connected message not legacy", () => {
    const html = renderToString(
      <IntegrationsForm orgSlug="tag-esports" twitch={{ configured: true, hasOAuth: true, externalAccountLogin: "divine1701" }} youtube={{ configured: false }} kick={{ configured: false }} />,
    );
    expect(html).toContain("Your account is connected");
    expect(html).not.toContain("Not yet tested — test the connection before adding creator channels.");
  });

  it("Neither configured shows not-connected", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={{ configured: false }} youtube={{ configured: false }} kick={{ configured: false }} />);
    expect(html).toContain("isn’t connected");
    expect(html).toContain("Connect Twitch");
  });

  it("OAuth connected YouTube shows Connected as @mysticminutes17", () => {
    const html = renderToString(
      <IntegrationsForm
        orgSlug="tag-esports"
        twitch={{ configured: false }}
        youtube={{ configured: true, hasOAuth: true, externalAccountLogin: "@mysticminutes17", authorizedAt: "2026-10-02T20:16:00Z" }}
        kick={{ configured: false }}
      />,
    );
    expect(html).toContain("Connected as");
    expect(html).toContain("@mysticminutes17");
    expect(html).toContain("Reconnect YouTube");
    expect(html).toContain("Test YouTube connection");
  });
});

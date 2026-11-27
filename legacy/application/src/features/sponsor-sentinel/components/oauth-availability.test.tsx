import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { IntegrationsForm } from "./integrations-form";

vi.mock("@/features/sponsor-sentinel/actions/integration-actions", () => ({
  saveProviderCredential: vi.fn(),
  testProviderCredential: vi.fn(),
  deleteProviderCredential: vi.fn(),
}));

const EMPTY = { configured: false };

describe("IntegrationsForm — OAuth entry points & provider availability", () => {
  it("renders all three OAuth connect actions when configured", () => {
    const html = renderToString(
      <IntegrationsForm
        orgSlug="tag-esports"
        twitch={EMPTY}
        youtube={EMPTY}
        kick={EMPTY}
        availability={{ twitch: true, youtube: true, kick: true }}
      />
    );
    expect(html).toContain("/api/auth/youtube/start?orgSlug=tag-esports");
    expect(html).toContain("/api/auth/twitch/start?orgSlug=tag-esports");
    expect(html).toContain("/api/auth/kick/start?orgSlug=tag-esports");
    expect(html).toContain("Connect YouTube");
    expect(html).toContain("Connect Twitch");
    expect(html).toContain("Connect Kick");
  });

  it("defaults to available (existing callers keep working)", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={EMPTY} youtube={EMPTY} kick={EMPTY} />);
    expect(html).toContain("/api/auth/twitch/start?orgSlug=org-1");
  });

  it("missing provider configuration produces no fake working button", () => {
    const html = renderToString(
      <IntegrationsForm
        orgSlug="org-1"
        twitch={EMPTY}
        youtube={EMPTY}
        kick={EMPTY}
        availability={{ twitch: false, youtube: false, kick: false }}
      />
    );
    expect(html).not.toContain("/api/auth/twitch/start");
    expect(html).not.toContain("/api/auth/youtube/start");
    expect(html).not.toContain("/api/auth/kick/start");
    expect(html).toContain("isn’t available right now");
  });

  it("partial availability only gates the missing provider", () => {
    const html = renderToString(
      <IntegrationsForm
        orgSlug="org-1"
        twitch={EMPTY}
        youtube={EMPTY}
        kick={EMPTY}
        availability={{ twitch: true, youtube: true, kick: false }}
      />
    );
    expect(html).toContain("/api/auth/twitch/start");
    expect(html).toContain("/api/auth/youtube/start");
    expect(html).not.toContain("/api/auth/kick/start");
  });

  it("orgSlug is URL-encoded correctly (no injection into authorization flow)", () => {
    const html = renderToString(
      <IntegrationsForm orgSlug="org with spaces&x=1" twitch={EMPTY} youtube={EMPTY} kick={EMPTY} />
    );
    expect(html).toContain("orgSlug=org%20with%20spaces%26x%3D1");
    expect(html).not.toContain("orgSlug=org with spaces");
  });

  it("no stale Kick 'coming soon' wording", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={EMPTY} youtube={EMPTY} kick={EMPTY} />);
    expect(html.toLowerCase()).not.toContain("coming soon");
  });

  it("no arbitrary organization ID can be injected — only orgSlug query param", () => {
    const html = renderToString(<IntegrationsForm orgSlug="org-1" twitch={EMPTY} youtube={EMPTY} kick={EMPTY} />);
    expect(html).not.toContain("organization_id");
    expect(html).not.toContain("organizationId");
  });
});

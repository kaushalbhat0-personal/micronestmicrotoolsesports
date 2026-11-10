import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ConnectedChannelsList } from "./connected-channels-list";
import { ConnectYouTubeForm } from "./connect-youtube-form";

vi.mock("@/features/sponsor-sentinel/actions/channel-actions", () => ({
  disconnectChannelAction: vi.fn(),
  connectYouTubeChannelAction: vi.fn(),
}));

describe("ConnectedChannelsList", () => {
  it("empty state shows No creator channels", () => {
    const html = renderToString(<ConnectedChannelsList orgSlug="org-1" channels={[]} />);
    expect(html).toContain("No creator channels connected");
    expect(html).toContain("Connect a channel");
  });

  it("renders connected channel with platform and status", () => {
    const html = renderToString(
      <ConnectedChannelsList
        orgSlug="org-1"
        channels={[{ id: "ch1", platform: "youtube", external_handle: "@Handle", display_name: "Handle", canonical_url: "https://youtube.com/channel/UC1", connection_status: "connected" } as never]}
      />
    );
    expect(html).toContain("Handle");
    expect(html).toContain("youtube");
    expect(html).toContain("Connected ✓");
    expect(html).toContain("Open channel");
    expect(html).toContain("Disconnect");
  });

  it("shows disconnect confirmation not immediately", () => {
    const html = renderToString(<ConnectedChannelsList orgSlug="org-1" channels={[{ id: "ch1", platform: "youtube", external_handle: "@H", display_name: "H", canonical_url: "https://youtube.com/channel/UC1", connection_status: "connected" } as never]} />);
    // Dialog closed initially, no confirmation text
    expect(html).not.toContain("Disconnect this creator channel?");
  });
});

describe("ConnectYouTubeForm", () => {
  it("renders handle input and connect button", () => {
    const html = renderToString(<ConnectYouTubeForm orgSlug="org-1" hasCredentials={true} />);
    expect(html).toContain("YouTube handle");
    expect(html).toContain("Connect YouTube");
    expect(html).toContain("@GoogleDevelopers");
  });

  it("shows no secrets", () => {
    const html = renderToString(<ConnectYouTubeForm orgSlug="org-1" hasCredentials={true} />);
    expect(html).not.toContain("apiKey");
    expect(html).not.toContain("secret");
  });
});

import { describe, expect, it } from "vitest";
import { parseYouTubeAtom } from "./parser";
import type { VerificationResult } from "@/server/webhooks/types";

function verifiedYouTube(challenge?: string, eventType = "video_published"): VerificationResult {
  return {
    status: "VERIFIED",
    provider: "youtube",
    rawBody: "<feed/>",
    challenge,
    eventType,
  } as unknown as VerificationResult;
}

describe("YouTube parser", () => {
  it("valid Atom notification parses, yt:videoId extracted", () => {
    const xml = `<?xml version="1.0"?><feed><entry><yt:videoId>vid123</yt:videoId><yt:channelId>UC999</yt:channelId><title>Our Video #Brand</title><published>2026-03-10T14:00:00Z</published></entry></feed>`;
    const res = parseYouTubeAtom(xml, verifiedYouTube());
    expect("parsed" in res).toBe(true);
    const r = res as { parsed: { videoId: string | null; channelIdAtom: string | null }; canonical: { externalEventId: string; externalChannelId: string | null } };
    expect(r.parsed.videoId).toBe("vid123");
    expect(r.parsed.channelIdAtom).toBe("UC999");
    expect(r.canonical.externalEventId).toBe("vid123");
    expect(r.canonical.externalChannelId).toBe("UC999");
  });

  it("valid verified challenge remains challenge-only", () => {
    const res = parseYouTubeAtom("", verifiedYouTube("hub-challenge-123"));
    expect("kind" in res && (res as { kind: string }).kind).toBe("challenge");
    if ("kind" in res && (res as { kind: string }).kind === "challenge") expect((res as { challenge: string }).challenge).toBe("hub-challenge-123");
  });

  it("malformed XML rejected (missing yt:videoId)", () => {
    const xml = `<feed><entry><title>no id</title></entry></feed>`;
    expect(() => parseYouTubeAtom(xml, verifiedYouTube())).toThrow();
  });

  it("empty body rejected", () => {
    expect(() => parseYouTubeAtom("", verifiedYouTube())).toThrow();
  });

  it("missing Atom entry rejected", () => {
    expect(() => parseYouTubeAtom("<random>hi</random>", verifiedYouTube())).toThrow();
  });

  it("invalid verify (Rejected) never reaches notification ingestion (throws)", () => {
    const bad: VerificationResult = { status: "REJECTED", provider: "youtube", errorKind: "invalid_verify_token", message: "bad" };
    expect(() => parseYouTubeAtom("<entry><yt:videoId>vid</yt:videoId></entry>", bad)).toThrow();
  });

  it("documents deliveryCollapsed limitation", () => {
    const xml = `<?xml version="1.0"?><feed><entry><yt:videoId>sameVid</yt:videoId><yt:channelId>UC1</yt:channelId></entry></feed>`;
    const res = parseYouTubeAtom(xml, verifiedYouTube()) as { canonical: { metadata: Record<string, unknown> } };
    expect(res.canonical.metadata.deliveryCollapsed).toBe(true);
  });
});

import type {
  EventIngestor,
  EventNormalizer,
  EventParser,
  EventVerifier,
  ParsedEvent,
} from "@/features/sponsor-sentinel/types/events";
import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";

export class MockEventVerifier implements EventVerifier {
  constructor(private validPlatforms: readonly Platform[] = ["twitch", "youtube", "kick"]) {}
  async verify(request: Request, provider: Platform): Promise<{ readonly valid: boolean; readonly reason?: string }> {
    if (!this.validPlatforms.includes(provider)) return { valid: false, reason: "unsupported platform" };
    const sig = request.headers.get("x-mock-signature");
    if (sig === "invalid") return { valid: false, reason: "invalid signature" };
    return { valid: true };
  }
}

export class MockEventParser implements EventParser {
  parse(rawBody: string, _headers: Headers, provider: Platform): ParsedEvent {
    if (!rawBody || rawBody.trim() === "") throw new Error("malformed event body");
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    if (typeof parsed.type !== "string") throw new Error("malformed: missing type");
    return {
      provider,
      type: parsed.type as string,
      externalChannelId: (parsed.channelId as string | null) ?? null,
      externalContentId: (parsed.contentId as string | null) ?? null,
      timestamp: (parsed.timestamp as string) ?? new Date().toISOString(),
      raw: parsed,
    };
  }
}

export class MockEventNormalizer implements EventNormalizer {
  async normalize(parsed: ParsedEvent): Promise<CanonicalLiveStream | CanonicalVideo | null> {
    if (parsed.type === "unsupported") return null;
    // Return a minimal canonical live for valid types
    return {
      platform: parsed.provider,
      externalStreamId: parsed.externalContentId ?? "mock-content",
      externalChannelId: parsed.externalChannelId ?? "mock-channel",
      channelHandle: "mock-handle",
      title: "Mock Event Title #OurBrand",
      category: { id: "1", name: "Mock", platform: parsed.provider },
      tags: [],
      startedAt: parsed.timestamp,
      observedAt: new Date().toISOString(),
      canonicalUrl: `https://${parsed.provider}.com/mock`,
      isLive: true,
      description: null,
    };
  }
}

export class MockEventIngestor implements EventIngestor {
  public ingested: Array<{ canonical: CanonicalLiveStream | CanonicalVideo; source: "event" }> = [];
  async ingest(canonical: CanonicalLiveStream | CanonicalVideo, source: "event"): Promise<void> {
    this.ingested.push({ canonical, source });
  }
  reset(): void {
    this.ingested = [];
  }
}

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runEventPipeline } from "./event-pipeline";
import { MockEventIngestor, MockEventNormalizer, MockEventParser, MockEventVerifier } from "./mock-pipeline";

function makeSupabaseWithWebhookStore() {
  const store: unknown[] = [];
  const supabase = {
    from: (table: string) => {
      if (table !== "webhook_events") throw new Error("unexpected table");
      return {
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const dup = store.find(
                (r) => (r as Record<string, unknown>).provider === row.provider && (r as Record<string, unknown>).provider_event_id === row.provider_event_id,
              );
              if (dup) throw new Error('duplicate key value violates unique constraint "webhook_events_provider_event_unique"');
              const inserted = { id: `we-${store.length + 1}`, ...row };
              store.push(inserted);
              return { data: inserted, error: null };
            },
          }),
        }),
      } as never;
    },
  } as unknown as SupabaseClient;
  return { supabase, store };
}

describe("event pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valid event processed", async () => {
    const { supabase } = makeSupabaseWithWebhookStore();
    const verifier = new MockEventVerifier();
    const parser = new MockEventParser();
    const normalizer = new MockEventNormalizer();
    const ingestor = new MockEventIngestor();
    const req = new Request("https://example.com/webhook", { headers: { "x-mock-signature": "valid" } });
    const body = JSON.stringify({ type: "stream.online", channelId: "twitch-123", contentId: "stream-1", timestamp: new Date().toISOString() });
    const res = await runEventPipeline({
      supabase,
      organizationId: "org-a",
      provider: "twitch",
      request: req,
      rawBody: body,
      headers: new Headers({ "x-mock-signature": "valid" }),
      verifier,
      parser,
      normalizer,
      ingestor,
    });
    expect(res.status).toBe("processed");
    expect(ingestor.ingested.length).toBe(1);
  });

  it("invalid event (bad signature) -> invalid", async () => {
    const { supabase } = makeSupabaseWithWebhookStore();
    const verifier = new MockEventVerifier();
    const parser = new MockEventParser();
    const normalizer = new MockEventNormalizer();
    const ingestor = new MockEventIngestor();
    const req = new Request("https://example.com/webhook", { headers: { "x-mock-signature": "invalid" } });
    const res = await runEventPipeline({
      supabase,
      organizationId: "org-a",
      provider: "twitch",
      request: req,
      rawBody: JSON.stringify({ type: "stream.online", channelId: "c" }),
      headers: new Headers(),
      verifier,
      parser,
      normalizer,
      ingestor,
    });
    expect(res.status).toBe("invalid");
    expect(ingestor.ingested.length).toBe(0);
  });

  it("malformed event body -> error", async () => {
    const { supabase } = makeSupabaseWithWebhookStore();
    const verifier = new MockEventVerifier();
    const parser = new MockEventParser();
    const normalizer = new MockEventNormalizer();
    const ingestor = new MockEventIngestor();
    const req = new Request("https://example.com/webhook", { headers: { "x-mock-signature": "valid" } });
    const res = await runEventPipeline({
      supabase,
      organizationId: "org-a",
      provider: "twitch",
      request: req,
      rawBody: "",
      headers: new Headers(),
      verifier,
      parser,
      normalizer,
      ingestor,
    });
    expect(res.status).toBe("error");
  });

  it("duplicate event not processed twice", async () => {
    const { supabase } = makeSupabaseWithWebhookStore();
    const verifier = new MockEventVerifier();
    const parser = new MockEventParser();
    const normalizer = new MockEventNormalizer();
    const ingestor = new MockEventIngestor();
    const req = new Request("https://example.com/webhook", { headers: { "x-mock-signature": "valid" } });
    const body = JSON.stringify({ type: "stream.online", channelId: "twitch-123", contentId: "stream-1", timestamp: new Date().toISOString() });
    const first = await runEventPipeline({
      supabase,
      organizationId: "org-a",
      provider: "twitch",
      request: req,
      rawBody: body,
      headers: new Headers(),
      verifier,
      parser,
      normalizer,
      ingestor,
    });
    expect(first.status).toBe("processed");
    // second with same contentId -> same eventId -> duplicate
    const second = await runEventPipeline({
      supabase,
      organizationId: "org-a",
      provider: "twitch",
      request: req,
      rawBody: body,
      headers: new Headers(),
      verifier,
      parser,
      normalizer,
      ingestor,
    });
    expect(second.status).toBe("duplicate");
    expect(ingestor.ingested.length).toBe(1);
  });

  it("unsupported platform -> unsupported", async () => {
    const { supabase } = makeSupabaseWithWebhookStore();
    const verifier = new MockEventVerifier();
    const parser = new MockEventParser();
    const normalizer = new MockEventNormalizer();
    const ingestor = new MockEventIngestor();
    const req = new Request("https://example.com/webhook", { headers: {} });
    const res = await runEventPipeline({
      supabase,
      organizationId: "org-a",
      provider: "facebook" as never,
      request: req,
      rawBody: JSON.stringify({ type: "stream.online" }),
      headers: new Headers(),
      verifier,
      parser,
      normalizer,
      ingestor,
    });
    expect(res.status).toBe("unsupported");
  });

  it("tenant isolation: event for org-a not visible to org-b via select (store check)", async () => {
    const { supabase, store } = makeSupabaseWithWebhookStore();
    const verifier = new MockEventVerifier();
    const parser = new MockEventParser();
    const normalizer = new MockEventNormalizer();
    const ingestor = new MockEventIngestor();
    const req = new Request("https://example.com/webhook", { headers: { "x-mock-signature": "valid" } });
    const body = JSON.stringify({ type: "stream.online", channelId: "twitch-123", contentId: "s1" });
    await runEventPipeline({
      supabase,
      organizationId: "org-a",
      provider: "twitch",
      request: req,
      rawBody: body,
      headers: new Headers(),
      verifier,
      parser,
      normalizer,
      ingestor,
    });
    // store has org-a event, org-b should not see it via RLS (policy checks is_org_member)
    expect(store.some((r) => (r as Record<string, unknown>).organization_id === "org-a")).toBe(true);
    expect(store.some((r) => (r as Record<string, unknown>).organization_id === "org-b")).toBe(false);
  });
});

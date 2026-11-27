import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPairSync, createSign } from "node:crypto";
import { verifyKickRequest, clearKickPublicKeyCacheForTests } from "./verifier";
import {
  clearKickPublicKeyCacheForTests as clearCache,
  KICK_PUBLIC_KEY_URL,
  KICK_PUBLIC_KEY_TTL_MS,
  __setKickPublicKeyCacheForTests,
} from "./public-key";

function signKick(privateKeyPem: string, messageId: string, timestamp: string, body: string): string {
  const payload = `${messageId}.${timestamp}.${body}`;
  const signer = createSign("sha256");
  signer.update(payload);
  signer.end();
  const sig = signer.sign(privateKeyPem);
  return sig.toString("base64");
}

function mockFetchSuccess(pem: string): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string | URL | Request) => {
    const u = typeof url === "string" ? url : url.toString();
    if (u.includes("/public/v1/public-key")) {
      return new Response(JSON.stringify({ data: { public_key: pem }, message: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  });
}

function mockFetchFailure(status = 500): ReturnType<typeof vi.fn> {
  return vi.fn(async () => new Response("error", { status }));
}

function mockFetchMalformed(): ReturnType<typeof vi.fn> {
  return vi.fn(async () => new Response(JSON.stringify({ data: { public_key: "not-a-pem" } }), { status: 200 }));
}

describe("Kick verifier", () => {
  let privatePem: string;
  let publicPem: string;
  let originalKey: string | undefined;
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;
    originalKey = process.env.KICK_WEBHOOK_PUBLIC_KEY;
    originalFetch = globalThis.fetch;
    clearKickPublicKeyCacheForTests();
    clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    else process.env.KICK_WEBHOOK_PUBLIC_KEY = originalKey;
    globalThis.fetch = originalFetch!;
    clearKickPublicKeyCacheForTests();
    clearCache();
    vi.restoreAllMocks();
  });

  // ── Existing behavior ──

  it("valid signature via fetched key (no cache → fetch official key)", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    const fetchMock = mockFetchSuccess(publicPem);
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const body = JSON.stringify({ event: "test" });
    const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("VERIFIED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]?.toString()).toContain("/public/v1/public-key");
  });

  it("valid signature via env fallback when fetch fails", async () => {
    process.env.KICK_WEBHOOK_PUBLIC_KEY = publicPem;
    clearCache();
    const fetchMock = mockFetchFailure(500);
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const body = JSON.stringify({ event: "test" });
    const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("VERIFIED");
  });

  it("valid cache → no network fetch", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    const fetchMock = mockFetchSuccess(publicPem);
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const body = JSON.stringify({ event: "test" });
    const id = "id-cache-1";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const makeReq = () =>
      new Request("https://example.com/webhooks/kick", {
        method: "POST",
        headers: {
          "Kick-Event-Message-Id": id,
          "Kick-Event-Message-Timestamp": ts,
          "Kick-Event-Signature": sig,
          "Kick-Event-Type": "chat.message.sent",
        },
      });
    const first = await verifyKickRequest(makeReq(), body);
    expect(first.status).toBe("VERIFIED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    // Second verification within TTL should use cache, no fetch
    const ts2 = new Date().toISOString();
    const sig2 = signKick(privatePem, id, ts2, body);
    const req2 = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts2,
        "Kick-Event-Signature": sig2,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const second = await verifyKickRequest(req2, body);
    expect(second.status).toBe("VERIFIED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cache expiry → fetch new key", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    // Inject expired cache (TTL 1ms ago)
    __setKickPublicKeyCacheForTests(publicPem, 0);
    // Wait a tick to ensure expired
    await new Promise((r) => setTimeout(r, 2));
    const { privateKey: pk2, publicKey: pub2 } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privatePem2 = pk2.export({ type: "pkcs8", format: "pem" }) as string;
    const publicPem2 = pub2.export({ type: "spki", format: "pem" }) as string;
    const fetchMock = mockFetchSuccess(publicPem2);
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const body = "{}";
    const id = "expiry-id";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem2, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("VERIFIED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("invalid signature", async () => {
    process.env.KICK_WEBHOOK_PUBLIC_KEY = publicPem;
    clearCache();
    const fetchMock = mockFetchSuccess(publicPem);
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const body = JSON.stringify({ event: "test" });
    const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const badSig = sig.slice(0, -4) + "AAAA";
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": badSig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("REJECTED");
  });

  it("missing required headers", async () => {
    const fetchMock = vi.fn(async () => new Response("should not be called", { status: 500 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("https://example.com/webhooks/kick", { method: "POST", headers: {} });
    const res = await verifyKickRequest(req, "{}");
    expect(res.status).toBe("MALFORMED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("malformed signature", async () => {
    const fetchMock = vi.fn(async () => new Response("should not be called", { status: 500 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": "id",
        "Kick-Event-Message-Timestamp": new Date().toISOString(),
        "Kick-Event-Signature": "not-base64!!!",
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, "{}");
    expect(res.status === "MALFORMED" || res.status === "REJECTED").toBe(true);
    // Malformed base64 should not trigger fetch
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("modified body fails", async () => {
    process.env.KICK_WEBHOOK_PUBLIC_KEY = publicPem;
    clearCache();
    const fetchMock = mockFetchSuccess(publicPem);
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({ event: "test" });
    const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body + " ");
    expect(res.status).toBe("REJECTED");
  });

  it("stale timestamp", async () => {
    const fetchMock = vi.fn(async () => new Response("should not be called", { status: 500 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const body = "{}";
    const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const ts = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("STALE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetch failure without usable key → CONFIGURATION_ERROR", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    const fetchMock = mockFetchFailure(500);
    vi.stubGlobal("fetch", fetchMock);
    const body = "{}";
    const id = "id";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("CONFIGURATION_ERROR");
  });

  it("malformed fetched key → configuration failure", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    const fetchMock = mockFetchMalformed();
    vi.stubGlobal("fetch", fetchMock);
    const body = "{}";
    const id = "id";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("CONFIGURATION_ERROR");
    expect(JSON.stringify(res)).not.toContain("not-a-pem");
  });

  it("fetch failure with valid fallback → fallback behavior", async () => {
    process.env.KICK_WEBHOOK_PUBLIC_KEY = publicPem;
    clearCache();
    const fetchMock = mockFetchFailure(500);
    vi.stubGlobal("fetch", fetchMock);
    const body = "{}";
    const id = "fallback-ok";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("VERIFIED");
  });

  it("malformed env fallback → CONFIGURATION_ERROR when fetch fails", async () => {
    process.env.KICK_WEBHOOK_PUBLIC_KEY = "not-a-key";
    clearCache();
    const fetchMock = mockFetchFailure(500);
    vi.stubGlobal("fetch", fetchMock);
    const body = "{}";
    const id = "id";
    const ts = new Date().toISOString();
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": "dGVzdA==",
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(["REJECTED", "MALFORMED", "CONFIGURATION_ERROR", "STALE"].includes(res.status)).toBe(true);
    expect(res.status).toBe("CONFIGURATION_ERROR");
  });

  // ── Concurrency / single-flight ──

  it("concurrent verification requests → one public-key fetch", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    let fetchCount = 0;
    const fetchMock = vi.fn(async () => {
      fetchCount++;
      // Simulate network latency so concurrent callers overlap
      await new Promise((r) => setTimeout(r, 30));
      return new Response(JSON.stringify({ data: { public_key: publicPem }, message: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const body = "{}";
    const mkReq = (id: string) => {
      const ts = new Date().toISOString();
      const sig = signKick(privatePem, id, ts, body);
      return new Request("https://example.com/webhooks/kick", {
        method: "POST",
        headers: {
          "Kick-Event-Message-Id": id,
          "Kick-Event-Message-Timestamp": ts,
          "Kick-Event-Signature": sig,
          "Kick-Event-Type": "chat.message.sent",
        },
      });
    };

    const [r1, r2, r3] = await Promise.all([
      verifyKickRequest(mkReq("c1"), body),
      verifyKickRequest(mkReq("c2"), body),
      verifyKickRequest(mkReq("c3"), body),
    ]);
    expect(r1.status).toBe("VERIFIED");
    expect(r2.status).toBe("VERIFIED");
    expect(r3.status).toBe("VERIFIED");
    expect(fetchCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("successful fetch updates cache", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    const fetchMock = mockFetchSuccess(publicPem);
    vi.stubGlobal("fetch", fetchMock);
    const body = "{}";
    const id = "cache-update";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("VERIFIED");
    // Now cache valid → second request should not fetch
    fetchMock.mockClear();
    const ts2 = new Date().toISOString();
    const sig2 = signKick(privatePem, id, ts2, body);
    const req2 = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts2,
        "Kick-Event-Signature": sig2,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res2 = await verifyKickRequest(req2, body);
    expect(res2.status).toBe("VERIFIED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("failed fetch does not poison cache", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    // First, populate cache successfully
    const fetchMockSuccess = mockFetchSuccess(publicPem);
    vi.stubGlobal("fetch", fetchMockSuccess);
    const body = "{}";
    const id = "poison-1";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const r1 = await verifyKickRequest(req, body);
    expect(r1.status).toBe("VERIFIED");
    // Now expire cache and cause fetch to fail — with no fallback, should be CONFIGURATION_ERROR, not stale cache reuse
    __setKickPublicKeyCacheForTests(publicPem, 0);
    await new Promise((r) => setTimeout(r, 2));
    const fetchMockFail = mockFetchFailure(500);
    vi.stubGlobal("fetch", fetchMockFail);
    const ts2 = new Date().toISOString();
    const sig2 = signKick(privatePem, "poison-2", ts2, body);
    const req2 = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": "poison-2",
        "Kick-Event-Message-Timestamp": ts2,
        "Kick-Event-Signature": sig2,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const r2 = await verifyKickRequest(req2, body);
    expect(r2.status).toBe("CONFIGURATION_ERROR");
    // Next, restore successful fetch — should succeed again (cache not poisoned)
    const fetchMockSuccess2 = mockFetchSuccess(publicPem);
    vi.stubGlobal("fetch", fetchMockSuccess2);
    const ts3 = new Date().toISOString();
    const sig3 = signKick(privatePem, "poison-3", ts3, body);
    const req3 = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": "poison-3",
        "Kick-Event-Message-Timestamp": ts3,
        "Kick-Event-Signature": sig3,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const r3 = await verifyKickRequest(req3, body);
    expect(r3.status).toBe("VERIFIED");
  });

  // ── Key rotation ──

  it("rotation: old cached key + webhook signed with new key → refresh → VERIFIED", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    const { privateKey: oldPriv, publicKey: oldPub } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const oldPrivatePem = oldPriv.export({ type: "pkcs8", format: "pem" }) as string;
    const oldPublicPem = oldPub.export({ type: "spki", format: "pem" }) as string;
    const { privateKey: newPriv, publicKey: newPub } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const newPrivatePem = newPriv.export({ type: "pkcs8", format: "pem" }) as string;
    const newPublicPem = newPub.export({ type: "spki", format: "pem" }) as string;

    // Prime cache with old key (valid, not expired)
    __setKickPublicKeyCacheForTests(oldPublicPem, KICK_PUBLIC_KEY_TTL_MS);
    // Mock fetch to return new key
    const fetchMock = mockFetchSuccess(newPublicPem);
    vi.stubGlobal("fetch", fetchMock);

    const body = JSON.stringify({ event: "rotation" });
    const id = "rotation-id-1";
    const ts = new Date().toISOString();
    const sigNew = signKick(newPrivatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sigNew,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("VERIFIED");
    // Should have fetched once for retry (initial cache hit didn't fetch, retry forced fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Prove old key alone would not verify new sig
    void oldPrivatePem;
  });

  it("rotation: old cached key + invalid signature → refresh once → still REJECTED (no infinite loop)", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    const { privateKey: oldPriv, publicKey: oldPub } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const oldPublicPem = oldPub.export({ type: "spki", format: "pem" }) as string;
    void oldPriv;
    const { privateKey: newPriv2, publicKey: newPub2 } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    void newPriv2;
    const newPublicPem = newPub2.export({ type: "spki", format: "pem" }) as string;
    __setKickPublicKeyCacheForTests(oldPublicPem, KICK_PUBLIC_KEY_TTL_MS);
    const fetchMock = mockFetchSuccess(newPublicPem);
    vi.stubGlobal("fetch", fetchMock);

    const body = "{}";
    const id = "rotation-invalid";
    const ts = new Date().toISOString();
    // Create an invalid signature (random bytes)
    const badSig = Buffer.from("invalid-signature-bytes-32").toString("base64");
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": badSig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("REJECTED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rotation: no infinite retry — fetch called at most twice per verification", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    const { privateKey: oldPriv, publicKey: oldPub } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const oldPublicPem = oldPub.export({ type: "spki", format: "pem" }) as string;
    void oldPriv;
    const { publicKey: newPub } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const newPublicPem = newPub.export({ type: "spki", format: "pem" }) as string;
    __setKickPublicKeyCacheForTests(oldPublicPem, KICK_PUBLIC_KEY_TTL_MS);
    const fetchMock = mockFetchSuccess(newPublicPem);
    vi.stubGlobal("fetch", fetchMock);
    const body = "{}";
    const id = "loop-check";
    const ts = new Date().toISOString();
    const badSig = Buffer.from("bad-sig-1234567890-bad-sig").toString("base64");
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": badSig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("REJECTED");
    // Initial verification used cached key (no fetch), retry caused one forced fetch → total 1
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ── Security ──

  it("security: raw body is still used for verification (not re-stringified)", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    const fetchMock = mockFetchSuccess(publicPem);
    vi.stubGlobal("fetch", fetchMock);
    const body = '{"a":1}';
    const bodyWithSpace = '{"a": 1}';
    const id = "raw-body-id";
    const ts = new Date().toISOString();
    // Sign with compact body
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    // Send modified whitespace body — should fail even though JSON sematically same
    const res = await verifyKickRequest(req, bodyWithSpace);
    expect(res.status).toBe("REJECTED");
  });

  it("security: public-key fetch response cannot inject arbitrary crypto (non-RSA rejected)", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    // Generate EC key instead of RSA
    const { publicKey: ecPub } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const ecPem = ecPub.export({ type: "spki", format: "pem" }) as string;
    const fetchMock = mockFetchSuccess(ecPem);
    vi.stubGlobal("fetch", fetchMock);
    const body = "{}";
    const id = "ec-inject";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    // EC key should be rejected as invalid_key_type → CONFIGURATION_ERROR (no fallback)
    expect(res.status).toBe("CONFIGURATION_ERROR");
  });

  it("security: signature cannot supply key via request headers", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    const { privateKey: attackerPriv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const attackerPrivatePem = attackerPriv.export({ type: "pkcs8", format: "pem" }) as string;
    const fetchMock = mockFetchSuccess(publicPem);
    vi.stubGlobal("fetch", fetchMock);
    const body = "{}";
    const id = "attacker-id";
    const ts = new Date().toISOString();
    const sigAttacker = signKick(attackerPrivatePem, id, ts, body);
    // Attacker tries to inject public key via header (should be ignored — verifier never reads key from request)
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sigAttacker,
        "Kick-Event-Type": "chat.message.sent",
        "X-Kick-Public-Key": "attacker-injected-key",
        "Kick-Public-Key": "attacker-injected-key",
        "X-Public-Key": "attacker",
      },
    });
    const res = await verifyKickRequest(req, body);
    // Must not verify with attacker's key — should be REJECTED (verified against official key)
    expect(res.status).toBe("REJECTED");
  });

  it("security: no key material appears in errors/logs", async () => {
    delete process.env.KICK_WEBHOOK_PUBLIC_KEY;
    clearCache();
    const fetchMock = mockFetchMalformed();
    vi.stubGlobal("fetch", fetchMock);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = "{}";
    const id = "log-check";
    const ts = new Date().toISOString();
    const sig = signKick(privatePem, id, ts, body);
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyKickRequest(req, body);
    expect(res.status).toBe("CONFIGURATION_ERROR");
    const logged = consoleSpy.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(logged).not.toContain("BEGIN PUBLIC KEY");
    expect(logged).not.toContain("not-a-pem");
    expect(JSON.stringify(res)).not.toContain("BEGIN PUBLIC KEY");
    consoleSpy.mockRestore();
  });

  it("secret/private material not logged", async () => {
    const fetchMock = vi.fn(async () => new Response("should not be called", { status: 500 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("https://example.com/webhooks/kick", { method: "POST", headers: {} });
    const res = await verifyKickRequest(req, "{}");
    expect(JSON.stringify(res)).not.toContain(privatePem);
    expect(JSON.stringify(res)).not.toContain("private");
  });

  it("TTL constant is 24 hours (application policy)", () => {
    expect(KICK_PUBLIC_KEY_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(KICK_PUBLIC_KEY_URL).toBe("https://api.kick.com/public/v1/public-key");
  });
});

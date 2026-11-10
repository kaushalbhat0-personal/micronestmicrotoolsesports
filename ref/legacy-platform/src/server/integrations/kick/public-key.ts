/**
 * Kick public-key resolver — rotation-hardened (08A-HARDEN).
 *
 * Official docs: https://docs.kick.com/events/webhook-security.md + https://docs.kick.com/apis/public-key.md
 * Endpoint: GET https://api.kick.com/public/v1/public-key
 * Response: { data: { public_key: "-----BEGIN PUBLIC KEY-----..." }, message: string }
 * Signature: RSA-SHA256 over `${messageId}.${timestamp}.${rawBody}` (PKCS1v15, SHA-256)
 *
 * Precedence (explicit, documented):
 *   1) valid cached official key (process-local, not expired)
 *        ↓
 *   2) fetch official Kick public-key endpoint (GET /public/v1/public-key)
 *        ↓
 *   3) configured environment fallback `KICK_WEBHOOK_PUBLIC_KEY` (explicit fallback/override)
 *        ↓
 *   4) CONFIGURATION_ERROR
 *
 * Do NOT accept a public key supplied by the webhook request.
 * Public key is not secret, but do not log key material.
 *
 * Cache policy: application-side TTL of 24 hours. The official Kick documentation
 * does not specify a cache duration; 24h is a conservative application policy
 * (not a Kick guarantee). Cache is process-local for MVP, deterministic, and
 * invalidated when TTL expires.
 *
 * Single-flight: concurrent callers awaiting the same fetch share one promise;
 * successful fetch updates cache; failed fetch does not poison cache.
 */

import { createPublicKey, type KeyObject } from "node:crypto";

export const KICK_PUBLIC_KEY_URL = "https://api.kick.com/public/v1/public-key";

/**
 * Application-side cache TTL. Per task spec "approximately 24 hours".
 * This is NOT a Kick guarantee — Kick docs do not specify a cache duration.
 */
export const KICK_PUBLIC_KEY_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedEntry {
  key: KeyObject;
  pem: string;
  expiresAt: number;
}

let cache: CachedEntry | null = null;
let pendingFetch: Promise<FetchResult> | null = null;

type FetchResult =
  | { ok: true; key: KeyObject; pem: string }
  | { ok: false; errorKind: string };

function getEnvFallback(): { key: KeyObject; pem: string } | null {
  const envPem = process.env.KICK_WEBHOOK_PUBLIC_KEY;
  if (!envPem) return null;
  const trimmed = envPem.trim();
  if (!trimmed.includes("-----BEGIN PUBLIC KEY-----")) return null;
  try {
    const key = createPublicKey(trimmed);
    // Validate it is RSA; public key resolver only stores RSA keys.
    // KeyObject.asymmetricKeyType is available on Node 18+
    const asymmetricKeyType = (key as unknown as { asymmetricKeyType?: string }).asymmetricKeyType;
    if (asymmetricKeyType && asymmetricKeyType !== "rsa") return null;
    return { key, pem: trimmed };
  } catch {
    return null;
  }
}

function isCacheValid(): boolean {
  return cache !== null && Date.now() < cache.expiresAt;
}

function extractPem(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null;
  const obj = json as Record<string, unknown>;
  // Preferred shape: { data: { public_key: "-----BEGIN..." } }
  const data = obj.data as Record<string, unknown> | undefined;
  if (data && typeof data.public_key === "string") return data.public_key;
  if (data && typeof data.publicKey === "string") return data.publicKey;
  // Fallback shapes (defensive)
  if (typeof obj.public_key === "string") return obj.public_key;
  if (typeof obj.publicKey === "string") return obj.publicKey;
  return null;
}

async function fetchOfficialKey(fetchFn: typeof fetch): Promise<FetchResult> {
  try {
    const res = await fetchFn(KICK_PUBLIC_KEY_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, errorKind: `fetch_${res.status}` };
    }
    let json: unknown;
    try {
      const text = await res.text();
      json = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, errorKind: "malformed_json" };
    }
    const pem = extractPem(json);
    if (!pem || typeof pem !== "string") {
      return { ok: false, errorKind: "malformed_key_response" };
    }
    const trimmed = pem.trim();
    if (!trimmed.includes("-----BEGIN PUBLIC KEY-----") || !trimmed.includes("-----END PUBLIC KEY-----")) {
      return { ok: false, errorKind: "malformed_key_format" };
    }
    let key: KeyObject;
    try {
      key = createPublicKey(trimmed);
    } catch {
      return { ok: false, errorKind: "invalid_key_material" };
    }
    const asymmetricKeyType = (key as unknown as { asymmetricKeyType?: string }).asymmetricKeyType;
    if (asymmetricKeyType && asymmetricKeyType !== "rsa") {
      return { ok: false, errorKind: "invalid_key_type" };
    }
    return { ok: true, key, pem: trimmed };
  } catch {
    return { ok: false, errorKind: "network_error" };
  }
}

export type ResolveResult =
  | { ok: true; key: KeyObject; source: "cache" | "fetch" | "env_fallback" }
  | { ok: false; errorKind: string };

/**
 * Resolve the Kick public key according to documented precedence.
 * @param opts.forceRefresh - when true, ignore valid cache and fetch anew (for rotation retry).
 * @param opts.fetchFn - injectable fetch for tests; defaults to global fetch.
 */
export async function resolveKickPublicKey(opts?: {
  forceRefresh?: boolean;
  fetchFn?: typeof fetch;
}): Promise<ResolveResult> {
  const fetchFn = opts?.fetchFn ?? fetch;
  const forceRefresh = opts?.forceRefresh ?? false;

  if (!forceRefresh && isCacheValid() && cache) {
    return { ok: true, key: cache.key, source: "cache" };
  }

  // Single-flight: if a fetch is already in progress, await it
  if (pendingFetch) {
    const result = await pendingFetch;
    if (result.ok) {
      return { ok: true, key: result.key, source: "fetch" };
    }
    // Fetch failed — try env fallback (do not poison cache)
    const fallback = getEnvFallback();
    if (fallback) return { ok: true, key: fallback.key, source: "env_fallback" };
    return { ok: false, errorKind: result.errorKind };
  }

  // Start a new fetch (single-flight promise)
  pendingFetch = fetchOfficialKey(fetchFn);
  let fetchResult: FetchResult;
  try {
    fetchResult = await pendingFetch;
  } finally {
    pendingFetch = null;
  }

  if (fetchResult.ok) {
    cache = {
      key: fetchResult.key,
      pem: fetchResult.pem,
      expiresAt: Date.now() + KICK_PUBLIC_KEY_TTL_MS,
    };
    return { ok: true, key: fetchResult.key, source: "fetch" };
  }

  // Fetch failed — attempt env fallback before error
  const fallback = getEnvFallback();
  if (fallback) {
    // Do not cache fallback as official key — keeps precedence correct
    return { ok: true, key: fallback.key, source: "env_fallback" };
  }

  // Safe structured logging: only provider + errorKind, never key material
  console.error("[kick-public-key] fetch failed", { provider: "kick", errorKind: fetchResult.errorKind });

  return { ok: false, errorKind: fetchResult.errorKind };
}

export function clearKickPublicKeyCacheForTests(): void {
  cache = null;
  pendingFetch = null;
}

/** For tests: inspect whether cache is valid without exposing key */
export function __isKickPublicKeyCachedForTests(): boolean {
  return isCacheValid();
}

/** For tests: allow direct cache injection with a PEM (validated) */
export function __setKickPublicKeyCacheForTests(pem: string, ttlMs: number = KICK_PUBLIC_KEY_TTL_MS): void {
  const key = createPublicKey(pem);
  cache = { key, pem, expiresAt: Date.now() + ttlMs };
}

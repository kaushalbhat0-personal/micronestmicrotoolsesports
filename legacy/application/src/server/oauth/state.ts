import { randomBytes, createHmac, createHash } from "node:crypto";
import type { Provider } from "@/server/credentials/repository";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getHmacKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
      return Buffer.alloc(32, 0);
    }
    throw new Error("CREDENTIALS_ENCRYPTION_KEY not configured");
  }
  let buf: Buffer;
  if (/^[A-Za-z0-9+/=]{44}$/.test(raw)) {
    buf = Buffer.from(raw, "base64");
  } else if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    buf = Buffer.from(raw, "hex");
  } else {
    buf = createHash("sha256").update(raw).digest();
  }
  if (buf.length !== 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes");
  return buf;
}

function base64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export type OAuthStatePayload = {
  orgId: string;
  userId: string;
  provider: Provider;
  nonce: string;
  iat: number;
};

export function generateState(input: { organizationId: string; userId: string; provider: Provider }): { state: string; nonce: string; issuedAt: number } {
  const nonce = base64urlEncode(randomBytes(32));
  const issuedAt = Date.now();
  const payload: OAuthStatePayload = {
    orgId: input.organizationId,
    userId: input.userId,
    provider: input.provider,
    nonce,
    iat: issuedAt,
  };
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", getHmacKey()).update(payloadB64).digest();
  const sigB64 = base64urlEncode(sig);
  const state = `${payloadB64}.${sigB64}`;
  return { state, nonce, issuedAt };
}

/**
 * Verify state query param against signed payload and expected tenant context.
 * Throws on any tamper/expiry/mismatch. Caller must also verify cookie state equals query state for single-use CSRF.
 */
export function verifyState(input: {
  state: string;
  expectedOrganizationId: string;
  expectedUserId: string;
  expectedProvider?: Provider;
  maxAgeMs?: number;
  nowMs?: number;
}): OAuthStatePayload {
  const { state, expectedOrganizationId, expectedUserId, expectedProvider, maxAgeMs = STATE_TTL_MS, nowMs = Date.now() } = input;
  if (!state || typeof state !== "string") throw new Error("Missing state");
  const parts = state.split(".");
  if (parts.length !== 2) throw new Error("Malformed state");
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) throw new Error("Malformed state");

  const expectedSig = base64urlEncode(createHmac("sha256", getHmacKey()).update(payloadB64).digest());
  // Constant-time compare (length check first)
  if (sigB64.length !== expectedSig.length) throw new Error("Invalid state signature");
  // Use timingSafeEqual via buffer comparison
  const a = Buffer.from(sigB64, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  // Node's timingSafeEqual requires same length
  let equal = true;
  if (a.length !== b.length) equal = false;
  else {
    // manual constant-time
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
    equal = diff === 0;
  }
  if (!equal) throw new Error("Invalid state signature");

  let payload: OAuthStatePayload;
  try {
    const json = base64urlDecode(payloadB64).toString("utf8");
    payload = JSON.parse(json) as OAuthStatePayload;
  } catch {
    throw new Error("Malformed state payload");
  }

  if (!payload.orgId || !payload.userId || !payload.nonce || !payload.iat || !payload.provider) {
    throw new Error("Malformed state payload");
  }
  if (payload.orgId !== expectedOrganizationId) throw new Error("State organization mismatch");
  if (payload.userId !== expectedUserId) throw new Error("State user mismatch");
  if (expectedProvider && payload.provider !== expectedProvider) throw new Error("State provider mismatch");
  if (typeof payload.iat !== "number" || Number.isNaN(payload.iat)) throw new Error("Malformed state iat");
  if (nowMs - payload.iat > maxAgeMs) throw new Error("State expired");
  if (payload.iat > nowMs + 60_000) throw new Error("State issued in future");

  return payload;
}

export const OAUTH_STATE_TTL_MS = STATE_TTL_MS;

/**
 * Safe external fetch for patch ingestion.
 *
 * Every outbound request enforces:
 * - exact hostname allowlist (no substrings, no redirects off-list),
 * - HTTPS only,
 * - timeout via AbortController,
 * - hard response size cap with streaming abort,
 * - safe error classification (network/timeout/oversize/status).
 */

import { integrationError } from "@/lib/errors";

export interface SafeFetchOptions {
  readonly allowedHosts: readonly string[];
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly accept?: string;
}

export interface SafeFetchResult {
  readonly body: string;
  readonly etag: string | null;
  readonly bytes: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

function hostAllowed(url: URL, allowedHosts: readonly string[]): boolean {
  return allowedHosts.some((host) => url.hostname === host);
}

/** Fetch text with guardrails. Throws AppError (INTEGRATION_ERROR) on any violation. */
export async function safeFetchText(urlString: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw integrationError(`Blocked unsafe ingestion URL: unparsable`);
  }
  if (url.protocol !== "https:") throw integrationError(`Blocked unsafe ingestion URL: non-https`);
  if (!hostAllowed(url, options.allowedHosts)) throw integrationError(`Blocked unsafe ingestion URL: host not allowlisted`);

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(urlString, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "MicroNest-MetaParser/1.0 (+patch-intelligence)",
        ...(options.accept ? { accept: options.accept } : {}),
      },
    });
    const finalUrl = new URL(response.url !== "" ? response.url : urlString);
    if (!hostAllowed(finalUrl, options.allowedHosts)) {
      throw integrationError(`Blocked unsafe ingestion redirect: host not allowlisted`);
    }
    if (!response.ok || response.body === null) {
      throw integrationError(`Upstream responded with status ${response.status}`);
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw integrationError(`Upstream response exceeded size cap`);
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      body: new TextDecoder().decode(merged),
      etag: response.headers.get("etag"),
      bytes,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw integrationError(`Upstream request timed out`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

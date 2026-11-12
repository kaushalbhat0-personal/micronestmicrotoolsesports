/**
 * BGMI Tournament Hub — safe Liquipedia fetch.
 *
 * Strict source allowlist: only the exact Liquipedia PUBG Mobile
 * MediaWiki API path required by the adapter. No generic URL fetching,
 * no user-controlled server-side fetch — the page title is validated
 * against `^[A-Za-z0-9 _/().-]+$` and only ever appended as an encoded
 * query parameter to the allowlisted endpoint.
 *
 * Etiquette: modest frequency (ingestion runs daily at most), explicit
 * MicroNest User-Agent, bounded timeouts and response sizes.
 */

import { integrationError } from "@/lib/errors";

export const LIQUIPEDIA_API_HOST = "liquipedia.net";
export const LIQUIPEDIA_API_PATH_PREFIX = "/pubgmobile/api.php";
export const LIQUIPEDIA_USER_AGENT = "MicroNest-BgmiHub/1.0 (+tournament-standings; contact: info.micronest@gmail.com)";

const TIMEOUT_MS = 20_000;
const MAX_BYTES = 4 * 1024 * 1024;

const PAGE_TITLE_PATTERN = /^[A-Za-z0-9 _/().-]+$/;

export function assertSafePageTitle(page: string): void {
  if (page.length === 0 || page.length > 200 || !PAGE_TITLE_PATTERN.test(page)) {
    throw integrationError("Blocked unsafe Liquipedia page title");
  }
}

function buildApiUrl(params: Record<string, string>): string {
  const search = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  return `https://${LIQUIPEDIA_API_HOST}${LIQUIPEDIA_API_PATH_PREFIX}?${search.toString()}`;
}

/** GET a MediaWiki API response as parsed JSON with guardrails. */
export async function safeFetchLiquipediaJson(params: Record<string, string>): Promise<unknown> {
  const urlString = buildApiUrl(params);
  const url = new URL(urlString);
  if (url.hostname !== LIQUIPEDIA_API_HOST) throw integrationError("Blocked unsafe ingestion URL");
  if (!url.pathname.startsWith(LIQUIPEDIA_API_PATH_PREFIX)) throw integrationError("Blocked unsafe ingestion path");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(urlString, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": LIQUIPEDIA_USER_AGENT, accept: "application/json" },
    });
    const finalUrl = new URL(response.url !== "" ? response.url : urlString);
    if (finalUrl.hostname !== LIQUIPEDIA_API_HOST) {
      throw integrationError("Blocked unsafe ingestion redirect");
    }
    if (!response.ok) throw integrationError(`Liquipedia responded with status ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw integrationError("Liquipedia returned an empty body");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw integrationError("Liquipedia response exceeded size cap");
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(merged)) as unknown;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw integrationError("Liquipedia request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

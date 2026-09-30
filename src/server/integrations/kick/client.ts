/**
 * Kick Public API — real integration boundary (RCCF-05C).
 * Fixed base https://api.kick.com, app token via https://id.kick.com/oauth/token.
 */

import { getKickAppToken, clearKickTokenCache } from "./auth";

const KICK_API_BASE = "https://api.kick.com";

export type KickErrorKind =
  | "auth"
  | "not_found"
  | "rate_limited"
  | "invalid_request"
  | "server"
  | "network"
  | "malformed"
  | "unsupported";

export class KickApiError extends Error {
  readonly kind: KickErrorKind;
  readonly status: number;
  readonly retryAfter?: string | null;

  constructor(opts: { kind: KickErrorKind; status: number; message: string; retryAfter?: string | null }) {
    super(opts.message);
    this.name = "KickApiError";
    this.kind = opts.kind;
    this.status = opts.status;
    this.retryAfter = opts.retryAfter ?? null;
  }
}

function sanitizeBody(body: string): string {
  // hide any token fragments
  return body.slice(0, 500).replace(/access_token[^"]*"?/gi, "access_token=***");
}

export interface KickClientConfig {
  clientId: string;
  clientSecret: string;
}

export class KickClient {
  private readonly config: KickClientConfig;
  private readonly fetchFn: typeof fetch;

  constructor(config: KickClientConfig, fetchFn: typeof fetch = fetch) {
    this.config = config;
    this.fetchFn = fetchFn;
  }

  private async authFetch(path: string, params: Record<string, string | string[] | undefined>, retryOnAuth = true): Promise<{ json: unknown; headers: Headers; status: number }> {
    const token = await getKickAppToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
    const url = new URL(`${KICK_API_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, item);
      } else {
        url.searchParams.set(k, v);
      }
    }

    const doFetch = async (bearer: string): Promise<Response> => {
      return this.fetchFn(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearer}`,
          Accept: "application/json",
        },
      });
    };

    let res = await doFetch(token);
    if (res.status === 401 && retryOnAuth) {
      clearKickTokenCache();
      const fresh = await getKickAppToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
      res = await doFetch(fresh);
    }

    const headers = res.headers;
    const retryAfter = headers.get("retry-after") ?? headers.get("Retry-After");

    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      throw new KickApiError({ kind: "rate_limited", status: 429, message: `Kick rate limited: ${sanitizeBody(body)}`, retryAfter });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let kind: KickErrorKind = "server";
      if (res.status === 401) kind = "auth";
      else if (res.status === 404) kind = "not_found";
      else if (res.status >= 400 && res.status < 500) kind = "invalid_request";
      throw new KickApiError({ kind, status: res.status, message: `Kick API error ${res.status}: ${sanitizeBody(body)}`, retryAfter });
    }

    let json: unknown;
    try {
      const text = await res.text();
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new KickApiError({ kind: "malformed", status: res.status, message: "Kick malformed JSON response" });
    }

    if (typeof json !== "object" || json === null) {
      throw new KickApiError({ kind: "malformed", status: res.status, message: "Kick malformed response: not an object" });
    }

    return { json, headers, status: res.status };
  }

  // GET /public/v1/channels?slug=handle or broadcaster_user_id
  async getChannelsBySlug(slugs: string[]): Promise<{ data: Array<Record<string, unknown>> }> {
    if (slugs.length === 0) return { data: [] };
    const res = await this.authFetch("/public/v1/channels", { slug: slugs });
    const data = (res.json as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
    return { data: data ?? [] };
  }

  async getChannelsByBroadcasterId(ids: string[]): Promise<{ data: Array<Record<string, unknown>> }> {
    if (ids.length === 0) return { data: [] };
    const res = await this.authFetch("/public/v1/channels", { broadcaster_user_id: ids });
    const data = (res.json as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
    return { data: data ?? [] };
  }

  // GET /public/v1/users/livestreams?user_id=...
  // For Kick public API, livestreams per user is the live check
  async getLivestreamsForUsers(userIds: string[]): Promise<{ data: Array<Record<string, unknown>> }> {
    if (userIds.length === 0) return { data: [] };
    const res = await this.authFetch("/public/v1/users/livestreams", { user_id: userIds });
    const data = (res.json as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
    return { data: data ?? [] };
  }

  // GET /public/v2/livestreams with cursor pagination
  async getLivestreamsV2(params: { limit?: string; cursor?: string }): Promise<{ data: Array<Record<string, unknown>>; pagination: { next_cursor?: string } | undefined }> {
    const res = await this.authFetch("/public/v2/livestreams", { limit: params.limit, cursor: params.cursor });
    const json = res.json as Record<string, unknown>;
    const data = (json.data as Array<Record<string, unknown>> | undefined) ?? [];
    const pagination = json.pagination as { next_cursor?: string } | undefined;
    return { data, pagination };
  }

  // GET /public/v1/categories/:id
  async getCategoryById(id: string): Promise<{ data: Record<string, unknown> | null }> {
    const res = await this.authFetch(`/public/v1/categories/${encodeURIComponent(id)}`, {});
    // API returns { data: { id, name } } or similar
    const json = res.json as Record<string, unknown>;
    const data = (json.data as Record<string, unknown> | undefined) ?? (json as Record<string, unknown>);
    if (!data || typeof data.id === "undefined") return { data: null };
    return { data };
  }

  // Event subscriptions — Kick: GET /public/v1/events/subscriptions?broadcaster_user_id
  async getEventSubscriptions(broadcasterUserId?: number): Promise<{ data: Array<Record<string, unknown>> }> {
    const params: Record<string, string | string[] | undefined> = {};
    if (broadcasterUserId !== undefined) params.broadcaster_user_id = String(broadcasterUserId);
    const res = await this.authFetch("/public/v1/events/subscriptions", params);
    const data = (res.json as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
    // Handle wrapped format { data: [...] } or { data: { data: [...] } }
    if (Array.isArray(data)) return { data };
    const inner = (res.json as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (inner && Array.isArray(inner.data)) return { data: inner.data as Array<Record<string, unknown>> };
    return { data: [] };
  }

  async createEventSubscriptions(input: {
    broadcaster_user_id?: number;
    events: Array<{ name: string; version: number }>;
    method: "webhook";
  }): Promise<{ data: Array<Record<string, unknown>> }> {
    const token = await getKickAppToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
    const url = `${KICK_API_BASE}/public/v1/events/subscriptions`;
    const doFetch = async (bearer: string): Promise<Response> => {
      return this.fetchFn(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(input),
      });
    };
    let res = await doFetch(token);
    if (res.status === 401) {
      clearKickTokenCache();
      const fresh = await getKickAppToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
      res = await doFetch(fresh);
    }
    const headers = res.headers;
    const retryAfter = headers.get("retry-after") ?? headers.get("Retry-After");
    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      throw new KickApiError({ kind: "rate_limited", status: 429, message: `Kick rate limited: ${sanitizeBody(body)}`, retryAfter });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let kind: KickErrorKind = "server";
      if (res.status === 401) kind = "auth";
      else if (res.status === 404) kind = "not_found";
      else if (res.status >= 400 && res.status < 500) kind = "invalid_request";
      throw new KickApiError({ kind, status: res.status, message: `Kick API error ${res.status}: ${sanitizeBody(body)}`, retryAfter });
    }
    const json = (await res.json()) as Record<string, unknown>;
    const data = (json.data as Array<Record<string, unknown>> | undefined) ?? [];
    return { data: Array.isArray(data) ? data : [] };
  }

  async deleteEventSubscriptions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const token = await getKickAppToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
    const url = new URL(`${KICK_API_BASE}/public/v1/events/subscriptions`);
    for (const id of ids) url.searchParams.append("id", id);
    const doFetch = async (bearer: string): Promise<Response> => {
      return this.fetchFn(url.toString(), { method: "DELETE", headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json" } });
    };
    let res = await doFetch(token);
    if (res.status === 401) {
      clearKickTokenCache();
      const fresh = await getKickAppToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
      res = await doFetch(fresh);
    }
    const headers = res.headers;
    const retryAfter = headers.get("retry-after") ?? headers.get("Retry-After");
    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      throw new KickApiError({ kind: "rate_limited", status: 429, message: `Kick rate limited: ${sanitizeBody(body)}`, retryAfter });
    }
    if (!res.ok && res.status !== 204) {
      const body = await res.text().catch(() => "");
      let kind: KickErrorKind = "server";
      if (res.status === 401) kind = "auth";
      else if (res.status === 404) kind = "not_found";
      else if (res.status >= 400 && res.status < 500) kind = "invalid_request";
      throw new KickApiError({ kind, status: res.status, message: `Kick API error ${res.status}: ${sanitizeBody(body)}`, retryAfter });
    }
  }
}

export function createKickClient(fetchFn: typeof fetch = fetch): KickClient | null {
  const id = process.env.KICK_CLIENT_ID;
  const secret = process.env.KICK_CLIENT_SECRET;
  if (!id || !secret) return null;
  return new KickClient({ clientId: id, clientSecret: secret }, fetchFn);
}

export function clearKickTokenCacheForTests(): void {
  clearKickTokenCache();
}

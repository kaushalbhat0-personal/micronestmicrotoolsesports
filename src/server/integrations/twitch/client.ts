/**
 * Twitch Helix API — real integration boundary (RCCF-05A).
 * Centralizes auth, headers, rate-limit, errors. No raw fetch elsewhere.
 */

import { getAppAccessToken, clearTwitchTokenCache } from "./auth";

export interface TwitchClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface TwitchToken {
  access_token: string;
  expires_in: number;
  token_type: "bearer";
}

export type TwitchErrorKind =
  | "auth"
  | "not_found"
  | "rate_limited"
  | "invalid_request"
  | "server"
  | "network"
  | "malformed";

export class TwitchApiError extends Error {
  readonly kind: TwitchErrorKind;
  readonly status: number;
  readonly resetAt?: string | null;
  readonly remaining?: number | null;
  readonly limit?: number | null;

  constructor(opts: {
    kind: TwitchErrorKind;
    status: number;
    message: string;
    resetAt?: string | null;
    remaining?: number | null;
    limit?: number | null;
  }) {
    super(opts.message);
    this.name = "TwitchApiError";
    this.kind = opts.kind;
    this.status = opts.status;
    this.resetAt = opts.resetAt ?? null;
    this.remaining = opts.remaining ?? null;
    this.limit = opts.limit ?? null;
  }
}

function sanitizeErrorMessage(status: number, bodyText: string): string {
  // Never include tokens; bodyText is safe truncate
  const truncated = bodyText.slice(0, 500);
  return `Twitch Helix error ${status}${truncated ? `: ${truncated}` : ""}`;
}

function parseRateLimitHeaders(headers: Headers): { limit: number | null; remaining: number | null; reset: string | null } {
  const limitRaw = headers.get("ratelimit-limit") ?? headers.get("Ratelimit-Limit");
  const remainingRaw = headers.get("ratelimit-remaining") ?? headers.get("Ratelimit-Remaining");
  const resetRaw = headers.get("ratelimit-reset") ?? headers.get("Ratelimit-Reset");
  const limit = limitRaw ? Number(limitRaw) : null;
  const remaining = remainingRaw ? Number(remainingRaw) : null;
  let reset: string | null = null;
  if (resetRaw) {
    const epoch = Number(resetRaw);
    if (!Number.isNaN(epoch)) reset = new Date(epoch * 1000).toISOString();
    else reset = resetRaw;
  }
  return { limit: Number.isNaN(limit) ? null : limit, remaining: Number.isNaN(remaining) ? null : remaining, reset };
}

export interface HelixRequestOptions {
  signal?: AbortSignal;
  retryOnAuth?: boolean;
}

export class TwitchClient {
  private readonly config: TwitchClientConfig;
  private readonly fetchFn: typeof fetch;

  // Last rate-limit snapshot for budget integration
  public lastRateLimit: { limit: number | null; remaining: number | null; resetAt: string | null } | null = null;

  constructor(config: TwitchClientConfig, fetchFn: typeof fetch = fetch) {
    this.config = config;
    this.fetchFn = fetchFn;
  }

  async getAppToken(): Promise<TwitchToken> {
    const token = await getAppAccessToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
    // Return minimal shape; expires_in not tracked here (cached in auth)
    return { access_token: token, expires_in: 3600, token_type: "bearer" };
  }

  /** Core Helix GET with auth, rate-limit, and error mapping */
  async helixGet<T>(path: string, params: Record<string, string | string[] | undefined>, opts: HelixRequestOptions = {}): Promise<{ data: T; headers: Headers }> {
    const token = await getAppAccessToken(this.config.clientId, this.config.clientSecret, this.fetchFn);

    const url = new URL(`https://api.twitch.tv/helix${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, item);
      } else {
        url.searchParams.set(k, v);
      }
    }

    const doFetch = async (bearer: string): Promise<Response> => {
      const init: RequestInit = {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Client-Id": this.config.clientId,
        },
      };
      if (opts.signal !== undefined) init.signal = opts.signal;
      return this.fetchFn(url.toString(), init);
    };

    let res = await doFetch(token);

    // 401 → refresh once
    if (res.status === 401 && opts.retryOnAuth !== false) {
      clearTwitchTokenCache();
      const fresh = await getAppAccessToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
      res = await doFetch(fresh);
    }

    // Capture rate-limit headers
    const rl = parseRateLimitHeaders(res.headers);
    this.lastRateLimit = { limit: rl.limit, remaining: rl.remaining, resetAt: rl.reset };

    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      throw new TwitchApiError({
        kind: "rate_limited",
        status: 429,
        message: sanitizeErrorMessage(429, body),
        resetAt: rl.reset,
        remaining: rl.remaining,
        limit: rl.limit,
      });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let kind: TwitchErrorKind = "server";
      if (res.status === 401) kind = "auth";
      else if (res.status === 404) kind = "not_found";
      else if (res.status >= 400 && res.status < 500) kind = "invalid_request";
      else if (res.status >= 500) kind = "server";
      throw new TwitchApiError({
        kind,
        status: res.status,
        message: sanitizeErrorMessage(res.status, body),
        resetAt: rl.reset,
        remaining: rl.remaining,
        limit: rl.limit,
      });
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new TwitchApiError({ kind: "malformed", status: res.status, message: "Twitch Helix malformed JSON response" });
    }

    // Validate shape has data array at minimum for most endpoints
    if (typeof json !== "object" || json === null) {
      throw new TwitchApiError({ kind: "malformed", status: res.status, message: "Twitch Helix malformed response: not an object" });
    }

    return { data: json as T, headers: res.headers };
  }

  // Convenience wrappers for capability-required endpoints

  async getUsersByLogin(logins: string[]): Promise<{ data: Array<{ id: string; login: string; display_name: string }> }> {
    if (logins.length === 0) return { data: [] };
    const res = await this.helixGet<{ data: Array<{ id: string; login: string; display_name: string }> }>("/users", {
      login: logins,
    });
    return res.data;
  }

  async getUsersById(ids: string[]): Promise<{ data: Array<{ id: string; login: string; display_name: string }> }> {
    if (ids.length === 0) return { data: [] };
    const res = await this.helixGet<{ data: Array<{ id: string; login: string; display_name: string }> }>("/users", { id: ids });
    return res.data;
  }

  async getStreams(userIds: string[]): Promise<{ data: Array<import("./types").TwitchStream>; pagination?: { cursor?: string } }> {
    if (userIds.length === 0) return { data: [] };
    const res = await this.helixGet<{ data: Array<import("./types").TwitchStream>; pagination?: { cursor?: string } }>("/streams", {
      user_id: userIds,
    });
    return res.data;
  }

  async getChannelInformation(broadcasterIds: string[]): Promise<{ data: Array<import("./types").TwitchChannelInfo> }> {
    if (broadcasterIds.length === 0) return { data: [] };
    const res = await this.helixGet<{ data: Array<import("./types").TwitchChannelInfo> }>("/channels", {
      broadcaster_id: broadcasterIds,
    });
    return res.data;
  }

  async getVideos(params: { id?: string[]; user_id?: string; first?: string }): Promise<{
    data: Array<import("./types").TwitchVideo>;
    pagination?: { cursor?: string };
  }> {
    const q: Record<string, string | string[] | undefined> = {};
    if (params.id) q.id = params.id;
    if (params.user_id) q.user_id = params.user_id;
    if (params.first) q.first = params.first;
    const res = await this.helixGet<{ data: Array<import("./types").TwitchVideo>; pagination?: { cursor?: string } }>("/videos", q);
    return res.data;
  }

  async getGamesByIds(ids: string[]): Promise<{ data: Array<{ id: string; name: string }> }> {
    if (ids.length === 0) return { data: [] };
    const res = await this.helixGet<{ data: Array<{ id: string; name: string }> }>("/games", { id: ids });
    return res.data;
  }

  async getGamesByNames(names: string[]): Promise<{ data: Array<{ id: string; name: string }> }> {
    if (names.length === 0) return { data: [] };
    const res = await this.helixGet<{ data: Array<{ id: string; name: string }> }>("/games", { name: names });
    return res.data;
  }

  async getStreamTags(broadcasterId: string): Promise<{ data: Array<{ tag_id: string }> }> {
    const res = await this.helixGet<{ data: Array<{ tag_id: string }> }>("/streams/tags", { broadcaster_id: broadcasterId });
    return res.data;
  }

  // EventSub subscription management — reuse auth/rate-limit, separate from GET helper
  async createEventSubSubscription(input: {
    type: string;
    version: string;
    condition: Record<string, string>;
    transport: { method: "webhook"; callback: string; secret: string };
  }): Promise<{ data: Array<{ id: string; status: string }> }> {
    const token = await getAppAccessToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
    const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
    const doFetch = async (bearer: string): Promise<Response> => {
      return this.fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Client-Id": this.config.clientId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
    };
    let res = await doFetch(token);
    if (res.status === 401) {
      clearTwitchTokenCache();
      const fresh = await getAppAccessToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
      res = await doFetch(fresh);
    }
    const rl = parseRateLimitHeaders(res.headers);
    this.lastRateLimit = { limit: rl.limit, remaining: rl.remaining, resetAt: rl.reset };
    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      throw new TwitchApiError({ kind: "rate_limited", status: 429, message: sanitizeErrorMessage(429, body), resetAt: rl.reset, remaining: rl.remaining, limit: rl.limit });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let kind: TwitchErrorKind = "server";
      if (res.status === 401) kind = "auth";
      else if (res.status === 404) kind = "not_found";
      else if (res.status >= 400 && res.status < 500) kind = "invalid_request";
      throw new TwitchApiError({ kind, status: res.status, message: sanitizeErrorMessage(res.status, body), resetAt: rl.reset, remaining: rl.remaining, limit: rl.limit });
    }
    const json = (await res.json()) as { data: Array<{ id: string; status: string }> };
    return json;
  }

  async listEventSubSubscriptions(): Promise<{
    data: Array<{ id: string; status: string; type: string; version: string; condition: Record<string, string>; transport: { method: string; callback: string } }>;
    total?: number;
  }> {
    const res = await this.helixGet<{ data: Array<{ id: string; status: string; type: string; version: string; condition: Record<string, string>; transport: { method: string; callback: string } }> }>(
      "/eventsub/subscriptions",
      {},
    );
    return res.data as unknown as { data: Array<{ id: string; status: string; type: string; version: string; condition: Record<string, string>; transport: { method: string; callback: string } }> };
  }

  async deleteEventSubSubscription(id: string): Promise<void> {
    const token = await getAppAccessToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
    const url = `https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(id)}`;
    const doFetch = async (bearer: string): Promise<Response> => {
      return this.fetchFn(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${bearer}`, "Client-Id": this.config.clientId },
      });
    };
    let res = await doFetch(token);
    if (res.status === 401) {
      clearTwitchTokenCache();
      const fresh = await getAppAccessToken(this.config.clientId, this.config.clientSecret, this.fetchFn);
      res = await doFetch(fresh);
    }
    const rl = parseRateLimitHeaders(res.headers);
    this.lastRateLimit = { limit: rl.limit, remaining: rl.remaining, resetAt: rl.reset };
    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      throw new TwitchApiError({ kind: "rate_limited", status: 429, message: sanitizeErrorMessage(429, body), resetAt: rl.reset, remaining: rl.remaining, limit: rl.limit });
    }
    if (!res.ok && res.status !== 204) {
      const body = await res.text().catch(() => "");
      let kind: TwitchErrorKind = "server";
      if (res.status === 401) kind = "auth";
      else if (res.status === 404) kind = "not_found";
      else if (res.status >= 400 && res.status < 500) kind = "invalid_request";
      throw new TwitchApiError({ kind, status: res.status, message: sanitizeErrorMessage(res.status, body), resetAt: rl.reset, remaining: rl.remaining, limit: rl.limit });
    }
  }
}

export function createTwitchClient(fetchFn: typeof fetch = fetch): TwitchClient | null {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;
  return new TwitchClient({ clientId: id, clientSecret: secret }, fetchFn);
}

export function clearTwitchTokenCacheForTests(): void {
  clearTwitchTokenCache();
}

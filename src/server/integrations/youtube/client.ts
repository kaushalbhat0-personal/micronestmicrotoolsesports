/**
 * YouTube Data API v3 — real integration boundary (RCCF-05B).
 * API-key only (public metadata). No OAuth. Fixed base URL.
 */

const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3";

export type YouTubeErrorKind =
  | "auth"
  | "not_found"
  | "quota_exceeded"
  | "rate_limited"
  | "invalid_request"
  | "server"
  | "network"
  | "malformed";

export class YouTubeApiError extends Error {
  readonly kind: YouTubeErrorKind;
  readonly status: number;
  readonly quotaOperation?: string | null;

  constructor(opts: { kind: YouTubeErrorKind; status: number; message: string; quotaOperation?: string | null }) {
    super(opts.message);
    this.name = "YouTubeApiError";
    this.kind = opts.kind;
    this.status = opts.status;
    this.quotaOperation = opts.quotaOperation ?? null;
  }
}

function sanitizeBody(body: string): string {
  return body.slice(0, 500).replace(/key=[^&\s]+/gi, "key=***").replace(/access_token[^&\s]*/gi, "access_token=***");
}

export interface YouTubeClientConfig {
  apiKey?: string;
  accessToken?: string;
}

export class YouTubeClient {
  private readonly apiKey: string | undefined;
  private readonly accessToken: string | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(config: YouTubeClientConfig, fetchFn: typeof fetch = fetch) {
    if (!config.apiKey && !config.accessToken) throw new Error("YouTubeClient requires apiKey or accessToken");
    this.apiKey = config.apiKey ?? undefined;
    this.accessToken = config.accessToken ?? undefined;
    this.fetchFn = fetchFn;
  }

  private async request<T>(path: string, params: Record<string, string | undefined>, operation: string): Promise<T> {
    const url = new URL(`${YOUTUBE_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
    if (this.accessToken) {
      // OAuth path — Bearer, no key
    } else if (this.apiKey) {
      url.searchParams.set("key", this.apiKey);
    }

    let res: Response;
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
      res = await this.fetchFn(url.toString(), {
        method: "GET",
        headers,
      });
    } catch (e) {
      throw new YouTubeApiError({ kind: "network", status: 0, message: `YouTube network error for ${operation}: ${e instanceof Error ? e.message : String(e)}` });
    }

    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      throw new YouTubeApiError({ kind: "rate_limited", status: 429, message: `YouTube rate/quota limited for ${operation}: ${sanitizeBody(body)}`, quotaOperation: operation });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Detect quotaExceeded via body google error
      const isQuota = body.includes("quotaExceeded") || body.includes("quota exceeded") || res.status === 403 && body.includes("quota");
      if (isQuota) {
        throw new YouTubeApiError({ kind: "quota_exceeded", status: res.status, message: `YouTube quota exceeded for ${operation}: ${sanitizeBody(body)}`, quotaOperation: operation });
      }
      let kind: YouTubeErrorKind = "server";
      if (res.status === 401 || res.status === 403) kind = "auth";
      else if (res.status === 404) kind = "not_found";
      else if (res.status >= 400 && res.status < 500) kind = "invalid_request";
      throw new YouTubeApiError({ kind, status: res.status, message: `YouTube API error ${res.status} for ${operation}: ${sanitizeBody(body)}` });
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new YouTubeApiError({ kind: "malformed", status: res.status, message: `YouTube malformed JSON for ${operation}` });
    }
    if (typeof json !== "object" || json === null) {
      throw new YouTubeApiError({ kind: "malformed", status: res.status, message: `YouTube malformed response for ${operation}` });
    }
    return json as T;
  }

  async channelsList(params: { id?: string; forHandle?: string; part?: string }): Promise<{
    items?: Array<{ id: string; snippet: { title: string; description: string; customUrl?: string } }>;
  }> {
    const p: Record<string, string | undefined> = {};
    if (params.id) p.id = params.id;
    if (params.forHandle) p.forHandle = params.forHandle;
    p.part = params.part ?? "snippet";
    return this.request("/channels", p, "channels.list");
  }

  async videosList(params: {
    id: string;
    part?: string;
    maxResults?: string;
    pageToken?: string;
  }): Promise<{
    items?: Array<{
      id: string;
      snippet: { title: string; description: string; tags?: string[]; categoryId: string; publishedAt: string; channelId: string; liveBroadcastContent: string };
      contentDetails: { duration: string };
      liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string };
    }>;
    nextPageToken?: string;
    pageInfo?: { totalResults: number; resultsPerPage: number };
  }> {
    return this.request("/videos", {
      id: params.id,
      part: params.part ?? "snippet,contentDetails,liveStreamingDetails",
      maxResults: params.maxResults,
      pageToken: params.pageToken,
    }, "videos.list");
  }

  async searchList(params: {
    channelId: string;
    type?: string;
    eventType?: string;
    maxResults?: string;
    pageToken?: string;
    order?: string;
  }): Promise<{
    items?: Array<{ id: { videoId?: string; channelId?: string }; snippet: { title: string; publishedAt: string; channelId: string } }>;
    nextPageToken?: string;
  }> {
    return this.request("/search", {
      part: "snippet",
      channelId: params.channelId,
      type: params.type ?? "video",
      eventType: params.eventType,
      maxResults: params.maxResults ?? "5",
      pageToken: params.pageToken,
      order: params.order ?? "date",
    }, "search.list");
  }

  async videoCategoriesList(params: { id: string; part?: string }): Promise<{
    items?: Array<{ id: string; snippet: { title: string } }>;
  }> {
    return this.request("/videoCategories", { id: params.id, part: params.part ?? "snippet" }, "videoCategories.list");
  }
}

export function createYouTubeClient(fetchFn: typeof fetch = fetch): YouTubeClient | null {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  return new YouTubeClient({ apiKey: key }, fetchFn);
}

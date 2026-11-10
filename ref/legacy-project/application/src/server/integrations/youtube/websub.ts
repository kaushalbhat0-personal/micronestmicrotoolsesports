const PUBSUBHUBBUB_ENDPOINT = "https://pubsubhubbub.appspot.com/subscribe";

export type WebSubMode = "subscribe" | "unsubscribe";

export class WebSubApiError extends Error {
  readonly kind: "auth" | "invalid_request" | "server" | "network";
  readonly status: number;
  constructor(opts: { kind: "auth" | "invalid_request" | "server" | "network"; status: number; message: string }) {
    super(opts.message);
    this.name = "WebSubApiError";
    this.kind = opts.kind;
    this.status = opts.status;
  }
}

/**
 * YouTube WebSub (PubSubHubbub) — subscribes to https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC...
 * Uses hub.callback (our webhook), hub.topic, hub.verify=async, hub.verify_token.
 */
export async function websubRequest(
  params: {
    mode: WebSubMode;
    topic: string;
    callback: string;
    verifyToken: string;
    leaseSeconds?: number;
  },
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const body = new URLSearchParams({
    "hub.mode": params.mode,
    "hub.topic": params.topic,
    "hub.callback": params.callback,
    "hub.verify": "async",
    "hub.verify_token": params.verifyToken,
  });
  if (params.leaseSeconds !== undefined) body.set("hub.lease_seconds", String(params.leaseSeconds));

  let res: Response;
  try {
    res = await fetchFn(PUBSUBHUBBUB_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    throw new WebSubApiError({ kind: "network", status: 0, message: `WebSub network error: ${e instanceof Error ? e.message : String(e)}` });
  }

  if (res.status === 429) throw new WebSubApiError({ kind: "invalid_request", status: 429, message: "WebSub rate limited" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let kind: "auth" | "invalid_request" | "server" = "server";
    if (res.status === 401 || res.status === 403) kind = "auth";
    else if (res.status >= 400 && res.status < 500) kind = "invalid_request";
    throw new WebSubApiError({ kind, status: res.status, message: `WebSub error ${res.status}: ${text.slice(0, 300)}` });
  }
}

export function youtubeTopicForChannel(channelId: string): string {
  return `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
}

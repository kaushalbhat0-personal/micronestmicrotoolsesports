import { TwitchClient } from "@/server/integrations/twitch/client";
import { KickClient } from "@/server/integrations/kick/client";
import { YouTubeClient } from "@/server/integrations/youtube/client";

export async function testTwitchConnection(clientId: string, clientSecret: string, fetchFn: typeof fetch = fetch): Promise<{ ok: boolean; errorKind?: string }> {
  try {
    const client = new TwitchClient({ clientId, clientSecret }, fetchFn);
    await client.getAppToken();
    // Cheap validation: try helix users with dummy – 400 is still auth success, only 401 is auth failure
    try {
      await client.getUsersByLogin(["twitch"]);
    } catch (e) {
      const kind = (e as { kind?: string }).kind;
      if (kind === "auth") return { ok: false, errorKind: "auth" };
      // Other errors (not_found, etc) still mean auth succeeded
    }
    return { ok: true };
  } catch (e) {
    const kind = (e as { kind?: string }).kind ?? "server";
    return { ok: false, errorKind: kind };
  }
}

export async function testKickConnection(clientId: string, clientSecret: string, fetchFn: typeof fetch = fetch): Promise<{ ok: boolean; errorKind?: string }> {
  try {
    const client = new KickClient({ clientId, clientSecret }, fetchFn);
    // Try to fetch token + categories
    await client.getCategoryById("1");
    return { ok: true };
  } catch (e) {
    const kind = (e as { kind?: string }).kind ?? "server";
    // 404 for category not found still means auth succeeded
    if (kind === "not_found") return { ok: true };
    if (kind === "auth") return { ok: false, errorKind: "auth" };
    return { ok: false, errorKind: kind };
  }
}

export async function testYouTubeConnection(apiKey: string, fetchFn: typeof fetch = fetch): Promise<{ ok: boolean; errorKind?: string }> {
  try {
    const client = new YouTubeClient({ apiKey }, fetchFn);
    await client.channelsList({ id: "UC_x5XG1OV2P6uZZ5FSM9Ttw" }); // Google Developers channel
    return { ok: true };
  } catch (e) {
    const kind = (e as { kind?: string }).kind ?? "server";
    if (kind === "auth") return { ok: false, errorKind: "auth" };
    if (kind === "quota_exceeded") return { ok: false, errorKind: "quota_exceeded" };
    return { ok: false, errorKind: kind };
  }
}

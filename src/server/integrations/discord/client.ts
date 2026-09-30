/**
 * Discord Webhooks — integration boundary.
 */

export async function sendDiscordWebhook(webhookUrl: string, payload: { content?: string; embeds?: unknown[] }) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
}

export function getDiscordWebhookUrl(): string | null {
  return process.env.DISCORD_WEBHOOK_URL ?? null;
}

"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { TwitchClient, TwitchApiError } from "@/server/integrations/twitch/client";
import { TwitchProvider } from "@/server/integrations/twitch/provider";
import { YouTubeClient, YouTubeApiError } from "@/server/integrations/youtube/client";
import { YouTubeProvider } from "@/server/integrations/youtube/provider";
import { KickClient, KickApiError } from "@/server/integrations/kick/client";
import { KickProvider } from "@/server/integrations/kick/provider";
import { createConnectedChannel, listConnectedChannels, getConnectedChannel } from "@/features/sponsor-sentinel/services/connected-channel-service";
import { deleteConnectedChannel } from "@/server/repositories/connected-channels";
import { AppError } from "@/lib/errors";

type ChannelActionResult =
  | { success: true; channel?: unknown }
  | { error: string; fieldErrors?: Record<string, string[]> | undefined };

function validateHandle(raw: string): { error?: string; fieldErrors?: Record<string, string[]>; normalized?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Enter a valid Twitch channel handle.", fieldErrors: { handle: ["Enter a valid Twitch channel handle."] } };
  }
  // Reject URLs as primary input
  if (trimmed.includes("twitch.tv") || trimmed.includes("http://") || trimmed.includes("https://") || trimmed.includes("/")) {
    return { error: "Enter a valid Twitch channel handle.", fieldErrors: { handle: ["Enter a valid Twitch channel handle. Do not enter a URL."] } };
  }
  // Twitch login: 1-25, alphanumeric + underscore, reasonable length
  if (trimmed.length < 1 || trimmed.length > 25) {
    return { error: "Enter a valid Twitch channel handle.", fieldErrors: { handle: ["Enter a valid Twitch channel handle."] } };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { error: "Enter a valid Twitch channel handle.", fieldErrors: { handle: ["Enter a valid Twitch channel handle."] } };
  }
  return { normalized: trimmed.toLowerCase() };
}

function mapTwitchError(kind: string): string {
  switch (kind) {
    case "auth":
      return "Twitch authentication failed. Check the configured Client ID and Client Secret.";
    case "rate_limited":
      return "Twitch rate limit reached. Please try again later.";
    case "not_found":
      return "Twitch channel not found.";
    case "invalid_request":
      return "Enter a valid Twitch channel handle.";
    default:
      return "Twitch service temporarily unavailable. Please try again later.";
  }
}

function validateYouTubeHandle(raw: string): { error?: string; fieldErrors?: Record<string, string[]>; normalized?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Enter a valid YouTube channel handle.", fieldErrors: { handle: ["Enter a valid YouTube channel handle."] } };
  }
  // Reject URLs as primary input
  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be") || trimmed.includes("http://") || trimmed.includes("https://") || trimmed.includes("/")) {
    return { error: "Enter a valid YouTube channel handle.", fieldErrors: { handle: ["Enter a valid YouTube channel handle. Do not enter a URL."] } };
  }
  // Allow @ prefix, 1-100 chars, alphanumeric + _ . -
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (!withoutAt || withoutAt.length > 100) {
    return { error: "Enter a valid YouTube channel handle.", fieldErrors: { handle: ["Enter a valid YouTube channel handle."] } };
  }
  // Preserve original with @ for canonical, but pass trimmed as normalized (provider handles both)
  return { normalized: trimmed };
}

function mapYouTubeError(kind: string): string {
  switch (kind) {
    case "auth":
      return "YouTube API key is invalid or not authorized for the YouTube Data API.";
    case "quota_exceeded":
      return "YouTube API quota has been exceeded. Please try again later.";
    case "rate_limited":
      return "YouTube API quota has been exceeded. Please try again later.";
    case "not_found":
      return "YouTube channel not found.";
    case "invalid_request":
      return "Enter a valid YouTube channel handle.";
    default:
      return "YouTube service temporarily unavailable. Please try again later.";
  }
}

function validateKickHandle(raw: string): { error?: string; fieldErrors?: Record<string, string[]>; normalized?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Enter a valid Kick channel handle.", fieldErrors: { handle: ["Enter a valid Kick channel handle."] } };
  }
  if (trimmed.includes("kick.com") || trimmed.includes("http://") || trimmed.includes("https://") || trimmed.includes("/")) {
    return { error: "Enter a valid Kick channel handle.", fieldErrors: { handle: ["Enter a valid Kick channel handle. Do not enter a URL."] } };
  }
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (!withoutAt || withoutAt.length > 100) {
    return { error: "Enter a valid Kick channel handle.", fieldErrors: { handle: ["Enter a valid Kick channel handle."] } };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(withoutAt)) {
    return { error: "Enter a valid Kick channel handle.", fieldErrors: { handle: ["Enter a valid Kick channel handle."] } };
  }
  return { normalized: trimmed };
}

function mapKickError(kind: string): string {
  switch (kind) {
    case "auth":
      return "Kick authentication failed. Check the configured Client ID and Client Secret.";
    case "rate_limited":
      return "Kick rate limit reached. Please try again later.";
    case "not_found":
      return "Kick channel not found.";
    case "invalid_request":
      return "Enter a valid Kick channel handle.";
    default:
      return "Kick service temporarily unavailable. Please try again later.";
  }
}

export async function connectTwitchChannelAction(formData: FormData): Promise<ChannelActionResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const handleRaw = String(formData.get("handle") ?? "");

  if (!orgSlug) return { error: "Missing organization" };

  // Never accept organization_id from client
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
    const supabase = await createClient();

    // Validate handle server-side before any Twitch call
    const validation = validateHandle(handleRaw);
    if (validation.error) {
      if (validation.fieldErrors) return { error: validation.error, fieldErrors: validation.fieldErrors };
      return { error: validation.error };
    }
    const handle = validation.normalized!;

    // OAuth-only — customer Twitch credentials removed
    let twitchClient: TwitchClient | null = null;
    try {
      const { getValidAccessToken } = await import("@/server/credentials/token-service");
      const tok = await getValidAccessToken(supabase as never, ctx.organization.id, "twitch");
      if (tok.ok) {
        const cid = process.env.TWITCH_CLIENT_ID ?? "oauth";
        const sec = process.env.TWITCH_CLIENT_SECRET ?? "oauth";
        twitchClient = new TwitchClient({ clientId: cid, clientSecret: sec, userAccessToken: tok.accessToken });
      }
    } catch {
      // ignore
    }
    if (!twitchClient) {
      return {
        error: "Connect Twitch via OAuth first. Go to /dashboard/" + orgSlug + "/settings/integrations",
        fieldErrors: { handle: ["Connect Twitch via OAuth first."] },
      };
    }

    const client = twitchClient;
    const provider = new TwitchProvider(client);

    let ref: Awaited<ReturnType<TwitchProvider["resolveChannel"]>>;
    try {
      ref = await provider.resolveChannel(handle);
    } catch (e) {
      if (e instanceof TwitchApiError) {
        const msg = mapTwitchError(e.kind);
        console.warn(`[Twitch resolveChannel ${e.kind}]`, e.message);
        return { error: msg, fieldErrors: { handle: [msg] } };
      }
      console.error("[connectTwitchChannelAction] resolveChannel unexpected", e);
      return { error: "Something went wrong. Please try again." };
    }

    if (!ref) {
      return { error: "Twitch channel not found.", fieldErrors: { handle: ["Twitch channel not found."] } };
    }

    // Duplicate check — existing architecture makes this straightforward
    try {
      const existingChannels = await listConnectedChannels(supabase, ctx.organization.id);
      const duplicate = existingChannels.find(
        (c) => c.platform === "twitch" && c.external_channel_id === ref.externalChannelId,
      );
      if (duplicate) {
        return { error: "This Twitch channel is already connected to this organization." };
      }
      // Also check by handle in case ID not yet known (defensive)
      const duplicateHandle = existingChannels.find(
        (c) => c.platform === "twitch" && c.external_handle.toLowerCase() === ref.externalHandle.toLowerCase(),
      );
      if (duplicateHandle) {
        return { error: "This Twitch channel is already connected to this organization." };
      }
    } catch {
      // Ignore list error, proceed to try insert — DB constraint will handle
    }

    // Create — uses service layer which validates and checks organizationId
    try {
      const channel = await createConnectedChannel(supabase, ctx.organization.id, {
        platform: "twitch",
        external_channel_id: ref.externalChannelId,
        external_handle: ref.externalHandle,
        display_name: ref.displayName ?? null,
        canonical_url: ref.canonicalUrl,
        connection_mode: "discovered",
        connection_status: "connected",
      });
      revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
      revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
      return { success: true, channel };
    } catch (e) {
      // Handle duplicate DB constraint gracefully
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("org_platform_ext_unique") || msg.includes("connected_channels_org_platform_ext_unique")) {
        return { error: "This Twitch channel is already connected to this organization." };
      }
      if (e instanceof AppError) {
        console.warn(`[AppError ${e.code}]`, e.safeMessage);
        return { error: e.safeMessage };
      }
      console.error("[connectTwitchChannelAction] create unexpected", e);
      return { error: "Something went wrong. Please try again." };
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[connectTwitchChannelAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function disconnectTwitchChannelAction(formData: FormData): Promise<ChannelActionResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();

  if (!orgSlug) return { error: "Missing organization" };
  if (!channelId) return { error: "Missing channel" };

  // Never accept organization_id from client
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
    const supabase = await createClient();

    // Verify ownership and platform — getConnectedChannel checks organization_id
    let channel: Awaited<ReturnType<typeof getConnectedChannel>>;
    try {
      channel = await getConnectedChannel(supabase, ctx.organization.id, channelId);
    } catch (e) {
      if (e instanceof AppError) {
        console.warn(`[AppError ${e.code}]`, e.safeMessage);
        return { error: e.safeMessage };
      }
      throw e;
    }

    if (channel.platform !== "twitch") {
      return { error: "Only Twitch channels can be disconnected via this action." };
    }

    await deleteConnectedChannel(supabase, channel.id);
    revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
    revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[disconnectTwitchChannelAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function connectYouTubeChannelAction(formData: FormData): Promise<ChannelActionResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const handleRaw = String(formData.get("handle") ?? "");

  if (!orgSlug) return { error: "Missing organization" };

  try {
    const ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
    const supabase = await createClient();

    const validation = validateYouTubeHandle(handleRaw);
    if (validation.error) {
      if (validation.fieldErrors) return { error: validation.error, fieldErrors: validation.fieldErrors };
      return { error: validation.error };
    }
    const handle = validation.normalized!;

    // YouTube is OAuth-only — customer apiKey removed. Use OAuth token or platform fallback.
    let ytClient: YouTubeClient | null = null;
    try {
      const { getValidAccessToken } = await import("@/server/credentials/token-service");
      const tok = await getValidAccessToken(supabase as never, ctx.organization.id, "youtube");
      if (tok.ok) ytClient = new YouTubeClient({ accessToken: tok.accessToken });
    } catch {
      // ignore
    }
    if (!ytClient) {
      const { createYouTubeClient } = await import("@/server/integrations/youtube/client");
      ytClient = createYouTubeClient();
    }
    if (!ytClient) {
      return {
        error: "Connect YouTube via OAuth first. Go to /dashboard/" + orgSlug + "/settings/integrations",
        fieldErrors: { handle: ["Connect YouTube via OAuth first."] },
      };
    }

    const client = ytClient;
    const provider = new YouTubeProvider(client);

    let ref: Awaited<ReturnType<YouTubeProvider["resolveChannel"]>>;
    try {
      ref = await provider.resolveChannel(handle);
    } catch (e) {
      if (e instanceof YouTubeApiError) {
        const msg = mapYouTubeError(e.kind);
        console.warn(`[YouTube resolveChannel ${e.kind}]`, e.message);
        return { error: msg, fieldErrors: { handle: [msg] } };
      }
      console.error("[connectYouTubeChannelAction] resolveChannel unexpected", e);
      return { error: "Something went wrong. Please try again." };
    }

    if (!ref) {
      return { error: "YouTube channel not found.", fieldErrors: { handle: ["YouTube channel not found."] } };
    }

    try {
      const existingChannels = await listConnectedChannels(supabase, ctx.organization.id);
      const duplicate = existingChannels.find(
        (c) => c.platform === "youtube" && c.external_channel_id === ref.externalChannelId,
      );
      if (duplicate) {
        return { error: "This YouTube channel is already connected to this organization." };
      }
      const duplicateHandle = existingChannels.find(
        (c) => c.platform === "youtube" && c.external_handle.toLowerCase() === ref.externalHandle.toLowerCase(),
      );
      if (duplicateHandle) {
        return { error: "This YouTube channel is already connected to this organization." };
      }
    } catch {
      // Ignore, DB constraint will handle
    }

    try {
      const channel = await createConnectedChannel(supabase, ctx.organization.id, {
        platform: "youtube",
        external_channel_id: ref.externalChannelId,
        external_handle: ref.externalHandle,
        display_name: ref.displayName ?? null,
        canonical_url: ref.canonicalUrl,
        connection_mode: "discovered",
        connection_status: "connected",
      });
      revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
      revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
      return { success: true, channel };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("connected_channels_org_platform_ext_unique")) {
        return { error: "This YouTube channel is already connected to this organization." };
      }
      if (e instanceof AppError) {
        console.warn(`[AppError ${e.code}]`, e.safeMessage);
        return { error: e.safeMessage };
      }
      console.error("[connectYouTubeChannelAction] create unexpected", e);
      return { error: "Something went wrong. Please try again." };
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[connectYouTubeChannelAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function disconnectYouTubeChannelAction(formData: FormData): Promise<ChannelActionResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();

  if (!orgSlug) return { error: "Missing organization" };
  if (!channelId) return { error: "Missing channel" };

  try {
    const ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
    const supabase = await createClient();

    let channel: Awaited<ReturnType<typeof getConnectedChannel>>;
    try {
      channel = await getConnectedChannel(supabase, ctx.organization.id, channelId);
    } catch (e) {
      if (e instanceof AppError) {
        console.warn(`[AppError ${e.code}]`, e.safeMessage);
        return { error: e.safeMessage };
      }
      throw e;
    }

    if (channel.platform !== "youtube") {
      return { error: "Only YouTube channels can be disconnected via this action." };
    }

    await deleteConnectedChannel(supabase, channel.id);
    revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
    revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[disconnectYouTubeChannelAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function connectKickChannelAction(formData: FormData): Promise<ChannelActionResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const handleRaw = String(formData.get("handle") ?? "");

  if (!orgSlug) return { error: "Missing organization" };

  try {
    const ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
    const supabase = await createClient();

    const validation = validateKickHandle(handleRaw);
    if (validation.error) {
      if (validation.fieldErrors) return { error: validation.error, fieldErrors: validation.fieldErrors };
      return { error: validation.error };
    }
    const handle = validation.normalized!;

    // OAuth-only — customer Kick credentials removed
    let kickClient: KickClient | null = null;
    try {
      const { getValidAccessToken } = await import("@/server/credentials/token-service");
      const tok = await getValidAccessToken(supabase as never, ctx.organization.id, "kick");
      if (tok.ok) {
        const cid = process.env.KICK_CLIENT_ID ?? "oauth";
        const sec = process.env.KICK_CLIENT_SECRET ?? "oauth";
        kickClient = new KickClient({ clientId: cid, clientSecret: sec, userAccessToken: tok.accessToken });
      }
    } catch {
      // ignore
    }
    if (!kickClient) {
      return {
        error: "Connect Kick via OAuth first. Go to /dashboard/" + orgSlug + "/settings/integrations",
        fieldErrors: { handle: ["Connect Kick via OAuth first."] },
      };
    }

    const client = kickClient;
    const provider = new KickProvider(client);

    let ref: Awaited<ReturnType<KickProvider["resolveChannel"]>>;
    try {
      ref = await provider.resolveChannel(handle);
    } catch (e) {
      if (e instanceof KickApiError) {
        const msg = mapKickError(e.kind);
        console.warn(`[Kick resolveChannel ${e.kind}]`, e.message);
        return { error: msg, fieldErrors: { handle: [msg] } };
      }
      console.error("[connectKickChannelAction] resolveChannel unexpected", e);
      return { error: "Something went wrong. Please try again." };
    }

    if (!ref) {
      return { error: "Kick channel not found.", fieldErrors: { handle: ["Kick channel not found."] } };
    }

    try {
      const existingChannels = await listConnectedChannels(supabase, ctx.organization.id);
      const duplicate = existingChannels.find(
        (c) => c.platform === "kick" && c.external_channel_id === ref.externalChannelId,
      );
      if (duplicate) {
        return { error: "This Kick channel is already connected to this organization." };
      }
      const duplicateHandle = existingChannels.find(
        (c) => c.platform === "kick" && c.external_handle.toLowerCase() === ref.externalHandle.toLowerCase(),
      );
      if (duplicateHandle) {
        return { error: "This Kick channel is already connected to this organization." };
      }
    } catch {
      // Ignore list error, proceed to try insert — DB constraint will handle
    }

    try {
      const channel = await createConnectedChannel(supabase, ctx.organization.id, {
        platform: "kick",
        external_channel_id: ref.externalChannelId,
        external_handle: ref.externalHandle,
        display_name: ref.displayName ?? null,
        canonical_url: ref.canonicalUrl,
        connection_mode: "discovered",
        connection_status: "connected",
      });
      revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
      revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
      return { success: true, channel };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("connected_channels_org_platform_ext_unique")) {
        return { error: "This Kick channel is already connected to this organization." };
      }
      if (e instanceof AppError) {
        console.warn(`[AppError ${e.code}]`, e.safeMessage);
        return { error: e.safeMessage };
      }
      console.error("[connectKickChannelAction] create unexpected", e);
      return { error: "Something went wrong. Please try again." };
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[connectKickChannelAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function disconnectKickChannelAction(formData: FormData): Promise<ChannelActionResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();

  if (!orgSlug) return { error: "Missing organization" };
  if (!channelId) return { error: "Missing channel" };

  try {
    const ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
    const supabase = await createClient();

    let channel: Awaited<ReturnType<typeof getConnectedChannel>>;
    try {
      channel = await getConnectedChannel(supabase, ctx.organization.id, channelId);
    } catch (e) {
      if (e instanceof AppError) {
        console.warn(`[AppError ${e.code}]`, e.safeMessage);
        return { error: e.safeMessage };
      }
      throw e;
    }

    if (channel.platform !== "kick") {
      return { error: "Only Kick channels can be disconnected via this action." };
    }

    await deleteConnectedChannel(supabase, channel.id);
    revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
    revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[disconnectKickChannelAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}

// Provider-neutral disconnect — reuses same tenant checks, supports any platform
export async function disconnectChannelAction(formData: FormData): Promise<ChannelActionResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();
  if (!orgSlug) return { error: "Missing organization" };
  if (!channelId) return { error: "Missing channel" };
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
    const supabase = await createClient();
    let channel: Awaited<ReturnType<typeof getConnectedChannel>>;
    try {
      channel = await getConnectedChannel(supabase, ctx.organization.id, channelId);
    } catch (e) {
      if (e instanceof AppError) {
        console.warn(`[AppError ${e.code}]`, e.safeMessage);
        return { error: e.safeMessage };
      }
      throw e;
    }
    await deleteConnectedChannel(supabase, channel.id);
    revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
    revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[disconnectChannelAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}

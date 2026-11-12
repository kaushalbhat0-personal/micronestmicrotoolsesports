import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, notFoundError, validationError } from "@/lib/errors";
import * as channelRepo from "@/server/repositories/connected-channels";
import type { Platform } from "../types/platform";

export async function assertChannelUsable(
  supabase: SupabaseClient,
  organizationId: string,
  channelId: string,
  opts?: { platform?: Platform },
) {
  const ch = await channelRepo.findConnectedChannelById(supabase, channelId);
  if (!ch) throw notFoundError("Channel not found");
  if (ch.organization_id !== organizationId) throw forbiddenError("Cross-organization channel access denied");
  if (ch.connection_status !== "connected") throw validationError("Channel is not connected", { status: ch.connection_status });
  if (opts?.platform && ch.platform !== opts.platform) throw validationError(`Channel platform mismatch: expected ${opts.platform}, got ${ch.platform}`);
  return ch;
}

export async function assertOwnsChannelByExternalId(
  supabase: SupabaseClient,
  organizationId: string,
  platform: Platform,
  externalChannelId: string,
) {
  const { data, error } = await supabase
    .from("connected_channels")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("platform", platform)
    .eq("external_channel_id", externalChannelId)
    .maybeSingle();
  if (error || !data) throw notFoundError("Channel not found for organization");
  return data;
}

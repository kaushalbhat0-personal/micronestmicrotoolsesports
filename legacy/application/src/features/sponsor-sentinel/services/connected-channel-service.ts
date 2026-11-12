import type { SupabaseClient } from "@supabase/supabase-js";
import { validationError, forbiddenError, notFoundError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { z } from "zod";
import { isPlatform } from "../types/platform";
import * as repo from "@/server/repositories/connected-channels";

const createChannelSchema = z.object({
  platform: z.string().refine((v) => isPlatform(v), "invalid platform"),
  external_channel_id: z.string().min(1).max(200),
  external_handle: z.string().min(1).max(200),
  display_name: z.string().max(200).nullable().optional(),
  canonical_url: z.string().url().max(500),
  connection_mode: z.enum(["discovered", "authorized"]).optional(),
  connection_status: z.enum(["connected", "disconnected", "expired", "revoked"]).optional(),
  authorized_at: z.string().datetime().nullable().optional(),
  metadata: z.unknown().nullable().optional(),
});

export async function createConnectedChannel(
  supabase: SupabaseClient,
  organizationId: string,
  rawInput: unknown,
  opts?: { userId?: string },
) {
  const input = parseOrThrow(createChannelSchema, rawInput);

  // RLS will enforce organization membership, but we also ensure caller supplied organizationId
  // matches an organization they are member of — caller must have obtained it via requireOrganizationContext.
  if (!organizationId) throw validationError("organizationId required");

  // Free-tier quota: at most 1 connected channel total per free user (paid → no-op).
  // Only new `connected` rows consume the slot; non-connected rows never count.
  const status = input.connection_status ?? "connected";
  if (status === "connected" && opts?.userId) {
    const { assertFreeChannelConnectAllowed } = await import("@/server/services/sponsorship-limits");
    await assertFreeChannelConnectAllowed(supabase, { userId: opts.userId, organizationId });
  }

  return repo.createConnectedChannel(supabase, {
    organization_id: organizationId,
    platform: input.platform as "twitch" | "youtube" | "kick",
    external_channel_id: input.external_channel_id,
    external_handle: input.external_handle,
    display_name: input.display_name ?? null,
    canonical_url: input.canonical_url,
    connection_mode: input.connection_mode ?? "discovered",
    connection_status: input.connection_status ?? "connected",
    authorized_at: input.authorized_at ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function listConnectedChannels(
  supabase: SupabaseClient,
  organizationId: string,
) {
  if (!organizationId) throw forbiddenError("Missing organization");
  return repo.listConnectedChannelsByOrg(supabase, organizationId);
}

export async function getConnectedChannel(
  supabase: SupabaseClient,
  organizationId: string,
  channelId: string,
) {
  const row = await repo.findConnectedChannelById(supabase, channelId);
  if (!row) throw notFoundError("Channel not found");
  if (row.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  return row;
}

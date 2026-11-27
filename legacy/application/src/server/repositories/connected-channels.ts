import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectedChannel } from "@/types/database";

export type CreateConnectedChannelInput = {
  organization_id: string;
  platform: "twitch" | "youtube" | "kick";
  external_channel_id: string;
  external_handle: string;
  display_name?: string | null;
  canonical_url: string;
  connection_mode?: "discovered" | "authorized";
  connection_status?: "connected" | "disconnected" | "expired" | "revoked";
  authorized_at?: string | null;
  metadata?: unknown | null;
};

export async function createConnectedChannel(
  supabase: SupabaseClient,
  input: CreateConnectedChannelInput,
): Promise<ConnectedChannel> {
  const { data, error } = await supabase
    .from("connected_channels")
    .insert({
      organization_id: input.organization_id,
      platform: input.platform,
      external_channel_id: input.external_channel_id,
      external_handle: input.external_handle,
      display_name: input.display_name ?? null,
      canonical_url: input.canonical_url,
      connection_mode: input.connection_mode ?? "discovered",
      connection_status: input.connection_status ?? "connected",
      authorized_at: input.authorized_at ?? null,
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ConnectedChannel;
}

export async function findConnectedChannelById(
  supabase: SupabaseClient,
  id: string,
): Promise<ConnectedChannel | null> {
  const { data, error } = await supabase.from("connected_channels").select("*").eq("id", id).single();
  if (error) return null;
  return data as ConnectedChannel;
}

export async function listConnectedChannelsByOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ConnectedChannel[]> {
  const { data, error } = await supabase
    .from("connected_channels")
    .select("id, organization_id, platform, external_channel_id, external_handle, display_name, canonical_url, connection_status")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ConnectedChannel[];
}

export async function deleteConnectedChannel(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("connected_channels").delete().eq("id", id);
  if (error) throw error;
}

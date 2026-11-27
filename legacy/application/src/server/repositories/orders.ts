import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "@/types/database";

const ORDER_COLUMNS = "id, organization_id, plan_id, tool_id, is_all_access, buyer_user_id, amount_minor, currency, status, razorpay_order_id, provider, dodo_session_id, created_at, updated_at";

export async function listOrdersForOrg(supabase: SupabaseClient, organizationId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Order[]) ?? [];
}

export async function getOrderById(supabase: SupabaseClient, orderId: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  if (error) throw error;
  return (data as Order | null) ?? null;
}

export async function getOrderByRazorpayOrderId(supabase: SupabaseClient, razorpayOrderId: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select(ORDER_COLUMNS).eq("razorpay_order_id", razorpayOrderId).maybeSingle();
  if (error) throw error;
  return (data as Order | null) ?? null;
}

export async function getOrderByDodoSessionId(supabase: SupabaseClient, dodoSessionId: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select(ORDER_COLUMNS).eq("dodo_session_id", dodoSessionId).maybeSingle();
  if (error) throw error;
  return (data as Order | null) ?? null;
}

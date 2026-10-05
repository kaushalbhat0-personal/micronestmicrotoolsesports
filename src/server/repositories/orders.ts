import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "@/types/database";

export async function listOrdersForOrg(supabase: SupabaseClient, organizationId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Order[]) ?? [];
}

export async function getOrderById(supabase: SupabaseClient, orderId: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error) throw error;
  return (data as Order | null) ?? null;
}

export async function getOrderByRazorpayOrderId(supabase: SupabaseClient, razorpayOrderId: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select("*").eq("razorpay_order_id", razorpayOrderId).maybeSingle();
  if (error) throw error;
  return (data as Order | null) ?? null;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payment } from "@/types/database";

const PAYMENT_COLUMNS = "id, order_id, organization_id, razorpay_payment_id, razorpay_signature, amount_minor, currency, status, verified_at, created_at";

export async function listPaymentsForOrg(supabase: SupabaseClient, organizationId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Payment[]) ?? [];
}

export async function getPaymentById(supabase: SupabaseClient, paymentId: string): Promise<Payment | null> {
  const { data, error } = await supabase.from("payments").select(PAYMENT_COLUMNS).eq("id", paymentId).maybeSingle();
  if (error) throw error;
  return (data as Payment | null) ?? null;
}

export async function getPaymentByRazorpayPaymentId(
  supabase: SupabaseClient,
  razorpayPaymentId: string
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("razorpay_payment_id", razorpayPaymentId)
    .maybeSingle();
  if (error) throw error;
  return (data as Payment | null) ?? null;
}

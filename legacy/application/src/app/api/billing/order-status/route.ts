import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, validationError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationMember } from "@/lib/auth/require-membership";

const querySchema = z.object({
  orderId: z.string().uuid("orderId must be a valid UUID"),
});

/**
 * Member-scoped order status for the post-checkout return page.
 * Read-only: order status + current entitlement expiry. Provisioning
 * happens exclusively via the Dodo webhook — this endpoint never grants.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({ orderId: url.searchParams.get("orderId") ?? undefined });
    if (!parsed.success) throw validationError("Invalid order request", parsed.error.flatten());

    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, organization_id, plan_id, tool_id, is_all_access, status, provider")
      .eq("id", parsed.data.orderId)
      .maybeSingle();
    if (orderError || !order) throw validationError("Order not found");

    const ord = order as {
      id: string;
      organization_id: string;
      tool_id: string | null;
      is_all_access: boolean;
      status: string;
      provider: string | null;
    };

    // Tenant check: caller must belong to the order's organization
    await requireOrganizationMember(ord.organization_id);

    let expiresAt: string | null = null;
    if (ord.is_all_access) {
      const { data: ent } = await admin
        .from("tool_entitlements")
        .select("expires_at")
        .eq("organization_id", ord.organization_id)
        .eq("is_all_access", true)
        .maybeSingle();
      expiresAt = (ent as { expires_at: string | null } | null)?.expires_at ?? null;
    } else if (ord.tool_id) {
      const { data: ent } = await admin
        .from("tool_entitlements")
        .select("expires_at")
        .eq("organization_id", ord.organization_id)
        .eq("tool_id", ord.tool_id)
        .eq("is_all_access", false)
        .maybeSingle();
      expiresAt = (ent as { expires_at: string | null } | null)?.expires_at ?? null;
    }

    return NextResponse.json(
      { orderId: ord.id, status: ord.status, provider: ord.provider ?? "razorpay", expiresAt },
      { status: 200 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

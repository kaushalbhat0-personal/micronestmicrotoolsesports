import { redirect } from "next/navigation";
import type { Route } from "next";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";

// Legacy route — RCCF-UIUX-03 IA split: Creator Channels vs Connections.
// Keep auth/entitlement checks, then redirect to new Connections location.
export default async function IntegrationsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  redirect(`/dashboard/${orgSlug}/connections` as Route);
}

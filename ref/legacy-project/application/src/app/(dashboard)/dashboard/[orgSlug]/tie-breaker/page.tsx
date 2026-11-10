import Link from "next/link";
import type { Route } from "next";
import { Plus } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { getHistory } from "@/features/tie-breaker/services/history";
import { CompetitionList } from "@/features/tie-breaker/components/competition-list";
import { FirstUseGuide } from "@/features/tie-breaker/components/first-use-guide";
import { ClaimFreeTieBreakerCard } from "@/features/tie-breaker/components/claim-free-card";
import { FreePlanBadge } from "@/components/freemium/free-plan-badge";
import { FreeUsageLine } from "@/components/freemium/free-usage-line";
import {
  getTieBreakerFreeUsage,
  resolveTieBreakerAccessLevel,
} from "@/server/services/tie-breaker-policy";

export const metadata = {
  title: "Tie-Breaker — MicroNest",
  description: "Resolve tied standings using your chosen rules, explain every placement, and lock the official result.",
};

export default async function TieBreakerPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, "tie-breaker");
  } catch (e) {
    if (isEntitlementDenied(e)) {
      return (
        <div className="space-y-6">
          <AccessDenied orgSlug={orgSlug} />
          <ClaimFreeTieBreakerCard orgSlug={orgSlug} />
        </div>
      );
    }
    throw e;
  }
  const supabase = await createClient();
  const accessLevel = await resolveTieBreakerAccessLevel(supabase, { organizationId: ctx.organization.id }).catch(
    () => "paid" as const,
  );
  const history = await getHistory(supabase, ctx.organization.id, {}, accessLevel === "free" ? "free" : "paid").catch(() => ({
    competitions: [],
    total: 0,
  }));
  const usage =
    accessLevel === "free"
      ? await getTieBreakerFreeUsage(supabase, ctx.organization.id).catch(() => null)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tie-Breaker"
        description={`Official standings for tied competitions — ${ctx.organization.name}. Explained, locked, shareable.`}
        action={
          <Link
            href={`/dashboard/${orgSlug}/tie-breaker/new` as Route}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus className="h-4 w-4" aria-hidden /> New competition
          </Link>
        }
      />
      {accessLevel === "free" && (
        <div className="flex flex-wrap items-center gap-3" aria-label="Free plan usage">
          <FreePlanBadge />
          {usage && <FreeUsageLine used={usage.used} limit={usage.limit} label="free official records this month" />}
        </div>
      )}
      {history.competitions.length === 0 && <FirstUseGuide />}
      <section className="space-y-4">
        <SectionHeader
          title="Competitions"
          description="Drafts you can keep editing, and locked official records with their own record numbers."
        />
        <CompetitionList orgSlug={orgSlug} competitions={history.competitions} total={history.total} />
      </section>
    </div>
  );
}

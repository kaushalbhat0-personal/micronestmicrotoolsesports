import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import {
  getBillingToolSections,
} from "@/server/services/billing-service";
import { toCatalogTools } from "@/lib/workspace/catalog-tools";
import { PageHeader } from "@/components/ui/page-header";
import { ToolCatalogCard } from "@/components/workspace/tool-catalog-card";

export const metadata = {
  title: "All Tools — MicroNest",
  description: "Every released MicroNest tool for your workspace — open what you have, start the rest free.",
  robots: { index: false, follow: false },
};

/**
 * Workspace tool catalog (RCCF-FIRST-VALUE-FIX-03 F4). Discovery without
 * Billing: every released tool with its canonical Free status. Purchase
 * stays in Billing — this page links there but never sells.
 */
export default async function WorkspaceToolsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const user = await requireUser();
  const ctx = await requireOrganizationContext(orgSlug);
  const supabase = await createClient();
  const sections = await getBillingToolSections(supabase, ctx.organization.id, user.id);

  // Registry order (never a hardcoded subset, never removed tools).
  const tools = toCatalogTools(sections.yourTools, sections.availableToAdd);

  return (
    <div className="space-y-8">
      <PageHeader
        title="All Tools"
        description={`Everything MicroNest offers ${ctx.organization.name} — open what you have, start the rest free.`}
        action={
          <Link
            href={`/dashboard/${orgSlug}/settings/billing` as Route}
            className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Need higher limits? View Billing
          </Link>
        }
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCatalogCard key={tool.toolSlug} tool={tool} orgSlug={orgSlug} />
        ))}
      </div>
    </div>
  );
}

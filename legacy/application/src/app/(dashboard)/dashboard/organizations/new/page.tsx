import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-user";
import { createOrganizationForUser } from "@/server/services/organization-service";
import { provisionStarterFreeGrants } from "@/server/services/free-provisioning";
import { parseToolIntent, toolWorkspaceRoute } from "@/lib/workspace/tool-intent";
import { slugify } from "@/lib/utils/format";
import { getPlanContext } from "@/server/billing/plan-context";
import { CreateOrgForm } from "./create-org-form";

async function createOrgAction(planSlug: string | null, toolSlug: string | null, formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();

  const user = await requireUser();
  const supabase = await createClient();

  const rawSlug = slugInput ? slugInput : slugify(name);
  const result = await createOrganizationForUser(supabase, user.id, { name, slug: rawSlug });

  // Starter Free provisioning (RCCF F1): tools already available when the
  // workspace opens. Best-effort — never fails creation; anything skipped
  // stays claimable from the tool page or Billing fallback.
  try {
    const { skipped } = await provisionStarterFreeGrants(result.slug);
    if (skipped.length > 0) {
      console.warn(
        "[createOrgAction] starter Free provisioning skipped",
        skipped.map((s) => `${s.toolSlug}: ${s.reason}`).join("; ").slice(0, 500)
      );
    }
  } catch (e) {
    console.warn("[createOrgAction] starter Free provisioning failed", e instanceof Error ? e.message : String(e).slice(0, 200));
  }

  // Preserve a validated purchase plan so the buyer lands on Billing with it selected.
  let redirectPlan: string | null = null;
  if (planSlug) {
    const plan = await getPlanContext(supabase, planSlug);
    redirectPlan = plan?.slug ?? null;
  }
  // Tool intent (RCCF F6): re-validated server-side; purchase flow keeps
  // precedence, otherwise land straight in the intended tool.
  const validTool = parseToolIntent(toolSlug);
  if (redirectPlan) {
    redirect(`/dashboard/${result.slug}?plan=${redirectPlan}`);
  }
  if (validTool) {
    redirect(toolWorkspaceRoute(result.slug, validTool) as Route);
  }
  redirect(`/dashboard/${result.slug}`);
}

export default async function NewOrganizationPage({ searchParams }: { searchParams?: Promise<{ plan?: string; tool?: string }> }) {
  const supabase = await createClient();
  const sp = searchParams ? await searchParams : undefined;
  const plan = await getPlanContext(supabase, sp?.plan);
  const toolSlug = parseToolIntent(sp?.tool);
  return <CreateOrgForm action={createOrgAction.bind(null, plan?.slug ?? null, toolSlug)} planName={plan?.name ?? null} />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-user";
import { createOrganizationForUser } from "@/server/services/organization-service";
import { slugify } from "@/lib/utils/format";
import { getPlanContext } from "@/server/billing/plan-context";
import { CreateOrgForm } from "./create-org-form";

async function createOrgAction(planSlug: string | null, formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();

  const user = await requireUser();
  const supabase = await createClient();

  const rawSlug = slugInput ? slugInput : slugify(name);
  const result = await createOrganizationForUser(supabase, user.id, { name, slug: rawSlug });

  // Preserve a validated purchase plan so the buyer lands on Billing with it selected.
  let redirectPlan: string | null = null;
  if (planSlug) {
    const plan = await getPlanContext(supabase, planSlug);
    redirectPlan = plan?.slug ?? null;
  }
  redirect(redirectPlan ? `/dashboard/${result.slug}?plan=${redirectPlan}` : `/dashboard/${result.slug}`);
}

export default async function NewOrganizationPage({ searchParams }: { searchParams?: Promise<{ plan?: string }> }) {
  const supabase = await createClient();
  const sp = searchParams ? await searchParams : undefined;
  const plan = await getPlanContext(supabase, sp?.plan);
  return <CreateOrgForm action={createOrgAction.bind(null, plan?.slug ?? null)} planName={plan?.name ?? null} />;
}

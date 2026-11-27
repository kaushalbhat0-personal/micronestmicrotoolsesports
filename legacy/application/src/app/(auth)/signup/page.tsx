import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SignupForm } from "./signup-form";
import { getPlanContext } from "@/server/billing/plan-context";

export default async function SignupPage({ searchParams }: { searchParams?: Promise<{ plan?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sp = searchParams ? await searchParams : undefined;
  const plan = await getPlanContext(supabase, sp?.plan);

  if (user) redirect(plan ? `/dashboard?plan=${plan.slug}` : "/dashboard");

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-muted-foreground">
          {plan ? `Start with a free MicroNest account to continue` : "Start with a free MicroNest account"}
        </p>
      </div>
      <SignupForm plan={plan} />
    </div>
  );
}

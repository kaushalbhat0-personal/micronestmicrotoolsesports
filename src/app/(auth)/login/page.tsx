import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getPlanContext } from "@/server/billing/plan-context";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ plan?: string }> }) {
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
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your MicroNest account</p>
      </div>
      <LoginForm plan={plan} />
    </div>
  );
}

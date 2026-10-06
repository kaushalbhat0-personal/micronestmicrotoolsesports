import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Forgot password — MicroNest",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
        <p className="text-sm text-muted-foreground">Enter your email and we&apos;ll send a reset link</p>
      </div>
      <ForgotForm />
    </div>
  );
}

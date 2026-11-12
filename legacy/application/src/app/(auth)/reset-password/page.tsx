import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Reset password — MicroNest",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-sm text-muted-foreground">Set a new password</p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-destructive" role="alert">
              Your password reset link is invalid or has expired.
            </p>
            <p className="text-sm text-muted-foreground">Request a new reset link and try again.</p>
            <Link href={"/forgot-password" as unknown as string as import("next").Route} className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Request a new reset link
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose a strong password — at least 8 characters</p>
      </div>
      <ResetForm />
    </div>
  );
}

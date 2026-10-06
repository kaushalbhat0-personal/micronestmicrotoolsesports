"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestPasswordReset } from "@/lib/auth/password-actions";

export function ForgotForm() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFieldError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set("email", email);
    const result = await requestPasswordReset(fd);
    if (!result.ok) {
      setFieldError(result.fieldError ?? "Please check your email");
    } else {
      setSuccess(result.message);
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reset your password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-invalid={Boolean(fieldError)} />
            {fieldError && (
              <p className="text-sm text-destructive" role="alert">
                {fieldError}
              </p>
            )}
          </div>
          {success && (
            <p className="rounded-[12px] border border-success/20 bg-success-soft px-3 py-2 text-sm text-success" role="status" aria-live="polite">
              {success}
            </p>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            Send reset link
          </Button>
          <div className="text-center text-sm">
            <Link href="/login" className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
              Back to sign in
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

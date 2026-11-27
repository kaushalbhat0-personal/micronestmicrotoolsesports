import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a FRAGIX account to manage teams and profile settings.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <p className="text-accent-600 text-xs font-bold tracking-[0.18em] uppercase">
        Join the ecosystem
      </p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
        Sign up
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Create your FRAGIX account and continue straight into profile setup. You can share your
        identity immediately; BGMI ownership review is a separate step for the public registry.
        Sessions use secure cookies — no email confirmation step.
      </p>
      <div className="mt-6 border border-slate-200 bg-white p-4 sm:p-6">
        <Suspense fallback={<p className="text-sm text-slate-600">Loading sign-up form…</p>}>
          <SignupForm />
        </Suspense>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-accent-600 focus-visible:outline-accent-600 font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to FRAGIX to manage teams and profile settings.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Minimal auth surface for cookie-session flows (P14-D7, refined P14-D10).
export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <p className="text-accent-600 text-xs font-bold tracking-[0.18em] uppercase">Welcome back</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
        Sign in
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Use your FRAGIX account. Sessions are stored in secure cookies for server actions.
      </p>
      <div className="mt-6 border border-slate-200 bg-white p-4 sm:p-6">
        <Suspense fallback={<p className="text-sm text-slate-600">Loading sign-in form…</p>}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        New to FRAGIX?{" "}
        <Link
          href="/signup"
          className="text-accent-600 focus-visible:outline-accent-600 font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

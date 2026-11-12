import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to MicroNest Esports to manage teams and profile settings.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Minimal auth surface for cookie-session flows (P14-D7).
export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-3 text-sm text-slate-600">
        Use your MicroNest account. Sessions are stored in secure cookies for server actions.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <Suspense fallback={<p className="text-sm text-slate-600">Loading sign-in form…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

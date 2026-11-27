import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { getOwnOnboardingStatus } from "@/features/player-profile/server/resolve-onboarding";
import { createClient } from "@/lib/supabase/server";
import { ProfileOnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Complete your profile",
  description: "Create your FRAGIX player profile and first game identity.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfileOnboardingPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight uppercase">
          Complete your profile
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Sign in to create your player profile.
        </p>
        <p className="mt-4">
          <Link
            href={"/login?next=/onboarding/profile" as Route}
            className="text-accent-600 font-semibold underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    );
  }

  let status: Awaited<ReturnType<typeof getOwnOnboardingStatus>>;
  try {
    status = await getOwnOnboardingStatus(client);
  } catch {
    status = { status: "not_started", completeness: null, isVerified: false };
  }

  if (status.status === "complete") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight uppercase">
          Profile ready
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Your self-reported profile looks complete. This is not a verification badge — publish
          discoverability from settings when you choose.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/settings/profile"
            className="bg-accent-600 hover:bg-accent-700 inline-flex min-h-[44px] items-center px-4 text-sm font-bold tracking-wide text-white uppercase"
          >
            Open profile settings
          </Link>
          <Link
            href="/workspace/teams"
            className="inline-flex min-h-[44px] items-center border border-slate-300 px-4 text-sm font-bold tracking-wide uppercase"
          >
            Team workspace
          </Link>
        </div>
      </div>
    );
  }

  const defaultDisplayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-accent-600 text-xs font-bold tracking-[0.18em] uppercase">
        Onboarding
      </p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
        Complete your profile
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Status: <strong>{status.status.replaceAll("_", " ")}</strong>. Add your handle, country, and
        BGMI identity. Self-reported details are never marked verified.
      </p>
      <div className="mt-6 border border-slate-200 bg-white p-4 sm:p-6">
        <ProfileOnboardingForm defaultDisplayName={defaultDisplayName} />
      </div>
    </div>
  );
}

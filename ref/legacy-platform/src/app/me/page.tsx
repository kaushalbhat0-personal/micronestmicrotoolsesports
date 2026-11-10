import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  findFinderProfileByUserId,
  findGameProfileByUserAndGame,
} from "@/features/finder/repositories/finder";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "My Player Profile | MicroNest",
  description: "Create and manage your MicroNest Finder player profile.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [profile, gameProfile] = await Promise.all([
    findFinderProfileByUserId(supabase, user.id),
    findGameProfileByUserAndGame(supabase, user.id, "bgmi"),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <PageHeader
            title="My player profile"
            description="This is how teams find you. Levels are self-reported context, never MicroNest ratings."
          />
          <div className="mt-6">
            <ProfileForm
              initial={{
                handle: profile?.handle ?? "",
                display_name: profile?.display_name ?? "",
                region: profile?.region ?? "",
                languages: (profile?.languages ?? []).join(", "),
                timezone: profile?.timezone ?? "",
                current_level: profile?.current_level ?? "casual",
                target_level: profile?.target_level ?? "community",
                primary_role: profile?.primary_role ?? "Assaulter",
                secondary_roles: profile?.secondary_roles ?? [],
                availability: profile?.availability ?? [],
                looking_for: profile?.looking_for ?? true,
                open_to_tryout: profile?.open_to_tryout ?? false,
                bio: profile?.bio ?? "",
                allow_indexing: profile?.allow_indexing ?? false,
                ign: gameProfile?.ign ?? "",
                character_id: gameProfile?.character_id ?? "",
                verification_status: gameProfile?.verification_status ?? "unverified",
              }}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { findPublicPlayerByHandle } from "@/features/finder/repositories/finder";
import { VerificationBadge } from "@/features/finder/components/verification-badge";

/**
 * Public player profile — masked projection only.
 *
 * Privacy-first default: profiles are NOINDEX in Phase B while the
 * directory is young. Canonical URL is present for the future opt-in
 * indexing path (allow_indexing). No private data in metadata or JSON-LD.
 */

type Params = { params: Promise<{ handle: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const supabase = await createClient();
  const player = await findPublicPlayerByHandle(supabase, handle);
  if (!player) return {};
  return {
    title: `${player.display_name} (@${player.handle}) — BGMI Player | MicroNest`,
    description: `BGMI player ${player.display_name}: ${player.primary_role}, ${player.current_level} aiming for ${player.target_level}, ${player.region}. Self-reported competitive context.`,
    alternates: { canonical: `/players/${player.handle}` },
    robots: { index: false, follow: true },
    openGraph: {
      title: `${player.display_name} (@${player.handle})`,
      description: `BGMI ${player.primary_role} · ${player.current_level} → ${player.target_level}`,
      url: `/players/${player.handle}`,
      type: "profile",
    },
  };
}

export default async function PlayerProfilePage({ params }: Params) {
  const { handle } = await params;
  const supabase = await createClient();
  const player = await findPublicPlayerByHandle(supabase, handle);
  if (!player) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Find Players", href: "/find/players" },
              { label: `@${player.handle}` },
            ]}
          />
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-[30px] leading-tight tracking-[-0.02em] text-foreground">
                  {player.display_name}
                </h1>
                <p className="text-sm text-muted-foreground">@{player.handle}</p>
              </div>
              <VerificationBadge verified={player.bgmi_verified} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Competitive context</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Current level</dt><dd className="font-medium">{player.current_level} (self-reported)</dd></div>
                  <div><dt className="text-muted-foreground">Target level</dt><dd className="font-medium">{player.target_level} (self-reported)</dd></div>
                  <div><dt className="text-muted-foreground">Primary role</dt><dd className="font-medium">{player.primary_role}</dd></div>
                  <div><dt className="text-muted-foreground">Secondary roles</dt><dd className="font-medium">{player.secondary_roles.length > 0 ? player.secondary_roles.join(", ") : "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Region</dt><dd className="font-medium">{player.region}</dd></div>
                  <div><dt className="text-muted-foreground">Languages</dt><dd className="font-medium">{player.languages.length > 0 ? player.languages.join(", ") : "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Availability</dt><dd className="font-medium">{player.availability.length > 0 ? player.availability.join(", ") : "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Status</dt><dd className="font-medium">{[player.looking_for && "Looking for team", player.open_to_tryout && "Open to tryout"].filter(Boolean).join(" · ") || "Not currently looking"}</dd></div>
                </dl>
                {player.bio && <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed">{player.bio}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>BGMI identity</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p><span className="text-muted-foreground">IGN:</span> <span className="font-medium">{player.ign}</span></p>
                <p><span className="text-muted-foreground">Character ID:</span> <span className="font-medium">{player.character_id_masked}</span></p>
                {!player.bgmi_verified && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Unverified: this profile entered an IGN and Character ID, but MicroNest has not
                    verified account ownership. Verification means account-control evidence only —
                    never skill, rank, or tournament success.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Levels are self-reported, not MicroNest ratings</Badge>
              <Link href={"/find/players" as Route} className="text-sm text-primary underline">Back to Find Players</Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "/" },
          { name: "Find Players", item: "/find/players" },
          { name: `@${player.handle}`, item: `/players/${player.handle}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: player.display_name,
            identifier: player.handle,
            description: `BGMI ${player.primary_role} player (self-reported ${player.current_level}, targeting ${player.target_level}).`,
          }),
        }}
      />
    </div>
  );
}

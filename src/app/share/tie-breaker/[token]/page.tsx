import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { PublicResult } from "@/features/tie-breaker/components/public-result";
import { fetchCompletedTieBreakerShare, parseTieBreakerShareToken } from "@/features/tie-breaker/services/share";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientEnv } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Official Result — MicroNest",
  description: "Official locked competition result shared from MicroNest Tie-Breaker Resolver.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function InvalidCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 container-nest py-12">
        <Card className="mx-auto max-w-lg border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-warning" aria-hidden /> {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tools" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">
              Explore MicroNest tools
            </Link>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

export default async function ShareTieBreakerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let parsedToken: string;
  try {
    parsedToken = parseTieBreakerShareToken(token);
  } catch {
    return <InvalidCard title="Invalid share link" description="This link is malformed. Ask the organizer for the official share link." />;
  }

  let record = null;
  try {
    const admin = createAdminClient();
    record = await fetchCompletedTieBreakerShare(admin, parsedToken);
  } catch {
    record = null;
  }

  if (!record) {
    return (
      <InvalidCard
        title="Record not available"
        description="This record does not exist, is not finished yet, or the link is no longer valid. Only finished and locked results are publicly shared."
      />
    );
  }

  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL ?? "";
  const publicUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/share/tie-breaker/${parsedToken}` : "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="print:hidden">
        <Header />
      </div>
      <main className="flex-1 container-nest max-w-2xl py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MicroNest · Official Result</p>
        <div className="mt-3">
          <PublicResult record={record} publicUrl={publicUrl} />
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}

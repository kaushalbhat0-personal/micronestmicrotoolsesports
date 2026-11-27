import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { PublicPayoutPage } from "@/features/payout-tracker/components/public-payout-page";
import { fetchPublishedPayoutShare, parsePayoutShareToken } from "@/features/payout-tracker/services/share";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Prize Payouts — MicroNest",
  description: "Organizer-reported tournament prize payout status shared from MicroNest Prize Payout Tracker.",
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
            <Link href="/tools" className="inline-flex h-10 min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">
              Explore MicroNest tools
            </Link>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

export default async function SharePayoutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let parsedToken: string;
  try {
    parsedToken = parsePayoutShareToken(token);
  } catch {
    return <InvalidCard title="Invalid share link" description="This link is malformed. Ask the organizer for the current public payout link." />;
  }

  let record = null;
  try {
    const admin = createAdminClient();
    record = await fetchPublishedPayoutShare(admin, parsedToken);
  } catch {
    record = null;
  }

  if (!record) {
    return (
      <InvalidCard
        title="Payout record not available"
        description="This record does not exist, is not published yet, or the link was revoked. Only published payout trackers are publicly shared."
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="print:hidden">
        <Header />
      </div>
      <main className="flex-1 container-nest py-8 sm:py-12">
        <PublicPayoutPage record={record} />
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}

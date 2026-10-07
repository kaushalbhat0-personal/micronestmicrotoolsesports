import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "../print-button";
import { ShareCopyButton } from "../copy-button";
import { OrgLogo } from "@/features/draft-ban/components/org-logo";
import { fetchCompletedShareRecord, parseShareToken } from "@/features/draft-ban/services/share";
import { buildDraftCopyText } from "@/features/draft-ban/services/share-text";
import { createAdminClient } from "@/lib/supabase/admin";
import { AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Match Draft Record — MicroNest",
  description: "Official completed draft record shared from MicroNest Draft & Ban.",
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

export default async function ShareDraftBanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let parsedToken: string;
  try {
    parsedToken = parseShareToken(token);
  } catch {
    return <InvalidCard title="Invalid share link" description="This link is malformed. Ask the organizer for the official share link." />;
  }

  let record = null;
  try {
    const admin = createAdminClient();
    record = await fetchCompletedShareRecord(admin, parsedToken);
  } catch {
    record = null;
  }

  if (!record) {
    return (
      <InvalidCard
        title="Record not available"
        description="This record does not exist, is not finalized yet, or the link was revoked. Only completed draft records are publicly shared."
      />
    );
  }

  const remaining = record.pool.filter((p) => !record.actions.some((a) => a.item.toLowerCase() === p.toLowerCase()));

  // Official result text — same formatter as the internal record (public projection only, no notes).
  const copyText = buildDraftCopyText(
    {
      config: { teamA: record.team_a, teamB: record.team_b, pool: record.pool, sequence: record.sequence },
      actions: record.actions,
    },
    {
      organizationName: record.organization_name,
      refCode: record.ref_code,
      matchName: record.match_name,
      eventName: record.event_name,
      formatLabel: record.format_label,
      completedAt: new Date(record.completed_at).toLocaleString("en-GB"),
    },
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 container-nest py-12">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <OrgLogo name={record.organization_name} logoUrl={record.organization_logo_url} />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MicroNest · Match Draft Record</p>
                <CardTitle className="break-words">
                  {record.team_a} vs {record.team_b}
                </CardTitle>
              </div>
              <Badge variant="outline" className="ml-auto shrink-0 font-mono">
                {record.ref_code}
              </Badge>
            </div>
            <CardDescription>
              {record.organization_name}
              {record.event_name ? ` · ${record.event_name}` : ""}
              {record.format_label ? ` · ${record.format_label}` : ""} · Completed{" "}
              {new Date(record.completed_at).toLocaleString("en-GB")}
            </CardDescription>
            <p className="text-xs font-medium text-muted-foreground">Locked · Official record — this result cannot be changed.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-1.5 text-sm">
              {record.actions.map((a) => (
                <li key={a.stepIndex} className="flex flex-wrap items-center gap-x-2 rounded-[8px] bg-surface-muted/60 px-3 py-2">
                  <span className="text-muted-foreground">{a.stepIndex + 1}.</span>
                  <span className="font-medium">{a.team === "A" ? record.team_a : record.team_b}</span>
                  <Badge variant={a.type === "ban" ? "destructive" : "success"}>{a.type === "ban" ? "Ban" : "Pick"}</Badge>
                  <span className="font-medium">{a.item}</span>
                </li>
              ))}
            </ol>
            {remaining.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Remaining pool: {remaining.join(", ")}{remaining.length === 1 ? ` · Decider: ${remaining[0]}` : ""}
              </p>
            )}
            <div className="flex flex-col gap-2 print:hidden sm:flex-row">
              <ShareCopyButton text={copyText} />
              <PrintButton />
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
      <style>{`@media print { header, footer, nav, aside { display: none !important; } @page { margin: 12mm; size: A4; } }`}</style>
    </div>
  );
}

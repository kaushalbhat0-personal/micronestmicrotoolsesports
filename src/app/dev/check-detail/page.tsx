import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScanStatusBadge } from "@/features/sponsor-sentinel/components/scan-status-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { ContentProofSections } from "@/features/sponsor-sentinel/components/content-proof-sections";
import { formatDateTimeKolkata } from "@/lib/utils/format";

const mockOrgs = [{ id: "1", name: "TAG Esports", slug: "tag-esports" }];

const mockEvidence = [
  { id: "ev-1", organization_id: "org-1", campaign_id: "camp-a", deliverable_id: "d1", scan_id: "scan-1", platform: "youtube", external_channel_id: "UC1", external_content_id: "dQw4w9WgXcQ", evidence_type: "video", source: "youtube_videos_list", source_id: "vid1", source_url: "https://youtube.com/watch?v=dQw4w9WgXcQ", observed_value: "#spirituality #bhagavadgita — Sponsored Yoga Stream", normalized_value: "#spirituality #bhagavadgita", observed_at: new Date().toISOString(), scanner_version: "v1", created_at: new Date().toISOString() },
  { id: "ev-2", organization_id: "org-1", campaign_id: "camp-a", deliverable_id: "d2", scan_id: "scan-1", platform: "youtube", external_channel_id: "UC1", external_content_id: "dQw4w9WgXcQ", evidence_type: "video", source: "youtube_videos_list", source_id: "vid1", source_url: "https://youtube.com/watch?v=dQw4w9WgXcQ", observed_value: "#spirituality #bhagavadgita — Sponsored Yoga Stream", normalized_value: "#spirituality #bhagavadgita", observed_at: new Date().toISOString(), scanner_version: "v1", created_at: new Date().toISOString() },
  { id: "ev-3", organization_id: "org-1", campaign_id: "camp-a", deliverable_id: "d3", scan_id: "scan-1", platform: "twitch", external_channel_id: "chan1", external_content_id: "v123", evidence_type: "video", source: "get_videos", source_id: "v123", source_url: "https://twitch.tv/videos/v123", observed_value: "SponsorCup Qualifiers Live", normalized_value: "sponsorcup", observed_at: new Date().toISOString(), scanner_version: "v1", created_at: new Date().toISOString() },
] as never;

const mockEvals = [
  { id: "eval-1", organization_id: "org-1", evidence_id: "ev-1", deliverable_id: "d1", result: "PASS", reason: "Matched #spirituality in 1 video", evaluated_at: new Date().toISOString(), evaluator_version: "1", scan_id: "scan-1", created_at: new Date().toISOString() },
  { id: "eval-2", organization_id: "org-1", evidence_id: "ev-2", deliverable_id: "d2", result: "PASS", reason: "Matched #bhagavadgita in 1 video", evaluated_at: new Date().toISOString(), evaluator_version: "1", scan_id: "scan-1", created_at: new Date().toISOString() },
  { id: "eval-3", organization_id: "org-1", evidence_id: "ev-3", deliverable_id: "d3", result: "FAIL", reason: "No eligible content matched #yoga", evaluated_at: new Date().toISOString(), evaluator_version: "1", scan_id: "scan-1", created_at: new Date().toISOString() },
] as never;

const deliverableMap = new Map<string, { name: string; rule: unknown }>([
  ["d1", { name: "#spirituality", rule: {} }],
  ["d2", { name: "#bhagavadgita", rule: {} }],
  ["d3", { name: "#yoga", rule: {} }],
  ["d4", { name: "#krishnawisdom", rule: {} }],
]);

export default function CheckDetailPreview() {
  const scan = { id: "scan-1", platform: "youtube", status: "success", started_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), completed_at: new Date().toISOString(), scanner_version: "v1", error_code: null, error_message: null, campaign_id: "camp-a", organization_id: "org-1", created_at: new Date().toISOString() } as unknown as import("@/types/database").Scan;
  return (
    <DashboardShell organizations={mockOrgs}>
      <div className="space-y-8">
        <PageHeader title="Spring Sponsor 2026" description="youtube · success · 3 proof · 3 results" />
        <Card variant="default" className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">Check <ScanStatusBadge status={scan.status} /> <Badge variant="platform-youtube" className="capitalize text-[11px]">youtube</Badge> <span className="text-xs font-normal text-muted-foreground ml-auto">{formatDateTimeKolkata(scan.started_at)} → {formatDateTimeKolkata(scan.completed_at)}</span></CardTitle>
            <CardDescription>Campaign Spring Sponsor 2026 • 3 proof items • 3 results • PASS:2 FAIL:1</CardDescription>
          </CardHeader>
        </Card>
        <section className="space-y-3">
          <SectionHeader title="Requirement Results" description="Each requirement evaluated against all eligible content (content × requirements)." />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "d1", name: "#spirituality", result: "PASS", reason: "Matched #spirituality in 1 video", proof: 1 },
              { id: "d2", name: "#bhagavadgita", result: "PASS", reason: "Matched #bhagavadgita in 1 video", proof: 1 },
              { id: "d3", name: "#yoga", result: "FAIL", reason: "No eligible content matched #yoga", proof: 0 },
              { id: "d4", name: "#krishnawisdom", result: "NOT_VERIFIABLE", reason: "Content discovered but could not be evaluated", proof: 0 },
            ].map((r) => (
              <div key={r.id} className="rounded-[16px] border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{r.name}</p>
                  <StatusBadge status={r.result} />
                </div>
                <p className="text-xs text-muted-foreground">{r.reason}</p>
                <div className="flex items-center gap-2 pt-1"><span className="text-xs rounded-full bg-surface-muted px-2.5 py-1 text-muted-foreground">Proof: {r.proof}</span></div>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <SectionHeader title="Proof — 3 items" description="Many-to-many · One content appears once with all requirements it satisfies. Thumbnails from stored content ID." />
          <ContentProofSections evidence={mockEvidence} evaluations={mockEvals} deliverableMap={deliverableMap} />
        </section>
      </div>
    </DashboardShell>
  );
}

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ScanHistoryTable } from "@/features/sponsor-sentinel/components/scan-history-table";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHeader } from "@/components/ui/page-header";

const mockOrgs = [{ id: "1", name: "TAG Esports", slug: "tag-esports" }];

const mockScans = [
  {
    scan: { id: "scan-1", organization_id: "org-1", campaign_id: "camp-a", platform: "youtube", status: "success", started_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), completed_at: new Date().toISOString(), scanner_version: "v1", error_code: null, error_message: null, created_at: new Date().toISOString() },
    campaignName: "Spring Sponsor 2026",
    evidenceCount: 3,
    evaluationSummary: { PASS: 2, FAIL: 1 },
  },
  {
    scan: { id: "scan-2", organization_id: "org-1", campaign_id: "camp-b", platform: "twitch", status: "partial", started_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), completed_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), scanner_version: "v1", error_code: null, error_message: null, created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
    campaignName: "Summer Cup",
    evidenceCount: 1,
    evaluationSummary: { PASS: 1 },
  },
  {
    scan: { id: "scan-3", organization_id: "org-1", campaign_id: "camp-a", platform: "kick", status: "failed", started_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), completed_at: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(), scanner_version: "v1", error_code: "api_error", error_message: "test", created_at: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString() },
    campaignName: "Spring Sponsor 2026",
    evidenceCount: 0,
    evaluationSummary: {},
  },
] as never;

export default function ChecksPreview() {
  return (
    <DashboardShell organizations={mockOrgs}>
      <div className="space-y-8">
        <PageHeader title="Check History" description="Recent checks across your sponsorship campaigns — TAG Esports. Each check evaluates all requirements against discovered content." />
        <SectionHeader title="Recent checks" description="3 of 3 · Times in Asia/Kolkata" />
        <Card>
          <CardContent className="pt-6">
            <ScanHistoryTable items={mockScans} orgSlug="tag-esports" />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

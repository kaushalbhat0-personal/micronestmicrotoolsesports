import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState, Skeleton } from "@/components/ui/loading-state";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer } from "@/components/ui/page-container";
import {
  ShieldCheck,
  SearchCheck,
  Play,
  ExternalLink,
  Sparkles,
  Clock3,
  LoaderCircle,
  TriangleAlert,
  Building2,
  LayoutDashboard,
} from "lucide-react";

export default function DesignSystemShowcase() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-[80rem] items-center justify-between px-5 md:px-6 lg:px-8">
          <span className="font-display text-[18px] tracking-[-0.015em]">MicroNest — Design System</span>
          <span className="text-xs text-muted-foreground">RCCF-UIUX-02 · Light only · Quiet proof room</span>
        </div>
      </header>

      <PageContainer className="space-y-12">
        <PageHeader
          title="The quiet proof room"
          description="Warm cream canvas · White elevated · Terracotta accent · Charcoal ink · Editorial display · Restrained surfaces."
        />

        {/* Typography */}
        <section className="space-y-4">
          <SectionHeader title="Typography" description="Display serif + UI sans + Mono. Three clear levels." />
          <Card variant="default">
            <CardContent className="space-y-6 pt-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Page Title — Display 30/32</p>
                <h1 className="font-display text-[30px] leading-tight tracking-[-0.02em] sm:text-[32px]">Spring Sponsor 2026 — Tracking</h1>
                <p className="text-sm text-muted-foreground">H1 uses Instrument Serif, tight, charcoal. Not bold system font.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Section — 20</p>
                <h2 className="font-display text-[20px] tracking-[-0.015em]">Sponsorship campaigns</h2>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Card — 15 / Body 14 / Meta 12 / Numeric 28</p>
                <h3 className="text-[15px] font-semibold tracking-[-0.01em]">Campaign card title</h3>
                <p className="text-sm leading-relaxed">Body 14px relaxed — the quiet proof room is premium, warm and confident without neon.</p>
                <p className="text-xs text-muted-foreground">Metadata 12px · 12 Mar 2026 · Asia/Kolkata</p>
                <p className="text-[28px] font-bold tracking-[-0.02em] tabular-nums">1,248</p>
                <p className="font-mono text-xs">mono: scan_id 7f3a — exactOptionalPropertyTypes</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Colors */}
        <section className="space-y-4">
          <SectionHeader title="Color — Tokens" description="WCAG AA verified. Warm cream page, charcoal ink, single terracotta accent." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[12px] border bg-background p-4">
              <div className="h-10 rounded-[8px] border" style={{ background: "hsl(40 33% 97%)" }} />
              <p className="mt-2 text-xs font-medium">background — cream canvas</p>
              <p className="font-mono text-[10px] text-muted-foreground">40 33% 97%</p>
            </div>
            <div className="rounded-[12px] border bg-card p-4">
              <div className="h-10 rounded-[8px] bg-card border" />
              <p className="mt-2 text-xs font-medium">surface — white elevated</p>
              <p className="font-mono text-[10px] text-muted-foreground">0 0% 100%</p>
            </div>
            <div className="rounded-[12px] border bg-surface-muted p-4">
              <div className="h-10 rounded-[8px]" style={{ background: "hsl(40 20% 96%)" }} />
              <p className="mt-2 text-xs font-medium">surface-muted — warm stone</p>
              <p className="font-mono text-[10px] text-muted-foreground">40 20% 96%</p>
            </div>
            <div className="rounded-[12px] border bg-card p-4">
              <div className="h-10 rounded-full" style={{ background: "hsl(24 85% 52%)" }} />
              <p className="mt-2 text-xs font-medium">primary — terracotta</p>
              <p className="font-mono text-[10px] text-muted-foreground">24 85% 52%</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[12px] border bg-card p-4">
              <p className="text-xs font-semibold mb-2">Feedback</p>
              <div className="flex gap-2">
                <span className="h-8 w-8 rounded-full" style={{ background: "hsl(158 35% 38%)" }} />
                <span className="h-8 w-8 rounded-full" style={{ background: "hsl(36 80% 50%)" }} />
                <span className="h-8 w-8 rounded-full" style={{ background: "hsl(8 75% 56%)" }} />
                <span className="h-8 w-8 rounded-full" style={{ background: "hsl(210 30% 45%)" }} />
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">success teal / warning amber / destructive warm-red / info slate</p>
            </div>
            <div className="rounded-[12px] border bg-card p-4">
              <p className="text-xs font-semibold mb-2">Platform — muted, not product primary</p>
              <div className="flex gap-2">
                <span className="h-8 w-8 rounded-full" style={{ background: "hsl(0 72% 51%)" }} />
                <span className="h-8 w-8 rounded-full" style={{ background: "hsl(264 35% 48%)" }} />
                <span className="h-8 w-8 rounded-full" style={{ background: "hsl(142 40% 42%)" }} />
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">YouTube · Twitch · Kick</p>
            </div>
            <div className="rounded-[12px] border bg-surface-muted p-4">
              <p className="text-xs font-semibold mb-2">Border / Ring</p>
              <div className="flex gap-2">
                <span className="h-8 w-8 rounded-full border-2" style={{ borderColor: "hsl(40 12% 88%)", background: "white" }} />
                <span className="h-8 w-8 rounded-full" style={{ background: "hsl(24 85% 52%)" }} />
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">border 88% / ring terracotta</p>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-4">
          <SectionHeader title="Buttons" description="Terracotta primary 44px rounded-full. Secondary warm, outline restrained, destructive warm-red." />
          <Card>
            <CardContent className="flex flex-wrap gap-3 pt-6">
              <Button>Primary — Check now</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline — Back</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
              <Button disabled>Disabled</Button>
              <Button loading>Loading</Button>
            </CardContent>
            <CardContent className="flex flex-wrap gap-3 pt-0">
              <Button size="sm">Small 36px</Button>
              <Button size="lg">Large 48px</Button>
              <Button size="icon" aria-label="Icon">
                <SearchCheck className="h-4 w-4" />
              </Button>
              <Button>
                <Play className="h-4 w-4" /> Start tracking
              </Button>
              <Button variant="outline">
                <ExternalLink className="h-4 w-4" /> View source
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Inputs */}
        <section className="space-y-4">
          <SectionHeader title="Inputs & Select" description="Warm border 12px, hover strong, focus terracotta ring, 44px." />
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="demo-name">Campaign name</Label>
                <Input id="demo-name" placeholder="Spring Sponsor 2026" defaultValue="Spring Sponsor 2026" />
                <p className="text-xs text-muted-foreground">Help text 12px muted — 2–120 chars</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-invalid">Invalid state</Label>
                <Input id="demo-invalid" placeholder="Error" defaultValue="Bad input" aria-invalid={true} />
                <p className="text-xs text-destructive">This field is required.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-disabled">Disabled</Label>
                <Input id="demo-disabled" placeholder="Disabled" disabled value="Disabled" />
              </div>
              <div className="space-y-2">
                <Label>Select — Platform</Label>
                <Select defaultValue="twitch">
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Platform</SelectLabel>
                      <SelectItem value="twitch">Twitch</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="kick">Kick</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="demo-textarea">Textarea (native, will inherit card border)</Label>
                <textarea
                  id="demo-textarea"
                  rows={2}
                  placeholder="Describe the sponsor deliverables"
                  className="flex min-h-[80px] w-full rounded-[12px] border border-input bg-card px-3.5 py-2 text-sm placeholder:text-foreground-faint hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue="Sponsor requires #OurBrand in title for 2h stream."
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Cards */}
        <section className="space-y-4">
          <SectionHeader title="Cards — Variants" description="No more Card Card Card walls. Use variant to signal hierarchy." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Default</CardTitle>
                <CardDescription>Surface + restrained warm border.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Most content cards.</p>
              </CardContent>
            </Card>
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Elevated</CardTitle>
                <CardDescription>Border + shadow-sm — proof hero candidate.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Hero proof, elevated metric.</p>
              </CardContent>
            </Card>
            <Card variant="muted">
              <CardHeader>
                <CardTitle>Muted</CardTitle>
                <CardDescription>Warm stone — secondary / empty.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Table header, muted row.</p>
              </CardContent>
            </Card>
            <Card variant="ghost">
              <CardHeader>
                <CardTitle>Ghost</CardTitle>
                <CardDescription>No border — quiet sections.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Divider-only group.</p>
              </CardContent>
            </Card>
            <Card variant="hero">
              <CardHeader>
                <CardTitle>Hero 20px + shadow-sm</CardTitle>
                <CardDescription>Proof gallery hero, dialog feel.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Large radius, subtle elevation.</p>
              </CardContent>
            </Card>
            <Card variant="default" className="flex items-center justify-center p-6 text-center">
              <span className="text-sm text-muted-foreground">Shape: 16px cards · 20px hero · 12px inputs · pill badges/buttons</span>
            </Card>
          </div>
        </section>

        {/* Badges & Status */}
        <section className="space-y-4">
          <SectionHeader title="Badges & Status — Lucide, not unicode" description="Pill 12px, semantic variants, icon + label, platform muted." />
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap gap-2">
                <Badge>Default terracotta</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="success">Success teal</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="platform-youtube">YouTube</Badge>
                <Badge variant="platform-twitch">Twitch</Badge>
                <Badge variant="platform-kick">Kick</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="active" />
                <StatusBadge status="draft" />
                <StatusBadge status="PASS" />
                <StatusBadge status="FAIL" />
                <StatusBadge status="NOT_VERIFIABLE" />
                <StatusBadge status="PENDING" />
                <StatusBadge status="NOT_SUPPORTED" />
                <StatusBadge status="pending" />
                <StatusBadge status="running" />
                <StatusBadge status="success" />
                <StatusBadge status="partial" />
                <StatusBadge status="failed" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Icons */}
        <section className="space-y-4">
          <SectionHeader title="Icons — Lucide 16px / 1.75" description="One per button, one per header max. No emoji walls." />
          <Card>
            <CardContent className="flex flex-wrap gap-3 pt-6">
              <span className="inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm">
                <LayoutDashboard className="h-4 w-4" /> Overview
              </span>
              <span className="inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm">
                <ShieldCheck className="h-4 w-4" /> Campaigns
              </span>
              <span className="inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm">
                <SearchCheck className="h-4 w-4" /> Check now
              </span>
              <span className="inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm">
                <Play className="h-4 w-4" /> Start tracking
              </span>
              <span className="inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm">
                <ExternalLink className="h-4 w-4" /> View source
              </span>
              <span className="inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm">
                <Sparkles className="h-4 w-4" /> Proof
              </span>
              <span className="inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm">
                <Building2 className="h-4 w-4" /> Organizations
              </span>
              <span className="inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm">
                <Clock3 className="h-4 w-4" /> Pending
              </span>
              <span className="inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Running
              </span>
              <span className="inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm">
                <TriangleAlert className="h-4 w-4" /> Needs review
              </span>
            </CardContent>
          </Card>
        </section>

        {/* Table */}
        <section className="space-y-4">
          <SectionHeader title="Table — Warm" description="Rounded 16px border, muted header 12px semibold, hover muted/50." />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Check</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Proof</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs underline">View check</TableCell>
                <TableCell>Spring Sponsor 2026</TableCell>
                <TableCell>
                  <Badge variant="platform-youtube">YouTube</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status="success" />
                </TableCell>
                <TableCell className="font-medium">3</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs underline">View check</TableCell>
                <TableCell>Summer Cup</TableCell>
                <TableCell>
                  <Badge variant="platform-twitch">Twitch</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status="partial" />
                </TableCell>
                <TableCell className="font-medium">1</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        {/* Surfaces + PageContainer */}
        <section className="space-y-4">
          <SectionHeader title="Surfaces & Shadows" description="Most cards border-only, hero elevated shadow-sm, dialog shadow-lg. No heavy shadows." />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[16px] border bg-card p-4">
              <p className="text-xs font-semibold">Border only</p>
              <p className="text-xs text-muted-foreground">Default card — no shadow, warm border.</p>
            </div>
            <div className="rounded-[16px] border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold">Shadow-sm</p>
              <p className="text-xs text-muted-foreground">Elevated / hero — 1px/2px warm.</p>
            </div>
            <div className="rounded-[20px] border bg-card p-4 shadow-lg">
              <p className="text-xs font-semibold">Shadow-lg</p>
              <p className="text-xs text-muted-foreground">Dialog — 12px/24px warm.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            PageContainer: max-w 80rem, px-5 → 6 → 8, py-6 → 8 → 10. Warm cream page, not stretched on xl.
          </p>
        </section>

        {/* Empty / Loading */}
        <section className="space-y-4">
          <SectionHeader title="Empty & Loading" description="Dashed warm stone, display title, card icon. No emoji." />
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="No sponsorship campaigns yet"
            description="Create your first campaign to track what a creator needs to deliver for a brand."
            action={<Button>Create campaign</Button>}
            secondaryAction={<Button variant="outline">Connect channel</Button>}
          />
          <Card>
            <CardContent className="pt-6 space-y-4">
              <LoadingState message="Checking creator channel…" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Motion */}
        <section className="space-y-4">
          <SectionHeader title="Motion — Purposeful" description="Micro 180ms, nav 220ms, reveal 260ms, hero 360ms. Respects prefers-reduced-motion." />
          <Card variant="muted">
            <CardContent className="pt-6 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full bg-card border px-3 py-1.5">Button hover 180ms</span>
              <span className="rounded-full bg-card border px-3 py-1.5">Nav indicator 220ms</span>
              <span className="rounded-full bg-card border px-3 py-1.5">Proof stagger 60ms + 400ms</span>
              <span className="rounded-full bg-card border px-3 py-1.5">PASS spring 280ms</span>
              <span className="rounded-full bg-card border px-3 py-1.5">Reduced-motion → fade only</span>
            </CardContent>
          </Card>
        </section>

        <div className="border-t border-border pt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          Not in main navigation — internal showcase only. Delete before UIUX-03 if desired. Verify on desktop 1440 / tablet 768 / mobile 390.
        </div>
      </PageContainer>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Crosshair } from "lucide-react";
import { decodeShareState } from "@/features/bgmi-qualification/services/share";
import { getPresetById } from "@/features/bgmi-qualification/services/presets";
import { compareToTarget, pointsGap, projectedTotal, scenarioPoints } from "@/features/bgmi-qualification/services/scoring";
import { gapMessage, scenarioMessage, verdictLabel } from "@/features/bgmi-qualification/services/copy";
import { formatPoints } from "@/features/bgmi-qualification/services/format";

export const metadata: Metadata = {
  title: "Shared BGMI Qualification Check — MicroNest",
  description: "A shared BGMI qualification scenario from the MicroNest Qualification Simulator.",
  robots: { index: false, follow: false },
};

function InvalidCard({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 container-nest py-12">
        <Card className="mx-auto max-w-lg border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive" aria-hidden /> Invalid share link
            </CardTitle>
            <CardDescription>{reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={"/bgmi-qualification" as Route}
              className="inline-flex min-h-[44px] h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
            >
              Create your own check
            </Link>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

export default async function ShareBgmiQualificationPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  if (!s) return <InvalidCard reason="This link is missing the shared check. Generate a new link from the Qualification Simulator." />;
  if (s.length > 4000) return <InvalidCard reason="This share link is too large." />;

  const decoded = decodeShareState(s);
  if (!decoded.ok || !decoded.state) {
    const reason =
      decoded.error === "version"
        ? "This share link uses an unsupported version. Please generate a new link."
        : "This share link is malformed or has been tampered with.";
    return <InvalidCard reason={reason} />;
  }

  const st = decoded.state;
  const preset = getPresetById(st.preset);
  const need = pointsGap(st.current, st.target);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 container-nest py-8 sm:py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-2 text-center">
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">MicroNest — BGMI Qualification Check</p>
            <h1 className="font-display text-2xl font-normal tracking-tight">Shared qualification scenario</h1>
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              Current {st.current} pts · Target {st.target} pts · {st.matches} matches left · {preset.label}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">The gap</CardTitle>
              <CardDescription>{gapMessage(need, st.matches)}</CardDescription>
            </CardHeader>
          </Card>

          {st.scenarios.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Crosshair className="h-4 w-4 text-primary" aria-hidden /> What-if scenarios
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/60">
                  {st.scenarios.map((sc, i) => {
                    const pts = scenarioPoints(preset, sc.placement, sc.finishes);
                    if (!pts) return null;
                    const projected = projectedTotal(st.current, pts.total);
                    const verdict = compareToTarget(projected, st.target);
                    return (
                      <li key={`${sc.placement}-${sc.finishes}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                        <p className="text-sm leading-relaxed">
                          <span className="font-medium">
                            {sc.placement}
                            {sc.placement === 1 ? "st" : sc.placement === 2 ? "nd" : sc.placement === 3 ? "rd" : "th"} +{" "}
                            {sc.finishes} finishes
                          </span>{" "}
                          <span className="text-muted-foreground tabular-nums">+{pts.total} → {projected}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {scenarioMessage(sc.placement, sc.finishes, pts.total, projected, st.target, verdict)}
                          </span>
                        </p>
                        <Badge variant={verdict === "above" ? "success" : verdict === "exact" ? "warning" : "secondary"} className="shrink-0">
                          {verdict === "above" ? <Check className="h-3 w-3" aria-hidden /> : null}
                          {verdictLabel(verdict)}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {st.averageRate !== null ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Average rate</CardTitle>
                <CardDescription>
                  Averaging {formatPoints(st.averageRate)} pts per match lands at{" "}
                  <span className="font-semibold tabular-nums">{formatPoints(st.current + st.averageRate * st.matches)}</span> —{" "}
                  {verdictLabel(compareToTarget(st.current + st.averageRate * st.matches, st.target)).toLowerCase()}.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            Targets move as rivals score. Final position depends on other results and tiebreaks.
          </p>

          <div className="flex justify-center">
            <Link
              href={"/bgmi-qualification" as Route}
              className="inline-flex min-h-[44px] h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
            >
              Create your own check
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { QualificationCalculator } from "@/features/bgmi-qualification/components/qualification-calculator";
import { isValidPoints } from "@/features/bgmi-qualification/services/scoring";

export const metadata: Metadata = {
  title: "BGMI Qualification Calculator — Know What Your Team Needs to Qualify | MicroNest",
  description:
    "Free BGMI qualification calculator: enter current points, target and matches left, then test what-if placement and finish scenarios. No signup.",
  alternates: { canonical: "/bgmi-qualification" },
  openGraph: {
    title: "BGMI Qualification Calculator — Know What Your Team Needs to Qualify",
    description:
      "How many points does your BGMI team need to qualify? Test what-if scenarios instantly. No signup.",
    url: "/bgmi-qualification",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BGMI Qualification Calculator — Know What Your Team Needs to Qualify",
    description: "How many points does your BGMI team need to qualify? Test what-if scenarios instantly.",
  },
};

function parsePrefillCurrent(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const parsed = Number(raw);
  return isValidPoints(parsed) ? parsed : null;
}

function parsePrefillUpdated(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Public BGMI Qualification Simulator — instant-use microtool.
 * Fully client-side and ephemeral: no account, no persistence, no live
 * data. The answer (gap + required rate) renders above the fold.
 *
 * Accepts `?current=N` (optionally `&updated=ISO`) from Tournament Hub
 * team rows: only current points are prefilled, and a caveat banner
 * reminds planners to confirm the latest result.
 */
export default async function BgmiQualificationPage({
  searchParams,
}: {
  searchParams?: Promise<{ current?: string | string[]; updated?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const prefillCurrent = parsePrefillCurrent(params.current);
  const prefillUpdatedAt = prefillCurrent !== null ? parsePrefillUpdated(params.updated) : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main id="main-content" className="flex-1 container-nest py-8 sm:py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-2">
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
              MicroNest · BGMI Qualification Simulator
            </p>
            <h1 className="font-display text-3xl font-normal tracking-tight">Know what your team needs to qualify.</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Enter your points, the qualification target, and matches left. Test what-if placements and finishes —
              instantly, with no signup. Existing tools show what happened; this shows what needs to happen next.
            </p>
          </div>
          <QualificationCalculator prefillCurrent={prefillCurrent} prefillUpdatedAt={prefillUpdatedAt} />
        </div>
      </main>
      <Footer />
    </div>
  );
}

import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { QualificationCalculator } from "@/features/bgmi-qualification/components/qualification-calculator";

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

/**
 * Public BGMI Qualification Simulator — instant-use microtool.
 * Fully client-side and ephemeral: no account, no persistence, no live
 * data. The answer (gap + required rate) renders above the fold.
 */
export default function BgmiQualificationPage() {
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
          <QualificationCalculator />
        </div>
      </main>
      <Footer />
    </div>
  );
}

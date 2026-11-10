import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { RelatedContent } from "@/components/marketing/content/related-content";
import { USE_CASES, getUseCase } from "@/config/content/use-cases";

export async function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getUseCase(slug);
  if (!entry) return {};
  return {
    title: `${entry.title} | MicroNest`,
    description: entry.description,
    alternates: { canonical: `/use-cases/${entry.slug}` },
    openGraph: { title: `${entry.title} | MicroNest`, description: entry.description, url: `/use-cases/${entry.slug}`, type: "website" },
  };
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getUseCase(slug);
  if (!entry) notFound();

  const isTournament = entry.slug === "tournament-organizers";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Use Cases", href: "/use-cases" }, { label: entry.title }]} />
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Use case • {isTournament ? "Prize Pool" : "Organizations"}</p>
          <h1 className="font-display mt-2 text-3xl font-normal tracking-tight">{entry.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{entry.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">For {entry.audience.join(" · ")} • Published {entry.publishedAt}</p>

          <div className="prose prose-neutral mt-8 max-w-none prose-p:leading-relaxed prose-headings:font-display prose-headings:font-normal">
            {isTournament ? (
              <>
                <h2>The organizer’s payout problem</h2>
                <p>A tournament organizer announces a <Link href="/glossary/prize-pool" className="underline decoration-primary/30 hover:decoration-primary">prize pool</Link> — say <code>₹100,000</code> — and must publish who gets what. If payouts are calculated in a spreadsheet and copied by hand, the announced percentages may not total <code>100%</code> and the rounded amounts may not sum to the pool. Players notice.</p>

                <h2>Define the prize pool</h2>
                <p>Start with one number and one currency. <Link href="/tools/prize-pool-splitter">Prize Pool Splitter</Link> supports <code>INR, USD, EUR, GBP</code> with no FX conversion — it does not convert currencies — so the pool you enter is the pool you publish. State whether the pool is gross or net of fees.</p>

                <h2>Choose a distribution model</h2>
                <p>See <Link href="/guides/esports-prize-pool-distribution" className="underline decoration-primary/30 hover:decoration-primary">Esports Prize Pool Distribution</Link> for the full comparison. Quick guidance:</p>
                <ul>
                  <li><strong>Percentage</strong> — explicit, auditable, scales with pool changes.</li>
                  <li><strong>Equal</strong> — <code>pool ÷ n</code> for team bonuses or qualifiers.</li>
                  <li><strong>Ranked</strong> — presets for Top 3/4/5/8/10 when a quick start matches your format.</li>
                  <li><strong>Custom</strong> — add or remove placements for non-standard brackets.</li>
                </ul>

                <h2>Validate percentages</h2>
                <p>Percentages must total <code>100%</code>. The calculator shows <code>X% / 100%</code> live; entering <code>50 / 30 / 19.99</code> surfaces <em>Total must equal 100% (currently 99.99%)</em> and disables a false <em>Balanced</em> state. This prevents publishing an incomplete structure.</p>

                <h2>Calculate exact payouts</h2>
                <p>Percentages can produce fractional minor units. Instead of rounding each line independently, the tool reconciles via <Link href="/guides/esports-prize-pool-rounding">largest-remainder</Link> — flooring each raw payout and distributing remaining paise/cents to the largest fractional parts. Example <code>₹100 ÷ 3 equal</code> → <code>₹33.34, ₹33.33, ₹33.33</code> total <code>₹100.00</code>, deterministic.</p>

                <h2>Communicate payouts clearly</h2>
                <p>Publish both percentage and amount — e.g., <code>1st — 50% — ₹50,000.00</code> — so that adjustments scale. The <em>Copy Results</em> text includes <code>Prize Pool, placements — percentage — payout, Total Distributed</code> for pasting into announcements or sheets. Include the total to show reconciliation.</p>

                <h2>Avoid rounding discrepancies</h2>
                <ul>
                  <li>Always validate <code>100%</code> before copying.</li>
                  <li>Don’t scale percentages silently to force 100%.</li>
                  <li>Don’t hide a <code>₹0.01</code> difference — the reconciled total should be <code>₹0.00</code> remaining.</li>
                  <li>Document the distribution alongside the pool, not just the final amounts.</li>
                </ul>

                <h2>What MicroNest does not do</h2>
                <p>Prize Pool Splitter is a focused calculator. It does not handle registrations, brackets, payments, escrow, tax processing, or tournament operations. Use it to produce the numbers; handle operations in your existing tournament platform.</p>

                <h2>When this tool is not needed</h2>
                <p>If you already have a finance-verified sheet that reconciles and you publish percentages, you may not need a new tool. Use the calculator when you want speed without auditing a sheet for drift.</p>
              </>
            ) : (
              <>
                <h2>The sponsorship operations problem</h2>
                <p>An organization running &ldquo;Monster Energy — November Campaign&rdquo; across a main team and an academy team needs to prove that each creator delivered the agreed hashtag, title, and category — and to keep that proof auditable for sponsors. Spreadsheets work until the third campaign, then they break.</p>

                <h2>Before a campaign starts</h2>
                <ul>
                  <li>Create a <strong>Workspace</strong> per identity (e.g., <em>Mystic Minutes</em> as a workspace, not a giant org with many channels of same platform).</li>
                  <li>Create a <strong>Campaign</strong> (e.g., <em>Monster Energy — November Campaign</em>) with a clear window.</li>
                  <li>Define <strong>Requirements</strong> as one measurable row each (hashtag, title phrase, category, duration, etc.).</li>
                </ul>

                <h2>During campaign execution</h2>
                <ol>
                  <li><strong>Connect creator channels</strong> — YouTube, Twitch, Kick (one per platform per workspace, verified directly with the platform).</li>
                  <li><strong>Run checks</strong> — each check evaluates all requirements against eligible published content.</li>
                  <li><strong>Review proof</strong> — each video shown once with the requirements it satisfies, with source links.</li>
                  <li><strong>Review results</strong> — Confirmed / Not found / Needs review / Not applicable / Checking.</li>
                  <li><strong>Use check history</strong> — ongoing campaign visibility, not a folder of screenshots.</li>
                </ol>

                <h2>Keeping campaign history</h2>
                <p>Completed campaigns keep checks, proof and results for reporting. Requirements are locked when tracking, history remains readable.</p>

                <h2>Who this workflow is best suited for</h2>
                <p>Organizations and managers who run more than one campaign or more than one creator and need proof that is explainable to sponsors.</p>

                <h2>When a simpler workflow may be enough</h2>
                <p>If you run a single one-off post for a sponsor, a manual screenshot and link may be faster than a full campaign. Use a dedicated workflow when you need repeatability and auditability.</p>
              </>
            )}
          </div>

          <Card className="mt-10 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm">{isTournament ? "Split a prize pool in seconds" : "Try this workflow"}</CardTitle>
              <CardDescription>{isTournament ? "Enter the pool, pick a method, and get exact reconciled payouts — no spreadsheet drift." : "Create a workspace, define requirements, connect a creator channel, and run your first check."}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={isTournament ? "/tools/prize-pool-splitter" : "/tools/sponsorship-tracking"} className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] min-h-[44px]">{isTournament ? "Open Prize Pool Splitter" : "Try Sponsorship Tracking"}</Link>
            </CardContent>
          </Card>

          <RelatedContent
            items={
              isTournament
                ? [
                    { title: "Prize Pool Distribution — Overview", href: "/guides/esports-prize-pool-distribution", description: "All methods with examples.", badge: "Guide" },
                    { title: "How to Split by Percentage", href: "/guides/esports-prize-pool-percentage-split", description: "₹100,000 — 50/30/20 walkthrough.", badge: "Guide" },
                    { title: "Prize Pool", href: "/glossary/prize-pool", description: "What a prize pool is.", badge: "Glossary" },
                    { title: "Prize Pool Splitter", href: "/tools/prize-pool-splitter", description: "The calculator behind the workflow.", badge: "Tool" },
                  ]
                : [
                    { title: "Sponsorship Deliverables Checklist", href: "/guides/esports-sponsorship-deliverables", description: "What sponsors actually expect.", badge: "Guide" },
                    { title: "How to Prove Sponsored Content", href: "/guides/proving-sponsored-content", description: "From requirement to proof.", badge: "Guide" },
                    { title: "Proof of Performance", href: "/glossary/proof-of-performance", description: "What counts as proof.", badge: "Glossary" },
                    { title: "Sponsorship Tracking", href: "/tools/sponsorship-tracking", description: "The product behind the workflow.", badge: "Tool" },
                  ]
            }
          />
        </article>
      </main>
      <Footer />
      <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Use Cases", item: "/use-cases" }, { name: entry.title, item: `/use-cases/${entry.slug}` }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: entry.title,
            description: entry.description,
            author: { "@type": "Organization", name: "MicroNest" },
            datePublished: entry.publishedAt,
            mainEntityOfPage: `/use-cases/${entry.slug}`,
          }),
        }}
      />
    </div>
  );
}

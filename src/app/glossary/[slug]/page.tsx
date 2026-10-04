import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { RelatedContent } from "@/components/marketing/content/related-content";
import { GLOSSARY, getGlossary } from "@/config/content/glossary";

export async function generateStaticParams() {
  return GLOSSARY.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getGlossary(slug);
  if (!entry) return {};
  return {
    title: `${entry.title} | MicroNest`,
    description: entry.description,
    alternates: { canonical: `/glossary/${entry.slug}` },
    openGraph: { title: `${entry.title} | MicroNest`, description: entry.description, url: `/glossary/${entry.slug}`, type: "website" },
  };
}

export default async function GlossaryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getGlossary(slug);
  if (!entry) notFound();

  const isProof = entry.slug === "proof-of-performance";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Glossary", href: "/glossary" }, { label: entry.term }]} />
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Glossary • {entry.category}</p>
          <h1 className="font-display mt-2 text-3xl font-normal tracking-tight">{entry.term}</h1>
          <p className="mt-3 text-lg leading-relaxed text-foreground">{entry.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">Published {entry.publishedAt}</p>

          <div className="prose prose-neutral mt-8 max-w-none prose-p:leading-relaxed prose-headings:font-display prose-headings:font-normal">
            {isProof ? (
              <>
                <h2>Why sponsors care</h2>
                <p>Proof turns a promise into something a sponsor can verify. It connects a requirement (&ldquo;title contains #RedBull&rdquo;) to published content with a source link and observed time, so reporting is evidence-based.</p>

                <h2>What can count as proof</h2>
                <ul>
                  <li>Title phrase, hashtag, or category that matches the campaign</li>
                  <li>Description content or platform-specific tag</li>
                  <li>Duration or VOD existence (Twitch/YouTube; Kick VOD not supported in MVP)</li>
                  <li>Source URL to the video or stream</li>
                </ul>

                <h2>How teams typically organize it</h2>
                <p>Without a tool, teams paste links into sheets. With a dedicated workflow, proof is grouped by content — each video once — with the requirements it satisfies, plus check history for the campaign.</p>

                <h2>How verification fits</h2>
                <p>Verification is a <em>Check</em> that evaluates each requirement against eligible content and produces a <em>Result</em>: Confirmed, Not found, Needs review, Not applicable, or Checking.</p>

                <h2>How MicroNest approaches it</h2>
                <p>Sponsorship Tracking keeps one workspace per creator/brand, campaign requirements, connected creator channels, checks, and proof/results. No giant suite to learn.</p>
              </>
            ) : (
              <>
                <h2>Examples</h2>
                <ul>
                  <li>Title must contain <code>#Logitech</code></li>
                  <li>Description must contain sponsor link</li>
                  <li>Category must be <em>League of Legends</em></li>
                  <li>Duration at least 60 minutes (Twitch/YouTube)</li>
                  <li>Twitch tag <code>esports_sponsor</code> or YouTube tags include sponsor tags</li>
                </ul>

                <h2>Why requirements should be specific</h2>
                <p>Specific requirements can be checked automatically. &ldquo;Mention us&rdquo; cannot. One requirement per row keeps results clear.</p>

                <h2>How deliverables become measurable</h2>
                <p>Turn vague asks into the patterns above with platform and location (title vs description) specified. The campaign window makes timing verifiable.</p>

                <h2>How proof relates</h2>
                <p>Each deliverable becomes a <em>Requirement</em> in a campaign. A <em>Check</em> looks for proof in published content and yields a <em>Result</em> per requirement. Proof is grouped by content.</p>

                <h2>Related concepts</h2>
                <p>Sponsorship Tracking, Proof of Performance, Campaign, Requirement, Check, Result, Creator Channel.</p>
              </>
            )}
          </div>

          <Card className="mt-10">
            <CardHeader>
              <CardTitle className="text-sm">Continue with {entry.related.tool === "sponsorship-tracking" ? "Sponsorship Tracking" : entry.related.tool}</CardTitle>
              <CardDescription>Use the product workflow in your workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/tools/${entry.related.tool}`} className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)] min-h-[44px]">View tool</Link>
            </CardContent>
          </Card>

          <RelatedContent
            items={
              isProof
                ? [
                    { title: "Sponsorship Deliverables Checklist", href: "/guides/esports-sponsorship-deliverables", description: "What sponsors actually expect.", badge: "Guide" },
                    { title: "How to Prove Sponsored Content", href: "/guides/proving-sponsored-content", description: "From requirement to proof.", badge: "Guide" },
                    { title: "Sponsorship Deliverable", href: "/glossary/sponsorship-deliverable", description: "Definition and examples.", badge: "Glossary" },
                    { title: "For Esports Organizations", href: "/use-cases/esports-organizations", description: "Keep campaigns auditable.", badge: "Use case" },
                  ]
                : [
                    { title: "Sponsorship Deliverables Checklist", href: "/guides/esports-sponsorship-deliverables", description: "What sponsors actually expect.", badge: "Guide" },
                    { title: "How to Prove Sponsored Content", href: "/guides/proving-sponsored-content", description: "From requirement to proof.", badge: "Guide" },
                    { title: "Proof of Performance", href: "/glossary/proof-of-performance", description: "What counts as proof.", badge: "Glossary" },
                  ]
            }
          />
        </article>
      </main>
      <Footer />
      <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Glossary", item: "/glossary" }, { name: entry.term, item: `/glossary/${entry.slug}` }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "DefinedTerm",
            name: entry.term,
            description: entry.description,
            inDefinedTermSet: { "@type": "DefinedTermSet", name: "MicroNest Glossary" },
            isPartOf: { "@type": "WebSite", name: "MicroNest" },
          }),
        }}
      />
    </div>
  );
}

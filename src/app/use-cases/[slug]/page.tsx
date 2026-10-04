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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Use Cases", href: "/use-cases" }, { label: "For Esports Organizations" }]} />
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Use case • Organizations</p>
          <h1 className="font-display mt-2 text-3xl font-normal tracking-tight">{entry.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{entry.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">For {entry.audience.join(" · ")} • Published {entry.publishedAt}</p>

          <div className="prose prose-neutral mt-8 max-w-none prose-p:leading-relaxed prose-headings:font-display prose-headings:font-normal">
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
          </div>

          <Card className="mt-10 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm">Try this workflow</CardTitle>
              <CardDescription>Create a workspace, define requirements, connect a creator channel, and run your first check.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/tools/sponsorship-tracking" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)] min-h-[44px]">Try Sponsorship Tracking</Link>
            </CardContent>
          </Card>

          <RelatedContent
            items={[
              { title: "Sponsorship Deliverables Checklist", href: "/guides/esports-sponsorship-deliverables", description: "What sponsors actually expect.", badge: "Guide" },
              { title: "How to Prove Sponsored Content", href: "/guides/proving-sponsored-content", description: "From requirement to proof.", badge: "Guide" },
              { title: "Proof of Performance", href: "/glossary/proof-of-performance", description: "What counts as proof.", badge: "Glossary" },
              { title: "Sponsorship Tracking", href: "/tools/sponsorship-tracking", description: "The product behind the workflow.", badge: "Tool" },
            ]}
          />
        </article>
      </main>
      <Footer />
      <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Use Cases", item: "/use-cases" }, { name: "For Esports Organizations", item: `/use-cases/${entry.slug}` }]} />
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

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { AnswerBlock } from "@/components/marketing/content/answer-block";
import { RelatedContent } from "@/components/marketing/content/related-content";
import { GUIDES, getGuide } from "@/config/content/guides";

export async function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: `${guide.title} | MicroNest`,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { title: `${guide.title} | MicroNest`, description: guide.description, url: `/guides/${guide.slug}`, type: "article" },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  // Content is inline for auditability — no CMS, no markdown infra
  if (guide.slug === "esports-sponsorship-deliverables") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides", href: "/guides" }, { label: guide.title }]} />
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Guide • Sponsorship</p>
            <h1 className="font-display mt-2 text-3xl font-normal tracking-tight sm:text-4xl">{guide.title}</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{guide.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">For {guide.audience.join(" · ")} • Published {guide.publishedAt}</p>

            <AnswerBlock question="What is an esports sponsorship deliverable?" answer="A sponsorship deliverable is the specific output a sponsor pays for — for example, a hashtag in a stream title, a link in a description, or being in a category during a campaign window. When deliverables are measurable, teams can verify them and keep proof without chasing screenshots." />

            <div className="prose prose-neutral mt-8 max-w-none prose-p:leading-relaxed prose-headings:font-display prose-headings:font-normal prose-headings:tracking-tight">
              <h2>What sponsors actually expect</h2>
              <p>Sponsors rarely say &ldquo;post something.&rdquo; They ask for something they can check: a title that contains a phrase, a hashtag that appears, a duration that is met, a video that exists after the stream. Vague requests &mdash; &ldquo;mention us&rdquo; &mdash; create follow-up work. Specific requirements create proof.</p>

              <h2>Common types of deliverables</h2>
              <p>Most esports deliverables fall into a small set of verifiable patterns. MicroNest models these as campaign requirements:</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="py-2">Type</th><th className="py-2">Example</th><th className="py-2">Checked where</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">Title phrase</td><td className="py-2">&ldquo;Monster Energy — November Campaign&rdquo; in title</td><td className="py-2">Stream title / video title</td></tr>
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">Hashtag</td><td className="py-2">#MonsterEnergy in title</td><td className="py-2">Title (normalized, # ensured)</td></tr>
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">Category</td><td className="py-2">Category is League of Legends</td><td className="py-2">Platform category</td></tr>
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">Duration</td><td className="py-2">Stream at least 90 minutes</td><td className="py-2">Twitch/YouTube duration</td></tr>
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">Description link/hashtag</td><td className="py-2">Link in description contains sponsor URL</td><td className="py-2">Description</td></tr>
                  <tr><td className="py-2 font-medium text-foreground">Platform tag</td><td className="py-2">Twitch tag or YouTube tag includes sponsor tag</td><td className="py-2">Twitch curated / YouTube freeform</td></tr>
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">Kick VOD-related requirements (duration, VOD existence) are currently not verifiable on Kick — the platform does not expose VODs the same way.</p>

              <h2>How to turn vague requests into measurable requirements</h2>
              <ul>
                <li><strong>Keep one requirement per row.</strong> &ldquo;Title contains #RedBull and duration &ge; 60m&rdquo; should be two requirements.</li>
                <li><strong>Use the sponsor&rsquo;s exact phrase.</strong> If they want &ldquo;#MonsterEnergy&rdquo;, require that exact string, not &ldquo;monster&rdquo;.</li>
                <li><strong>Specify where it must appear.</strong> Title vs description vs tags — they are different checks.</li>
                <li><strong>Prefer exact category.</strong> Resolve game name → category ID before the campaign starts.</li>
                <li><strong>Avoid regex.</strong> &ldquo;Contains&rdquo; with lowercasing and whitespace normalization covers most cases.</li>
              </ul>

              <h2>Example requirements (copy-ready)</h2>
              <ul>
                <li>Title contains <code>#MonsterEnergy</code></li>
                <li>Title contains &ldquo;Monster Energy — November Campaign&rdquo;</li>
                <li>Category is <em>Valorant</em></li>
                <li>Duration at least 90 minutes (Twitch/YouTube only)</li>
                <li>Description contains <code>monster.energy/creator</code></li>
                <li>YouTube tags include <code>monsterenergy, esports</code></li>
              </ul>

              <h2>A practical deliverables checklist</h2>
              <ul>
                <li>☐ Each deliverable is one measurable requirement</li>
                <li>☐ Location (title/description/tags/category/duration) is explicit</li>
                <li>☐ Exact phrase/hashtag/tag is specified</li>
                <li>☐ Platform capability checked (e.g., no duration on Kick)</li>
                <li>☐ Campaign window (starts/ends) is set</li>
                <li>☐ Creator channels are connected and verified</li>
              </ul>

              <h2>How teams keep proof organized</h2>
              <p>Without a system, teams screenshot titles and paste links into a sheet. It works once, then it breaks. A dedicated workflow keeps one workspace per creator/brand, one campaign per sponsor, requirements per campaign, and proof grouped by content — each video shown once with the requirements it satisfies — so reporting is a list of proof, not a maze of links.</p>

              <h2>How Sponsorship Tracking fits</h2>
              <p>MicroNest lets you create a sponsor campaign, define requirements using the patterns above, connect creator channels (YouTube, Twitch, Kick), run checks on eligible content, and review proof and results in check history. The product does not invent compliance; it verifies what can be verified and marks the rest <em>Needs review</em> or <em>Not applicable</em> honestly.</p>
            </div>

            <Card className="mt-10 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm">Next step</CardTitle>
                <CardDescription>Turn these deliverables into a campaign and see proof grouped by content.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/tools/sponsorship-tracking" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)] min-h-[44px]">Try Sponsorship Tracking</Link>
              </CardContent>
            </Card>

            <RelatedContent
              items={[
                { title: "How to Prove Sponsored Content", description: "From requirement to proof — the workflow.", href: "/guides/proving-sponsored-content", badge: "Guide" },
                { title: "Proof of Performance", description: "What counts as proof for sponsors.", href: "/glossary/proof-of-performance", badge: "Glossary" },
                { title: "Sponsorship Deliverable", description: "Definition and examples.", href: "/glossary/sponsorship-deliverable", badge: "Glossary" },
                { title: "For Esports Organizations", description: "Keep sponsorship campaigns auditable.", href: "/use-cases/esports-organizations", badge: "Use case" },
              ]}
            />
          </article>
        </main>
        <Footer />
        <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Guides", item: "/guides" }, { name: guide.title, item: `/guides/${guide.slug}` }]} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, author: { "@type": "Organization", name: "MicroNest" }, datePublished: guide.publishedAt, mainEntityOfPage: `/guides/${guide.slug}` }) }} />
      </div>
    );
  }

  if (guide.slug === "proving-sponsored-content") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides", href: "/guides" }, { label: guide.title }]} />
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Guide • Workflow</p>
            <h1 className="font-display mt-2 text-3xl font-normal tracking-tight sm:text-4xl">{guide.title}</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{guide.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">For {guide.audience.join(" · ")} • Published {guide.publishedAt}</p>

            <AnswerBlock question="How do you prove sponsored content was published?" answer="Define the requirement in measurable terms, confirm the content was published, run a check, and keep the proof grouped by content. MicroNest structures this as Requirement → Published Content → Check → Proof → Result." />

            <div className="prose prose-neutral mt-8 max-w-none prose-p:leading-relaxed prose-headings:font-display prose-headings:font-normal">
              <h2>What proof of performance means</h2>
              <p>Proof is evidence that a sponsored requirement was actually fulfilled — not a promise. For example, a title that contains a required hashtag, or a category that matches the campaign, captured with a source link and observation time.</p>

              <h2>Why published content alone is not always enough</h2>
              <p>A video existing does not automatically satisfy a sponsor. The title might miss the hashtag, the category might be wrong, the duration might be short. Proof needs to pair <em>what was published</em> with <em>what was required</em> and a reason.</p>

              <h2>The workflow: Requirement → Content → Check → Proof → Result</h2>
              <ol>
                <li><strong>Requirement.</strong> Example: Title contains <code>#Logitech</code>, category is <em>Valorant</em>.</li>
                <li><strong>Published content.</strong> Creator publishes a YouTube video or Twitch VOD that falls inside the campaign window.</li>
                <li><strong>Check.</strong> The workspace runs a check on eligible content from connected creator channels.</li>
                <li><strong>Proof.</strong> The system captures title, description, tags, category, duration where observable, with source URL and observed time.</li>
                <li><strong>Result.</strong> Each requirement is evaluated: <em>Confirmed</em> (PASS), <em>Not found</em> (FAIL), <em>Needs review</em> (NOT_VERIFIABLE), <em>Not applicable</em> (NOT_SUPPORTED), <em>Checking</em> (PENDING).</li>
              </ol>

              <h2>Examples of useful proof</h2>
              <ul>
                <li>Video <em>Monster Energy — November Campaign</em> — title contains <code>#MonsterEnergy</code> → <em>Confirmed</em></li>
                <li>Same video — YouTube tags include <code>monsterenergy</code> → <em>Confirmed</em></li>
                <li>Twitch VOD 2h 10m — duration ≥ 90m → <em>Confirmed</em> (Twitch/YouTube only)</li>
                <li>Kick live — duration check → <em>Not applicable</em> (Kick VOD not supported in MVP)</li>
              </ul>

              <h2>What happens when proof cannot be verified</h2>
              <p>Some content cannot be verified automatically: VOD deleted, description not observable on Kick, or duration not supported. The result is <em>Needs review</em> — not a failure — so you can follow up manually.</p>

              <h2>How to organize campaign proof</h2>
              <p>Group proof by content. One video should appear once with the requirements it satisfies, not as duplicated rows per requirement. Keep check history for the campaign so reporting is a timeline, not a folder of screenshots.</p>

              <h2>How Sponsorship Tracking fits</h2>
              <p>Create a campaign, connect creator channels (YouTube/Twitch/Kick), define requirements, run checks, and review proof and results in one place. Checks are read-only; proof is immutable for auditability.</p>
            </div>

            <Card className="mt-10 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm">See the workflow in practice</CardTitle>
                <CardDescription>Define requirements, connect a creator channel, and run your first check.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/tools/sponsorship-tracking" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)] min-h-[44px]">Try Sponsorship Tracking</Link>
              </CardContent>
            </Card>

            <RelatedContent
              items={[
                { title: "Sponsorship Deliverables Checklist", description: "What sponsors actually expect.", href: "/guides/esports-sponsorship-deliverables", badge: "Guide" },
                { title: "Proof of Performance", description: "What counts as proof.", href: "/glossary/proof-of-performance", badge: "Glossary" },
                { title: "Sponsorship Deliverable", description: "Definition and examples.", href: "/glossary/sponsorship-deliverable", badge: "Glossary" },
                { title: "For Esports Organizations", description: "Keep campaigns auditable.", href: "/use-cases/esports-organizations", badge: "Use case" },
              ]}
            />
          </article>
        </main>
        <Footer />
        <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Guides", item: "/guides" }, { name: guide.title, item: `/guides/${guide.slug}` }]} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, author: { "@type": "Organization", name: "MicroNest" }, datePublished: guide.publishedAt, mainEntityOfPage: `/guides/${guide.slug}` }) }} />
      </div>
    );
  }

  notFound();
}

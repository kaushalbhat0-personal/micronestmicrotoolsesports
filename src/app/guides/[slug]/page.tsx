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

  if (guide.slug === "esports-prize-pool-distribution") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides", href: "/guides" }, { label: guide.title }]} />
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Guide • Prize Pool</p>
            <h1 className="font-display mt-2 text-3xl font-normal tracking-tight sm:text-4xl">{guide.title}</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{guide.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">For {guide.audience.join(" · ")} • Published {guide.publishedAt}</p>

            <AnswerBlock question="How should an esports prize pool be distributed?" answer="Choose a distribution model — percentage, equal, ranked or custom — assign placements that total 100%, then reconcile rounding so individual payouts add up exactly to the prize pool. The structure depends on your format, not a universal standard." />

            <div className="prose prose-neutral mt-8 max-w-none prose-p:leading-relaxed prose-headings:font-display prose-headings:font-normal">
              <h2>What a prize pool is</h2>
              <p>A <Link href="/glossary/prize-pool" className="underline decoration-primary/30 hover:decoration-primary">prize pool</Link> is the total amount offered for a tournament — funded by the organizer, sponsors, or entry fees — before it is split into individual <Link href="/glossary/prize-pool-distribution" className="underline decoration-primary/30 hover:decoration-primary">payouts</Link>. The pool is one number; the distribution is how you turn it into placements.</p>

              <h2>Why distribution structure matters</h2>
              <p>Players compare payouts, not just the headline pool. A steep structure rewards the winner; a flatter structure keeps mid-table teams engaged. The right choice depends on format (single elimination vs league), number of paid placements, and what you want to incentivize.</p>

              <h2>Percentage-based distribution</h2>
              <p>Each placement receives a share of the pool. Example — an illustrative <code>₹100,000</code> pool split <code>50% / 30% / 20%</code> pays <code>₹50,000</code>, <code>₹30,000</code>, <code>₹20,000</code>. Percentages must total <code>100%</code>; otherwise the calculator cannot reconcile. See the focused guide <Link href="/guides/esports-prize-pool-percentage-split">How to Split by Percentage</Link> for validation and workflow.</p>

              <h2>Equal split</h2>
              <p>All recipients receive the same amount — <code>pool ÷ n</code>. Simple for team bonuses or qualifiers where placement should not affect pay. Naive division still requires rounding reconciliation.</p>

              <h2>Ranked distributions</h2>
              <p>Ranked presets are convenient starting points, not rules. MicroNest’s <Link href="/tools/prize-pool-splitter">Prize Pool Splitter</Link> includes:</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="py-2">Preset</th><th className="py-2">Percentages</th><th className="py-2">When it’s useful</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">Top 3</td><td className="py-2 font-mono">50 / 30 / 20</td><td className="py-2">Small finals, three paid places</td></tr>
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">Top 4</td><td className="py-2 font-mono">40 / 30 / 20 / 10</td><td className="py-2">Four-team playoff</td></tr>
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">Top 5</td><td className="py-2 font-mono">35 / 25 / 20 / 12 / 8</td><td className="py-2">Five paid, winner still distinct</td></tr>
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">Top 8</td><td className="py-2 font-mono">30 / 20 / 15 / 10 / 8 / 7 / 5 / 5</td><td className="py-2">Large bracket, deeper payout</td></tr>
                  <tr><td className="py-2 font-medium text-foreground">Top 10</td><td className="py-2 font-mono">25 / 18 / 15 / 10 / 8 / 6 / 5 / 5 / 4 / 4</td><td className="py-2">Season or league</td></tr>
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">All presets are editable — adjust any percentage in the calculator.</p>

              <h2>Custom distributions</h2>
              <p>When presets don’t match your format, build a custom list (for example <code>40/30/20/10</code> for four places). You can add or remove placements; labels re-number automatically. The only invariant is <code>100%</code>.</p>

              <h2>Validating that percentages total 100%</h2>
              <p>The calculator shows <code>X% / 100%</code> in real time. If you enter <code>50 / 30 / 19.99</code> the UI surfaces <em>Total must equal 100% (currently 99.99%)</em> and the result shows <em>Complete the configuration</em> instead of a false <em>Balanced</em> total. This is intentional — no rounding trick should hide an incomplete distribution.</p>

              <h2>Rounding and the final cent</h2>
              <p>Percentages can produce fractional currency units (for example <code>₹100 × 33.3333%</code>). Displaying two decimals and naively rounding each line can leave the sum <code>₹99.99</code> or <code>₹100.01</code>. The fix is <Link href="/guides/esports-prize-pool-rounding">reconciliation</Link>: convert the pool to minor units (cents/paise), floor each raw payout, then distribute the remaining minor units one by one to the largest fractional parts.</p>

              <h2>Examples</h2>
              <ul>
                <li><code>₹100,000 — 50/30/20</code> → <code>₹50,000.00, ₹30,000.00, ₹20,000.00</code> (no remainder)</li>
                <li><code>₹100 — 3 equal</code> → <code>₹33.34, ₹33.33, ₹33.33</code> — one cent to the largest remainder, total <code>₹100.00</code></li>
                <li><code>₹10,000 — 40/30/20/10</code> → <code>₹4,000.00, ₹3,000.00, ₹2,000.00, ₹1,000.00</code></li>
              </ul>

              <h2>When to choose each method</h2>
              <ul>
                <li><strong>Percentage</strong> when you want explicit control and auditability.</li>
                <li><strong>Equal</strong> when placement should not affect pay.</li>
                <li><strong>Ranked</strong> when a preset matches your paid places and you want speed.</li>
                <li><strong>Custom</strong> when your format is non-standard.</li>
              </ul>
              <p>No model is universally correct — document the percentages you chose alongside the pool. The calculator reconciles to the last cent regardless of method.</p>
            </div>

            <Card className="mt-10 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm">Split your pool in seconds</CardTitle>
                <CardDescription>Enter the pool, pick a method, and get exact reconciled payouts.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/tools/prize-pool-splitter" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)] min-h-[44px]">Open Prize Pool Splitter</Link>
              </CardContent>
            </Card>

            <RelatedContent
              items={[
                { title: "How to Split by Percentage", description: "Percentage fundamentals and ₹100,000 example.", href: "/guides/esports-prize-pool-percentage-split", badge: "Guide" },
                { title: "How to Handle Rounding", description: "Why 33.33% needs reconciliation.", href: "/guides/esports-prize-pool-rounding", badge: "Guide" },
                { title: "Prize Pool", description: "What a prize pool is in esports.", href: "/glossary/prize-pool", badge: "Glossary" },
                { title: "For Tournament Organizers", description: "Define, validate, and communicate payouts.", href: "/use-cases/tournament-organizers", badge: "Use case" },
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

  if (guide.slug === "esports-prize-pool-percentage-split") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides", href: "/guides" }, { label: guide.title }]} />
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Guide • Prize Pool</p>
            <h1 className="font-display mt-2 text-3xl font-normal tracking-tight sm:text-4xl">{guide.title}</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{guide.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">For {guide.audience.join(" · ")} • Published {guide.publishedAt}</p>

            <AnswerBlock question="How do percentage prize distributions work?" answer="Each placement receives a percentage of the total pool. Percentages must total 100%. The calculator then reconciles fractional currency units so displayed payouts add up exactly to the pool." />

            <div className="prose prose-neutral mt-8 max-w-none prose-p:leading-relaxed prose-headings:font-display prose-headings:font-normal">
              <h2>Percentage fundamentals</h2>
              <p>A percentage split assigns a share, not a fixed amount. If the pool changes, payouts scale automatically. For example, <code>40%</code> of a <code>₹100,000</code> pool is <code>₹40,000</code>; of a <code>₹10,000</code> pool it is <code>₹4,000</code>.</p>

              <h2>Example: ₹100,000 — 50 / 30 / 20</h2>
              <p>This is an <em>example</em>, not an industry standard. It is the default in <Link href="/tools/prize-pool-splitter" className="underline decoration-primary/30 hover:decoration-primary">Prize Pool Splitter</Link> because it is easy to verify:</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="py-2">Placement</th><th className="py-2">Percent</th><th className="py-2">Payout (₹)</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">1st</td><td className="py-2 font-mono">50%</td><td className="py-2 font-mono">50,000.00</td></tr>
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">2nd</td><td className="py-2 font-mono">30%</td><td className="py-2 font-mono">30,000.00</td></tr>
                  <tr><td className="py-2 font-medium text-foreground">3rd</td><td className="py-2 font-mono">20%</td><td className="py-2 font-mono">20,000.00</td></tr>
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">Total <code>₹1,00,000.00</code> • <code>100%</code> • <code>₹0.00</code> remaining — <em>Balanced</em>.</p>

              <h2>Other common structures</h2>
              <p>Choose what fits your format — the calculator supports up to 100 placements:</p>
              <ul>
                <li><code>40 / 30 / 20 / 10</code> — four paid, common for quad finals</li>
                <li><code>35 / 25 / 20 / 12 / 8</code> — five paid, winner distinct but deeper</li>
                <li><code>30 / 20 / 15 / 10 / 8 / 7 / 5 / 5</code> — eight paid, league style</li>
                <li>Custom — add or remove placements, labels re-number automatically</li>
              </ul>

              <h2>Ensuring percentages total 100%</h2>
              <p>The UI shows <code>X% / 100%</code> live. Entering <code>50 / 30 / 19.99</code> triggers <em>Total must equal 100% (currently 99.99%)</em> and the preview shows <em>Complete the configuration</em> — it never falsely reports <em>Balanced</em>. Tolerance is <code>0.001</code> to allow <code>33.33 × 3 + 33.34</code> without failing on floating-point noise.</p>

              <h2>What happens when percentages do not total 100%</h2>
              <p>The distribution is considered incomplete. No payouts are displayed as balanced, remaining is not <code>₹0.00</code>, and copy is disabled. Fix the percentages — the calculator does not silently scale them.</p>

              <h2>Rounding in practice</h2>
              <p>Percentages can create fractional minor units (paise/cents). For <code>₹100 × 33.33%</code> the raw value is <code>₹33.33</code> exactly; for <code>33.3333%</code> it is <code>₹33.3333</code>. Rounding each line independently would drift. The calculator uses <Link href="/guides/esports-prize-pool-rounding">largest-remainder reconciliation</Link> to distribute leftover paise to the largest fractional parts so the sum is exact.</p>

              <h2>Why totals must reconcile exactly</h2>
              <p>Players reconcile payouts. A displayed total of <code>₹99.99</code> against a <code>₹100</code> pool creates disputes and manual adjustments. Reconciliation guarantees <code>sum(displayed payouts) === prize pool</code> to the last cent, deterministically.</p>

              <h2>Practical workflow</h2>
              <ol>
                <li>Enter the prize pool and currency (<code>INR, USD, EUR, GBP</code> — no FX conversion).</li>
                <li>Pick <em>Percentage</em> (or <em>Ranked</em> / <em>Custom</em> / <em>Equal</em>).</li>
                <li>Set percentages until <code>100%</code> and <em>Balanced</em> appear.</li>
                <li>Copy results — the breakdown includes pool, percentages, payouts and total.</li>
                <li>Communicate percentages alongside amounts so adjustments scale.</li>
              </ol>
            </div>

            <Card className="mt-10 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm">Try this example live</CardTitle>
                <CardDescription>Open the calculator with 50/30/20 pre-filled and edit any value.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/tools/prize-pool-splitter" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)] min-h-[44px]">Open Prize Pool Splitter</Link>
              </CardContent>
            </Card>

            <RelatedContent
              items={[
                { title: "Prize Pool Distribution — Overview", description: "Percentage, equal, ranked and custom.", href: "/guides/esports-prize-pool-distribution", badge: "Guide" },
                { title: "How to Handle Rounding", description: "Largest-remainder reconciliation.", href: "/guides/esports-prize-pool-rounding", badge: "Guide" },
                { title: "Prize Pool Distribution", description: "How distribution differs from pool size.", href: "/glossary/prize-pool-distribution", badge: "Glossary" },
                { title: "For Tournament Organizers", description: "From pool to communicated payouts.", href: "/use-cases/tournament-organizers", badge: "Use case" },
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

  if (guide.slug === "esports-prize-pool-rounding") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides", href: "/guides" }, { label: guide.title }]} />
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Guide • Prize Pool</p>
            <h1 className="font-display mt-2 text-3xl font-normal tracking-tight sm:text-4xl">{guide.title}</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{guide.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">For {guide.audience.join(" · ")} • Published {guide.publishedAt}</p>

            <AnswerBlock question="How do you make prize payouts add up exactly?" answer="Calculate each raw payout, floor to minor units, then distribute the remaining minor units one by one to the largest fractional parts. This largest-remainder method makes the sum equal the prize pool with deterministic tie-breaking." />

            <div className="prose prose-neutral mt-8 max-w-none prose-p:leading-relaxed prose-headings:font-display prose-headings:font-normal">
              <h2>Why fractional currency units appear</h2>
              <p>A percentage of a pool rarely lands on an exact cent/paise. <code>₹100 × 33.3333%</code> is <code>₹33.3333</code>; <code>₹10,000 × 12%</code> is <code>₹1,200.00</code> (exact) but <code>₹10,000 × 8.33%</code> is <code>₹833.00</code> vs <code>₹833.333…</code>. Displaying two decimals without reconciliation creates drift.</p>

              <h2>Why naive rounding drifts</h2>
              <p>Rounding each line independently (<code>Math.round</code> per payout) can make the total <code>₹99.99</code> or <code>₹100.01</code> against a <code>₹100</code> pool. The error is small but visible — and finance teams rightly expect <code>sum == pool</code>.</p>

              <h2>Largest-remainder reconciliation</h2>
              <p>The method MicroNest uses — documented in <code>calculation.ts</code> and tested as deterministic:</p>
              <ol>
                <li>Convert the pool to minor units: <code>minor = round(pool × 100)</code>.</li>
                <li>Compute raw minor payouts: <code>raw = minor × percentage / 100</code> (float).</li>
                <li>Floor each: <code>floored = floor(raw)</code>.</li>
                <li>Remainder: <code>remaining = minor - sum(floored)</code>.</li>
                <li>Sort by fractional part <code>raw - floored</code> descending, then position ascending.</li>
                <li>Distribute one minor unit at a time to that order until <code>remaining == 0</code>.</li>
              </ol>
              <p>Tie-breaking by position makes the result deterministic — same input always yields the same allocation.</p>

              <h2>Example: ₹100 split three ways</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="py-2">Placement</th><th className="py-2">Percent</th><th className="py-2">Raw</th><th className="py-2">Payout</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">1st</td><td className="py-2 font-mono">33.3333%</td><td className="py-2 font-mono">33.3333</td><td className="py-2 font-mono">₹33.34</td></tr>
                  <tr className="border-b"><td className="py-2 font-medium text-foreground">2nd</td><td className="py-2 font-mono">33.3333%</td><td className="py-2 font-mono">33.3333</td><td className="py-2 font-mono">₹33.33</td></tr>
                  <tr><td className="py-2 font-medium text-foreground">3rd</td><td className="py-2 font-mono">33.3333%</td><td className="py-2 font-mono">33.3333</td><td className="py-2 font-mono">₹33.33</td></tr>
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">Total <code>₹100.00</code> • <code>100%</code> • <code>₹0.00</code> remaining. If percentages are exactly <code>33.3333%</code> each, the largest remainder goes to 1st deterministically.</p>

              <h2>Equal split is the same problem</h2>
              <p><code>₹100 ÷ 3</code> is <code>₹33.333…</code> per recipient. The same logic distributes the one-cent remainder to 1st (<code>₹33.34</code>) and the rest <code>₹33.33</code>. For <code>₹1,00,000 ÷ 3</code> the result is <code>₹33,333.34, ₹33,333.33, ₹33,333.33</code>.</p>

              <h2>Communicating rounding to participants</h2>
              <p>Show both percentage and payout, and note that totals reconcile. MicroNest’s copy text includes <code>Prize Pool, placements — percentage — payout, Total Distributed</code> so teams can paste the breakdown directly.</p>

              <h2>What not to do</h2>
              <ul>
                <li>Don’t scale percentages silently to force 100%.</li>
                <li>Don’t hide a <code>₹0.01</code> discrepancy — reconcile it.</li>
                <li>Don’t present 50/30/20 as a rule — document the percentages you chose.</li>
              </ul>
            </div>

            <Card className="mt-10 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm">See reconciliation live</CardTitle>
                <CardDescription>Enter ₹100 with 3 equal recipients and watch the 1-cent distribution.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/tools/prize-pool-splitter" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)] min-h-[44px]">Open Prize Pool Splitter</Link>
              </CardContent>
            </Card>

            <RelatedContent
              items={[
                { title: "Prize Pool Distribution — Overview", description: "All methods with examples.", href: "/guides/esports-prize-pool-distribution", badge: "Guide" },
                { title: "How to Split by Percentage", description: "₹100,000 — 50/30/20 walkthrough.", href: "/guides/esports-prize-pool-percentage-split", badge: "Guide" },
                { title: "Prize Pool Distribution", description: "Distribution vs pool size.", href: "/glossary/prize-pool-distribution", badge: "Glossary" },
                { title: "For Tournament Organizers", description: "Validate and communicate payouts.", href: "/use-cases/tournament-organizers", badge: "Use case" },
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

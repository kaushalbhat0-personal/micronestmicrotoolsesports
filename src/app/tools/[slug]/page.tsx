import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getToolBySlug,
  isValidToolSlug,
  toolCategoryLabel,
} from "@/features/tools/catalog";
import { buildToolDetailMetadata, buildToolNotFoundMetadata } from "../_lib/query";
import { buildToolsCanonicalUrl } from "../_lib/query";
import {
  ToolAvailabilityBadge,
  ToolCategoryBadge,
  toolCompatibilityLabel,
} from "../_components/tool-bits";
import { PrizePoolRunner } from "./_components/prize-pool-runner";
import { RosterBuilderRunner } from "./_components/roster-builder-runner";
import { TiebreakRunner } from "./_components/tiebreak-runner";

// P7.1 runner map: explicit slug → component entries, no dynamic imports,
// no plugin framework. Tool four adds one import + one entry + one test.
// Compile-time safety comes from the component type; registry parity (every
// "available" tool has an entry, every entry names a registry slug) is
// asserted in routes.test.ts so drift fails the suite, not the user.
const TOOL_RUNNERS: Record<string, React.ComponentType> = {
  "prize-pool-splitter": PrizePoolRunner,
  "roster-slot-builder": RosterBuilderRunner,
  "tiebreak-qualifier": TiebreakRunner,
};

type SlugParams = { slug: string };

export const revalidate = 60;

// Public tool landing page (P5). Resolves the slug through the static
// registry only: no database, no outage state, no invented content. Invalid
// and unknown slugs return the identical generic not-found
// (404-equivalence). Available tools render their runner inline; all other
// entries render the honest coming-soon state.
export async function generateMetadata({
  params,
}: {
  params: Promise<SlugParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = isValidToolSlug(slug) ? getToolBySlug(slug) : undefined;
  if (tool === undefined) {
    const missing = buildToolNotFoundMetadata();
    return {
      title: missing.title,
      description: missing.description,
      robots: { index: false, follow: true },
    };
  }
  const copy = buildToolDetailMetadata(tool);
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: true },
    ...(buildToolsCanonicalUrl(`/tools/${tool.slug}`) === undefined
      ? {}
      : { alternates: { canonical: buildToolsCanonicalUrl(`/tools/${tool.slug}`) } }),
  };
}

function RunnerForTool({ slug }: { slug: string }): React.ReactNode {
  const Runner = TOOL_RUNNERS[slug];
  return Runner ? <Runner /> : null;
}

export default async function ToolDetailPage({ params }: { params: Promise<SlugParams> }) {
  const { slug } = await params;
  if (!isValidToolSlug(slug)) {
    notFound();
  }
  const tool = getToolBySlug(slug);
  if (tool === undefined) {
    notFound();
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-6 text-sm">
        <Link
          href="/tools"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to tools
        </Link>
      </p>

      <div className="overflow-hidden rounded-lg bg-arena-950 text-white">
        <div className="border-b-2 border-accent-600 px-4 py-8 sm:px-6">
          <p className="text-xs font-bold tracking-[0.18em] text-accent-300 uppercase">
            Tool · {toolCategoryLabel(tool.category)}
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
            {tool.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{tool.tagline}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ToolAvailabilityBadge availability={tool.availability} />
            <ToolCategoryBadge category={tool.category} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Intended for
            </dt>
            <dd className="mt-1 text-sm font-medium">{tool.audience}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Compatibility
            </dt>
            <dd className="mt-1 text-sm font-medium">
              {toolCompatibilityLabel(tool.gameKeys)} · v{tool.version}
            </dd>
          </div>
        </dl>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-700">{tool.description}</p>
      </div>

      <section aria-labelledby="tool-inputs-heading" className="mt-6">
        <h2 id="tool-inputs-heading" className="text-lg font-semibold">
          Inputs and outputs
        </h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold">You provide</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {tool.inputsExplained.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold">You get</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {tool.outputsExplained.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="tool-usage-heading" className="mt-6">
        <h2 id="tool-usage-heading" className="text-lg font-semibold">
          How to use it
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          {tool.usageGuidance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="tool-run-heading" className="mt-8">
        <h2 id="tool-run-heading" className="font-display text-lg font-extrabold tracking-tight uppercase">
          Use the tool
        </h2>
        {tool.availability === "available" ? (
          <RunnerForTool slug={tool.slug} />
        ) : (
          <div
            role="status"
            className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-center"
          >
            <p className="text-sm font-semibold">Execution coming soon</p>
            <p className="mt-1 text-sm text-slate-600">
              This tool&apos;s landing page is live, but in-browser execution is not
              available yet.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

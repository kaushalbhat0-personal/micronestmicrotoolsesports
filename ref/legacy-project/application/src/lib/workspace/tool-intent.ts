import { TOOLS } from "@/config/app/tools";

/**
 * Tool-intent preservation (RCCF-FIRST-VALUE-FIX-03 F6).
 *
 * When a user picks a tool before choosing a workspace
 * (dashboard card → organization selection), the intended tool travels as
 * `?tool=<slug>` and is re-validated server-side at every hop. Only
 * commercially available registry slugs survive — arbitrary input (paths,
 * URLs, unknown slugs) resolves to null, so intent can never become an
 * open redirect or reach an unreleased tool.
 */

const COMMERCIALLY_AVAILABLE_SLUGS: ReadonlySet<string> = new Set(
  TOOLS.filter((t) => !t.comingSoon).map((t) => t.slug)
);

/** Validate raw `?tool=` input against the canonical tool registry. */
export function parseToolIntent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  if (slug === "" || slug.length > 64) return null;
  if (!COMMERCIALLY_AVAILABLE_SLUGS.has(slug)) return null;
  return slug;
}

/** Customer-facing display name for a validated tool slug. */
export function toolDisplayName(toolSlug: string): string | null {
  const tool = TOOLS.find((t) => t.slug === toolSlug && !t.comingSoon);
  return tool ? tool.name : null;
}

/**
 * Workspace entry route for a validated tool slug. Sponsorship Tracking
 * opens its campaigns list (the operational entry, matching sidebar nav);
 * every other tool opens its workspace root.
 */
export function toolWorkspaceRoute(orgSlug: string, toolSlug: string): string {
  if (toolSlug === "sponsor-sentinel") return `/dashboard/${orgSlug}/sponsor-sentinel/campaigns`;
  return `/dashboard/${orgSlug}/${toolSlug}`;
}

import type { MetadataRoute } from "next";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import { labSitemapPaths } from "@/lib/marketing/public-tool-content";
import { GUIDES } from "@/config/content/guides";
import { GLOSSARY } from "@/config/content/glossary";
import { USE_CASES } from "@/config/content/use-cases";
import { listPublishedMetaParserPaths } from "@/lib/marketing/meta-parser-sitemap";
import { listPublishedBgmiTournamentPaths } from "@/lib/marketing/bgmi-tournaments-sitemap";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const now = new Date();

  const publicPaths = [
    "",
    "/tools",
    ...MARKETING_TOOLS.map((t) => `/tools/${t.slug}`),
    ...labSitemapPaths(),
    "/paid-tools",
    "/bgmi-qualification",
    "/bgmi-tournaments",
    // Finder discovery surface. Per-handle /players/* entries stay out of
    // the sitemap in Phase B: profiles are noindex by default (opt-in via
    // allow_indexing) and must never be thin-programmatic entries.
    // Phase C: /find/teams joins the directory; /teams/[slug] stays out
    // for the same noindex-by-default reason.
    "/find/players",
    "/find/teams",
    ...(await listPublishedBgmiTournamentPaths()).filter((p) => p !== "/bgmi-tournaments"),
    ...(await listPublishedMetaParserPaths()),
    "/pricing",
    "/guides",
    ...GUIDES.map((g) => `/guides/${g.slug}`),
    "/glossary",
    ...GLOSSARY.map((g) => `/glossary/${g.slug}`),
    "/use-cases",
    ...USE_CASES.map((u) => `/use-cases/${u.slug}`),
    "/privacy",
    "/terms",
    "/refund",
    "/digital-delivery",
    "/shipping",
    "/contact",
  ];

  return publicPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/tools" || path === "/meta-parser" || path === "/bgmi-tournaments" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path.startsWith("/tools/") ? 0.8 : path === "/tools" ? 0.9 : path.startsWith("/meta-parser") || path.startsWith("/bgmi-tournaments") || path === "/bgmi-qualification" ? 0.8 : 0.5,
  }));
}

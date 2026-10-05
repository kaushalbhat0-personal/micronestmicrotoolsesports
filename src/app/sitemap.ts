import type { MetadataRoute } from "next";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import { GUIDES } from "@/config/content/guides";
import { GLOSSARY } from "@/config/content/glossary";
import { USE_CASES } from "@/config/content/use-cases";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const now = new Date();

  const publicPaths = [
    "",
    "/tools",
    ...MARKETING_TOOLS.map((t) => `/tools/${t.slug}`),
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
    changeFrequency: path === "" || path === "/tools" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path.startsWith("/tools/") ? 0.8 : path === "/tools" ? 0.9 : 0.5,
  }));
}

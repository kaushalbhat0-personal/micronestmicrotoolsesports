import type { MetadataRoute } from "next";
import { MARKETING_TOOLS } from "@/config/marketing/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const now = new Date();

  const publicPaths = [
    "",
    "/tools",
    ...MARKETING_TOOLS.map((t) => `/tools/${t.slug}`),
    "/privacy",
    "/terms",
  ];

  return publicPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/tools" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path.startsWith("/tools/") ? 0.8 : path === "/tools" ? 0.9 : 0.5,
  }));
}

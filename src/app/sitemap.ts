// M4 sitemap: static marketing routes only (/ and /about).
// Product routes (/players, /players/[handle], /settings/profile) carry
// noindex metadata and MUST NOT appear here (frozen G1 indexing posture).
// Base URL comes from NEXT_PUBLIC_APP_URL only; when unconfigured the
// sitemap is empty (never invent a domain).

import type { MetadataRoute } from "next";
import { getMarketingBaseUrl } from "@/lib/canonical";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getMarketingBaseUrl();
  if (base === undefined) {
    return [];
  }
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.8 },
  ];
}

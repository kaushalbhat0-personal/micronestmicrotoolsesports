import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/tools", "/tools/*", "/guides", "/guides/*", "/glossary", "/glossary/*", "/use-cases", "/use-cases/*", "/privacy", "/terms", "/refund", "/digital-delivery", "/shipping", "/contact"],
        disallow: ["/dashboard", "/dashboard/*", "/api/*", "/auth/*", "/dev/*", "/login", "/signup"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

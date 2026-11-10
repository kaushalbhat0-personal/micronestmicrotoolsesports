import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Cleanup redirects (RCCF-CLEANUP-02): removed unbuilt tool pages → collection.
  async redirects() {
    return [
      {
        source: "/tools/scrim-matchmaker",
        destination: "/tools",
        permanent: true,
      },
      {
        source: "/tools/vod-clipper",
        destination: "/tools",
        permanent: true,
      },
      {
        source: "/tools/roster-sentinel",
        destination: "/tools",
        permanent: true,
      },
    ];
  },
  // Security headers baseline
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

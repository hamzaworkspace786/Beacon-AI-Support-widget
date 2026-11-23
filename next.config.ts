import type { NextConfig } from "next";

// Basic browser protections on every page except the chat window.
const protections = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
      // Every page except /embed/... refuses to be shown inside another website's frame.
      {
        source: "/((?!embed/).*)",
        headers: [...protections, { key: "X-Frame-Options", value: "DENY" }],
      },
      // The chat window is the one page that must be framed, on customers' websites.
      // Which websites may frame it is decided per bot, by the page itself, from the
      // list of allowed websites (see app/embed/[publicId]/page.tsx).
      {
        source: "/embed/:path*",
        headers: protections,
      },
      // The loader is the same for every bot. Browsers may keep it for 5 minutes,
      // then keep using the old copy for up to a day while a new one is fetched.
      {
        source: "/widget.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

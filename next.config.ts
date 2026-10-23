import type { NextConfig } from "next";

/**
 * Allow next/image to optimize images served from the Supabase Storage
 * bucket. Derived from env so it works for any project ref; empty when the
 * env var is missing (e.g. local builds without Supabase).
 *
 * Note: every uploaded image is rendered with `unoptimized`, so it is served
 * straight from its public URL and never reaches the optimizer. This pattern
 * is only a safety net for a remote asset that is still optimized.
 */
function supabaseRemotePatterns(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:" && protocol !== "http:") return [];
    return [
      {
        protocol: protocol === "http:" ? "http" : "https",
        hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  outputFileTracingIncludes: {
    // The agents read their markdown skill files from disk at runtime, so the
    // future chat route must carry them into the serverless output.
    "/api/chat": ["./src/lib/chat/skills/**/*"],
  },
  images: {
    // Only applies to the local static assets in /public (the hero photo and
    // the stock work images) — uploaded files are served unoptimized, so this
    // never touches them.
    qualities: [75, 95],
    remotePatterns: supabaseRemotePatterns(),
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

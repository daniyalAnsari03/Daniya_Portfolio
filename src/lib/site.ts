/**
 * Single source of truth for the public site's SEO identity: the origin URL
 * (canon, metadataBase, sitemap, JSON-LD) and the shared name/title/description.
 */

/** Absolute origin of the public site. Reads the env, falls back safely. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
  "https://daniyal.example.com";

export const SITE_NAME = "Daniyal";

export const SITE_TITLE = "Daniyal | Full-Stack AI Developer";

export const SITE_DESCRIPTION =
  "Full-Stack developer building web apps and AI agents. Based in Karachi, Pakistan.";

export const SITE_JOB_TITLE = "Full-Stack AI Developer";

/** Utility: absolute URL path join, never double or missing slashes. */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

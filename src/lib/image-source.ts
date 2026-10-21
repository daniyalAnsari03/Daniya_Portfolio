/**
 * Uploaded images (project covers, gallery images, About photos/cards,
 * homepage cards) live in the public Supabase Storage bucket and are served
 * straight from their public URL.
 *
 * Those files must reach the browser untouched: the Next.js image optimizer
 * would download the original, resize it and re-encode it (WebP/AVIF), which
 * lowers the quality of the uploaded file even with `quality={95}`. So every
 * uploaded image is rendered with `unoptimized`, which keeps the original URL
 * as-is — no `/_next/image` proxy, no width/quality query params.
 *
 * Local static assets (`/ai.png`, `/works/work-01.jpg`) keep the optimizer:
 * they are already sized for the web and there is nothing to preserve.
 */

/**
 * `true` when the source is an absolute (remote) URL, i.e. an uploaded file
 * served from the Supabase Storage public bucket. Local assets start with `/`
 * and stay optimized.
 */
export function isRemoteImageSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  return /^https?:\/\//i.test(src.trim());
}

/**
 * Builds the demo rate-limit line from the shared copy (docs/fix.txt).
 *
 * The server answers a 429 with `retryAfterSeconds`; the line must say the
 * wait correctly — "in less than a minute" under 60 seconds, otherwise
 * "about N minutes" / "about 1 minute" with the right plural.
 */
import { content } from "@/lib/content";

export function formatRateLimitLine(seconds: number | undefined): string {
  const lines = content.askAi.demo.errors;
  const value = Number(seconds);

  if (!Number.isFinite(value) || value <= 0 || value < 60) {
    return lines.rateLimitedSoon;
  }

  const minutes = Math.ceil(value / 60);
  return lines.rateLimited.replace(
    "{minutes}",
    `${minutes} ${minutes === 1 ? "minute" : "minutes"}`,
  );
}

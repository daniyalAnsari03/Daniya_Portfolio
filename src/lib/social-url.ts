/**
 * Normalizes a social link entered in admin Settings into an absolute
 * http(s) URL. Client-safe (no server-only) so every renderer can use it.
 *
 * Behaviour:
 * - trims whitespace; empty → `null`;
 * - `https://…` / `http://…` kept as-is;
 * - `//host…` repaired to `https://host…`;
 * - a bare domain (`github.com/name`, `www.linkedin.com/in/name`) gets
 *   `https://` prepended;
 * - `javascript:`, `data:` and any other scheme → `null`;
 * - never returns a relative path.
 *
 * Callers must NOT render an icon when the helper returns `null` (no dead
 * link, no `#`, no fallback to this site's own URL).
 */
export function normalizeSocialUrl(
  value: string | null | undefined,
): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;

  const schemeMatch = /^(https?:)?\/\//.exec(trimmed);
  const candidate = schemeMatch
    ? schemeMatch[1]
      ? trimmed
      : `https:${trimmed}`
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const { protocol, hostname } = url;
  if ((protocol !== "https:" && protocol !== "http:") || !hostname) {
    return null;
  }

  return url.toString();
}

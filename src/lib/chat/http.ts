/**
 * Small shared helpers for the SSE chat routes (/api/chat, /api/chat/demo).
 * Pure functions — no data access, no secrets read.
 */

const encoder = new TextEncoder();

/** Serialises one SSE event as a `data:` frame. */
export function sseFrame(event: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/** The keep-alive comment frame. */
export function ssePingFrame(): Uint8Array {
  return encoder.encode(": ping\n\n");
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function methodNotAllowed(): Response {
  return jsonResponse({ error: "method_not_allowed" }, 405, {
    allow: "POST",
  });
}

/** True when the `Origin` header (if any) matches the request host. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host;
    const requestHost =
      request.headers.get("host") ?? new URL(request.url).host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}

/**
 * Logs only the error name and a short message — never env values, headers,
 * tokens or user content.
 */
export function logStreamError(scope: string, error: unknown): void {
  if (error instanceof Error) {
    const message = error.message.replace(/\s+/g, " ").slice(0, 200);
    console.error(`[${scope}] ${error.name}: ${message}`);
    return;
  }
  console.error(`[${scope}] UnknownError`);
}

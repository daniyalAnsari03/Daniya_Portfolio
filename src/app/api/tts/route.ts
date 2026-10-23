/**
 * Public text-to-speech endpoint.
 *
 * - Origin checked and rate limited per hashed IP (a separate budget from the
 *   chat), with the text length capped.
 * - The spoken text is never logged and never stored.
 * - The model, API key and voice live on the server only; no secret reaches
 *   the client.
 */

import "server-only";

import { z } from "zod";

import { getClientIp, hashIp } from "@/lib/chat/ip";
import { checkRateLimitWithKey } from "@/lib/chat/sessions";
import {
  TTS_INSTRUCTIONS,
  TTS_SPEED,
  TTS_VOICE,
} from "@/lib/chat/tts-config";

export const maxDuration = 30;

const MAX_BODY_BYTES = 2 * 1024;
const TTS_TIMEOUT_MS = 20_000;
const TTS_RATE_LIMIT = 60;
const TTS_RATE_LIMIT_WINDOW_SECONDS = 600;
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(300),
});

function jsonResponse(
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

function methodNotAllowed(): Response {
  return jsonResponse({ error: "method_not_allowed" }, 405, {
    allow: "POST",
  });
}

function logTtsError(error: unknown): void {
  if (error instanceof Error) {
    const message = error.message.replace(/\s+/g, " ").slice(0, 200);
    console.error(`[api/tts] ${error.name}: ${message}`);
    return;
  }
  console.error("[api/tts] UnknownError");
}

function isSameOrigin(request: Request): boolean {
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

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const contentType = request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();

    if (contentType !== "application/json") {
      return jsonResponse({ error: "unsupported_media_type" }, 415);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "payload_too_large" }, 413);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }

    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    const ipHash = hashIp(getClientIp(request));
    const rateLimit = await checkRateLimitWithKey(
      `${ipHash}:tts`,
      TTS_RATE_LIMIT,
      TTS_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (!rateLimit.allowed) {
      return jsonResponse(
        {
          error: "rate_limited",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        429,
        { "retry-after": String(rateLimit.retryAfterSeconds) },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_TTS_MODEL?.trim();

    if (!apiKey || !model) {
      return jsonResponse({ error: "unavailable" }, 503);
    }

    const speechBody: Record<string, unknown> = {
      model,
      input: parsed.data.text,
      voice: TTS_VOICE,
      response_format: "mp3",
      speed: TTS_SPEED,
    };

    if (model.startsWith("gpt-4o-mini-tts")) {
      speechBody.instructions = TTS_INSTRUCTIONS;
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    const timeout = setTimeout(abort, TTS_TIMEOUT_MS);
    request.signal.addEventListener("abort", abort);

    let upstream: Response;

    try {
      upstream = await fetch(OPENAI_SPEECH_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(speechBody),
        signal: controller.signal,
      });
    } catch (error) {
      if (request.signal.aborted) {
        return jsonResponse({ error: "server_error" }, 500);
      }
      logTtsError(error);
      return jsonResponse({ error: "tts_unavailable" }, 502);
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", abort);
    }

    if (!upstream.ok) {
      console.error(`[api/tts] OpenAI responded ${upstream.status}`);
      return jsonResponse({ error: "tts_unavailable" }, 502);
    }

    const audio = await upstream.arrayBuffer();

    return new Response(audio, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
        "content-length": String(audio.byteLength),
      },
    });
  } catch (error) {
    logTtsError(error);
    return jsonResponse({ error: "server_error" }, 500);
  }
}

export function GET(): Response {
  return methodNotAllowed();
}

export function PUT(): Response {
  return methodNotAllowed();
}

export function PATCH(): Response {
  return methodNotAllowed();
}

export function DELETE(): Response {
  return methodNotAllowed();
}

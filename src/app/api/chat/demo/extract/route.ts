/**
 * Demo PDF context extraction (docs/fix.txt).
 *
 * A small helper endpoint for the demo setup screen: it receives one PDF,
 * extracts its text server-side with `unpdf` and returns the text to the
 * browser so it can fill the context textarea. Text-based PDFs only.
 *
 * Nothing is stored or logged: the PDF bytes, the extracted text and the file
 * name never touch a database, a storage bucket or a temp file — the bytes
 * live only inside this request. Nothing is sent to OpenAI here.
 *
 * - Rate limited per hashed IP (6 uploads / 10 minutes, `${ipHash}:demoextract`).
 * - Limits: 4 MB file, 40 pages, ~20 s extraction timeout, 8000 characters out.
 * - Error codes: too_large, invalid_file, unreadable, no_text, rate_limited, server.
 */

import { getDocumentProxy } from "unpdf";

import {
  jsonResponse,
  logStreamError,
  methodNotAllowed,
  isSameOrigin,
} from "@/lib/chat/http";
import { getClientIp, hashIp } from "@/lib/chat/ip";
import { checkRateLimitWithKey } from "@/lib/chat/sessions";

export const maxDuration = 60;

/** Content-Length is checked again on the real file below; this is just the early reject. */
const MAX_HEADER_BYTES = 4.2 * 1024 * 1024;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 40;
const EXTRACT_TIMEOUT_MS = 20_000;
const MAX_TEXT_CHARS = 8000;
/** Anything shorter than this is almost certainly a scanned/image-only PDF. */
const MIN_TEXT_CHARS = 20;

/** The demo-extract budget: a separate key so it never shares a counter. */
const EXTRACT_RATE_LIMIT = 6;
const EXTRACT_RATE_LIMIT_WINDOW_SECONDS = 600;

/**
 * Extracts the text of the first `MAX_PAGES` pages (pages beyond that are
 * ignored). Mirrors unPDF's own `getPageText` so the limit is applied instead
 * of parsing the whole document.
 */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  const parts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => {
        if (!("str" in item) || typeof item.str !== "string") return "";
        return item.str + (item.hasEOL ? "\n" : "");
      })
      .join("");
    parts.push(text);
  }

  return parts.join("\n\n");
}

/**
 * Runs the extraction under a fixed timeout so a bad PDF can never hang the
 * function. The PDF itself is rejected with a clean `unreadable` error —
 * password-protected, corrupted or unreadable files all land here, and no
 * internals ever leak to the client.
 */
async function extractWithTimeout(buffer: ArrayBuffer): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let text = "";

  try {
    const result = await Promise.race([
      extractPdfText(buffer),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("extraction timed out")),
          EXTRACT_TIMEOUT_MS,
        );
      }),
    ]);
    text = result;
  } finally {
    if (timer) clearTimeout(timer);
  }

  // Clean: normalize line breaks, collapse runs of spaces and blank lines,
  // strip control characters (keep line breaks).
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TEXT_CHARS) return { text, truncated: false };
  return {
    text: text.slice(0, MAX_TEXT_CHARS).trim(),
    truncated: true,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    // a. Origin host check
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    // b. Multipart/form-data only
    const contentType = request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();
    if (contentType !== "multipart/form-data") {
      return jsonResponse({ error: "unsupported_media_type" }, 415);
    }

    // c. Early size reject when the header is present.
    const contentLength = Number(request.headers.get("content-length") ?? "");
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_HEADER_BYTES
    ) {
      return jsonResponse({ error: "too_large" }, 413);
    }

    // d. IP hash (HMAC) — fails closed when the env secret is missing.
    let ipHash: string;
    try {
      ipHash = hashIp(getClientIp(request));
    } catch {
      logStreamError("api/chat/demo/extract", new Error("missing ip hash secret"));
      return jsonResponse({ error: "server" }, 500);
    }

    // e. Rate limit BEFORE the file is parsed.
    let rateLimit;
    try {
      rateLimit = await checkRateLimitWithKey(
        `${ipHash}:demoextract`,
        EXTRACT_RATE_LIMIT,
        EXTRACT_RATE_LIMIT_WINDOW_SECONDS,
      );
    } catch {
      return jsonResponse({ error: "server" }, 500);
    }

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

    // f. Exactly one File named "file".
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    const files = formData.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File)) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const file = files[0] as File;

    // g. Real size check.
    if (file.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: "too_large" }, 413);
    }

    // h. Magic bytes — never trust the name or mime type.
    const buffer = await file.arrayBuffer();
    const magic = new TextDecoder().decode(buffer.slice(0, 5));
    if (!magic.startsWith("%PDF-")) {
      return jsonResponse({ error: "invalid_file" }, 400);
    }

    // i./j. Extract (max 40 pages, timed out) and clean the text.
    let extractedText: string;
    try {
      extractedText = await extractWithTimeout(buffer);
    } catch (error) {
      logStreamError("api/chat/demo/extract", error);
      return jsonResponse({ error: "unreadable" }, 422);
    }

    // k. Tiny/empty text = scanned or image-only PDF.
    if (extractedText.length < MIN_TEXT_CHARS) {
      return jsonResponse({ error: "no_text" }, 422);
    }

    // l. Truncate and return; jsonResponse already sets Cache-Control:
    //    no-store, but it is repeated explicitly for clarity here.
    const { text, truncated } = truncate(extractedText);

    return jsonResponse({ text, truncated }, 200, {
      "cache-control": "no-store",
    });
  } catch (error) {
    logStreamError("api/chat/demo/extract", error);
    return jsonResponse({ error: "server" }, 500);
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

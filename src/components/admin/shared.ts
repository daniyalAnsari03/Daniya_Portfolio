/* Shared admin building blocks: form styles, file validation and the
   signed-upload helper. Used by every admin section (projects, about,
   homepage) so the look and the upload flow stay identical. */

export const FIELD_CLASS =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-3 text-sm text-[#111111] outline-none transition-colors placeholder:text-black/30 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";
export const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[#111111]/70";
export const CARD_CLASS = "rounded-2xl border border-black/10 bg-white p-5 sm:p-6";
export const BUTTON_CLASS =
  "rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40";
export const PRIMARY_BUTTON_CLASS =
  "rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const VIDEO_ACCEPT = "video/mp4,video/webm";

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Only JPEG, PNG or WebP images are allowed.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Images must be 10 MB or smaller.";
  }
  if (file.size === 0) {
    return "That image could not be read.";
  }
  return null;
}

export function validateVideoFile(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
    return "Only MP4 or WebM videos are allowed.";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return "Videos must be 50 MB or smaller.";
  }
  if (file.size === 0) {
    return "That video could not be read.";
  }
  return null;
}

export type MediaKind = "image" | "video";

export function validateMediaFile(file: File, kind: MediaKind): string | null {
  return kind === "video" ? validateVideoFile(file) : validateImageFile(file);
}

/**
 * Uploads a file to a signed Supabase Storage URL and reports the progress,
 * so the admin can show a progress bar.
 */
export function uploadWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("Content-Type", file.type);
    request.setRequestHeader("cache-control", "max-age=31536000");
    request.setRequestHeader("x-upsert", "false");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve({ ok: true });
        return;
      }

      let message = "Upload failed. Please try again.";
      try {
        const parsed = JSON.parse(request.responseText) as {
          message?: unknown;
          error?: unknown;
        };
        const detail =
          typeof parsed.message === "string"
            ? parsed.message
            : typeof parsed.error === "string"
              ? parsed.error
              : "";
        if (detail) message = detail;
      } catch {
        // Keep the generic message for non-JSON responses.
      }
      resolve({ ok: false, error: message });
    };

    request.onerror = () => {
      resolve({ ok: false, error: "Upload failed. Check your connection." });
    };

    request.send(file);
  });
}

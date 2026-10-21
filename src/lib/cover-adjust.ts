import type { CSSProperties } from "react";

/** How the cover image is fitted into the card box. */
export type CoverFit = "contain" | "cover";

/**
 * Per-project cover framing, edited in the admin dashboard and rendered by
 * the Works card. The uploaded file itself is never modified: only a uniform
 * scale and a position are applied to the rendered element.
 */
export type CoverAdjust = {
  fit: CoverFit;
  /** Focus point on the X axis (0…100, percent). */
  posX: number;
  /** Focus point on the Y axis (0…100, percent). */
  posY: number;
  /** Uniform scale (1…3). */
  zoom: number;
};

/** Defaults used when a project has no saved framing. */
export const DEFAULT_COVER_ADJUST: CoverAdjust = {
  fit: "contain",
  posX: 50,
  posY: 50,
  zoom: 1,
};

export const COVER_ZOOM_MIN = 1;
export const COVER_ZOOM_MAX = 3;
export const COVER_ZOOM_STEP = 0.05;

/**
 * The default framing of a media card that is cropped to its box
 * (object-fit: cover) — the About hero cards and the homepage cards have
 * always been rendered that way.
 */
export const DEFAULT_CARD_ADJUST: CoverAdjust = {
  fit: "cover",
  posX: 50,
  posY: 50,
  zoom: 1,
};

function clampValue(
  value: number | string | null | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Normalise (and clamp) any incoming framing value. Used on the server
 * before a write and on read, so an out-of-range value can never reach the
 * page.
 *
 * `fallback` decides what a missing/invalid value falls back to — it lets a
 * surface keep its own default framing (e.g. the homepage cards are cropped
 * to the box) without duplicating the clamping rules.
 */
export function clampCoverAdjust(
  adjust: Partial<CoverAdjust> | null | undefined,
  fallback: CoverAdjust = DEFAULT_COVER_ADJUST,
): CoverAdjust {
  const fit =
    adjust?.fit === "cover"
      ? "cover"
      : adjust?.fit === "contain"
        ? "contain"
        : fallback.fit;

  return {
    fit,
    posX: clampValue(adjust?.posX, 0, 100, fallback.posX),
    posY: clampValue(adjust?.posY, 0, 100, fallback.posY),
    zoom: clampValue(
      adjust?.zoom,
      COVER_ZOOM_MIN,
      COVER_ZOOM_MAX,
      fallback.zoom,
    ),
  };
}

/**
 * The single rendering rule shared by the Works card and the admin preview,
 * so the preview always matches the published card.
 *
 * - `contain`: the whole screenshot stays visible (object-fit: contain,
 *   centred).
 * - `cover`: the box is filled (object-fit: cover) and the focus point decides
 *   which part of the image is shown.
 *
 * The zoom is always a uniform scale around the focus point — never a
 * stretch.
 */
export function coverAdjustStyle(adjust: CoverAdjust): CSSProperties {
  const { fit, posX, posY, zoom } = clampCoverAdjust(adjust);
  const origin = `${posX}% ${posY}%`;

  return {
    objectFit: fit === "cover" ? "cover" : "contain",
    objectPosition: fit === "cover" ? origin : "center",
    transform: `scale(${zoom})`,
    transformOrigin: origin,
  };
}

/**
 * Only the transform part of the rule (the uniform scale around the focus
 * point). Useful when the scale has to live on a different element than the
 * object-fit/object-position (e.g. when a hover zoom is applied on top).
 */
export function coverAdjustTransform(adjust: CoverAdjust): CSSProperties {
  const { posX, posY, zoom } = clampCoverAdjust(adjust);

  return {
    transform: `scale(${zoom})`,
    transformOrigin: `${posX}% ${posY}%`,
  };
}

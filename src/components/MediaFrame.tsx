"use client";

import Image from "next/image";
import {
  clampCoverAdjust,
  coverAdjustStyle,
  DEFAULT_CARD_ADJUST,
  type CoverAdjust,
} from "@/lib/cover-adjust";
import { isRemoteImageSrc } from "@/lib/image-source";

export type MediaFrameKind = "image" | "video";

type MediaFrameProps = {
  src: string;
  alt?: string;
  /** `video` renders a looping muted <video>, `image` a next/image. */
  kind?: MediaFrameKind;
  /** Framing saved in the admin dashboard (fit, focus point, zoom). */
  adjust: CoverAdjust;
  /** `sizes` for the image optimizer. */
  sizes?: string;
  priority?: boolean;
  /** Extra classes for the media element itself. */
  className?: string;
};

/**
 * The shared media renderer. It shows either an image (next/image) or a video
 * and frames both with the admin's "Image fit" values:
 *
 * - `contain`: the whole file stays visible (object-fit: contain, centred).
 * - `cover`: the box is filled (object-fit: cover) and the focus point decides
 *   which part is shown.
 *
 * The zoom is always a uniform scale around the focus point — never a stretch.
 * The uploaded file itself is never modified.
 *
 * Uploaded files (absolute Supabase Storage URLs) are rendered with
 * `unoptimized`, so the browser downloads the original bytes — no resize and
 * no re-encode by the Next.js image optimizer. Local assets in `/public` keep
 * the optimizer.
 */
export default function MediaFrame({
  src,
  alt = "",
  kind = "image",
  adjust,
  sizes,
  priority = false,
  className,
}: MediaFrameProps) {
  const style = coverAdjustStyle(clampCoverAdjust(adjust, DEFAULT_CARD_ADJUST));
  const classes = `h-full w-full ${className ?? ""}`;
  const unoptimized = isRemoteImageSrc(src);

  if (kind === "video") {
    return (
      <video
        src={src}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        className={classes}
        style={style}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      quality={95}
      unoptimized={unoptimized}
      priority={priority}
      decoding="async"
      draggable={false}
      className={classes}
      style={style}
    />
  );
}

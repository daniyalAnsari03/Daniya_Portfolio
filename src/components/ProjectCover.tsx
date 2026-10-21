"use client";

import MediaFrame from "@/components/MediaFrame";
import {
  clampCoverAdjust,
  DEFAULT_COVER_ADJUST,
  type CoverAdjust,
} from "@/lib/cover-adjust";

type ProjectCoverProps = {
  src: string;
  alt: string;
  /** Framing saved in the admin dashboard (fit, focus point, zoom). */
  adjust: CoverAdjust;
  /** `sizes` for the image optimizer. */
  sizes: string;
  className?: string;
  priority?: boolean;
};

/**
 * A project cover image rendered with the framing saved in the admin
 * dashboard. The Works card and the admin preview both render the cover
 * through this component, so what the admin sees is exactly what the public
 * page shows.
 *
 * It is a thin wrapper around the shared `MediaFrame`, so the project cover,
 * the About hero cards and the homepage cards all follow the same rendering
 * rule.
 *
 * The uploaded file is never modified: only a uniform scale and a position
 * are applied to the rendered element.
 *
 * Uploaded covers are served from their original Supabase Storage URL
 * (`unoptimized`), so the published card shows the file exactly as it was
 * uploaded.
 */
export default function ProjectCover({
  src,
  alt,
  adjust,
  sizes,
  className,
  priority = false,
}: ProjectCoverProps) {
  return (
    <MediaFrame
      src={src}
      alt={alt}
      kind="image"
      adjust={clampCoverAdjust(adjust, DEFAULT_COVER_ADJUST)}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}

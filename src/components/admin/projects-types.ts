import type { CoverAdjust } from "@/lib/cover-adjust";

export type ProjectImageRow = {
  id: string;
  url: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  demoLink: string;
  coverImageUrl: string;
  /** Framing of the cover image inside the card (fit, focus point, zoom). */
  coverAdjust: CoverAdjust;
  visible: boolean;
  images: ProjectImageRow[];
};

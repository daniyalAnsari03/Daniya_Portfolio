import type { CoverAdjust } from "@/lib/cover-adjust";

export type HomepageContentData = {
  heroLine1: string;
  heroLine2: string;
  heroSubtitle: string;
  coverLabel: string;
  coverHeading1: string;
  coverHeading2: string;
  reelLabel: string;
  reelVideoUrl: string;
  worksHeading: string;
  contactLine1: string;
  contactLine2: string;
  contactAccentWord: string;
};

export type HomepageCardRow = {
  id: string;
  imageUrl: string;
  /** The framing of the image inside the card box (fit, focus point, zoom). */
  coverAdjust: CoverAdjust;
  visible: boolean;
};

export type HomepageStatus =
  | { status: "success"; message: string }
  | { status: "error"; message: string }
  | null;

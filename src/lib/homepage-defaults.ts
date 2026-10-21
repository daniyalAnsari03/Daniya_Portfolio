import { content } from "@/lib/content";
import { DEFAULT_CARD_ADJUST, type CoverAdjust } from "@/lib/cover-adjust";

/**
 * The homepage defaults.
 *
 * Every text and every card of the homepage lives here as a fallback: when the
 * database has no row (or no card) the homepage renders EXACTLY what it
 * renders today. Once the admin saves content, the database wins.
 *
 * This file is imported by the server (reads), by the client components
 * (rendering) and by the admin UI (the pre-filled form), so it must stay
 * free of server-only code.
 */

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

export const HOMEPAGE_TEXT_LIMITS = {
  headline: 60,
  subtitle: 140,
  label: 40,
  pill: 20,
  contact: 40,
} as const;

export type HomepageContent = {
  hero: {
    /** Headline line 1 (behind the photo). */
    line1: string;
    /** Headline line 2 (in front of the photo). */
    line2: string;
    subtitle: string;
  };
  cover: {
    label: string;
    heading1: string;
    heading2: string;
    /** The text inside the reel pill. */
    reelLabel: string;
    /** Optional video played inside the pill (empty = animated gradient). */
    reelVideoUrl: string;
  };
  works: {
    heading: string;
  };
  contact: {
    line1: string;
    line2: string;
    /** The word shown in the accent colour. */
    accentWord: string;
  };
};

/** The shape of the form the admin dashboard sends to the server action. */
export type HomepageContentInput = {
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

/** The current hardcoded homepage copy — the fallback for every field. */
export const HOMEPAGE_DEFAULTS: HomepageContent = {
  hero: {
    line1: content.headline.line1,
    line2: content.headline.line2,
    subtitle: content.subtitle,
  },
  cover: {
    label: content.cover.label,
    heading1: content.cover.heading.line1,
    heading2: content.cover.heading.line2,
    reelLabel: content.cover.pillText,
    reelVideoUrl: "",
  },
  works: {
    heading: content.works.heading,
  },
  contact: {
    line1: content.contact.heading.line1,
    line2: content.contact.heading.line2,
    accentWord: "together",
  },
};

/* -------------------------------------------------------------------------- */
/* Cards                                                                      */
/* -------------------------------------------------------------------------- */

export type HomepageCard = {
  id: string;
  /** The image URL (a local path for the stock cards). */
  src: string;
  alt: string;
  /** Framing of the image inside the card box (fit, focus point, zoom). */
  adjust: CoverAdjust;
  visible: boolean;
};

/**
 * The 10 stock cards of the homepage "Recent works" row — the same images, in
 * the same order, with the same shapes. Used until the admin saves cards.
 */
export const HOMEPAGE_STOCK_CARDS: HomepageCard[] = content.works.images.map(
  (image, index) => ({
    id: `stock-${index + 1}`,
    src: image.src,
    alt: image.alt,
    adjust: DEFAULT_CARD_ADJUST,
    visible: true,
  }),
);

/* -------------------------------------------------------------------------- */
/* Card shapes                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The row alternates portrait / landscape by slot index (portrait first). The
 * sizes are the ones the homepage uses today — the admin preview reads the
 * same constants, so the preview shows the real card box.
 */
export const HOMEPAGE_CARD_SHAPES = [
  {
    portrait: true,
    /** The card box on the homepage. */
    className: "h-[82vw] w-[62vw] lg:h-[21.6vw] lg:w-[16.25vw]",
    /** Width / height of the box (desktop values). */
    aspect: 16.25 / 21.6,
    /** `sizes` for the image optimizer. */
    sizes: "(max-width: 1023px) 62vw, 16.25vw",
  },
  {
    portrait: false,
    className: "h-[60vw] w-[80vw] lg:h-[16.2vw] lg:w-[21.6vw]",
    aspect: 21.6 / 16.2,
    sizes: "(max-width: 1023px) 80vw, 21.6vw",
  },
] as const;

/** The shape of the card at the given slot index. */
export function homepageCardShape(index: number) {
  return HOMEPAGE_CARD_SHAPES[index % HOMEPAGE_CARD_SHAPES.length];
}

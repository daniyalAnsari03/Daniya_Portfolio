/**
 * The About hero card box — the single source of truth for its size, radius
 * and aspect ratio.
 *
 * The public About page (`MediaMarquee`) and the admin preview
 * (`About > Hero`) both read these constants, so the preview shows the exact
 * box the card is published in.
 */

/** The size pattern repeats every 3 cards (square, tall, short). */
export const ABOUT_HERO_CARD_PATTERN = 3;

/** The rounded corners of a hero card. */
export const ABOUT_HERO_CARD_RADIUS_CLASS = "rounded-[12px]";

/**
 * Size pattern (square, tall, short) per breakpoint: mobile ~62vw wide,
 * tablet ~34vw, desktop 21 / 19.5 / 21vw.
 */
export const ABOUT_HERO_CARD_SIZES = [
  "h-[62vw] w-[62vw] sm:h-[34vw] sm:w-[34vw] lg:h-[21vw] lg:w-[21vw]",
  "h-[76.7vw] w-[57.5vw] sm:h-[42.1vw] sm:w-[31.6vw] lg:h-[26vw] lg:w-[19.5vw]",
  "h-[37.8vw] w-[62vw] sm:h-[20.7vw] sm:w-[34vw] lg:h-[12.8vw] lg:w-[21vw]",
];

export const ABOUT_HERO_CARD_SIZES_FALLBACK =
  "h-[62vw] w-[62vw] lg:h-[21vw] lg:w-[21vw]";

/**
 * Only TWO vertical levels: the tall card sits ~10svh higher than every other
 * card. The row starts at 62svh (bottom of the hero heading block), so the
 * tall card's top lands at ~66svh and the rest at ~76svh — all top-aligned
 * and running past the fold.
 */
export const ABOUT_HERO_CARD_LEVELS = ["mt-[14svh]", "mt-[4svh]", "mt-[14svh]"];

export const ABOUT_HERO_CARD_LEVELS_FALLBACK = "mt-[14svh]";

/**
 * Width / height ratio of every pattern slot (desktop values — the ratio is
 * the same on the other breakpoints). Used by the admin preview so it shows
 * the real card box.
 */
export const ABOUT_HERO_CARD_ASPECTS = [21 / 21, 19.5 / 26, 21 / 12.8];

export const ABOUT_HERO_CARD_ASPECT_FALLBACK = 1;

/** The size classes of a card at the given index. */
export function aboutHeroCardSizeClass(index: number): string {
  return (
    ABOUT_HERO_CARD_SIZES[index % ABOUT_HERO_CARD_PATTERN] ??
    ABOUT_HERO_CARD_SIZES_FALLBACK
  );
}

/** The vertical level of a card at the given index. */
export function aboutHeroCardLevelClass(index: number): string {
  return (
    ABOUT_HERO_CARD_LEVELS[index % ABOUT_HERO_CARD_PATTERN] ??
    ABOUT_HERO_CARD_LEVELS_FALLBACK
  );
}

/** The width / height ratio of the card box at the given index. */
export function aboutHeroCardAspect(index: number): number {
  return (
    ABOUT_HERO_CARD_ASPECTS[index % ABOUT_HERO_CARD_PATTERN] ??
    ABOUT_HERO_CARD_ASPECT_FALLBACK
  );
}

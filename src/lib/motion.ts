import type { Transition, Variants } from "framer-motion";

/**
 * One shared easing curve used everywhere.
 * cubic-bezier(0.76, 0, 0.24, 1)
 */
export const EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];

/** Standard durations (seconds). */
export const duration = {
  fast: 0.4,
  base: 0.7,
  slow: 1.1,
} as const;

/**
 * Easing for the hero / nav load-in sequence.
 * cubic-bezier(0.22, 1, 0.36, 1)
 */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Hero + nav load-in sequence, played once on page load.
 * `delay` is the absolute start time in seconds measured from load; `duration`
 * in seconds. `stagger`/`distance` in px (the photo travels in vh). Tune here.
 */
export const load = {
  ease: EASE_OUT,
  line1: { delay: 0.2, duration: 1.4 }, // masked slide-up
  line2: { delay: 0.7, duration: 1.4 }, // masked slide-up
  subtitle: { delay: 1.2, duration: 1.0 }, // fade
  nav: { delay: 1.5, duration: 1.4, from: 90 }, // rise from below
  corners: { delay: 2.2, duration: 1.1, stagger: 0.15, distance: 20 },
  photo: { delay: 2.9, duration: 1.8, from: "14vh", to: "0vh" }, // rise + fade
};

/** Reusable transitions built from the shared curve + durations. */
export const transition = {
  fast: { duration: duration.fast, ease: EASE } satisfies Transition,
  base: { duration: duration.base, ease: EASE } satisfies Transition,
  slow: { duration: duration.slow, ease: EASE } satisfies Transition,
  reveal: { duration: duration.slow, ease: EASE } satisfies Transition,
} as const;

/**
 * Slide-up reveal from behind a clipped mask.
 * Parent must clip with `overflow-hidden`.
 */
export const maskReveal: Variants = {
  hidden: { y: "115%" },
  visible: { y: "0%" },
};

/** Fade + subtle rise. */
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/** Fade only (for fixed corner / nav chrome). */
export const fadeIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Site-wide page-transition and shared-popup tokens (docs/fix.txt).
 *
 * One file, one source of truth for the timing of anything that is not a
 * per-section scroll reveal: the Home / Works / About page transition, the
 * contact + project sheets, and the stagger used inside them. Change one value
 * here to retune the whole site's speed.
 *
 * - `pageTransition` / `popup` share the site's existing 1.3s "slow" feel.
 * - `easeInOut` is the site curve (EASE) — same one the cover, nav and popups
 *   already used; `easeOut` is the hero/nav load curve (EASE_OUT).
 * - `oldPageEndScale` is how small the *outgoing* page gets while the new one
 *   rises over it; `transitionBackground` is the colour revealed around the
 *   shrinking page. Both are read by the page transition only.
 */
export const pageMotion = {
  /** Full page transition between Home / Works / About (seconds). */
  pageTransition: 1.3,
  /** Shared popup feel — contact + project sheets (seconds). */
  popup: 1.3,
  /** Smaller items inside a popup/stagger: rows, chips, gallery images. */
  item: 1.0,
  /** Delay between consecutive items in a stagger (seconds). */
  stagger: 0.15,
  /** Short fade used for prefers-reduced-motion instead of a transition. */
  fade: 0.2,
  /** Ease in-out — cubic-bezier(0.76, 0, 0.24, 1), the site curve. */
  easeInOut: EASE,
  /** Smooth ease-out — cubic-bezier(0.22, 1, 0.36, 1). */
  easeOut: EASE_OUT,
  /** Scale the outgoing page shrinks to while the new page rises (1 = no shrink). */
  oldPageEndScale: 0.5,
  /**
   * How far the outgoing page LIFTS while it shrinks, in vh (negative = up).
   * Same progress value as the scale, so the whole site moves as one.
   * The lift is applied on an OUTER wrapper (screen space, never scaled) and
   * the scale on an INNER wrapper, so the page really moves up instead of
   * only appearing to shrink towards the centre.
   */
  oldPageEndLift: -20,
  /** Colour revealed behind the shrinking outgoing page (design token, no hex). */
  transitionBackground: "var(--charcoal)",
  /** Safety net: force-reset the transition if it never completes (seconds). */
  failsafe: 2,
} as const;

/**
 * About page tokens (see docs/fix.txt). Every /about animation derives its
 * durations and stagger from `pageMotion` — change one value there to retune
 * the whole site. Nothing on /about hardcodes a duration. Only the curves are
 * About-specific (its reveals use a slightly softer ease-out than the site
 * default).
 */
export const about = {
  /** Page-level reveals: hero lines, section slides, word reveals. */
  pageDuration: pageMotion.pageTransition,
  /** Shared popup feel (contact / project sheets). */
  popupDuration: pageMotion.popup,
  /** Smaller items: lines, chips, detail rows. */
  itemDuration: pageMotion.item,
  /** Delay between consecutive items in a stagger. */
  stagger: pageMotion.stagger,
  /** Ease in-out — cubic-bezier(0.65, 0, 0.35, 1). */
  easeInOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  /** Ease out — cubic-bezier(0.22, 1, 0.36, 1), same curve as EASE_OUT. */
  easeOut: EASE_OUT,
};

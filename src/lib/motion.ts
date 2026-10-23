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
 * Resume / CV tokens (see docs/fix.txt).
 *
 * The right-edge "Resume" tab and the CV drawer read every timing from here:
 * the drawer slides in with the same slow feel as the other popups, the CV
 * content staggers in behind it and the tab slides in after the page's own
 * load animation. Only `opacity` and `transform` animate.
 */
export const cvMotion = {
  /** The drawer slides in / out (seconds) — the shared popup feel. */
  drawer: pageMotion.popup,
  /** Duration of one CV block inside the drawer (seconds). */
  item: pageMotion.item,
  /** Delay between two CV blocks (seconds). */
  stagger: pageMotion.stagger,
  /** Short fade (seconds) — the tab hiding and the reduced-motion state. */
  fade: pageMotion.fade,
  /** Ease in-out — the site curve. */
  easeInOut: pageMotion.easeInOut,
  /** Smooth ease-out — the hero/nav load curve. */
  easeOut: pageMotion.easeOut,
  /** The Resume tab slides in from the right, after the page load animation. */
  tab: {
    /**
     * The tab appears once the page's own load sequence (the corner chrome)
     * has finished — the delay is derived from the shared load tokens.
     */
    delay: load.corners.delay + load.corners.duration + 0.1,
    duration: 1.2,
    from: 40,
    ease: EASE_OUT,
  },
} as const;

/**
 * About page tokens (see docs/fix.txt). Every /about animation derives its
 * durations and stagger from `pageMotion` — change one value there to retune
 * the whole site. Nothing on /about hardcodes a duration. Only the curves are
 * About-specific (its reveals use a slightly softer ease-out than the site
 * default).
 */export const about = {
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

/**
 * Ask AI chat tokens (see docs/fix.txt).
 *
 * The right-edge "Ask AI" tab and its drawer read every timing from here.
 * The drawer slides in with the same slow feel as the CV drawer, the chat
 * content staggers in behind it and the tab slides in just after the Resume
 * tab. Only `opacity` and `transform` animate.
 */
export const askAiMotion = {
  /** The drawer slides in / out (seconds) — the shared popup feel. */
  drawer: pageMotion.popup,
  /** Duration of one item inside the drawer (seconds). */
  item: pageMotion.item,
  /** Delay between two staggered items (seconds). */
  stagger: pageMotion.stagger,
  /** Short fade (seconds) — the tab hiding and the reduced-motion state. */
  fade: pageMotion.fade,
  /** Ease in-out — the site curve. */
  easeInOut: pageMotion.easeInOut,
  /** Smooth ease-out — the hero/nav load curve. */
  easeOut: pageMotion.easeOut,
  /** The Ask AI tab slides in from the right, just after the Resume tab. */
  tab: {
    /**
     * The tab appears once the page's own load sequence (the corner chrome)
     * has finished — the delay is derived from the shared load tokens and sits
     * a little after the Resume tab so the two slide in one after the other.
     */
    delay: cvMotion.tab.delay + 0.2,
    duration: cvMotion.tab.duration,
    from: cvMotion.tab.from,
    ease: cvMotion.tab.ease,
  },
  /** A chat message fades and rises in. */
  message: { duration: 0.45, distance: 12 },
  /** The three typing dots pulse, one after the other. */
  typing: { duration: 1.1, stagger: 0.18 },
  /** The voice orb rings breathe. */
  pulse: { duration: 1.8 },
  /** The equalizer bars — each bar is a little slower than the one before. */
  bars: { duration: 1.4, stagger: 0.16 },
  /** The theme popover fades in under the theme button. */
  menu: { duration: 0.25 },
  /**
   * The entry sequence of the opening screen: the heading first, then the
   * suggested questions one by one, then the input bar.
   */
  entry: {
    heading: { delay: 0.1 },
    row: { delay: 0.25, stagger: 0.12 },
    input: { delay: 0.7 },
  },
} as const;

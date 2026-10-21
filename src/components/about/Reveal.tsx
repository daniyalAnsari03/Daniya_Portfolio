"use client";

import {
  Fragment,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { about, duration } from "@/lib/motion";
import { useFrozenPage, useLoadGate } from "@/components/PageTransition";

/* ------------------------------------------------------------------ */
/* Capability probes                                                   */
/*                                                                     */
/* Both resolve after mount, so server and first client render are     */
/* always identical (hydration safe).                                  */
/* ------------------------------------------------------------------ */

const TOUCH_QUERY = "(hover: none)";

function subscribeTouch(callback: () => void) {
  const query = window.matchMedia(TOUCH_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** Touch device (no hover) — heavy motion collapses to short fades. */
function useTouch(): boolean {
  return useSyncExternalStore(
    subscribeTouch,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
}

/**
 * Reduced motion and touch devices only get simple short fades: no word-by-
 * word splits, no slide distances, no delays on `reduce`.
 */
function useSimple(): { reduce: boolean; touch: boolean; simple: boolean } {
  const reduce = useReducedMotion() ?? false;
  const touch = useTouch();
  return { reduce, touch, simple: reduce || touch };
}

/** Standard viewport config: fires once, 10% inside the viewport. */
const VIEWPORT = { once: true, margin: "-10%" } as const;

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

/**
 * Generic scroll reveal (whileInView, once). Fades in while sliding a short
 * distance in `direction`; on touch/reduced motion it is a plain short fade.
 * Renders a motion.div, so grid/flex classes can be passed via `className`.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  distance = 40,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
}) {
  const { reduce, simple } = useSimple();
  const slide = simple ? 0 : distance;
  const x = direction === "left" ? -slide : direction === "right" ? slide : 0;
  const y = direction === "up" ? slide : direction === "down" ? -slide : 0;

  const variants = {
    hidden: { opacity: 0, x, y },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: simple ? duration.fast : about.pageDuration,
        ease: about.easeOut,
        delay: reduce ? 0 : delay,
      },
    },
  };

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

/**
 * Statement heading that rises word by word (one IntersectionObserver on the
 * wrapper, staggered children). Touch / reduced motion: one short fade of the
 * whole text instead of a word split.
 */
export function WordReveal({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const { reduce, simple } = useSimple();
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) return null;

  if (simple) {
    return (
      <motion.span
        className={className}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={VIEWPORT}
        transition={{
          duration: duration.fast,
          ease: about.easeOut,
          delay: reduce ? 0 : delay,
        }}
      >
        {text}
      </motion.span>
    );
  }

  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: about.stagger } } }}
    >
      {words.map((word, index) => (
        <Fragment key={index}>
          {index > 0 && " "}
          <motion.span
            className="inline-block"
            variants={{
              hidden: { opacity: 0, y: 24 },
              visible: {
                opacity: 1,
                y: 0,
                transition: {
                  duration: about.pageDuration,
                  ease: about.easeOut,
                },
              },
            }}
          >
            {word}
          </motion.span>
        </Fragment>
      ))}
    </motion.span>
  );
}

/**
 * Thin rule that draws left → right. Can animate via its own whileInView
 * (default) or inherit from parent variants when used inside a reveal wrapper.
 * Touch / reduced motion: fully revealed, no draw. Put the background in
 * `className` (e.g. `bg-white/35`) or `style` (gradient).
 *
 * The line is ALWAYS a full-size 1px element carrying its final colour; only
 * a `clip-path` inset is animated. It must never start at `scaleX(0)`.
 */
export function LineDraw({
  delay = 0,
  className,
  style,
  inherit = false,
}: {
  delay?: number;
  className?: string;
  style?: CSSProperties;
  inherit?: boolean;
}) {
  const { reduce, simple } = useSimple();

  const variants = inherit
    ? {
        hidden: {
          clipPath: simple ? "inset(0% 0% 0% 0%)" : "inset(0% 100% 0% 0%)",
        },
        visible: {
          clipPath: "inset(0% 0% 0% 0%)",
          transition: {
            duration: simple ? duration.fast : about.itemDuration * 0.8,
            ease: about.easeOut,
            delay: reduce ? 0 : delay,
          },
        },
      }
    : undefined;

  if (inherit) {
    return (
      <motion.div
        aria-hidden="true"
        className={`h-px w-full ${className ?? ""}`}
        style={style}
        variants={variants}
      />
    );
  }

  return (
    <motion.div
      aria-hidden="true"
      className={`h-px w-full ${className ?? ""}`}
      style={style}
      initial={{
        clipPath: simple ? "inset(0% 0% 0% 0%)" : "inset(0% 100% 0% 0%)",
      }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0%)" }}
      viewport={VIEWPORT}
      transition={{
        duration: simple ? duration.fast : about.itemDuration * 0.8,
        ease: about.easeOut,
        delay: reduce ? 0 : delay,
      }}
    />
  );
}

/**
 * Hero heading line for the initial load sequence: rises from below a clip
 * mask, line by line (absolute `delay` from page load). Touch / reduced
 * motion: short fade, no travel.
 */
export function LoadMaskLine({
  children,
  delay,
}: {
  children: ReactNode;
  delay: number;
}) {
  const { reduce, simple } = useSimple();
  // The line waits for the page to be ready (the rise has finished) and never
  // animates in the frozen copy of the outgoing page.
  const frozen = useFrozenPage();
  const play = useLoadGate();

  return (
    <span className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
      <motion.span
        className="block"
        initial={
          frozen ? false : { opacity: 0, y: simple ? "0%" : "115%" }
        }
        animate={frozen || play ? { opacity: 1, y: "0%" } : undefined}
        transition={{
          duration: simple ? duration.fast : about.pageDuration,
          ease: about.easeOut,
          delay: reduce ? 0 : delay,
        }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/**
 * Initial-load rise + fade (hero subtitle, cards row). Plays once on mount
 * with an absolute `delay`; touch / reduced motion gets a short fade only.
 */
export function LoadRise({
  children,
  className,
  delay = 0,
  distance = 48,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
}) {
  const { reduce, simple } = useSimple();
  // The rise waits for the page to be ready (the rise has finished) and never
  // animates in the frozen copy of the outgoing page.
  const frozen = useFrozenPage();
  const play = useLoadGate();

  return (
    <motion.div
      className={className}
      initial={frozen ? false : { opacity: 0, y: simple ? 0 : distance }}
      animate={frozen || play ? { opacity: 1, y: 0 } : undefined}
      transition={{
        duration: simple ? duration.fast : about.pageDuration,
        ease: about.easeOut,
        delay: reduce ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A whole <section> that slides up into place the first time it scrolls into
 * view (used by the dark Services screen). Touch / reduced motion: short fade.
 */
export function SectionRise({
  children,
  id,
  className,
  dataChromeDark = false,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  /** Marks the section as a dark zone so the fixed header inverts over it. */
  dataChromeDark?: boolean;
}) {
  const { simple } = useSimple();

  return (
    <motion.section
      id={id}
      className={className}
      data-chrome-dark={dataChromeDark ? "true" : undefined}
      initial={{ opacity: 0, y: simple ? 0 : 56 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{
        duration: simple ? duration.fast : about.pageDuration,
        ease: about.easeInOut,
      }}
    >
      {children}
    </motion.section>
  );
}

/**
 * `whileInView` once with a per-item `delay`, for children that should appear
 * one after another after their parent enters view. Used by Skills pills.
 */
export const staggerParent = (stagger: number) => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
});

"use client";

import {
  Fragment,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { about, duration } from "@/lib/motion";
import { useFrozenPage, useLoadGate } from "@/components/PageTransition";

/* ------------------------------------------------------------------ */
/* Shared About viewport trigger                                       */
/*                                                                     */
/* ONE trigger for every About `whileInView`: fire once and only once  */
/* the element is 6% inside the BOTTOM of the viewport. No negative    */
/* margin on top or the sides — on tall mobile stacks (and near the    */
/* page end) an all-sided inset could leave elements waiting at        */
/* opacity 0 forever.                                                  */
/* ------------------------------------------------------------------ */

export const ABOUT_VIEWPORT = {
  once: true,
  margin: "0px 0px -6% 0px",
} as const;

/* ------------------------------------------------------------------ */
/* Load gate + failsafe                                                */
/* ------------------------------------------------------------------ */

/** How long a closed load gate may hold the About hero back (ms). */
const GATE_FAILSAFE_MS = 2500;

/**
 * Load gate with a failsafe. The gate stays closed while a transition is
 * still rising; if it has not opened within `GATE_FAILSAFE_MS` it is forced
 * open so the About hero (heading lines, subtitle, cards row, marquee) can
 * never stay hidden. On a direct page load the gate is already open and no
 * timer is ever armed — those loads behave exactly as before. The flag lives
 * only for the lifetime of one page instance (it starts `false` and the gate
 * opens before any new page mounts), so no reset is ever needed.
 */
export function useGateOpen(): boolean {
  const play = useLoadGate();
  const [forced, setForced] = useState(false);

  useEffect(() => {
    if (play) return;
    const timer = window.setTimeout(() => setForced(true), GATE_FAILSAFE_MS);
    return () => window.clearTimeout(timer);
  }, [play]);

  return play || forced;
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

/**
 * Generic scroll reveal (whileInView, once). Fades in while sliding a short
 * distance in `direction`. Reduced motion: plain short fade, no travel.
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
  const reduce = useReducedMotion() ?? false;
  const slide = reduce ? 0 : distance;
  const x = direction === "left" ? -slide : direction === "right" ? slide : 0;
  const y = direction === "up" ? slide : direction === "down" ? -slide : 0;

  const variants = {
    hidden: { opacity: 0, x, y },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: reduce ? duration.fast : about.pageDuration,
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
      viewport={ABOUT_VIEWPORT}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

/**
 * Statement heading that rises word by word (one IntersectionObserver on the
 * wrapper, staggered children). The word spans are ALWAYS rendered — the DOM
 * never swaps after hydration. Reduced motion: no rise, no stagger — the
 * words fade in as one, straight away.
 */
export function WordReveal({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) return null;

  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={ABOUT_VIEWPORT}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: reduce ? 0 : about.stagger },
        },
      }}
    >
      {words.map((word, index) => (
        <Fragment key={index}>
          {index > 0 && " "}
          <motion.span
            className="inline-block"
            variants={{
              hidden: { opacity: 0, y: reduce ? 0 : 24 },
              visible: {
                opacity: 1,
                y: 0,
                transition: {
                  duration: reduce ? duration.fast : about.pageDuration,
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
 * Reduced motion: fully revealed, no draw. Put the background in `className`
 * (e.g. `bg-white/35`) or `style` (gradient).
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
  const reduce = useReducedMotion() ?? false;

  const variants = inherit
    ? {
        hidden: {
          clipPath: reduce ? "inset(0% 0% 0% 0%)" : "inset(0% 100% 0% 0%)",
        },
        visible: {
          clipPath: "inset(0% 0% 0% 0%)",
          transition: {
            duration: reduce ? duration.fast : about.itemDuration * 0.8,
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
        clipPath: reduce ? "inset(0% 0% 0% 0%)" : "inset(0% 100% 0% 0%)",
      }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0%)" }}
      viewport={ABOUT_VIEWPORT}
      transition={{
        duration: reduce ? duration.fast : about.itemDuration * 0.8,
        ease: about.easeOut,
        delay: reduce ? 0 : delay,
      }}
    />
  );
}

/**
 * Hero heading line for the initial load sequence: rises from below a clip
 * mask, line by line (absolute `delay` from page load). Reduced motion:
 * short fade, no travel.
 */
export function LoadMaskLine({
  children,
  delay,
}: {
  children: ReactNode;
  delay: number;
}) {
  const reduce = useReducedMotion() ?? false;
  // The line waits for the page to be ready (the rise has finished) and never
  // animates in the frozen copy of the outgoing page.
  const frozen = useFrozenPage();
  const play = useGateOpen();

  return (
    <span className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
      <motion.span
        className="block"
        initial={frozen ? false : { opacity: 0, y: reduce ? "0%" : "115%" }}
        animate={frozen || play ? { opacity: 1, y: "0%" } : undefined}
        transition={{
          duration: reduce ? duration.fast : about.pageDuration,
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
 * with an absolute `delay`; reduced motion gets a short fade only.
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
  const reduce = useReducedMotion() ?? false;
  // The rise waits for the page to be ready (the rise has finished) and never
  // animates in the frozen copy of the outgoing page.
  const frozen = useFrozenPage();
  const play = useGateOpen();

  return (
    <motion.div
      className={className}
      initial={frozen ? false : { opacity: 0, y: reduce ? 0 : distance }}
      animate={frozen || play ? { opacity: 1, y: 0 } : undefined}
      transition={{
        duration: reduce ? duration.fast : about.pageDuration,
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
 * view (used by the dark Services screen). Reduced motion: short fade.
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
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.section
      id={id}
      className={className}
      data-chrome-dark={dataChromeDark ? "true" : undefined}
      initial={{ opacity: 0, y: reduce ? 0 : 56 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={ABOUT_VIEWPORT}
      transition={{
        duration: reduce ? duration.fast : about.pageDuration,
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

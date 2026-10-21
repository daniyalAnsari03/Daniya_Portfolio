"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  useReducedMotion,
  type TargetAndTransition,
  type Transition,
} from "framer-motion";
import { EASE, duration } from "@/lib/motion";

/** Px that must accumulate in one direction before the header hides/shows, so
 *  tiny jitter (touch bounce, Lenis settling) never flips the state. */
const THRESHOLD = 8;

/** The header is always visible while the page sits this close to the top. */
const TOP_MARGIN = 10;

/** Route changes make the router jump the scroll position (reset to the top or
 *  restore a saved offset). Those jumps are not user scrolling, so direction
 *  logic is paused for this long (ms) after every navigation — the header stays
 *  exactly where it is through the transition. */
const ROUTE_GUARD_MS = 400;

/** Hide/show state for the fixed top chrome, as framer-motion props.
 *  Only `transform` + `opacity` animate; timing comes from `src/lib/motion.ts`. */
export type HideOnScrollProps = {
  animate: TargetAndTransition;
  transition: Transition;
};

/**
 * Hide-on-scroll direction tracking, shared by every header (Home + About) so
 * the logic lives in one place. Listens to the window scroll event, which is
 * what Lenis drives (it scrolls natively), matching the rest of the codebase.
 *
 * - scrolls DOWN past the threshold -> hide (translateY(-120%) + opacity 0)
 * - scrolls UP past the threshold   -> show (translateY(0) + opacity 1)
 * - within `TOP_MARGIN` of the top  -> always shown
 * - `forceHidden()` true            -> always hidden (wins over everything);
 *   used on the homepage once the cover has scrolled over the header.
 */
export function useHideOnScroll(options?: {
  /** Extra condition that hard-hides the header regardless of direction. */
  forceHidden?: () => boolean;
}): HideOnScrollProps {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  // Keep the latest callback without re-subscribing on every render. Written
  // inside an effect (refs must not be mutated during render).
  const forceHiddenRef = useRef(options?.forceHidden);
  useEffect(() => {
    forceHiddenRef.current = options?.forceHidden;
  });

  useEffect(() => {
    let anchor = window.scrollY;
    const guardUntil = performance.now() + ROUTE_GUARD_MS;

    const update = () => {
      // A hard condition (e.g. the homepage cover covering the header) wins
      // over the direction logic and the near-top rule.
      if (forceHiddenRef.current?.()) {
        anchor = window.scrollY;
        setHidden(true);
        return;
      }

      const y = window.scrollY;

      // Near the top the header is always in place — checked before the guard
      // so a router reset to the top still lands visible.
      if (y <= TOP_MARGIN) {
        anchor = y;
        setHidden(false);
        return;
      }

      // Transition scroll restore: follow the jump without changing direction.
      if (performance.now() < guardUntil) {
        anchor = y;
        return;
      }

      const delta = y - anchor;
      if (delta > THRESHOLD) {
        anchor = y;
        setHidden(true);
      } else if (delta < -THRESHOLD) {
        anchor = y;
        setHidden(false);
      }
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [pathname]);

  return {
    animate: { y: hidden ? "-120%" : "0%", opacity: hidden ? 0 : 1 },
    transition: { duration: reduce ? 0 : duration.fast, ease: EASE },
  };
}

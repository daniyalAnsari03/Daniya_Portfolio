"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { AboutHeroCard } from "@/lib/about";
import { useFrozenPage, useLoadGate } from "@/components/PageTransition";
import MediaFrame from "@/components/MediaFrame";
import {
  ABOUT_HERO_CARD_RADIUS_CLASS,
  aboutHeroCardLevelClass,
  aboutHeroCardSizeClass,
} from "./card-sizes";

/**
 * Measure before the first paint, so the row never jumps from its static
 * state to the sliding one.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** The tight gap between cards (0.6vw) plus its vertical level. */
function cardClass(index: number): string {
  return `mr-[0.6vw] ${aboutHeroCardLevelClass(index)}`;
}

/** Shared card frame: pattern size, rounded corners, cover fit. */
function Card({
  card,
  sizeClass,
  priority = false,
}: {
  card: AboutHeroCard;
  sizeClass: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-charcoal/5 ${ABOUT_HERO_CARD_RADIUS_CLASS} ${sizeClass}`}
    >
      <MediaFrame
        src={card.fileUrl}
        kind={card.mediaType}
        adjust={card.coverAdjust}
        sizes="(min-width: 1024px) 21vw, (min-width: 640px) 34vw, 62vw"
        priority={priority}
      />
    </div>
  );
}

/**
 * The auto-sliding row of hero media.
 *
 * The row holds EXACTLY the cards the admin saved — one set, no padding
 * copies. The set is measured against the visible window:
 *
 * - set narrower than the window: no slide and no clone. The cards stand
 *   still in one line, centred and bottom-aligned.
 * - set as wide as the window (or wider): the row slides. The set is
 *   rendered a second time right behind it (hidden from assistive tech) and
 *   the track is translated by exactly one set width, which loops without a
 *   jump. Because one set already fills the window, the same image is never
 *   on screen twice at the same time.
 *
 * Every card keeps its size, aspect ratio and radius; the cards only share
 * one bottom line. `startDelay` holds the row still until the hero cards
 * have appeared (reduced motion: starts at once).
 */
export default function MediaMarquee({
  cards,
  startDelay = 0,
}: {
  cards: AboutHeroCard[];
  startDelay?: number;
}) {
  const reduce = useReducedMotion() ?? false;
  // The row starts sliding once the page is ready (the cards have appeared).
  const frozen = useFrozenPage();
  const play = useLoadGate();

  const containerRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLUListElement>(null);

  /** The row only slides when the set fills the window. */
  const [slide, setSlide] = useState(false);

  /** The row is only animated while it is actually on screen. */
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  // Pause the row while it is offscreen — a single CSS animation, no React
  // work per frame.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "10% 0px" },
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Pause the row while the tab is in the background.
  useEffect(() => {
    const onVisibility = () =>
      setTabVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Measure the set (cards + gaps) and the visible window. The row is
  // re-measured on resize and whenever the cards change.
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const set = setRef.current;
    if (!container || !set) return;

    const measure = () => {
      const viewWidth = container.clientWidth;
      if (viewWidth <= 0) return;
      // `offsetWidth` is a layout value — the track's transform never
      // influences it.
      setSlide(set.offsetWidth >= viewWidth);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(set);
    observer.observe(container);

    // A real phone fires `resize` whenever the browser toolbar shows or
    // hides — that only changes the height, never the measured widths. Only
    // a width change is reacted to, so the row is never re-measured (and
    // never re-renders) while the user scrolls.
    let lastWidth = window.innerWidth;
    const onResize = () => {
      const width = window.innerWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      measure();
    };

    window.addEventListener("resize", onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [cards.length]);

  if (cards.length === 0) return null;

  const delayed = slide && !reduce && startDelay > 0;

  /**
   * The row runs only when it can be seen: the page is ready, the row is on
   * screen and the tab is visible. The frozen copy of an outgoing page keeps
   * its own state, so the snapshot never animates. Reduced motion does NOT
   * stop the row — it only slows it down (see the CSS).
   */
  const running = slide && inView && tabVisible && (frozen || play);

  return (
    <div ref={containerRef} className="w-full overflow-x-clip">
      <div
        className={`${slide ? "marquee-track -ml-[6vw]" : "mx-auto"} flex w-max items-end`}
        data-running={running ? "true" : undefined}
        style={{
          ...(delayed ? { animationDelay: `${startDelay}s` } : {}),
          // Paused until the page is ready — the delay only starts counting
          // once the row is allowed to run. It is also paused while the row
          // is offscreen or the tab is hidden, so the animation never costs
          // anything the user cannot see.
          animationPlayState: running ? "running" : "paused",
        }}
      >
        {/* The admin's cards — exactly one set, nothing repeated.
            The first card is above the fold, so it is loaded eagerly; every
            other card is lazy. The clone below stays lazy. */}
        <ul ref={setRef} className="flex shrink-0 items-end">
          {cards.map((card, index) => (
            <li key={card.id} className={cardClass(index)}>
              <Card
                card={card}
                sizeClass={aboutHeroCardSizeClass(index)}
                priority={index === 0}
              />
            </li>
          ))}
        </ul>

        {/* One clone for the seamless loop — only when the set already fills
            the window, so the same image is never on screen twice. */}
        {slide && (
          <ul className="flex shrink-0 items-end" aria-hidden="true">
            {cards.map((card, index) => (
              <li key={`${card.id}-clone`} className={cardClass(index)}>
                <Card card={card} sizeClass={aboutHeroCardSizeClass(index)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

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
function Card({ card, sizeClass }: { card: AboutHeroCard; sizeClass: string }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-charcoal/5 ${ABOUT_HERO_CARD_RADIUS_CLASS} ${sizeClass}`}
    >
      <MediaFrame
        src={card.fileUrl}
        kind={card.mediaType}
        adjust={card.coverAdjust}
        sizes="(min-width: 1024px) 21vw, (min-width: 640px) 34vw, 62vw"
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
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [cards.length]);

  if (cards.length === 0) return null;

  const delayed = slide && !reduce && startDelay > 0;

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <div
        className={`${slide ? "marquee-track -ml-[6vw]" : "mx-auto"} flex w-max items-end`}
        style={
          delayed
            ? {
                animationDelay: `${startDelay}s`,
                // Paused until the page is ready — the delay only starts
                // counting once the row is allowed to run.
                animationPlayState: frozen || play ? "running" : "paused",
              }
            : undefined
        }
      >
        {/* The admin's cards — exactly one set, nothing repeated. */}
        <ul ref={setRef} className="flex shrink-0 items-end">
          {cards.map((card, index) => (
            <li key={card.id} className={cardClass(index)}>
              <Card card={card} sizeClass={aboutHeroCardSizeClass(index)} />
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

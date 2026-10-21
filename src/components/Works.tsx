"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { content } from "@/lib/content";
import MediaFrame from "@/components/MediaFrame";
import {
  HOMEPAGE_STOCK_CARDS,
  homepageCardShape,
  type HomepageCard,
} from "@/lib/homepage-defaults";

/**
 * Horizontal travel of the card row per 1px of vertical scroll.
 * Higher = faster / shorter pinned section. Tune this to taste.
 */
const SPEED = 1.5;

/**
 * Extra pinned scroll (in vh) that plays after the row has parked, before the
 * pin releases.
 */
const HOLD_VH = 30;

/** Gap (vw) between the screen's left edge and the parked last card. */
const END_MARGIN_VW = 2;

/** The heading behind the row. */
const HEADING_CLASS =
  "text-center text-[12vw] leading-none font-normal tracking-[-0.05em] text-foreground sm:text-[clamp(40px,4.4vw,96px)]";

export default function Works({
  heading = content.works.heading,
  cards = HOMEPAGE_STOCK_CARDS,
}: {
  /** The heading behind the row. */
  heading?: string;
  /** The cards of the row — the stock cards until the admin saves their own. */
  cards?: HomepageCard[];
}) {
  const reduce = useReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLUListElement>(null);
  const lastCardRef = useRef<HTMLLIElement>(null);

  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [lastCardLeft, setLastCardLeft] = useState(0);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);

  // Measure on mount, after fonts/images load and on resize — never during
  // scroll. Everything below is derived from these values, so nothing has to
  // be read from the DOM while scrolling.
  useEffect(() => {
    const measure = () => {
      const row = rowRef.current;
      if (!row) return;
      const last = lastCardRef.current ?? row.lastElementChild;
      // Distance from the row's own left edge to the last card's left edge,
      // in the same coordinate space the translate is applied in.
      const padLeft = Number.parseFloat(getComputedStyle(row).paddingLeft) || 0;
      const lastLeft =
        last instanceof HTMLElement ? last.offsetLeft : row.offsetWidth;
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setLastCardLeft(row.offsetLeft + padLeft + lastLeft);
      setReady(true);
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    const observer = new ResizeObserver(measure);
    const row = rowRef.current;
    if (row) {
      observer.observe(row);
      row.querySelectorAll("img").forEach((img) => {
        if (!img.complete) img.addEventListener("load", measure, { once: true });
      });
    }
    void document.fonts?.ready.then(measure);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("load", measure);
      observer.disconnect();
    };
  }, [reduce]);

  // Promote the row to its own layer only while the section is on screen.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "25% 0px 25% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduce]);

  // Row starts just off the right edge; the last card parks END_MARGIN_VW in
  // from the screen's left edge. Both ends are measured, never hard-coded.
  const startX = viewport.width;
  const endX = (END_MARGIN_VW / 100) * viewport.width - lastCardLeft;
  const travel = startX - endX;
  const hold = (HOLD_VH / 100) * viewport.height;
  const pinnedScroll = travel / SPEED + hold;
  const wrapperHeight = pinnedScroll + viewport.height;

  // Fraction of the pinned scroll taken by the row. The row is exactly at
  // endX from here on, so it can never travel further than the stop position.
  const pEnd = travel > 0 && pinnedScroll > 0 ? travel / SPEED / pinnedScroll : 1;

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  });

  // Three explicit stops + clamp: park at endX and hold it for the rest.
  const x = useTransform(
    scrollYProgress,
    [0, pEnd, 1],
    [startX, endX, endX],
    { clamp: true },
  );
  const headingOpacity = useTransform(
    scrollYProgress,
    [0, pEnd],
    [1, 0.5],
    { clamp: true },
  );

  const cardNodes = cards.map((card, i) => {
    const shape = homepageCardShape(i);
    const isLast = i === cards.length - 1;
    return (
      <li
        key={card.id}
        ref={isLast ? lastCardRef : undefined}
        className={`group relative shrink-0 snap-start overflow-hidden rounded-xl bg-charcoal/5 lg:rounded-[0.5vw] ${shape.className}`}
      >
        <MediaFrame
          src={card.src}
          alt={card.alt}
          kind="image"
          adjust={card.adjust}
          sizes={shape.sizes}
          priority={i < 2}
          className="transition-transform duration-500 ease-out lg:group-hover:scale-[1.04]"
        />
      </li>
    );
  });

  // Without cards there is nothing to pin — the heading alone is shown, so
  // the section never becomes an empty scroll area.
  if (cards.length === 0) {
    return (
      <section
        id="works"
        className="relative w-full rounded-b-[16px] bg-background sm:rounded-b-[24px]"
      >
        <div className="pt-[18vh] pb-[18vh]">
          <h2 className={HEADING_CLASS}>{heading}</h2>
        </div>
      </section>
    );
  }

  if (reduce) {
    return (
      <section
        id="works"
        className="relative w-full rounded-b-[16px] bg-background sm:rounded-b-[24px]"
      >
        <div ref={wrapperRef} className="pt-[18vh]">
          <h2 className={HEADING_CLASS}>{heading}</h2>

          <div className="mt-[8vh] snap-x snap-mandatory overflow-x-auto pb-[8vh] [scrollbar-width:thin]">
            <ul
              ref={rowRef}
              className="flex w-max items-end gap-[4vw] px-4 lg:gap-[1.8vw]"
            >
              {cardNodes}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="works"
      className="relative w-full rounded-b-[16px] bg-background sm:rounded-b-[24px]"
    >
      <div
        ref={wrapperRef}
        className="relative min-h-screen"
        style={{ height: ready ? wrapperHeight : undefined }}
      >
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* Heading sits behind the cards and only shows through the gaps. */}
          <motion.h2
            style={{ opacity: headingOpacity }}
            className={`absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 px-6 ${HEADING_CLASS}`}
          >
            {heading}
          </motion.h2>

          {/* No trailing padding or spacer: the row's width is exactly the
              cards + gaps, so endX is the last card's true park position.
              The cards share one bottom line — the row itself keeps its
              place on the page. */}
          <motion.ul
            ref={rowRef}
            style={{ x }}
            transformTemplate={(latest) => {
              const value = latest.x ?? 0;
              return `translate3d(${
                typeof value === "number" ? `${value}px` : value
              }, 0, 0)`;
            }}
            className={`absolute top-[24vh] left-0 z-10 flex w-max items-end gap-[4vw] lg:top-[27vh] lg:gap-[1.8vw] ${
              inView ? "will-change-transform" : ""
            }`}
          >
            {cardNodes}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}

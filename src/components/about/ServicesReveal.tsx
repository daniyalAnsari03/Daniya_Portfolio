"use client";

import {
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { about, duration } from "@/lib/motion";

/**
 * Services-only reveal helpers. The public Services section dropped the shared
 * `Reveal` / `LineDraw` / `SectionRise` blocks because the clip-path line draw
 * and the whole-section slide were competing with every column's own scroll
 * animation at the same moment — which stutters on phones. Everything here
 * animates ONLY opacity and transform, composites on the GPU, animates each
 * column as one block and keeps will-change out entirely.
 */

const MD_QUERY = "(min-width: 768px)";
const LG_QUERY = "(min-width: 1024px)";
const TOUCH_QUERY = "(hover: none)";

function subscribeMedia(callback: () => void) {
  const queries = [MD_QUERY, LG_QUERY, TOUCH_QUERY].map((query) =>
    window.matchMedia(query),
  );
  queries.forEach((query) => query.addEventListener("change", callback));
  return () =>
    queries.forEach((query) => query.removeEventListener("change", callback));
}

/** Columns per grid row: 1 (mobile) / 2 (tablet) / 3 (desktop). Matches the
 * grid classes in `Services.tsx`. Server snapshot = desktop (hydration safe;
 * resolves right after mount, before the section is scrolled to). */
function getColsPerRow(): number {
  if (!window.matchMedia(MD_QUERY).matches) return 1;
  return window.matchMedia(LG_QUERY).matches ? 3 : 2;
}

function useColsPerRow(): number {
  return useSyncExternalStore(subscribeMedia, getColsPerRow, () => 3);
}

function useTouchDevice(): boolean {
  return useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
}

/** Standard viewport config: fires once, 10% inside the viewport. */
const VIEWPORT = { once: true, margin: "-10%" } as const;

/**
 * The dark Services section. Same look as before. Desktop: the whole section
 * still rises 56px the first time it enters view. On mobile (< md), on touch
 * devices and under reduced motion it only fades — the section itself never
 * transforms, so it never animates against its own columns.
 */
export function ServicesSection({
  id,
  className,
  dataChromeDark = false,
  children,
}: {
  id?: string;
  className?: string;
  /** Marks the section as a dark zone so the fixed header inverts over it. */
  dataChromeDark?: boolean;
  children: ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;
  const touch = useTouchDevice();
  const cols = useColsPerRow();
  const simple = reduce || touch || cols === 1;

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
 * One services column. Desktop: unchanged behaviour — the column fades and
 * rises (48px) with the shared page duration while its thin line draws left →
 * right (scaleX with transform-origin left). Mobile / touch / reduced motion:
 * the whole column (line, title, description) is ONE block that fades in when
 * it enters the viewport; the title and description no longer queue behind
 * columns that are still off-screen (row-local stagger instead of a global
 * per-index delay; on a phone, where every column is its own row, that delay
 * is 0). Reduced motion: opacity only, the line is never drawn.
 */
export function ServicesColumn({
  index,
  title,
  description,
}: {
  index: number;
  title: string;
  description?: string | null;
}) {
  const reduce = useReducedMotion() ?? false;
  const touch = useTouchDevice();
  const cols = useColsPerRow();
  const mobile = reduce || touch || cols === 1;

  const blockVariants = {
    hidden: { opacity: 0, y: mobile ? (touch || reduce ? 0 : 24) : 48 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: mobile ? duration.fast : about.pageDuration,
        ease: about.easeOut,
        delay: reduce
          ? 0
          : mobile
            ? about.stagger * (index % cols)
            : about.stagger * index,
      },
    },
  };

  const lineVariants = reduce
    ? undefined
    : {
        hidden: { scaleX: 0 },
        visible: {
          scaleX: 1,
          transition: {
            duration: mobile ? duration.fast : about.itemDuration * 0.8,
            ease: about.easeOut,
            delay: 0,
          },
        },
      };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={blockVariants}
    >
      <span className="text-[18px] font-light tabular-nums text-white/45">
        {String(index + 1).padStart(2, "0")}
      </span>
      {lineVariants ? (
        <motion.div
          aria-hidden="true"
          className="mt-3 h-px w-full origin-left bg-white/35"
          variants={lineVariants}
        />
      ) : (
        <div aria-hidden="true" className="mt-3 h-px w-full bg-white/35" />
      )}
      <div className="pt-5">
        <h3 className="text-balance text-[clamp(22px,1.9vw,36px)] leading-tight font-light tracking-[-0.02em]">
          {title}
        </h3>
        {description && (
          <p className="mt-[clamp(20px,2vw,40px)] max-w-[46ch] text-[clamp(14px,1vw,18px)] leading-relaxed text-white/70 lg:max-w-[20vw]">
            {description}
          </p>
        )}
      </div>
    </motion.div>
  );
}

"use client";

import Image from "next/image";
import { type CSSProperties, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { content } from "@/lib/content";
import { load, maskReveal } from "@/lib/motion";
import { scrollToSection } from "./SmoothScroll";
import { useFrozenPage, useLoadGate } from "./PageTransition";
import { ArrowDown, GitHubIcon, LinkedInIcon } from "./icons";

/* ------------------------------------------------------------------ */
/* Hero photo geometry                                                 */
/*                                                                     */
/* Fractions measured from the alpha channel of public/ai.png (the     */
/* image is READ-ONLY: never modify, crop, resize or re-encode it).    */
/* The head is not centered in the image, so the image is positioned   */
/* from the HEAD center/top, not the image center.                     */
/* ------------------------------------------------------------------ */
const PHOTO_IMG_W = 1086;
const PHOTO_IMG_H = 1448;
/** Person's opaque bounding box top, as a fraction of the image height. */
const PHOTO_HEAD_TOP_FRAC = 39 / PHOTO_IMG_H; // 0.026934
/** Horizontal center of the opaque pixels in the top 18% band of the person's
 *  bounding box (px 387.5 → measured), as a fraction of the image width. */
const PHOTO_HEAD_CENTER_FRAC = 387.5 / PHOTO_IMG_W; // 0.356814
/** Width of that same top-18% band (px 438), as a fraction of image width. */
const PHOTO_HEAD_WIDTH_FRAC = 438 / PHOTO_IMG_W; // 0.403315

/** Head width in vw on desktop (≥1024px). */
const PHOTO_HEAD_W_VW_DESKTOP = 14.8;
/** Head width on mobile/tablet (<1024px): 34vw, capped at 285px on tablets. */
const PHOTO_HEAD_W_VW_MOBILE = 34;
const PHOTO_HEAD_W_PX_MAX_MOBILE = 285;
const PHOTO_HEAD_W_MOBILE = `min(${PHOTO_HEAD_W_VW_MOBILE}vw, ${PHOTO_HEAD_W_PX_MAX_MOBILE}px)`;
/** Head center from the left on mobile/tablet (<1024px), in vw. */
const PHOTO_HEAD_CENTER_VW_MOBILE = 28;
/** How far the bottom-anchored photo sits below the hero bottom on
 *  mobile/tablet (<1024px), in vh — pushes the person further down. */
const PHOTO_MOBILE_DOWN_VH = 8;

/** Image aspect (height / width) — always kept, so scaling is uniform. */
const PHOTO_ASPECT = PHOTO_IMG_H / PHOTO_IMG_W;

/** Rendered image width, derived from the head width / head-width fraction. */
const PHOTO_W_VW_DESKTOP = PHOTO_HEAD_W_VW_DESKTOP / PHOTO_HEAD_WIDTH_FRAC; // 36.696vw
const PHOTO_H_VW_DESKTOP = PHOTO_W_VW_DESKTOP * PHOTO_ASPECT; // 48.928vw
const PHOTO_W_VW_MOBILE = PHOTO_HEAD_W_VW_MOBILE / PHOTO_HEAD_WIDTH_FRAC; // 84.301vw

/* Desktop (≥1024px): head center at 41vw, head top at 30vh from the hero top.
   left = 41vw − headCenterFrac · renderedWidth; top = 30vh − headTopFrac · renderedHeight. */
const PHOTO_LEFT_VW_DESKTOP = 41 - PHOTO_HEAD_CENTER_FRAC * PHOTO_W_VW_DESKTOP; // 27.906vw
const PHOTO_TOP_VW_DESKTOP = PHOTO_HEAD_TOP_FRAC * PHOTO_H_VW_DESKTOP; // 1.318vw (under 30vh)

/* Mobile/tablet (<1024px): screen-relative head width min(34vw, 285px), head
   center at PHOTO_HEAD_CENTER_VW_MOBILE, and BOTTOM-ANCHORED (bottom: 0) so the
   person always reaches the bottom edge. The whole image scales uniformly from
   the head width; the head top lands wherever that puts it.
   left = headCenter − headCenterFrac · renderedWidth. */
const PHOTO_W_MOBILE = `calc(${PHOTO_HEAD_W_MOBILE} / ${PHOTO_HEAD_WIDTH_FRAC})`;
const PHOTO_LEFT_MOBILE = `calc(${PHOTO_HEAD_CENTER_VW_MOBILE}vw - ${PHOTO_HEAD_CENTER_FRAC} * (${PHOTO_HEAD_W_MOBILE} / ${PHOTO_HEAD_WIDTH_FRAC}))`;
const PHOTO_BOTTOM_MOBILE = `calc(var(--vh-sm) * -${PHOTO_MOBILE_DOWN_VH / 100})`;

const photoStyle = {
  "--photo-w": PHOTO_W_MOBILE,
  "--photo-w-lg": `${PHOTO_W_VW_DESKTOP.toFixed(4)}vw`,
  "--photo-left": PHOTO_LEFT_MOBILE,
  "--photo-left-lg": `${PHOTO_LEFT_VW_DESKTOP.toFixed(4)}vw`,
  "--photo-bottom": PHOTO_BOTTOM_MOBILE,
  "--photo-top-lg": `calc(var(--vh-sm) * 0.3 - ${PHOTO_TOP_VW_DESKTOP.toFixed(4)}vw)`,
} as CSSProperties;

/** A single headline line that reveals by sliding up from behind a clip. */
function RevealLine({
  children,
  delay,
  duration,
}: {
  children: ReactNode;
  delay: number;
  duration: number;
}) {
  const reduce = useReducedMotion();
  // The line waits for the page to be ready (the rise has finished) and never
  // animates in the frozen copy of the outgoing page.
  const frozen = useFrozenPage();
  const play = useLoadGate();
  return (
    <span className="block overflow-hidden">
      <motion.span
        className="block"
        initial={reduce || frozen ? false : "hidden"}
        animate={frozen || play ? "visible" : undefined}
        variants={maskReveal}
        transition={{ duration, ease: load.ease, delay }}
      >
        <span className="block pt-[0.05em] pb-[0.08em] text-[14vw] leading-[1.1] font-normal tracking-[-0.05em] whitespace-nowrap text-foreground lg:text-[clamp(48px,9.2vw,184px)] lg:leading-[0.9] lg:font-normal lg:tracking-[-0.045em]">
          {children}
        </span>
      </motion.span>
    </span>
  );
}

/**
 * Corner item entrance (step 4): fade in while moving `distance` px toward its
 * resting place, staggered by `load.corners.stagger`.
 */
function cornerRise(from: number, index: number): Variants {
  return {
    hidden: { opacity: 0, y: from },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: load.corners.duration,
        ease: load.ease,
        delay: load.corners.delay + load.corners.stagger * index,
      },
    },
  };
}

export default function Hero({
  line1 = content.headline.line1,
  line2 = content.headline.line2,
  subtitle = content.subtitle,
}: {
  /** Headline line 1 — sits behind the photo. */
  line1?: string;
  /** Headline line 2 — sits in front of the photo. */
  line2?: string;
  subtitle?: string;
}) {
  const reduce = useReducedMotion();
  // The load sequence waits for the page to be ready and never replays in
  // the frozen copy of the outgoing page.
  const frozen = useFrozenPage();
  const play = useLoadGate();

  const corner = (from: number, index: number) => ({
    initial: (reduce || frozen ? false : "hidden") as "hidden" | false,
    animate: (frozen || play ? "visible" : undefined) as
      | "visible"
      | undefined,
    variants: cornerRise(from, index),
  });

  const d = load.corners.distance;

  return (
    /* The sticky BACKGROUND layer is sized with the LARGE viewport (so it
       never leaves a gap when the browser toolbar hides), while the content
       box below is sized with the STABLE small viewport — the headline, the
       photo and the socials are then always inside the visible screen, even
       on a real phone with the toolbar shown. Both units are identical to
       `vh` on desktop and in a mobile emulator, so nothing changes there. */
    <section
      id="home"
      className="sticky top-0 z-0 h-viewport-lg w-full overflow-hidden bg-background"
    >
      {/* Content box — the stable small viewport. Everything that is
          positioned inside the hero is anchored to this box. */}
      <div className="relative h-viewport-sm w-full">
        {/* Headline: line 1 (behind photo) + line 2 & subtitle (in front).
            No z-index on this wrapper so the children stack against the
            photo: 10 < photo 20 < 30. */}
        <div className="absolute inset-x-0 top-[calc(var(--vh-sm)*0.18)] lg:top-[calc(var(--vh-sm)*0.21)]">
          {/* Line 1 — sits behind the photo */}
          <div className="relative z-10 pl-[13vw] lg:pl-[29vw]">
            <RevealLine delay={load.line1.delay} duration={load.line1.duration}>
              {line1}
            </RevealLine>
          </div>

          {/* Line 2 — right-aligned below line 1 (in front of the photo) */}
          <div className="relative z-30 pr-[4vw] text-right lg:pr-0 lg:pl-[60vw] lg:text-left">
            <RevealLine delay={load.line2.delay} duration={load.line2.duration}>
              {line2}
            </RevealLine>

            <motion.p
              className="mr-[4vw] ml-auto mt-[calc(var(--vh-sm)*0.015)] w-[38vw] text-left text-[15px] leading-[1.25] tracking-tight text-foreground/55 lg:mr-0 lg:ml-0 lg:mt-[calc(var(--vh-sm)*0.02)] lg:w-auto lg:text-[clamp(15px,1.2vw,22px)] lg:leading-normal"
              initial={reduce || frozen ? false : { opacity: 0 }}
              animate={frozen || play ? { opacity: 1 } : undefined}
              transition={{
                duration: load.subtitle.duration,
                ease: load.ease,
                delay: load.subtitle.delay,
              }}
            >
              {subtitle}
            </motion.p>
          </div>
        </div>

        {/* Photo — positioned from the measured HEAD center/top (the head is
            not centered in the image), never with -translate-x-1/2 on the
            image. <1024px: head min(34vw, 285px), head center 35vw,
            bottom-anchored (bottom: 0) so the person reaches the bottom
            edge. ≥1024px: head 14.8vw, head top 30vh, head center 41vw,
            bottom-cropped by overflow. Uniform scale (aspect kept). */}
        <motion.div
          style={photoStyle}
          className="pointer-events-none absolute bottom-[var(--photo-bottom)] left-[var(--photo-left)] z-20 w-[var(--photo-w)] lg:bottom-auto lg:top-[var(--photo-top-lg)] lg:left-[var(--photo-left-lg)] lg:w-[var(--photo-w-lg)]"
          initial={reduce || frozen ? false : { opacity: 0, y: load.photo.from }}
          animate={
            frozen || play ? { opacity: 1, y: load.photo.to } : undefined
          }
          transition={{
            duration: load.photo.duration,
            ease: load.ease,
            delay: load.photo.delay,
          }}
        >
          <Image
            src={content.photo.src}
            alt={content.photo.alt}
            width={content.photo.width}
            height={content.photo.height}
            preload
            quality={95}
            sizes={`(max-width: 1023px) ${PHOTO_W_VW_MOBILE.toFixed(0)}vw, ${PHOTO_W_VW_DESKTOP.toFixed(1)}vw`}
            className="h-auto w-full select-none"
          />
        </motion.div>

        {/* Bottom-left: scroll-down button (desktop only) */}
        <motion.button
          type="button"
          onClick={() => scrollToSection("works")}
          aria-label="Scroll down"
          className="absolute bottom-5 left-5 z-40 hidden h-[54px] w-[54px] items-center justify-center rounded-full bg-white text-charcoal ring-1 ring-black/10 lg:bottom-7 lg:left-7 lg:flex lg:h-16 lg:w-16"
          {...corner(d, 2)}
          transition={{ duration: 0.4, ease: load.ease }}
          whileHover={{ y: -3 }}
          whileTap={{ y: 0 }}
        >
          <ArrowDown className="h-5 w-5 lg:h-6 lg:w-6" />
        </motion.button>

        {/* Bottom-right: social links (below the nav pill on mobile / tablet) */}
        <motion.div
          className="absolute bottom-[calc(var(--vh-sm)*0.03+env(safe-area-inset-bottom,0px))] right-6 z-40 flex items-center gap-3 text-charcoal lg:bottom-8 lg:right-7 lg:gap-4"
          {...corner(d, 3)}
        >
          {content.social.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              className="transition-opacity duration-300 hover:opacity-60"
            >
              {link.icon === "github" ? (
                <GitHubIcon className="h-5 w-5" />
              ) : (
                <LinkedInIcon className="h-5 w-5" />
              )}
            </a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

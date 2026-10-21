"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { content } from "@/lib/content";
import { PALETTE } from "@/lib/colors";
import { EASE } from "@/lib/motion";
import { scrollToSection } from "./SmoothScroll";

/**
 * Animated gradient that stands in for the looping video inside the pill.
 * Start and end colours match so the transform-based loop is seamless.
 * Grays only: charcoal at the edges, a lighter gray at the midpoint (which
 * keeps the white "MY WORK" label readable at every point of the loop).
 */
const PILL_GRADIENT = `linear-gradient(120deg, ${PALETTE.charcoal} 0%, #4a4a4a 25%, #6e6e6e 50%, #4a4a4a 75%, ${PALETTE.charcoal} 100%)`;

/** Renders `text` with `word` highlighted in the accent colour. */
function Accent({
  text,
  word,
  color,
}: {
  text: string;
  word: string;
  /** Accent follows the section background: on the dark state it uses the
   * on-dark accent, on the light state the regular one. Without it (reduced
   * motion, static dark section) the on-dark token is applied. */
  color?: string | MotionValue<string>;
}) {
  const i = text.indexOf(word);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <motion.span
        className={color ? undefined : "text-accent-on-dark"}
        style={color ? { color } : undefined}
      >
        {word}
      </motion.span>
      {text.slice(i + word.length)}
    </>
  );
}

export default function Cover({
  label = content.cover.label,
  heading1 = content.cover.heading.line1,
  heading2 = content.cover.heading.line2,
  reelLabel = content.cover.pillText,
  reelVideoUrl = "",
}: {
  /** The small label above the heading. */
  label?: string;
  heading1?: string;
  heading2?: string;
  /** The text inside the reel pill. */
  reelLabel?: string;
  /** When set, the pill plays this video instead of the animated gradient. */
  reelVideoUrl?: string;
}) {
  const reduce = useReducedMotion();
  const pillRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef<HTMLParagraphElement>(null);

  // Colour change is driven by the closing text block under the video:
  // progress 0 when the text block's top edge is at about 62% of the viewport height,
  // progress 1 when its top edge reaches about 30% of the viewport height.
  const { scrollYProgress } = useScroll({
    target: closingRef,
    offset: ["start 62%", "start 30%"],
  });

  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 1],
    [PALETTE.charcoal, PALETTE.background],
  );
  const textColor = useTransform(
    scrollYProgress,
    [0, 1],
    ["#ffffff", PALETTE.foreground],
  );
  // The accent highlight tracks the background: on-dark accent while the
  // section is dark, regular accent once it has turned light.
  const accentColor = useTransform(
    scrollYProgress,
    [0, 1],
    [PALETTE.accentOnDark, PALETTE.accent],
  );

  const accent = reduce ? undefined : accentColor;
  const labelNode = <Accent text={label} word="AI engineer" color={accent} />;
  const line1 = <Accent text={heading1} word="work." color={accent} />;
  const line2 = <Accent text={heading2} word="think." color={accent} />;
  const closingText = <Accent text={content.cover.closing} word="end to end." color={accent} />;

  // Reduced motion: static black state, no scroll-linked colour animation.
  if (reduce) {
    return (
      <section
        id="cover"
        className="relative z-10 rounded-t-[16px] bg-charcoal sm:rounded-t-[24px]"
      >
        <div className="flex flex-col items-center px-6 pt-[25vh] pb-[30vh] text-center">
          <p className="text-[clamp(14px,1vw,20px)] font-medium tracking-tight text-white">
            {labelNode}
          </p>
          <h2 className="mt-[clamp(16px,1.6vw,28px)] text-[clamp(32px,3.4vw,72px)] leading-[1.05] font-medium tracking-[-0.04em] text-white">
            {line1}
            <br />
            {line2}
          </h2>
          <button
            type="button"
            onClick={() => scrollToSection("works")}
            aria-label={reelLabel}
            className="relative mt-[11vh] flex h-[36vw] w-[92vw] items-center justify-center overflow-hidden rounded-full bg-charcoal sm:h-[26vw] sm:w-[72vw] lg:h-[20vw] lg:w-[53vw]"
          >
            {reelVideoUrl ? (
              <video
                src={reelVideoUrl}
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ backgroundImage: PILL_GRADIENT }}
              />
            )}
            <span className="relative text-[16vw] font-medium tracking-[-0.03em] whitespace-nowrap text-white sm:text-[11vw] lg:text-[9vw]">
              {reelLabel}
            </span>
          </button>
          <p
            ref={closingRef}
            className="mt-[12vh] max-w-[24ch] text-[clamp(26px,3vw,64px)] leading-[1.1] font-medium tracking-[-0.03em] text-white"
          >
            {closingText}
          </p>
        </div>
      </section>
    );
  }

  return (
    <motion.section
      id="cover"
      style={{ backgroundColor }}
      className="relative z-10 rounded-t-[16px] sm:rounded-t-[24px]"
    >
      <div className="flex flex-col items-center px-6 pt-[25vh] pb-[30vh] text-center">
        <motion.p
          style={{ color: textColor }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
          className="text-[clamp(14px,1vw,20px)] font-medium tracking-tight"
        >
          {labelNode}
        </motion.p>

        <motion.h2
          style={{ color: textColor }}
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.12 }}
          className="mt-[clamp(16px,1.6vw,28px)] text-[clamp(32px,3.4vw,72px)] leading-[1.05] font-medium tracking-[-0.04em]"
        >
          {line1}
          <br />
          {line2}
        </motion.h2>

        <motion.button
          ref={pillRef}
          type="button"
          onClick={() => scrollToSection("works")}
          aria-label={reelLabel}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          className="relative mt-[11vh] flex h-[36vw] w-[92vw] items-center justify-center overflow-hidden rounded-full bg-charcoal sm:h-[26vw] sm:w-[72vw] lg:h-[20vw] lg:w-[53vw]"
        >
          {reelVideoUrl ? (
            /* The reel video replaces the gradient, but keeps the pill shape. */
            <video
              src={reelVideoUrl}
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            /* Fill: one tile is 100% of the pill width, so translating the
                200%-wide layer by -50% loops seamlessly (transform only). */
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-[200%]"
            >
              <motion.span
                className="block h-full w-full"
                style={{
                  backgroundImage: PILL_GRADIENT,
                  backgroundSize: "50% 100%",
                  backgroundRepeat: "repeat",
                }}
                animate={{ x: ["0%", "-50%"] }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
            </span>
          )}
          <span className="relative text-[16vw] font-medium tracking-[-0.03em] whitespace-nowrap text-white sm:text-[11vw] lg:text-[9vw]">
            {reelLabel}
          </span>
        </motion.button>

        <motion.p
          ref={closingRef}
          style={{ color: textColor }}
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          className="mt-[12vh] max-w-[24ch] text-[clamp(26px,3vw,64px)] leading-[1.1] font-medium tracking-[-0.03em]"
        >
          {closingText}
        </motion.p>
      </div>
    </motion.section>
  );
}

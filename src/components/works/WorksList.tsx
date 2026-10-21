"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { content } from "@/lib/content";
import { duration, EASE } from "@/lib/motion";
import { useFrozenPage, useLoadGate } from "@/components/PageTransition";
import ProjectCover from "@/components/ProjectCover";
import type { Project } from "@/lib/projects";

/**
 * Cards switch to their desktop sizes at this width (phones AND tablets stay
 * on the large alternating layout — see docs/fix.txt).
 */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** Horizontal drift (px) each side card enters from on desktop. */
const DRIFT_PX = 28;

/** Shared side padding for the pinned heading and the card list. */
const SIDE_PAD = "px-[2.6vw]";

/** Pinned heading colours: near-black at rest, gray while a card crosses it. */
const HEADING_DARK = "#111111";
const HEADING_MUTED = "#A8A8A8";

/**
 * Scroll distance (fraction of the viewport height) over which the pinned
 * heading turns gray. The first card top sits at 85vh, so it reaches the
 * heading (centre 36vh) at ~38vh of scroll and covers it by ~55vh.
 */
const COLOR_START = 0.38;
const COLOR_END = 0.55;

/** Linear blend between two `#rrggbb` colours, `t` clamped to 0…1. */
function mixHex(from: string, to: string, t: number) {
  const clamp = Math.min(1, Math.max(0, t));
  const channel = (i: number) => {
    const a = parseInt(from.slice(i, i + 2), 16);
    const b = parseInt(to.slice(i, i + 2), 16);
    return Math.round(a + (b - a) * clamp);
  };
  return `rgb(${channel(1)}, ${channel(3)}, ${channel(5)})`;
}

type WorksListProps = {
  projects: Project[];
  /** Opens the project detail popup. `trigger` is the clicked card. */
  onSelect?: (project: Project, trigger: HTMLElement | null) => void;
};

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

/** A heading line that reveals by sliding down from behind a clipped mask. */
function RevealFromAbove({
  children,
  delay,
  reduce,
}: {
  children: ReactNode;
  delay: number;
  reduce: boolean;
}) {
  // The line waits for the page to be ready (the rise has finished) and never
  // animates in the frozen copy of the outgoing page.
  const frozen = useFrozenPage();
  const play = useLoadGate();

  return (
    <span className="block overflow-hidden">
      <motion.span
        className="block"
        initial={reduce || frozen ? false : { y: "-115%" }}
        animate={frozen || play ? { y: "0%" } : undefined}
        transition={{ duration: duration.slow, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/**
 * The section heading. It is a zero-height sticky block, so it never takes up
 * flow space (the list starts at 85vh on its own) while its text stays pinned
 * with its centre at 36vh. It releases when the sticky scope ends, riding the
 * scope's bottom edge and scrolling off with it; the buffer below the scope
 * keeps it inside the content wrapper, never over the contact screen.
 */
function StickyHeading({
  projects,
  reduce,
}: {
  projects: Project[];
  reduce: boolean;
}) {
  const { scrollY } = useScroll();

  // Scroll-driven and reversible: near-black at the top, gray once the cards
  // start crossing the heading.
  const color = useTransform(scrollY, (y) => {
    const vh = typeof window === "undefined" ? 1 : window.innerHeight;
    const t = (y - vh * COLOR_START) / (vh * (COLOR_END - COLOR_START));
    return mixHex(HEADING_DARK, HEADING_MUTED, t);
  });

  const countLabel = String(projects.length).padStart(2, "0");

  return (
    <div className="pointer-events-none sticky top-[36vh] z-0 h-0">
      <div className={`absolute inset-x-0 top-0 -translate-y-1/2 ${SIDE_PAD}`}>
        <motion.h1
          style={{ color }}
          className="flex flex-wrap items-baseline justify-center gap-x-[0.35em] gap-y-1"
        >
          <RevealFromAbove delay={0.1} reduce={reduce}>
            <span className="block text-[clamp(40px,13vw,90px)] leading-none font-normal tracking-[-0.05em] lg:text-[clamp(52px,9vw,190px)]">
              {content.worksPage.heading}
            </span>
          </RevealFromAbove>
          <RevealFromAbove delay={0.3} reduce={reduce}>
            <span className="block text-[clamp(14px,1.1vw,22px)] leading-none font-normal tracking-[-0.03em] text-foreground/45">
              [{countLabel}]
            </span>
          </RevealFromAbove>
        </motion.h1>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  index,
  left,
  isDesktop,
  onSelect,
  reduce,
}: {
  project: Project;
  index: number;
  left: boolean;
  isDesktop: boolean;
  onSelect: (project: Project, trigger: HTMLElement | null) => void;
  reduce: boolean;
}) {
  // The first card is the load-in card: it only rises. Every other card drifts
  // in from its own side once it scrolls into view (no drift on mobile).
  const isFirst = index === 0;
  const drift = isFirst || !isDesktop ? 0 : left ? -DRIFT_PX : DRIFT_PX;

  // The load-in card waits for the page to be ready (the rise has finished)
  // and never animates in the frozen copy of the outgoing page.
  const frozen = useFrozenPage();
  const play = useLoadGate();

  const hidden = { opacity: 0, y: isFirst ? 64 : 48, x: drift };
  const visible = { opacity: 1, y: 0, x: 0 };
  const transition = {
    duration: duration.slow,
    ease: EASE,
    delay: isFirst ? 0.7 : 0,
  };

  // Every card is the same size: the left card's current width, on every
  // breakpoint. The alternating placement stays, only the size is unified.
  const width = "w-[88vw] lg:w-[35vw]";
  const ratio = "aspect-[16/10]";
  const sizes = "(min-width: 1024px) 35vw, 88vw";

  return (
    <li className={`flex ${left ? "justify-start" : "justify-end"}`}>
      <motion.button
        type="button"
        onClick={(event) => onSelect(project, event.currentTarget)}
        initial={reduce || frozen ? false : hidden}
        animate={
          isFirst && !reduce && (frozen || play) ? visible : undefined
        }
        whileInView={isFirst || reduce ? undefined : visible}
        viewport={isFirst || reduce ? undefined : { once: true, amount: 0.3 }}
        transition={transition}
        className={`group block text-left focus:outline-none ${width}`}
      >
        <div
          className={`relative w-full overflow-hidden rounded-[14px] bg-charcoal/5 ring-1 ring-black/5 ${ratio}`}
        >
          {project.coverImageUrl ? (
            <ProjectCover
              src={project.coverImageUrl}
              alt={project.name}
              adjust={project.coverAdjust}
              sizes={sizes}
              className="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : null}
        </div>

        <h2 className="mt-[14px] text-[16px] font-normal tracking-[-0.02em] text-foreground transition-opacity duration-300 group-hover:opacity-60 group-focus-visible:opacity-60 lg:text-[clamp(15px,1.15vw,22px)]">
          {project.name}
        </h2>
      </motion.button>
    </li>
  );
}

/**
 * Public works list. The heading is pinned inside the section scope and the
 * cards start low on the first screen (85vh) so they rise over it; the list
 * carries a higher z-index than the heading. Content (names, images) comes
 * straight from the admin dashboard and is rendered unchanged.
 */
export default function WorksList({ projects, onSelect }: WorksListProps) {
  const reduce = useReducedMotion() ?? false;
  const isDesktop = useIsDesktop();

  return (
    <section id="works" className="relative">
      {/* Sticky scope: the heading is released once this block scrolls off. */}
      <div className="relative">
        <StickyHeading projects={projects} reduce={reduce} />

        {projects.length === 0 ? (
          <div
            className={`flex min-h-[50vh] items-start justify-center ${SIDE_PAD} pt-[85vh] pb-[26vh]`}
          >
            <p className="text-center text-[clamp(18px,2.2vw,30px)] font-medium tracking-[-0.02em] text-foreground/50">
              {content.worksPage.empty}
            </p>
          </div>
        ) : (
          <ul
            key={isDesktop ? "desktop" : "mobile"}
            className={`relative z-10 flex flex-col gap-[13vh] ${SIDE_PAD} pt-[85vh] pb-[26vh]`}
          >
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                left={index % 2 === 0}
                isDesktop={isDesktop}
                onSelect={onSelect ?? (() => {})}
                reduce={reduce}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Keeps the released heading inside the content wrapper so it never
          crosses onto the fixed contact screen underneath. */}
      <div aria-hidden="true" className="h-[18vh]" />
    </section>
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SkillCategory } from "@/lib/about";
import { isRemoteImageSrc } from "@/lib/image-source";
import { EASE, about, duration } from "@/lib/motion";
import { LineDraw } from "./Reveal";

/* Thin top rule: transparent at both ends, darkest in the middle. */
const LINE_GRADIENT =
  "linear-gradient(to right, color-mix(in srgb, var(--charcoal) 0%, transparent) 0%, color-mix(in srgb, var(--charcoal) 55%, transparent) 50%, color-mix(in srgb, var(--charcoal) 0%, transparent) 100%)";

/* Pills fade in once, one after another. */
const pillsParent = {
  hidden: {},
  visible: { transition: { staggerChildren: about.stagger } },
};

const pillsChild = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: about.itemDuration, ease: about.easeOut },
  },
};

/**
 * Category tabs with the first category active by default. The active tab is a
 * single black pill that slides from the previous tab to the clicked one
 * (shared `layoutId`, tween on the shared motion tokens — never a spring);
 * inactive tabs are just a thin gray border with no fill.
 *
 * The selected category's skills are shown as Services-style columns — thin
 * line on top, name (and a small icon when one exists) below — never chips.
 * `AnimatePresence mode="wait"` fades the old columns out quickly, then the
 * new ones stagger in; the first category does the same the first time the
 * columns scroll into view. All timing comes from the `about` motion tokens.
 */
export default function SkillsTabs({
  categories,
}: {
  categories: SkillCategory[];
}) {
  const [activeId, setActiveId] = useState(categories[0]?.id ?? "");
  const reduce = useReducedMotion() ?? false;
  const active =
    categories.find((category) => category.id === activeId) ?? categories[0];

  if (!active) return null;

  const slide = reduce ? { duration: 0 } : { duration: duration.base, ease: EASE };
  const itemDuration = reduce ? duration.fast : about.itemDuration;
  const stagger = reduce ? 0 : about.stagger;

  const listParent = {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren: stagger * 0.5 },
    },
    exit: {
      transition: { staggerChildren: stagger * 0.35, staggerDirection: -1 },
    },
  };

  const listItem = {
    hidden: { opacity: 0, y: reduce ? 0 : 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: itemDuration, ease: about.easeOut },
    },
    exit: {
      opacity: 0,
      y: reduce ? 0 : -10,
      transition: { duration: duration.fast, ease: about.easeOut },
    },
  };

  return (
    <div className="mt-[calc(var(--vh-sm)*0.08)]">
      <motion.div
        role="tablist"
        aria-label="Skill categories"
        className="flex flex-wrap justify-center gap-2"
        variants={pillsParent}
        initial={reduce ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, margin: "-10%" }}
      >
        {categories.map((category) => {
          const isActive = category.id === active.id;
          return (
            <motion.button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(category.id)}
              variants={reduce ? undefined : pillsChild}
              className={`relative rounded-[10px] border px-4 py-2 text-sm font-medium tracking-tight transition-colors duration-300 md:px-5 ${
                isActive
                  ? "border-transparent text-white"
                  : "border-foreground/15 text-foreground/60 hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.span
                  aria-hidden="true"
                  layoutId="skills-active-pill"
                  className="absolute inset-0 rounded-[10px] bg-charcoal"
                  transition={slide}
                />
              )}
              <span className="relative z-10">{category.name}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {active.skills.length === 0 ? (
        <p className="mt-[calc(var(--vh-sm)*0.07)] text-center text-sm text-foreground/40">
          No skills listed yet.
        </p>
      ) : (
        <AnimatePresence mode="wait">
          <motion.ul
            key={active.id}
            className="mt-[calc(var(--vh-sm)*0.07)] grid grid-cols-1 gap-x-6 gap-y-[clamp(32px,3vw,56px)] sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3 lg:gap-x-[75px]"
            variants={listParent}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
            exit="exit"
          >
            {active.skills.map((skill) => (
              <motion.li key={skill.id} className="min-w-0" variants={listItem}>
                <LineDraw inherit style={{ backgroundImage: LINE_GRADIENT }} />
                <div className="inline-flex min-w-0 max-w-full items-center gap-[0.6em] pt-5 text-[clamp(20px,1.7vw,32px)]">
                  {skill.iconUrl && (
                    <Image
                      src={skill.iconUrl}
                      alt=""
                      width={0}
                      height={0}
                      sizes="1.1em"
                      unoptimized={isRemoteImageSrc(skill.iconUrl)}
                      decoding="async"
                      className="h-[1.1em] w-[1.1em] shrink-0 object-contain"
                    />
                  )}
                  <h3 className="min-w-0 text-balance leading-tight font-normal tracking-[-0.02em] text-foreground [overflow-wrap:anywhere]">
                    {skill.name}
                  </h3>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </AnimatePresence>
      )}
    </div>
  );
}

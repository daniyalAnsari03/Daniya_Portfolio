"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { content } from "@/lib/content";
import { EASE, duration, pageMotion } from "@/lib/motion";
import { lockScroll, unlockScroll } from "@/components/SmoothScroll";
import { ArrowUpRight, XIcon } from "@/components/icons";
import { isRemoteImageSrc } from "@/lib/image-source";
import type { Project } from "@/lib/projects";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const container: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: pageMotion.popup - 0.1,
      staggerChildren: pageMotion.stagger,
    },
  },
  exit: {
    transition: { staggerChildren: 0.03, staggerDirection: -1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: duration.fast, ease: EASE },
  },
};

type ProjectPopupProps = {
  /** The project being shown; the parent keeps it until the exit finishes. */
  project: Project;
  open: boolean;
  onClose: () => void;
  /** Called once the sheet has animated out. */
  onExited: () => void;
  /** Card that opened the popup; focus returns here after the exit finishes. */
  returnFocusTo: RefObject<HTMLElement | null>;
};

export default function ProjectPopup({
  project,
  open,
  onClose,
  onExited,
  returnFocusTo,
}: ProjectPopupProps) {
  const reduce = useReducedMotion() ?? false;
  const copy = content.worksPage.popup;
  const [animating, setAnimating] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    lockScroll();
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const root = panelRef.current;
      if (!root) return;

      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true",
      );

      if (focusable.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!root.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      unlockScroll();
    };
  }, [open, onClose]);

  const gallery =
    project.images.length > 0
      ? project.images
      : project.coverImageUrl
        ? [{ id: "cover", url: project.coverImageUrl, sortOrder: 0 }]
        : [];

  const headingId = `project-popup-${project.id}`;

  return (
    <AnimatePresence
      onExitComplete={() => {
        returnFocusTo.current?.focus();
        onExited();
      }}
    >
      {open ? (
        <div
          key={project.id}
          className="fixed inset-0 z-[100] flex items-end justify-center"
        >
          <motion.button
            type="button"
            tabIndex={-1}
            aria-label={copy.closeLabel}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-charcoal/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.15 : duration.base, ease: EASE }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            tabIndex={-1}
            data-lenis-prevent
            className="relative z-10 flex h-[92dvh] w-full max-w-[1600px] flex-col overflow-hidden rounded-t-[16px] bg-white text-[#111111] shadow-[0_-24px_80px_-24px_rgba(0,0,0,0.8)] outline-none"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.15, ease: EASE } }
                : {
                    opacity: 0,
                    y: "100%",
                    transition: {
                      duration: duration.slow,
                      ease: EASE,
                      delay: 0.18,
                    },
                  }
            }
            transition={{
              duration: reduce ? 0.15 : pageMotion.popup,
              ease: EASE,
            }}
            onAnimationStart={() => setAnimating(true)}
            onAnimationComplete={() => setAnimating(false)}
            style={{ willChange: animating ? "transform, opacity" : undefined }}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={copy.closeLabel}
              className="absolute top-5 right-5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0 lg:h-12 lg:w-12"
            >
              <XIcon className="h-5 w-5" />
            </button>

            <motion.div
              data-lenis-prevent
              className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:flex-row lg:overflow-hidden"
              initial={reduce ? undefined : "hidden"}
              animate={reduce ? undefined : "visible"}
              exit={reduce ? undefined : "exit"}
              variants={reduce ? undefined : container}
            >
              {/* Details. */}
              <motion.div
                variants={reduce ? undefined : item}
                className="shrink-0 px-6 pt-16 pb-8 sm:px-8 lg:w-[38%] lg:overflow-y-auto lg:px-12 lg:py-14"
              >
                <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
                  {copy.detailsLabel}
                </p>

                <h2
                  id={headingId}
                  className="mt-4 max-w-[18ch] pr-10 text-[9vw] leading-[0.95] font-medium tracking-[-0.045em] text-[#111111] sm:text-4xl lg:pr-0 lg:text-[clamp(36px,3.4vw,64px)]"
                >
                  {project.name}
                </h2>

                {project.description ? (
                  <p className="mt-6 max-w-[52ch] text-[15px] leading-relaxed whitespace-pre-line text-[#111111]/85 lg:text-base">
                    {project.description}
                  </p>
                ) : null}

                {project.techStack.length > 0 ? (
                  <div className="mt-8">
                    <h3 className="text-xs font-medium tracking-[0.18em] text-[#666666] uppercase">
                      {copy.techLabel}
                    </h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {project.techStack.map((tech) => (
                        <li
                          key={tech}
                          className="rounded-full border border-[#E5E5E5] px-3 py-1.5 text-xs font-medium tracking-[-0.01em] text-[#111111]"
                        >
                          {tech}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {project.demoLink ? (
                  <a
                    href={project.demoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-white transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {copy.demoLabel}
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
                  </a>
                ) : null}
              </motion.div>

              {/* Gallery: scrolls independently on desktop, stacks below the
                  details on tablet/mobile. Images keep their natural ratio. */}
              <div
                data-lenis-prevent
                className="min-h-0 flex-1 border-t border-[#E5E5E5] px-6 pt-8 pb-10 sm:px-8 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:px-10 lg:py-14"
              >
                <motion.h3
                  variants={reduce ? undefined : item}
                  className="text-xs font-medium tracking-[0.18em] text-[#666666] uppercase"
                >
                  {copy.galleryLabel}
                </motion.h3>

                <div className="mt-4 flex flex-col gap-4 lg:mt-5 lg:gap-5">
                  {gallery.map((image) => (
                    <motion.div
                      key={image.id}
                      variants={reduce ? undefined : item}
                      className="overflow-hidden rounded-[10px] border border-[#E5E5E5] bg-white"
                    >
                      <Image
                        src={image.url}
                        alt={project.name}
                        width={0}
                        height={0}
                        sizes="(min-width: 1024px) 55vw, 100vw"
                        unoptimized={isRemoteImageSrc(image.url)}
                        decoding="async"
                        style={{ width: "100%", height: "auto" }}
                        className="block h-auto w-full"
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

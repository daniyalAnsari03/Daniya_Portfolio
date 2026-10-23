"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { cvMotion } from "@/lib/motion";
import { cvBullets, cvContactItems, type CvDocument } from "@/lib/cv-shared";
import { DownloadIcon, XIcon } from "@/components/icons";
import { lockScroll, unlockScroll } from "@/components/SmoothScroll";

/**
 * The drawer is flush to the right edge: the full width on a phone, 75% on a
 * tablet in portrait and 50% (never below 480px) on a desktop. Only the
 * left corners are rounded — the right side is glued to the viewport edge.
 */
const PANEL_WIDTH =
  "w-full md:w-[75vw] lg:w-[50vw] lg:min-w-[480px] md:rounded-l-[18px]";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Touch devices (no hover) only get the plain fades — no slide distances and
 * no stagger. Same probe as the About page (a media query, so it is always
 * resolved on the client).
 */
const TOUCH_QUERY = "(hover: none)";

function subscribeTouch(callback: () => void) {
  const query = window.matchMedia(TOUCH_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useTouch(): boolean {
  return useSyncExternalStore(
    subscribeTouch,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
}

function useFocusTrap(active: boolean, containerRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetWidth > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, containerRef]);
}

type CvDrawerProps = {
  cv: CvDocument;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
};

export default function CvDrawer({ cv, open, onClose, onExited }: CvDrawerProps) {
  const reduce = useReducedMotion() ?? false;
  const touch = useTouch();
  const simple = reduce || touch;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [animating, setAnimating] = useState(false);

  useFocusTrap(open, panelRef);

  // Lock the page while the drawer is open (Lenis aware, including the
  // touch-device handling of SmoothScroll).
  useEffect(() => {
    if (open) {
      lockScroll();
    } else {
      unlockScroll();
    }
    return () => unlockScroll();
  }, [open]);

  // Move the focus into the drawer once it has slid in.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const container = panelRef.current;
      if (!container) return;
      const focusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable) {
        focusable.focus();
      } else {
        container.focus();
      }
    }, cvMotion.drawer * 1000 * 0.8);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  /**
   * The reveal: the drawer slides in first, then the CV itself fades in block
   * by block (name, contact, summary, every section and every entry).
   */
  const variants = useMemo(() => {
    const duration = simple ? cvMotion.fade : cvMotion.item;
    const distance = simple ? 0 : 16;

    const block = {
      hidden: { opacity: 0, y: distance },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration, ease: cvMotion.easeOut },
      },
    };

    const section = {
      hidden: { opacity: 0, y: distance },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration,
          ease: cvMotion.easeOut,
          staggerChildren: simple ? 0 : cvMotion.stagger,
        },
      },
    };

    const entry = {
      hidden: { opacity: 0, y: simple ? 0 : 10 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration, ease: cvMotion.easeOut },
      },
    };

    return {
      container: {
        hidden: {},
        visible: {
          transition: {
            delayChildren: simple ? 0 : cvMotion.drawer,
            staggerChildren: simple ? 0 : cvMotion.stagger,
          },
        },
      },
      block,
      section,
      entry,
    };
  }, [simple]);

  const profile = cv.profile;
  const contactItems = cvContactItems(profile);
  const hasBody = Boolean(profile.summary) || cv.sections.length > 0;

  return (
    <AnimatePresence onExitComplete={() => onExited()}>
      {open ? (
        /* The overlay + the drawer live in their own fixed layer, OUTSIDE the
           transformed page wrappers. `overflow-x-clip` keeps the off-screen
           drawer (during the exit) from ever creating a horizontal scroll. */
        <div className="fixed inset-0 z-[var(--z-popup)] overflow-x-clip">
          <motion.div
            className="absolute inset-0 bg-charcoal/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: cvMotion.fade, ease: cvMotion.easeInOut }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={content.resume.title}
            tabIndex={-1}
            className={`absolute top-0 right-0 flex h-viewport-sm flex-col bg-background outline-none ${PANEL_WIDTH}`}
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{
              duration: reduce ? cvMotion.fade : cvMotion.drawer,
              ease: cvMotion.easeInOut,
            }}
            onAnimationStart={() => setAnimating(true)}
            onAnimationComplete={() => setAnimating(false)}
            style={{ willChange: animating ? "transform, opacity" : undefined }}
          >
            {/* Header: the title on the left, the PDF button and the close
                button on the right. */}
            <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+18px)] sm:px-8 sm:pt-[calc(env(safe-area-inset-top)+22px)]">
              <h2 className="min-w-0 truncate text-lg font-medium tracking-[-0.03em] text-foreground sm:text-xl">
                {content.resume.title}
              </h2>

              <div className="flex shrink-0 items-center gap-2">
                <a
                  href="/cv/download"
                  download
                  className="flex h-10 items-center justify-between gap-2 rounded-full bg-accent p-2 pl-4 text-[12px] font-medium text-accent-contrast transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:text-[13px]"
                >
                  <span className="whitespace-nowrap">
                    {content.resume.downloadLabel}
                  </span>
                  <span className="flex h-full aspect-square items-center justify-center rounded-full bg-white text-accent">
                    <DownloadIcon className="h-1/2 w-1/2" />
                  </span>
                </a>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label={content.resume.closeLabel}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-contrast transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* The CV itself, on a paper-like panel that scrolls inside. */}
            <div
              data-lenis-prevent
              className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+32px)] sm:px-6"
            >
              <motion.div
                variants={variants.container}
                initial="hidden"
                animate="visible"
                className="rounded-[16px] bg-white p-6 ring-1 ring-black/5 sm:p-9"
              >
                <motion.div variants={variants.block}>
                  {profile.fullName ? (
                    <h3 className="text-[clamp(26px,3vw,40px)] leading-[1.05] font-medium tracking-[-0.035em] text-foreground">
                      {profile.fullName}
                    </h3>
                  ) : null}
                  {profile.headline ? (
                    <p className="mt-2 text-[15px] text-foreground/60">
                      {profile.headline}
                    </p>
                  ) : null}
                </motion.div>

                {contactItems.length > 0 ? (
                  <motion.ul
                    variants={variants.block}
                    className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-foreground/60"
                  >
                    {contactItems.map((item, index) => (
                      <li key={item} className="flex items-center gap-3">
                        {index > 0 ? (
                          <span
                            aria-hidden="true"
                            className="h-1 w-1 rounded-full bg-foreground/25"
                          />
                        ) : null}
                        <span className="[overflow-wrap:anywhere]">{item}</span>
                      </li>
                    ))}
                  </motion.ul>
                ) : null}

                {profile.summary ? (
                  <motion.p
                    variants={variants.block}
                    className="mt-6 text-[14px] leading-relaxed whitespace-pre-wrap text-foreground/75"
                  >
                    {profile.summary}
                  </motion.p>
                ) : null}

                {!hasBody ? (
                  <motion.p
                    variants={variants.block}
                    className="mt-6 text-sm text-foreground/50"
                  >
                    {content.resume.emptyLabel}
                  </motion.p>
                ) : null}

                {cv.sections.map((section) => (
                  <motion.section
                    key={section.id}
                    variants={variants.section}
                    className="mt-10 first:mt-8"
                  >
                    <h4 className="text-[11px] font-medium tracking-[0.18em] text-foreground/40 uppercase">
                      {section.title}
                    </h4>

                    <div className="mt-3">
                      {section.entries.length === 0 ? null : (
                        section.entries.map((entry) => {
                          const bullets = cvBullets(entry.description);
                          return (
                            <motion.article
                              key={entry.id}
                              variants={variants.entry}
                              className="border-t border-foreground/12 py-4 first:border-t-0 first:pt-3"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                                <div className="min-w-0">
                                  {entry.title ? (
                                    <h5 className="text-[15px] font-medium tracking-[-0.01em] text-foreground">
                                      {entry.title}
                                    </h5>
                                  ) : null}
                                  {entry.subtitle ? (
                                    <p className="mt-1 text-[13px] text-foreground/60">
                                      {entry.subtitle}
                                    </p>
                                  ) : null}
                                </div>
                                {entry.period ? (
                                  <p className="text-[13px] whitespace-nowrap text-foreground/45">
                                    {entry.period}
                                  </p>
                                ) : null}
                              </div>

                              {bullets.length > 0 ? (
                                <ul className="mt-3 space-y-2">
                                  {bullets.map((bullet, index) => (
                                    <li
                                      key={index}
                                      className="flex gap-3 text-[14px] leading-relaxed text-foreground/75"
                                    >
                                      <span
                                        aria-hidden="true"
                                        className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/40"
                                      />
                                      <span className="whitespace-pre-wrap">
                                        {bullet}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </motion.article>
                          );
                        })
                      )}
                    </div>
                  </motion.section>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

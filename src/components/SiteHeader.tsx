"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { load } from "@/lib/motion";
import { useHideOnScroll } from "@/lib/useHideOnScroll";
import ContactButton from "./ContactButton";

/** Y (px from the top) the header is measured against for dark-zone probing. */
const PROBE_Y = 44;

/**
 * On the homepage the Cover scrolls up over the Hero — and used to cover the
 * header that lived inside it. Once the Cover reaches the header line the
 * header must stay hidden even when the user scrolls back up.
 */
function coverOverHeader(): boolean {
  if (typeof document === "undefined") return false;
  const cover = document.getElementById("cover");
  if (!cover) return false;
  return cover.getBoundingClientRect().top <= PROBE_Y + 40;
}

/**
 * Fixed top chrome for every public page: the "Daniyal" logo on the left and
 * the Contact button on the right. Lives in the shared (public) layout, OUTSIDE
 * the transitioning page content, so it stays put through page transitions.
 *
 * - Hides on scroll down / shows on scroll up (shared `useHideOnScroll`).
 * - Inverts to white over dark sections (anything marked `data-chrome-dark`,
 *   e.g. the About services screen and the footer-reveal contact screen).
 * - On the homepage it replays the corner entrance (logo + contact button,
 *   matching the Hero's original load sequence) every time "/" is entered.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const reduce = useReducedMotion() ?? false;
  const onHome = pathname === "/";

  const hide = useHideOnScroll({ forceHidden: onHome ? coverOverHeader : undefined });
  const [dark, setDark] = useState(false);

  // Probe every dark zone under the header line (services, footer reveal…).
  useEffect(() => {
    const update = () => {
      const overDark = Array.from(
        document.querySelectorAll("[data-chrome-dark]"),
      ).some((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top <= PROBE_Y && rect.bottom >= PROBE_Y;
      });
      setDark(overDark);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  // The header never remounts (it lives in the layout), so on the homepage we
  // bump a key each time "/" is entered — the corner entrance replays exactly
  // as it did when it lived inside the Hero. Adjusted during render (the
  // documented prop-change pattern), so there is no extra committed frame.
  const [seenPath, setSeenPath] = useState(pathname);
  const [introKey, setIntroKey] = useState(0);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (pathname === "/") setIntroKey((key) => key + 1);
  }

  const d = load.corners.distance;
  const nameClass =
    "text-[24px] font-normal tracking-tight lg:text-[26px] " +
    (onHome ? "text-foreground" : dark ? "text-white" : "text-foreground");
  const buttonClass = "pointer-events-auto";

  const corner = (from: number, index: number) =>
    onHome
      ? {
          initial: reduce ? false : { opacity: 0, y: from },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: load.corners.duration,
            ease: load.ease,
            delay: load.corners.delay + load.corners.stagger * index,
          },
        }
      : {};

  return (
    <motion.header
      {...hide}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between px-6 pt-6 lg:px-7 lg:pt-7"
    >
      {onHome ? (
        <motion.span
          key={`site-name-${introKey}`}
          className={nameClass}
          {...corner(-d, 0)}
        >
          {content.name}
        </motion.span>
      ) : (
        <Link href="/" className={`pointer-events-auto ${nameClass}`}>
          {content.name}
        </Link>
      )}

      <motion.div
        key={`site-contact-${introKey}`}
        className={buttonClass}
        {...corner(-d, 1)}
      >
        <ContactButton variant={dark && !onHome ? "dark" : "accent"} />
      </motion.div>
    </motion.header>
  );
}

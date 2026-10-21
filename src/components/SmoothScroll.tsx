"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { EASE, duration } from "@/lib/motion";

let lenis: Lenis | null = null;

const prefersReducedMotion = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/** Freeze page scrolling while an overlay (e.g. the contact popup) is open. */
export function lockScroll() {
  if (lenis) {
    lenis.stop();
    return;
  }
  if (typeof document !== "undefined") {
    document.body.style.overflow = "hidden";
  }
}

/** Undo `lockScroll`. */
export function unlockScroll() {
  if (lenis) {
    lenis.start();
    return;
  }
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
}

/**
 * Instantly jump to the very top of the page (Lenis aware). `force` lets the
 * scroll apply even while Lenis is stopped (locked during a page transition),
 * and the native `window.scrollTo` covers the no-Lenis / reduced-motion case.
 */
export function resetScroll() {
  if (typeof window === "undefined") return;
  if (lenis) {
    lenis.scrollTo(0, { immediate: true, force: true });
  }
  window.scrollTo(0, 0);
}

/** Smoothly scroll to a section id using Lenis, with a native fallback. */
export function scrollToSection(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;

  if (lenis) {
    lenis.scrollTo(el, { duration: duration.slow, easing: (t) => cubic(t) });
    return;
  }

  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

/** Re-express the shared cubic-bezier easing as a time -> progress function. */
function cubic(t: number) {
  // Approximate sampling of cubic-bezier(0.76, 0, 0.24, 1).
  const [x1, y1, x2, y2] = EASE;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;

  let u = t;
  for (let i = 0; i < 6; i++) {
    const x = sampleX(u) - t;
    if (Math.abs(x) < 1e-5) break;
    const d = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(d) < 1e-6) break;
    u -= x / d;
  }
  return sampleY(u);
}

export default function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Disable smooth scrolling entirely when the user prefers reduced motion.
    if (prefersReducedMotion()) return;

    const instance = new Lenis({
      // `lerp` (rather than duration + easing) keeps wheel scrolling smooth and
      // frame-rate independent, and follows the wheel closely enough to settle
      // soon after the user stops. Touch is left native (syncTouch stays off).
      lerp: 0.14,
      wheelMultiplier: 1,
      smoothWheel: true,
      respectReducedMotion: true,
      // Lenis only animates while its rAF loop runs. With `autoRaf` it drives
      // itself; without it every scrollTo()/wheel gesture would update the
      // target and never move the page.
      autoRaf: true,
    });
    lenis = instance;

    return () => {
      instance.destroy();
      lenis = null;
    };
  }, []);

  return <>{children}</>;
}

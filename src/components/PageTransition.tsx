"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { pageMotion } from "@/lib/motion";
import { lockScroll, resetScroll, unlockScroll } from "./SmoothScroll";

/* ------------------------------------------------------------------ */
/* Page signal                                                         */
/*                                                                     */
/* Two flags, shared through one context:                              */
/*                                                                     */
/* - `ready`  the page may play its load animation. It is false while */
/*   the page is still rising and true once the transition settled.  */
/* - `frozen` this render is the frozen copy of the OUTGOING page    */
/*   (the one that stays on screen while it shrinks away). It must    */
/*   show the final state at once — never an entrance animation.      */
/*                                                                     */
/* The signal lives in a context (not a module store) so its value is */
/* already correct on the FIRST render of a page: the rising page    */
/* mounts with the signal closed, otherwise its load animation would */
/* start before the page has finished rising.                         */
/* ------------------------------------------------------------------ */

export type PageSignal = { ready: boolean; frozen: boolean };

const PageSignalContext = createContext<PageSignal>({
  ready: true,
  frozen: false,
});

/** The frozen copy of the outgoing page always shows its final state. */
const FROZEN_SIGNAL: PageSignal = { ready: true, frozen: true };

/** `true` when the current page may play its load animation. */
export function usePageReady(): boolean {
  return useContext(PageSignalContext).ready;
}

/** `true` inside the frozen copy of the outgoing page. */
export function useFrozenPage(): boolean {
  return useContext(PageSignalContext).frozen;
}

/**
 * Whether a page's load animation may play.
 *
 * The signal is closed while the page is still rising and opens when the
 * transition ends. It never closes again under a live page: the outgoing
 * page is replaced by its frozen copy (which renders in its final state) as
 * soon as a transition starts, so an entrance is never played twice and never
 * reversed.
 */
export function useLoadGate(): boolean {
  return usePageReady();
}

/* ------------------------------------------------------------------ */
/* Pending navigation signal                                           */
/*                                                                     */
/* The Nav lives outside this component, so a click publishes its      */
/* destination here. The transition starts on that signal — immediately */
/* on the click — instead of waiting for `usePathname()` to change.    */
/* ------------------------------------------------------------------ */

/** Routes that take part in the rise-over transition. `/admin` never does. */
const TRANSITION_ROUTES = new Set(["/", "/works", "/about"]);

export type PendingNavigation = {
  href: string;
  /** Scroll offset of the page being left, frozen before the route swaps. */
  scrollY: number;
  /** Height of the viewport when the transition started. */
  viewportHeight: number;
  /** Height of the outgoing document when the transition started. */
  documentHeight: number;
};

let pendingNavigation: PendingNavigation | null = null;
const pendingListeners = new Set<() => void>();

function emitPendingNavigation() {
  pendingListeners.forEach((listener) => listener());
}

function subscribePendingNavigation(listener: () => void) {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

/**
 * Measure the geometry the frozen (outgoing) page is laid out against:
 * where the user is scrolled to, how tall the viewport is and how tall the
 * outgoing document is. The frozen layer is built in DOCUMENT coordinates,
 * so these numbers decide where its viewport centre sits.
 */
function measureOutgoingPage() {
  if (typeof window === "undefined") {
    return { scrollY: 0, viewportHeight: 0, documentHeight: 0 };
  }

  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  const documentHeight = Math.max(
    document.documentElement.scrollHeight,
    scrollY + viewportHeight,
  );

  return { scrollY, viewportHeight, documentHeight };
}

/** Begin the rise-over transition for `href` on the click itself. */
export function beginPageTransition(href: string) {
  if (!TRANSITION_ROUTES.has(href)) return;
  if (pendingNavigation?.href === href) return;
  pendingNavigation = { href, ...measureOutgoingPage() };
  emitPendingNavigation();
}

function clearPendingNavigation() {
  if (pendingNavigation === null) return;
  pendingNavigation = null;
  emitPendingNavigation();
}

/** The route a transition is currently heading to, `null` when idle. */
export function usePendingTransition(): PendingNavigation | null {
  return useSyncExternalStore(
    subscribePendingNavigation,
    () => pendingNavigation,
    () => null,
  );
}

/* ------------------------------------------------------------------ */
/* Transition                                                          */
/* ------------------------------------------------------------------ */

type TransitionState = {
  /** Path of the page that owns `node`. */
  path: string;
  /** Committed page children (the page currently at `path`). */
  node: ReactNode;
  /** Outgoing page, frozen while the incoming panel rises over it. */
  prevNode: ReactNode | null;
  /** Content of the rising panel; `null` until the target route commits. */
  incomingNode: ReactNode | null;
  /** Scroll offset of the outgoing page — frozen during the transition. */
  scrollY: number;
  /** Height of the viewport when the transition started. */
  viewportHeight: number;
  /** Height of the outgoing document when the transition started. */
  documentHeight: number;
  /** Destination path while a navigation is in flight. */
  target: string | null;
  animating: boolean;
  /** The shared progress has been handed over to the animation driver. */
  started: boolean;
};

/** useLayoutEffect that is safe to SSR (App Router renders this component). */
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Keeps the outgoing page on screen while the incoming page rises over it,
 * for Home / Works / About navigations (including browser back/forward — the
 * direction never reverses).
 *
 * The transition is driven by ONE shared progress value (0 → 1):
 *
 * - the new page starts fully below the screen (`translateY(100%)`) and rises
 *   to `translateY(0)`, covering the old page — no rounded corners anywhere;
 * - the old page stays mounted underneath with its own colours (nothing dims
 *   it, no overlay sits on top of it) and shrinks in place from scale 1 to
 *   `pageMotion.oldPageEndScale`, around the centre of what the user is
 *   looking at, while it LIFTS by `pageMotion.oldPageEndLift` (vh) — the same
 *   progress drives both. The lift sits on an OUTER wrapper and the scale on
 *   an INNER one, so the lift is a real screen-space move that the scale
 *   cannot shrink away;
 * - a fixed backdrop in the dark design token (`--charcoal`) sits behind both
 *   layers, so the dark colour is revealed around the shrinking old page.
 *
 * Only `transform` and `opacity` animate, `will-change` is set on the two
 * layers while they run and drops away with them, and prefers-reduced-motion
 * collapses everything into a short cross-fade.
 *
 * The rise starts on the nav click (via `beginPageTransition`) and the shared
 * progress only starts running once the destination route has committed, so
 * the rising panel is never empty and the new page never flashes at the top.
 *
 * The page itself is mounted ONCE: the same element that rises simply becomes
 * the normal page when the transition ends (the stage keeps its place in the
 * tree, only its positioning changes). Its load animation waits for the
 * `ready` signal, so nothing plays twice.
 *
 * Lives in the shared (public) layout — the fixed chrome (header + nav pill)
 * is rendered as its SIBLING, outside every transformed wrapper, so it stays
 * put (and `position: fixed` keeps working) throughout. Server components,
 * caching and ISR are untouched: the previous page's already-rendered React
 * element is simply kept mounted for the length of the transition.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion() ?? false;
  const pending = usePendingTransition();

  const [prevPath, setPrevPath] = useState(pathname);
  const [elapsed, setElapsed] = useState(false);
  const [state, setState] = useState<TransitionState>(() => ({
    path: pathname,
    node: children,
    prevNode: null,
    incomingNode: null,
    scrollY: 0,
    viewportHeight: 0,
    documentHeight: 0,
    target: null,
    animating: false,
    started: false,
  }));

  /** The single 0 → 1 progress both layers are derived from. */
  const progress = useMotionValue(1);
  /** Id of the safety-net timer that force-resets a stuck transition. */
  const failsafeRef = useRef<number | null>(null);

  // The rising page and the shrinking page read the same progress.
  const rise = useTransform(progress, [0, 1], ["100%", "0%"]);
  const fade = useTransform(progress, [0, 1], [0, 1]);
  const shrink = useTransform(progress, [0, 1], [1, pageMotion.oldPageEndScale]);
  // The outgoing page lifts while it shrinks — same progress, same clock.
  const lift = useTransform(
    progress,
    (value) => `${value * pageMotion.oldPageEndLift}vh`,
  );

  // A click started (or retargeted) a navigation. Freeze the outgoing page
  // and aim the transition at the new destination.
  if (pending && pending.href !== state.target) {
    if (!state.animating) {
      // Only the public routes take part in the transition.
      if (pending.href !== pathname && TRANSITION_ROUTES.has(pathname)) {
        setElapsed(false);
        setState((current) => ({
          ...current,
          path: pathname,
          node: children,
          prevNode: children,
          incomingNode: null,
          scrollY: pending.scrollY,
          viewportHeight: pending.viewportHeight,
          documentHeight: pending.documentHeight,
          target: pending.href,
          animating: true,
          started: false,
        }));
      }
    } else {
      // Retarget (rapid clicks): keep whatever is on screen, just aim at the
      // new route. The rise never reverses and nothing is blanked out.
      const arrived = pathname === pending.href;
      setState((current) => ({
        ...current,
        path: arrived ? pathname : current.path,
        node: arrived ? children : current.node,
        incomingNode: arrived ? children : current.incomingNode,
        target: pending.href,
      }));
    }
  }

  // Adjust state when the route (and therefore `children`) changes. This runs
  // during render (the documented "adjust state on prop change" pattern), so
  // the committed frame already contains both pages — no flash of the naked
  // new page before the animation starts.
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    if (state.animating) {
      // Only the destination may become the rising page; a transient commit of
      // an aborted route is ignored.
      if (pathname === state.target) {
        setState((current) => ({
          ...current,
          path: pathname,
          node: children,
          incomingNode: children,
          started: true,
        }));
      }
    } else {
      // No click signal (browser back/forward or a plain link): animate now.
      const animateNow =
        TRANSITION_ROUTES.has(pathname) &&
        TRANSITION_ROUTES.has(state.path) &&
        pathname !== state.path;
      if (animateNow) setElapsed(false);
      // Client-side navigation only — safe to read the live geometry so the
      // outgoing page can be frozen exactly where the user left it.
      const geometry = measureOutgoingPage();
      setState((current) => ({
        ...current,
        path: pathname,
        node: children,
        prevNode: animateNow ? current.node : null,
        incomingNode: animateNow ? children : null,
        scrollY: geometry.scrollY,
        viewportHeight: geometry.viewportHeight,
        documentHeight: geometry.documentHeight,
        target: pathname,
        animating: animateNow,
        started: animateNow,
      }));
    }
  }

  /* ---------------------------------------------------------------- */
  /* Safety net                                                       */
  /* ---------------------------------------------------------------- */

  /** Put the site back into a normal state — nothing stays covered. */
  const forceReset = useCallback(() => {
    setElapsed(true);
    unlockScroll();
    clearPendingNavigation();
    setState((current) => ({
      ...current,
      animating: false,
      prevNode: null,
      incomingNode: null,
      target: null,
      scrollY: 0,
      viewportHeight: 0,
      documentHeight: 0,
      started: false,
    }));
  }, []);

  const armFailsafe = useCallback(() => {
    if (failsafeRef.current !== null) {
      window.clearTimeout(failsafeRef.current);
    }
    failsafeRef.current = window.setTimeout(() => {
      failsafeRef.current = null;
      forceReset();
    }, pageMotion.failsafe * 1000);
  }, [forceReset]);

  const disarmFailsafe = useCallback(() => {
    if (failsafeRef.current !== null) {
      window.clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
  }, []);

  // Reset the shared progress before the first painted frame of a transition,
  // so the old page always starts at scale 1 and the new page always starts
  // fully below the screen (no flash at the top). When the transition is
  // over the progress returns to 1 — the page sits exactly where it belongs.
  useIsoLayoutEffect(() => {
    progress.set(state.animating ? 0 : 1);
  }, [state.animating, progress]);

  // Lock scrolling and snap the document to the top for the new page (beating
  // any router scroll restoration a frame later).
  useIsoLayoutEffect(() => {
    if (!state.animating) return;

    lockScroll();
    resetScroll();
    const frame = window.requestAnimationFrame(() => resetScroll());

    return () => {
      window.cancelAnimationFrame(frame);
      unlockScroll();
    };
  }, [state.animating]);

  // The safety net covers the whole transition: it fires when the route never
  // commits, and it is re-armed when the animation actually starts.
  useEffect(() => {
    if (!state.animating) {
      disarmFailsafe();
      return;
    }
    armFailsafe();
    return disarmFailsafe;
  }, [state.animating, armFailsafe, disarmFailsafe]);

  // The one and only animation: a single progress value, animated with the
  // shared duration and easing. Both layers are derived from it, so the old
  // page shrinks (and lifts) exactly as fast as the new page rises.
  useEffect(() => {
    if (!state.animating || !state.started) return;

    const durationMs =
      (reduce ? pageMotion.fade : pageMotion.pageTransition) * 1000;

    const controls = animate(progress, 1, {
      duration: durationMs / 1000,
      ease: reduce ? pageMotion.easeOut : pageMotion.easeInOut,
    });

    // The animation is the transition's clock — restart the safety net here.
    armFailsafe();

    const settle = window.setTimeout(() => setElapsed(true), durationMs + 80);

    return () => {
      controls.stop();
      window.clearTimeout(settle);
    };
  }, [state.animating, state.started, reduce, progress, armFailsafe]);

  // Finish once the rise has played and the destination route has committed.
  useEffect(() => {
    if (!state.animating || !elapsed) return;
    if (state.target === null || pathname !== state.target) return;

    const frame = window.requestAnimationFrame(() => {
      // Late beat: the router's back/forward scroll restoration may have run
      // after the first reset — land on the top of the NEW page regardless.
      resetScroll();
      unlockScroll();
      clearPendingNavigation();
      setState((current) => ({
        ...current,
        animating: false,
        prevNode: null,
        incomingNode: null,
        target: null,
        scrollY: 0,
        viewportHeight: 0,
        documentHeight: 0,
        started: false,
      }));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [state.animating, state.target, elapsed, pathname]);

  // The live page: ready as soon as the transition is over.
  const liveSignal = useMemo<PageSignal>(
    () => ({ ready: !state.animating, frozen: false }),
    [state.animating],
  );

  const transitioning = state.animating && state.prevNode !== null;

  /**
   * Geometry of the frozen layer.
   *
   * The frozen (outgoing) page is laid out in DOCUMENT coordinates: its layer
   * starts at the document top, which sits `-scrollY` above the viewport. The
   * middle of what the user can see therefore lives at
   * `scrollY + viewportHeight / 2` in that layer's own space — that is the
   * point the page has to shrink around.
   */
  const viewportHeight = state.viewportHeight;
  const documentHeight = Math.max(
    state.documentHeight,
    state.scrollY + viewportHeight,
  );
  const originY = state.scrollY + viewportHeight / 2;
  const cardHeight = viewportHeight > 0 ? `${viewportHeight}px` : "100vh";

  return (
    <PageSignalContext.Provider value={liveSignal}>
      {/* Outgoing page: frozen at its scroll offset, shrinking in place and
          lifting away. It keeps its own colours — nothing dims it and no
          overlay covers it. It is a copy, so it renders in its final state
          (the frozen signal) instead of replaying its entrance. */}
      {transitioning ? (
        <PageSignalContext.Provider value={FROZEN_SIGNAL}>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          >
            {/* Dark backdrop (design token) — revealed around the shrinking page. */}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: pageMotion.transitionBackground }}
            />

            {/* LIFT — the translate that carries the old page UP. It lives on
                an OUTER wrapper and works in screen space, so the scale on
                the inner layer can never shrink it: the page really moves
                up, it does not only appear to shrink towards the centre. */}
            <motion.div
              className="absolute inset-0"
              style={{
                y: reduce ? 0 : lift,
                willChange: state.started && !reduce ? "transform" : undefined,
              }}
            >
              {/* SCALE — the frozen page. Its coordinate space is the DOCUMENT
                  (the layer starts at the document top), so the centre of the
                  visible viewport sits at `scrollY + viewportHeight / 2` px in
                  its own space. Scaling about that point makes the page shrink
                  around exactly what the user is looking at — from the top of
                  the page and from the footer it behaves identically. */}
              <motion.div
                className="absolute inset-x-0"
                style={{
                  top: -state.scrollY,
                  height: documentHeight,
                  scale: reduce ? 1 : shrink,
                  transformOrigin: `50% ${originY}px`,
                  willChange: state.started && !reduce ? "transform" : undefined,
                }}
              >
                {/* CARD — the visible slice of the frozen page (the viewport
                    band of the document). It is clipped, so the old page
                    reads as a card that shrinks into the middle of the screen
                    and leaves the dark backdrop visible around it. */}
                <div
                  className="absolute inset-x-0 overflow-hidden bg-background"
                  style={{ top: state.scrollY, height: cardHeight }}
                >
                  <div
                    className="absolute inset-x-0"
                    style={{ top: -state.scrollY }}
                  >
                    {state.prevNode}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </PageSignalContext.Provider>
      ) : null}

      {/* The page itself — mounted ONCE and never re-keyed: during a
          transition it is the rising panel (fixed, one viewport high),
          afterwards the very same element is simply the page in the flow. */}
      <motion.div
        key="page"
        className={
          transitioning
            ? "pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
            : "contents"
        }
        style={{
          y: reduce ? "0%" : rise,
          opacity: reduce ? fade : 1,
          willChange:
            transitioning && state.started
              ? reduce
                ? "opacity"
                : "transform"
              : undefined,
        }}
      >
        {transitioning ? state.incomingNode : state.node}
      </motion.div>
    </PageSignalContext.Provider>
  );
}

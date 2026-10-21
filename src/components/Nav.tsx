"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { content, type NavItem } from "@/lib/content";
import { EASE, duration, load } from "@/lib/motion";
import { scrollToSection } from "./SmoothScroll";
import { useWorksPopup } from "./works/WorksPopupProvider";
import { beginPageTransition, usePendingTransition } from "./PageTransition";

export default function Nav() {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const router = useRouter();
  const { popupOpen } = useWorksPopup();
  // The route a rise-over transition is currently heading to, if any.
  const pending = usePendingTransition();

  const home = content.nav[0].target;

  // Route-derived highlight: purely a function of the pathname, so the server
  // and the first client render always agree (/ -> Home, /works -> Works,
  // /about -> About). Nothing here touches browser globals.
  const routeActive = content.nav.find((item) => item.href === pathname)?.target;

  // Homepage scroll highlight. It stays `null` (Home) until after mount, so it
  // can never change the first render or cause a hydration mismatch.
  const [scrollActive, setScrollActive] = useState<string | null>(null);

  const active =
    pathname === "/" ? scrollActive ?? home : routeActive ?? home;

  // Have every destination ready before the click (the <Link> prefetches too,
  // this makes sure all three are warm even if the pill is never hovered).
  useEffect(() => {
    for (const item of content.nav) router.prefetch(item.href);
  }, [router]);

  useEffect(() => {
    // Section-based highlighting only applies to the homepage.
    if (pathname !== "/") return;

    const works = content.nav.find((item) => item.target === "works")?.target;

    const update = () => {
      const vh = window.innerHeight;

      // Works stays active while it spans the middle of the viewport.
      const worksEl = works ? document.getElementById(works) : null;
      if (worksEl && works) {
        const rect = worksEl.getBoundingClientRect();
        if (rect.top <= vh * 0.5 && rect.bottom > vh * 0.5) {
          setScrollActive(works);
          return;
        }
      }

      setScrollActive(home);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname, home]);

  const handleSelect = (event: MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    // Leave modified / non-primary clicks to the browser (new tab, etc.).
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    // A navigation to this exact target is already in flight: ignore repeats.
    // A different target is always allowed through (it retargets the rise).
    if (pending?.href === item.href) {
      event.preventDefault();
      return;
    }

    // Only the destination we are already on may be handled in-page. This is
    // decided by the route, never by querying the document: during a
    // transition the outgoing page is still mounted, so an id lookup could
    // resolve inside the old page and turn a navigation into a dead scroll.
    if (item.href === pathname && !pending) {
      event.preventDefault();
      // On the homepage "Home" returns to the very top; on every other route
      // clicking the current item is a no-op.
      if (pathname === "/") scrollToSection(item.target);
      return;
    }

    // Route navigation: start the rise-over transition on the click itself,
    // then let the prefetched <Link> perform the actual navigation.
    beginPageTransition(item.href);
  };

  return (
    <motion.nav
      aria-label="Section navigation"
      className="fixed inset-x-0 bottom-[8vh] z-50 flex justify-center px-4 lg:bottom-9"
      initial={{ opacity: 0, y: load.nav.from }}
      animate={
        popupOpen
          ? { opacity: 0, y: load.nav.from + 24, pointerEvents: "none" }
          : { opacity: 1, y: 0, pointerEvents: "auto" }
      }
      transition={{
        duration: reduce ? 0.15 : 0.4,
        ease: load.ease,
      }}
      style={{ pointerEvents: popupOpen ? "none" : "auto" }}
    >
      <div className="flex h-[52px] w-[268px] items-center gap-1 rounded-full bg-white p-1 shadow-[0_10px_30px_-10px_rgba(51,51,51,0.2)]">
        {content.nav.map((item) => {
          const isActive = active === item.target;
          return (
            <Link
              key={item.target}
              href={item.href}
              prefetch
              onClick={(event) => handleSelect(event, item)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex-1 rounded-full px-3 py-2 text-center text-[15px] font-medium uppercase tracking-tight transition-colors duration-300 lg:px-4 lg:text-sm ${
                isActive ? "text-accent-contrast" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active-pill"
                  className="absolute inset-0 rounded-full bg-accent"
                  transition={{ duration: duration.base, ease: EASE }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}

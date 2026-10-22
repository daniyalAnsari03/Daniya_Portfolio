"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { content } from "@/lib/content";
import { useFrozenPage } from "./PageTransition";
import { CheckIcon, CopyIcon, GitHubIcon, LinkedInIcon } from "./icons";

/**
 * The final Contact screen. It is a full-viewport layer fixed behind the rest
 * of the page (z-0) and is uncovered as the Works section scrolls up and away.
 * The trailing 100vh spacer (id="contact") is what makes the reveal possible:
 * it is transparent, so the black screen shows through it, and it is exactly
 * one viewport tall, so scrolling to its top lands on the very end of the page.
 */
/**
 * Renders `text` with the accent word highlighted. The word is only
 * highlighted when it actually appears in the line — otherwise the line is
 * rendered as it is.
 */
function withAccentWord(text: string, accentWord: string, className?: string) {
  const index = accentWord ? text.indexOf(accentWord) : -1;
  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <span className={className}>{accentWord}</span>
      {text.slice(index + accentWord.length)}
    </>
  );
}

export default function Contact({
  line1 = content.contact.heading.line1,
  line2 = content.contact.heading.line2,
  accentWord = "together",
}: {
  /** Heading line 1 — in front of the avatar's top. */
  line1?: string;
  /** Heading line 2 — drawn over the avatar. */
  line2?: string;
  /** The word shown in the accent colour. */
  accentWord?: string;
}) {
  const reduce = useReducedMotion();
  const spacerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);
  // The frozen copy of an outgoing page must never touch the shared
  // `data-footer` flag — the incoming page owns it.
  const frozen = useFrozenPage();

  // Reveal progress: 0 when the spacer enters from the bottom, 1 when the page
  // reaches its end (spacer fills the viewport).
  const { scrollYProgress } = useScroll({
    target: spacerRef,
    offset: ["start end", "end end"],
  });

  const avatarScale = useTransform(scrollYProgress, [0.5, 0.85], [0.85, 1]);
  const headingOpacity = useTransform(scrollYProgress, [0.6, 0.92], [0, 1]);
  const headingY = useTransform(scrollYProgress, [0.6, 0.92], [24, 0]);

  const copyEmail = useCallback(async () => {
    const email = content.contact.email;
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Fallback for browsers without the async clipboard API.
      const area = document.createElement("textarea");
      area.value = email;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-9999px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
      } catch {
        /* clipboard unavailable */
      }
      document.body.removeChild(area);
    }

    setCopied(true);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * Safety net for the reveal (real phones only): while the dark screen is
   * uncovered, the document background is switched to the dark token, so a
   * light strip can never show below it — not even for the frame in which
   * the browser toolbar reappears at the very end of the page.
   *
   * The flag lives on <html> and is switched instantly (no transition).
   */
  useEffect(() => {
    if (frozen) return;
    const spacer = spacerRef.current;
    if (!spacer || typeof IntersectionObserver === "undefined") return;

    const root = document.documentElement;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          root.setAttribute("data-footer", "true");
        } else {
          root.removeAttribute("data-footer");
        }
      },
      { threshold: 0 },
    );

    observer.observe(spacer);

    return () => {
      observer.disconnect();
      root.removeAttribute("data-footer");
    };
  }, [frozen]);

  return (
    <>
      <section
        aria-label="Contact"
        className="fixed inset-0 z-0 min-h-viewport-lg overflow-x-clip overflow-y-hidden bg-charcoal text-white"
      >
        {/* Heading (white + accent) with the avatar straddling both lines.
            Layer order back-to-front is line 1 (z-0), avatar (z-10), line 2
            (z-20): the avatar sits in front of "Let's work" but behind
            "together", whose letters are drawn over the circle. Each line is
            animated on its own so the heading block never creates its own
            stacking context (which would trap line 2 behind the avatar). */}
        <div className="absolute inset-x-0 top-[calc(var(--vh-sm)*0.24)] px-6 lg:top-[calc(var(--vh-sm)*0.18)]">
          <h2 className="relative text-center text-[13.5vw] leading-[0.92] font-medium tracking-[-0.045em] lg:text-[8.2vw]">
            <motion.span
              style={reduce ? undefined : { opacity: headingOpacity, y: headingY }}
              className="relative z-0 block lg:mb-0"
            >
              {withAccentWord(line1, accentWord, "text-accent-on-dark")}
            </motion.span>
            <motion.span
              style={reduce ? undefined : { opacity: headingOpacity, y: headingY }}
              className="relative z-20 block text-accent-on-dark"
            >
              {withAccentWord(line2, accentWord)}
            </motion.span>
          </h2>

          {/* top-1/2 of the two-line block is exactly the line boundary, so the
              avatar always straddles the two lines at any breakpoint. */}
          <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              style={reduce ? undefined : { scale: avatarScale }}
              className="h-[14vw] w-[14vw] max-w-[70px] overflow-hidden rounded-full bg-background lg:h-[7vw] lg:w-[7vw] lg:max-w-none"
            >
              <Image
                src={content.photo.src}
                alt={content.photo.alt}
                width={content.photo.width}
                height={content.photo.height}
                sizes="(max-width: 1023px) 24vw, 7vw"
                className="h-full w-full object-cover object-center object-top grayscale scale-110"
              />
            </motion.div>
          </div>
        </div>

        {/* Email + copy button. */}
        <div className="absolute inset-x-0 top-[calc(var(--vh-sm)*0.5)] flex flex-col items-center gap-[calc(var(--vh-sm)*0.014)] px-6 text-center lg:top-[calc(var(--vh-sm)*0.65)]">
          <p className="text-[15px] tracking-tight text-white/70 lg:text-[17px]">
            {content.contact.emailLabel}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={`mailto:${content.contact.email}`}
              className="text-[4.2vw] leading-none font-medium tracking-[-0.03em] text-white transition-opacity duration-300 hover:opacity-70 lg:text-[1.7vw]"
            >
              {content.contact.email}
            </a>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={copyEmail}
                aria-label={copied ? "Email copied" : "Copy email address"}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-accent-on-dark text-charcoal transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                {copied ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
              </button>
              <span
                aria-hidden
                className={`pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 text-xs whitespace-nowrap text-white/70 transition-opacity duration-300 ${
                  copied ? "opacity-100" : "opacity-0"
                }`}
              >
                Copied
              </span>
            </div>
          </div>
        </div>

        {/* Bottom corners: copyright + social links (same as the hero). */}
        <div className="absolute inset-x-0 bottom-5 flex items-center justify-between px-6 sm:bottom-7 sm:px-7">
          <span className="text-sm tracking-tight text-white sm:text-base">
            {content.contact.copyright}
          </span>

          <div className="flex items-center gap-3 sm:gap-4">
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
          </div>
        </div>
      </section>

      {/* Flow spacer that drives the reveal and acts as the scroll anchor.
          `data-chrome-dark` marks the black screen it uncovers, so the fixed
          header can invert to white while it sits under the header line.
          It uses the SAME viewport unit as the fixed screen above (large
          viewport), so the two always agree and no light strip can show
          below the dark screen when the browser toolbar reappears. */}
      <div
        ref={spacerRef}
        id={content.contact.target}
        aria-hidden="true"
        data-chrome-dark="true"
        className="h-viewport-lg w-full"
      />
    </>
  );
}

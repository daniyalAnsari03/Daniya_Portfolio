"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { content } from "@/lib/content";
import { EASE, duration, pageMotion } from "@/lib/motion";
import type { PublicSettings, SocialSetting } from "@/lib/settings";
import { lockScroll, unlockScroll } from "@/components/SmoothScroll";
import {
  CheckIcon,
  CopyIcon,
  GitHubIcon,
  LinkedInIcon,
  LinkIcon,
  XIcon,
} from "@/components/icons";
import ContactForm from "./ContactForm";

const panelTransition = { duration: pageMotion.popup, ease: pageMotion.easeInOut };

const container: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: pageMotion.stagger, delayChildren: 0.3 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: pageMotion.item, ease: pageMotion.easeInOut },
  },
};

function socialIcon(social: SocialSetting) {
  const name = social.name.toLowerCase();
  if (name.includes("github")) return <GitHubIcon className="h-5 w-5" />;
  if (name.includes("linked")) return <LinkedInIcon className="h-5 w-5" />;
  return <LinkIcon className="h-5 w-5" />;
}

export default function ContactPopup({
  open,
  onClose,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  settings: PublicSettings;
}) {
  const reduce = useReducedMotion();
  const copy = content.contact.popup;
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleClose = useCallback(() => {
    setCopied(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    lockScroll();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      unlockScroll();
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, handleClose]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const copyEmail = useCallback(async () => {
    const email = settings.contactEmail;
    try {
      await navigator.clipboard.writeText(email);
    } catch {
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
  }, [settings.contactEmail]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12px] pb-[24px] sm:pt-[48px] sm:pb-[48px] lg:pt-[45px] lg:pb-[10px]"
          role="dialog"
          aria-modal="true"
          aria-label={copy.heading}
        >
          <motion.button
            type="button"
            aria-label={copy.closeLabel}
            onClick={handleClose}
            className="absolute inset-0 cursor-default bg-charcoal/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : duration.base, ease: EASE }}
          />

          <motion.div
            data-lenis-prevent
            className="relative z-10 w-full max-w-[calc(100vw-24px)] max-h-[calc(100vh-60px)] rounded-[20px] bg-charcoal p-[20px] sm:max-w-[720px] sm:p-[48px] lg:max-w-[880px] lg:p-[75px] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]"
            initial={reduce ? false : { opacity: 0, y: "10%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: "10%" }}
            transition={reduce ? { duration: 0.15 } : panelTransition}
            style={{ overflowY: "auto" }}
          >
            <button
              type="button"
              onClick={handleClose}
              aria-label={copy.closeLabel}
              className="absolute top-[16px] right-[16px] flex h-[44px] w-[44px] items-center justify-center rounded-[8px] bg-white/[0.08] text-accent-on-dark transition-colors hover:bg-white/[0.12] sm:top-[20px] sm:right-[20px] sm:h-[48px] sm:w-[48px] md:top-[14px] md:right-[14px] md:h-[44px] md:w-[44px]"
            >
              <XIcon className="h-5 w-5 sm:h-6 sm:w-6 md:h-[20px] md:w-[20px]" />
            </button>

            <motion.div
              className="flex flex-col"
              initial={reduce ? undefined : "hidden"}
              animate={reduce ? undefined : "visible"}
              variants={reduce ? undefined : container}
            >
<motion.h2
                initial={reduce ? undefined : "hidden"}
                animate={reduce ? undefined : "visible"}
                variants={reduce ? undefined : item}
                className="mt-[32px] max-w-[28ch] text-[40px] leading-[1.1] font-medium tracking-[-0.03em] sm:text-[44px] md:text-[36px] lg:text-[56px]"
              >
                <span>Let&apos;s work </span>
                <span className="text-accent-on-dark">together</span>
              </motion.h2>

              <div className="mt-[48px] flex flex-col gap-[32px] sm:mt-[40px] sm:gap-[32px] md:mt-[32px] md:gap-[28px] lg:flex-row lg:gap-[40px] lg:items-start lg:mt-[64px]">
                {/* Left: message form. */}
                <motion.div
                  initial={reduce ? undefined : "hidden"}
                  animate={reduce ? undefined : "visible"}
                  variants={reduce ? undefined : item}
                  className="w-full lg:w-[480px] lg:flex-none"
                >
                  <ContactForm />
                </motion.div>

                {/* Right: contact details + socials (from public settings). */}
                <motion.div
                  initial={reduce ? undefined : "hidden"}
                  animate={reduce ? undefined : "visible"}
                  variants={reduce ? undefined : item}
                  className="flex flex-col gap-8 w-full lg:flex-none lg:w-[calc(100%-520px)] lg:pt-[8px]"
                >
<div>
                      <h3 className="text-[12px] font-normal text-white/50 uppercase tracking-normal sm:text-[13px] md:text-[14px] lg:text-[13px]">
                        {copy.detailsTitle}
                      </h3>
                      <div className="mt-[10px] flex items-center gap-[10px] sm:mt-[12px] sm:gap-[12px] md:mt-[14px] md:gap-[12px] lg:mt-[12px] lg:gap-[10px]">
                      <a
                        href={`mailto:${settings.contactEmail}`}
                        className="text-[16px] font-medium tracking-[-0.02em] text-white transition-opacity hover:opacity-70 sm:text-[17px] md:text-[18px] lg:text-[16px]"
                      >
                        {settings.contactEmail}
                      </a>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={copyEmail}
                          aria-label={
                            copied ? copy.copiedLabel : copy.copyLabel
                          }
                          className="flex h-[36px] w-[36px] items-center justify-center rounded-[6px] bg-accent-on-dark text-charcoal transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0 sm:h-[40px] sm:w-[40px] lg:h-[36px] lg:w-[36px]"
                        >
                          {copied ? (
                            <CheckIcon className="h-[16px] w-[16px]" />
                          ) : (
                            <CopyIcon className="h-[16px] w-[16px]" />
                          )}
                        </button>
                        <span
                          aria-hidden
                          className={`pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 text-xs whitespace-nowrap text-white/70 transition-opacity duration-300 ${
                            copied ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          {copy.copiedLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {settings.socials.length > 0 && (
                    <div>
                      <h3 className="text-[12px] font-normal text-white/50 uppercase tracking-normal sm:text-[13px] md:text-[14px] lg:text-[13px]">
                        {copy.socialsTitle}
                      </h3>
                      <div className="mt-[10px] flex items-center gap-[12px] sm:mt-[12px] sm:gap-[14px] md:mt-[14px] md:gap-[16px] lg:mt-[12px] lg:gap-[12px]">
                        {settings.socials.map((social) => (
                          <a
                            key={`${social.name}-${social.url}`}
                            href={social.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={social.name}
                            className="flex h-[18px] w-[18px] items-center justify-center text-white/70 transition-colors hover:text-accent-on-dark sm:h-[20px] sm:w-[20px] lg:h-[18px] lg:w-[18px]"
                          >
                            {socialIcon(social)}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
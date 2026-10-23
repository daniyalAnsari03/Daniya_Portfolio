"use client";

import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { cvMotion } from "@/lib/motion";
import { useContactPopup } from "@/components/contact/ContactPopupProvider";
import { useWorksPopup } from "@/components/works/WorksPopupProvider";
import { useFooterReveal } from "@/lib/useFooterReveal";
import { useChat } from "@/components/chat/ChatProvider";
import { useCv } from "./CvProvider";

/**
 * The right-edge "Resume" tab.
 *
 * It is a plain light (white) rectangle, rounded on the left only and flush to
 * the right edge of the viewport, vertically centred (as part of the shared
 * edge-tab stack), and it opens the CV drawer. Its size is driven only by the
 * rotated text plus a small padding, never by a fixed height or a stretch.
 * It fades out while any popup is open (the contact sheet, the project sheet,
 * the CV drawer itself, the chat drawer) and while the contact / footer
 * reveal is active, so it never collides with that content.
 *
 * Two motion layers: the outer one owns the show / hide fade (it must react
 * immediately when a popup opens), the inner one owns the load entrance — it
 * slides in from the right once the page's own load animation has finished.
 */
export default function ResumeTab() {
  const { cv, open, openCv, triggerRef } = useCv();
  const { isOpen: contactOpen } = useContactPopup();
  const { popupOpen } = useWorksPopup();
  const { open: chatOpen } = useChat();
  const footerReveal = useFooterReveal();
  const reduce = useReducedMotion() ?? false;

  if (!cv) return null;

  const hidden = contactOpen || popupOpen || open || chatOpen || footerReveal;

  return (
    <motion.div
      className="pointer-events-none"
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: cvMotion.fade, ease: cvMotion.easeInOut }}
    >
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={openCv}
        aria-label={content.resume.openLabel}
        aria-expanded={open}
        tabIndex={hidden ? -1 : 0}
        style={{ pointerEvents: hidden ? "none" : "auto" }}
        initial={reduce ? false : { opacity: 0, x: cvMotion.tab.from }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          duration: cvMotion.tab.duration,
          ease: cvMotion.tab.ease,
          delay: cvMotion.tab.delay,
        }}
        className="edge-tab pointer-events-auto inline-flex bg-white px-[7px] py-[10px] text-foreground ring-1 ring-charcoal/10 ring-inset transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal focus-visible:ring-inset md:px-[10px] md:py-[14px]"
      >
        <span className="block whitespace-nowrap leading-none [writing-mode:vertical-rl] rotate-180 text-[9px] font-medium tracking-[0.3em] uppercase md:text-[11px]">
          {content.resume.tabLabel}
        </span>
      </motion.button>
    </motion.div>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import { useContactPopup } from "@/components/contact/ContactPopupProvider";
import { useWorksPopup } from "@/components/works/WorksPopupProvider";
import { useFooterReveal } from "@/lib/useFooterReveal";
import { useCv } from "@/components/cv/CvProvider";
import { useChat } from "./ChatProvider";

/**
 * The right-edge "Ask AI" tab.
 *
 * It sits in the shared edge-tab stack, directly under the Resume tab, and
 * opens the chat drawer. It is a plain dark (charcoal) rectangle, rounded on
 * the left only, with light text, so it contrasts with the light Resume tab
 * above it. Its size is driven only by the rotated text plus a small padding,
 * never by a fixed height or a stretch.
 *
 * Unlike the Resume tab it always renders — it does not depend on there being
 * a published CV. When the CV is unpublished it is the only tab in the stack
 * and therefore sits alone in the vertical centre.
 *
 * It fades out while ANY overlay is open (the contact sheet, the project
 * sheet, the CV drawer, the chat drawer itself) and while the contact /
 * footer reveal is active.
 */
export default function AskAiTab() {
  const { open, openChat, triggerRef } = useChat();
  const { open: cvOpen } = useCv();
  const { isOpen: contactOpen } = useContactPopup();
  const { popupOpen } = useWorksPopup();
  const footerReveal = useFooterReveal();
  const reduce = useReducedMotion() ?? false;

  const hidden =
    contactOpen || popupOpen || cvOpen || open || footerReveal;

  return (
    <motion.div
      className="pointer-events-none"
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: askAiMotion.fade, ease: askAiMotion.easeInOut }}
    >
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={openChat}
        aria-label={content.askAi.openLabel}
        aria-expanded={open}
        tabIndex={hidden ? -1 : 0}
        style={{ pointerEvents: hidden ? "none" : "auto" }}
        initial={reduce ? false : { opacity: 0, x: askAiMotion.tab.from }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          duration: askAiMotion.tab.duration,
          ease: askAiMotion.tab.ease,
          delay: askAiMotion.tab.delay,
        }}
        className="edge-tab pointer-events-auto inline-flex bg-charcoal px-[7px] py-[10px] text-accent-on-dark transition-colors hover:text-accent-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-on-dark focus-visible:ring-inset md:px-[10px] md:py-[14px]"
      >
        <span className="block whitespace-nowrap leading-none [writing-mode:vertical-rl] rotate-180 text-[11px] font-medium tracking-[0.3em] uppercase md:text-[13px]">
          {content.askAi.tabLabel}
        </span>
      </motion.button>
    </motion.div>
  );
}

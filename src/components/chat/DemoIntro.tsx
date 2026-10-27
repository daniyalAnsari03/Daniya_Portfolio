"use client";

import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";

/**
 * The demo chat's own opening screen: one short helper line, no starter rows.
 */
export default function DemoIntro() {
  const reduce = useReducedMotion() ?? false;

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <motion.p
        initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.demoItems.distance }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduce ? askAiMotion.fade : askAiMotion.demoItems.duration,
          ease: reduce ? askAiMotion.easeOut : askAiMotion.demoItems.ease,
          delay: reduce ? 0 : askAiMotion.demoItems.delay,
        }}
        className="max-w-[32ch] text-center text-[14px] leading-relaxed text-chat-muted"
      >
        {content.askAi.demo.chatIntro}
      </motion.p>
    </div>
  );
}

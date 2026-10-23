"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown } from "@/components/icons";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import type { ChatStatus } from "@/lib/chat/status-events";

type ThinkingStepsProps = {
  /** Every status received for this answer, in order. */
  statuses: ChatStatus[];
  /**
   * `true` once the first answer word has been released: the list fast-forwards
   * its remaining steps and collapses into the one-line summary.
   */
  started: boolean;
  /** An error / abort removes the steps entirely. */
  failed?: boolean;
  className?: string;
};

type SpecialistAgent = "Work" | "Profile" | "Contact";
type StepMeta = {
  chip?: string;
  text: string;
  arrow?: boolean;
};

function agentChip(agent: SpecialistAgent): string {
  return content.askAi.steps.agentChip.replace("{agent}", agent);
}

function stepMeta(status: ChatStatus): StepMeta {
  switch (status.phase) {
    case "routing":
      return {
        chip: content.askAi.steps.routingChip,
        text: content.askAi.steps.routing,
      };
    case "handoff":
      return {
        text: content.askAi.steps.handoff.replace("{agent}", status.to),
        arrow: true,
      };
    case "lookup":
      return {
        chip: agentChip(status.agent),
        text: content.askAi.steps.lookup[status.topic],
      };
    case "writing":
      return {
        chip: agentChip(status.agent),
        text: content.askAi.steps.writing,
      };
  }
}

/** The chain of agents seen + how many handoffs actually happened. */
function buildSummary(statuses: ChatStatus[]): string {
  const chain: string[] = [content.askAi.steps.routingChip];
  let handoffs = 0;

  for (const status of statuses) {
    if (status.phase !== "handoff") continue;
    handoffs += 1;
    chain.push(agentChip(status.to));
  }

  if (handoffs === 0) return content.askAi.steps.summaryDirect;

  const template =
    handoffs === 1
      ? content.askAi.steps.summaryChain
      : content.askAi.steps.summaryChainPlural;

  return template
    .replace("{chain}", chain.join(" → "))
    .replace("{count}", String(handoffs));
}

function Dot({ active }: { active: boolean }) {
  const reduce = useReducedMotion() ?? false;

  if (!active) {
    return (
      <span
        aria-hidden="true"
        className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-chat-muted opacity-60"
      />
    );
  }

  return (
    <motion.span
      aria-hidden="true"
      className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-chat-accent"
      animate={reduce ? { opacity: 1 } : { opacity: [0.35, 1, 0.35] }}
      transition={
        reduce
          ? { duration: 0 }
          : {
              duration: askAiMotion.pulse.duration,
              repeat: Infinity,
              ease: askAiMotion.easeInOut,
            }
      }
    />
  );
}

function StepRow({
  status,
  active,
  reduce,
}: {
  status: ChatStatus;
  active: boolean;
  reduce: boolean;
}) {
  const meta = stepMeta(status);

  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.steps.translate }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: askAiMotion.steps.enter,
        ease: askAiMotion.easeOut,
      }}
      className="flex min-w-0 items-start gap-2"
    >
      {meta.arrow ? (
        <span
          aria-hidden="true"
          className="mt-[2px] text-[12px] leading-none text-chat-muted"
        >
          →
        </span>
      ) : (
        <Dot active={active} />
      )}

      <span className="flex min-w-0 flex-col gap-0.5">
        {meta.chip ? (
          <span
            className={`text-[9px] font-medium tracking-[0.18em] uppercase ${
              active ? "text-chat-accent" : "text-chat-muted"
            }`}
          >
            {meta.chip}
          </span>
        ) : null}

        <span
          aria-live={active ? "polite" : undefined}
          className={`text-[11px] leading-snug [overflow-wrap:anywhere] ${
            active ? "text-chat-text" : "text-chat-muted"
          }`}
        >
          {meta.text}
        </span>
      </span>
    </motion.div>
  );
}

/**
 * The live agent steps under the thinking starburst.
 *
 * Steps are shown one at a time (each for at least `minDwell`), the newest is
 * highlighted, older ones are muted. When the first answer word is released
 * the list is replaced by a quiet one-line summary that can be tapped open.
 * Only opacity / transform animate.
 */
export default function ThinkingSteps({
  statuses,
  started,
  failed = false,
  className,
}: ThinkingStepsProps) {
  const reduce = useReducedMotion() ?? false;
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const lastShownRef = useRef(0);

  // Reveal one step at a time, each after the previous one's minDwell passed.
  // The timer is the only thing that sets state (never the effect body), and
  // `started` / `failed` cancel it: the answer never waits for the steps.
  useEffect(() => {
    if (failed || started) return;
    if (visibleCount >= statuses.length) return;

    const elapsed =
      lastShownRef.current > 0
        ? performance.now() - lastShownRef.current
        : askAiMotion.steps.minDwell;
    const wait = Math.max(0, askAiMotion.steps.minDwell - elapsed);

    const id = window.setTimeout(() => {
      lastShownRef.current = performance.now();
      setVisibleCount((count) => Math.min(count + 1, statuses.length));
    }, wait);

    return () => window.clearTimeout(id);
  }, [failed, started, statuses.length, visibleCount]);

  if (failed) return null;
  if (statuses.length === 0) return null;

  if (started) {
    const summary = buildSummary(statuses);

    return (
      <div className={className}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          title={expanded ? content.askAi.steps.hideLabel : content.askAi.steps.showLabel}
          onClick={() => setExpanded((value) => !value)}
          className="group flex max-w-full items-center gap-1.5 rounded-full py-0.5 pr-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent focus-visible:ring-offset-2 focus-visible:ring-offset-chat-surface"
        >
          <span className="truncate text-[11px] leading-snug text-chat-muted transition-colors group-hover:text-chat-text">
            {summary}
          </span>
          <ArrowDown
            className={`h-3 w-3 shrink-0 text-chat-muted transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              id={listId}
              initial={{ opacity: 0, y: reduce ? 0 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -4 }}
              transition={{
                duration: askAiMotion.steps.collapse,
                ease: askAiMotion.easeOut,
              }}
              className="mt-2 flex flex-col gap-2 border-l border-chat-border pl-2.5"
            >
              {statuses.map((status, index) => (
                <StepRow
                  key={`${index}-${status.phase}`}
                  status={status}
                  active={false}
                  reduce={reduce}
                />
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  const visible = statuses.slice(0, visibleCount);

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {visible.map((status, index) => (
        <StepRow
          key={`${index}-${status.phase}`}
          status={status}
          active={index === visible.length - 1}
          reduce={reduce}
        />
      ))}
    </div>
  );
}

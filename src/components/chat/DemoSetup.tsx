"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import {
  extractPdf,
  preflightPdf,
  type PdfExtractErrorCode,
} from "@/lib/chat/demo-client";
import { formatRateLimitLine } from "@/lib/chat/rate-limit-text";

const MAX_NAME = 60;
const MAX_INSTRUCTIONS = 1000;
const MAX_CONTEXT = 8000;

/** Shared with the drawer, which must never paste a larger context. */
export const MAX_DEMO_NAME = MAX_NAME;
export const MAX_DEMO_INSTRUCTIONS = MAX_INSTRUCTIONS;
export const MAX_DEMO_CONTEXT = MAX_CONTEXT;

/** Which context option the setup screen shows (docs/fix.txt). */
type ContextOption = "paste" | "pdf";

/**
 * Which way the screen leaves on mode change: "forward" pushes it out to the
 * left (deeper into the demo), "back" returns it to the right (docs/fix.txt).
 */
export type DemoExitDirection = "forward" | "back";

type DemoSetupProps = {
  name: string;
  instructions: string;
  context: string;
  /** The direction of the change that last mounted the screen. */
  exitDirection: DemoExitDirection;
  onNameChange: (value: string) => void;
  onInstructionsChange: (value: string) => void;
  onContextChange: (value: string) => void;
  /** Starts the demo — only callable while every field is valid. */
  onStart: () => void;
  /** Back to the normal Ask AI — clears the demo state completely. */
  onBack: () => void;
};

const LABEL_CLASS =
  "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-chat-muted";
const FIELD_CLASS =
  "w-full rounded-[12px] bg-chat-input px-3 py-2.5 text-[16px] leading-snug text-chat-text ring-1 ring-chat-border outline-none placeholder:text-chat-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent sm:text-[15px]";

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const PDF_ERROR_CODES: readonly PdfExtractErrorCode[] = [
  "too_large",
  "invalid_file",
  "unreadable",
  "no_text",
  "rate_limited",
  "network",
  "server",
];

/**
 * The live counter under one of the textareas: "1234 / 8000". At the limit it
 * reads in the chat accent (token only) so the edge is visible at a glance.
 */
function CharCounter({
  count,
  max,
  atLimit,
}: {
  count: number;
  max: number;
  atLimit: boolean;
}) {
  const demo = content.askAi.demo.setup;
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 text-[11px] tabular-nums ${
        atLimit ? "text-chat-accent" : "text-chat-muted"
      }`}
    >
      {demo.charCounter
        .replace("{count}", String(count))
        .replace("{max}", String(max))}
    </span>
  );
}

/**
 * The polite limit/cut line under a textarea (`aria-live`). The row always
 * exists with a reserved height, so the notice fading in — and out — never
 * pushes the layout.
 */
function LimitNotice({ line }: { line: string | null }) {
  return (
    <motion.p
      aria-live="polite"
      initial={false}
      animate={{ opacity: line ? 1 : 0 }}
      transition={{ duration: askAiMotion.fade, ease: askAiMotion.easeOut }}
      className="min-w-0 flex-1 text-[11px] leading-tight text-chat-muted [overflow-wrap:anywhere]"
    >
      {line ?? ""}
    </motion.p>
  );
}

/** Cut to the limit; the incoming length itself drives the notice state. */
function clampToLimit(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * The demo mode's setup screen.
 *
 * Name (1–60), instructions (1–1000, prefilled with the default that may
 * still contain the `[Name]` placeholder) and the context (1–8000), which
 * comes from either the paste textarea or a PDF: choosing a file extracts
 * its text server-side (POST /api/chat/demo/extract) and fills the SAME
 * context state; the visitor can edit it before starting. Limits are
 * enforced in onChange (never with maxLength: the browser must never drop
 * text before React sees it) and counted live under each textarea with a
 * reserved-height notice. The screen slides in over the drawer's middle
 * area with the site's in-out curve, its fields staggering in behind it
 * (opacity + translate only). Every colour comes from the shared `--chat-*`
 * tokens so all three themes read right.
 */
export default function DemoSetup({
  name,
  instructions,
  context,
  exitDirection,
  onNameChange,
  onInstructionsChange,
  onContextChange,
  onStart,
  onBack,
}: DemoSetupProps) {
  const reduce = useReducedMotion() ?? false;
  const demo = content.askAi.demo.setup;

  const [option, setOption] = useState<ContextOption>("paste");
  const [pdfFile, setPdfFile] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<PdfExtractErrorCode | null>(
    null,
  );
  const [
    extractRetryAfterSeconds,
    setExtractRetryAfterSeconds,
  ] = useState<number | undefined>(undefined);
  /** Truncation of the EXTRACTED text; cleared by any later edit. */
  const [pdfTruncated, setPdfTruncated] = useState(false);
  /** `true` when the last change of a textarea came in over its limit. */
  const [instructionsCut, setInstructionsCut] = useState(false);
  const [contextCut, setContextCut] = useState(false);
  const extractAbortRef = useRef<AbortController | null>(null);
  const contextInputRef = useRef<HTMLInputElement | null>(null);

  const abortExtraction = useCallback(() => {
    extractAbortRef.current?.abort();
    extractAbortRef.current = null;
    setExtracting(false);
  }, []);

  // Back / close / unmount never leave an extraction running.
  useEffect(() => () => abortExtraction(), [abortExtraction]);

  const switchOption = useCallback(
    (next: ContextOption) => {
      if (next === option) return;
      abortExtraction();
      setOption(next);
    },
    [abortExtraction, option],
  );

  /** One clamp path for typing, paste, drop, undo, IME and the PDF fill. */
  const applyContext = useCallback(
    (next: string) => {
      const cut = next.length > MAX_CONTEXT;
      setContextCut(cut);
      if (!cut) setPdfTruncated(false);
      onContextChange(clampToLimit(next, MAX_CONTEXT));
    },
    [onContextChange],
  );

  const handleInstructionsChange = useCallback(
    (next: string) => {
      const cut = next.length > MAX_INSTRUCTIONS;
      setInstructionsCut(cut);
      onInstructionsChange(clampToLimit(next, MAX_INSTRUCTIONS));
    },
    [onInstructionsChange],
  );

  const handleRemovePdf = useCallback(() => {
    abortExtraction();
    setPdfFile(null);
    setExtractError(null);
    setExtractRetryAfterSeconds(undefined);
    setPdfTruncated(false);
    setContextCut(false);
    onContextChange("");
  }, [abortExtraction, onContextChange]);

  const handleFileChange = useCallback(
    async (file: File | null) => {
      if (!file) return;
      abortExtraction();

      // Client-side pre-check: wrong file kinds never reach the server.
      const preflight = preflightPdf(file);
      if (preflight) {
        setExtractError(preflight.code);
        setExtractRetryAfterSeconds(undefined);
        setPdfFile(null);
        setPdfTruncated(false);
        return;
      }

      setPdfFile({ name: file.name, size: file.size });
      setExtracting(true);
      setExtractError(null);
      setPdfTruncated(false);

      const controller = new AbortController();
      extractAbortRef.current = controller;

      try {
        const result = await extractPdf(file, controller.signal);
        if (controller.signal.aborted) return;
        // The same clamp path as typing/paste: even if the API ever returned
        // more than the limit, the cut notice shows the same way.
        applyContext(result.text);
        setPdfTruncated(result.truncated);
        setExtractError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        const code = (error as { code?: string } | undefined)?.code;
        setExtractError(
          PDF_ERROR_CODES.includes(code as PdfExtractErrorCode)
            ? (code as PdfExtractErrorCode)
            : "server",
        );
        if (code !== "rate_limited") setExtractRetryAfterSeconds(undefined);
        setPdfFile(null);
        setPdfTruncated(false);
      } finally {
        if (extractAbortRef.current === controller) {
          extractAbortRef.current = null;
        }
        if (!controller.signal.aborted) setExtracting(false);
      }
    },
    [abortExtraction, applyContext],
  );

  /** The quiet line for the current extraction error. */
  const extractErrorLine = ((): string | null => {
    if (!extractError) return null;
    const demoErrors = content.askAi.demo.errors;
    switch (extractError) {
      case "rate_limited":
        return formatRateLimitLine(extractRetryAfterSeconds);
      case "network":
        return demoErrors.network;
      case "too_large":
        return demo.extractErrors.tooLarge;
      case "invalid_file":
        return demo.extractErrors.invalidFile;
      case "unreadable":
        return demo.extractErrors.unreadable;
      case "no_text":
        return demo.extractErrors.noText;
      case "server":
      default:
        return demoErrors.server;
    }
  })();

  const nameValid =
    name.trim().length >= 1 && name.trim().length <= MAX_NAME;
  const instructionsValid =
    instructions.trim().length >= 1 &&
    instructions.trim().length <= MAX_INSTRUCTIONS;
  const contextValid =
    context.trim().length >= 1 && context.trim().length <= MAX_CONTEXT;
  const canStart = nameValid && instructionsValid && contextValid;

  const instructionsAtLimit = instructions.length >= MAX_INSTRUCTIONS;
  const instructionsNotice =
    instructions.length >= MAX_INSTRUCTIONS
      ? instructionsCut
        ? demo.truncatedNotice.replace("{max}", String(MAX_INSTRUCTIONS))
        : demo.limitReached.replace("{max}", String(MAX_INSTRUCTIONS))
      : null;

  const contextAtLimit = context.length >= MAX_CONTEXT;
  const contextNotice =
    context.length >= MAX_CONTEXT
      ? contextCut || pdfTruncated
        ? demo.truncatedNotice.replace("{max}", String(MAX_CONTEXT))
        : demo.limitReached.replace("{max}", String(MAX_CONTEXT))
      : null;

  const OPTION_BASE_CLASS =
    "flex h-7 items-center rounded-full px-3 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent";
  const optionClass = (active: boolean) =>
    active
      ? `${OPTION_BASE_CLASS} bg-chat-control text-chat-text`
      : `${OPTION_BASE_CLASS} text-chat-muted`;

  /**
   * The screen's own slide: in from the right with the site's in-out curve,
   * out toward where the change is going ("forward" pushes it left, "back"
   * returns it right). Reduced motion: opacity only. The exit is a function
   * variant so it reads the CURRENT direction at the moment it leaves.
   */
  const screenVariants: Variants = {
    hidden: { opacity: 0, x: reduce ? 0 : askAiMotion.demo.distance },
    shown: { opacity: 1, x: 0 },
    exit: (dir: DemoExitDirection) => ({
      opacity: 0,
      x: reduce
        ? 0
        : dir === "back"
          ? askAiMotion.demo.distance
          : -askAiMotion.demo.distance,
    }),
  };
  /** One staggered item: fade + small rise, opacity + translate only. */
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : askAiMotion.demoItems.distance },
    shown: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduce ? askAiMotion.fade : askAiMotion.demoItems.duration,
        ease: reduce ? askAiMotion.easeOut : askAiMotion.demoItems.ease,
      },
    },
  };

  return (
    <motion.div
      custom={exitDirection}
      initial="hidden"
      animate="shown"
      exit="exit"
      variants={screenVariants}
      transition={{
        duration: reduce ? askAiMotion.fade : askAiMotion.demo.step,
        ease: askAiMotion.demo.ease,
        delayChildren: reduce ? 0 : askAiMotion.demoItems.delay,
        staggerChildren: reduce ? 0 : askAiMotion.demoItems.stagger,
      }}
      data-lenis-prevent
      className="absolute inset-0 z-10 flex flex-col overflow-y-auto overscroll-contain rounded-l-[18px] bg-chat-surface px-4 pb-4 pt-2 sm:px-5"
    >
      <motion.p variants={itemVariants} className="text-[13px] leading-relaxed text-chat-muted">
        {demo.helper}
      </motion.p>

      <div className="mt-5 flex flex-col gap-5">
        <motion.div variants={itemVariants}>
          <label htmlFor="demo-name" className={LABEL_CLASS}>
            {demo.nameLabel}
          </label>
          <input
            id="demo-name"
            type="text"
            value={name}
            maxLength={MAX_NAME}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={demo.namePlaceholder}
            className={FIELD_CLASS}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <label htmlFor="demo-instructions" className={LABEL_CLASS}>
            {demo.instructionsLabel}
          </label>
          <textarea
            id="demo-instructions"
            value={instructions}
            onChange={(event) => handleInstructionsChange(event.target.value)}
            rows={5}
            className={`${FIELD_CLASS} resize-none`}
          />
          {/* Counter + limit notice: the row always exists (reserved height),
              so the notice fading in never pushes the layout. */}
          <div className="mt-1 flex min-h-[16px] items-start justify-between gap-3">
            <LimitNotice line={instructionsNotice} />
            <CharCounter
              count={instructions.length}
              max={MAX_INSTRUCTIONS}
              atLimit={instructionsAtLimit}
            />
          </div>
        </motion.div>

        {/* Context: the segmented control picks the source, but both options
            edit the same context state — switching never clears it. */}
        <motion.div variants={itemVariants}>
          <div className="flex min-h-[28px] items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-chat-muted">
              {demo.contextOptionsLabel}
            </span>
            <div
              role="tablist"
              aria-label={demo.contextOptionsLabel}
              className="flex rounded-full bg-chat-input p-0.5 ring-1 ring-chat-border"
            >
              <button
                type="button"
                role="tab"
                id="demo-context-option-paste"
                aria-selected={option === "paste"}
                aria-controls="demo-context-panel"
                onClick={() => switchOption("paste")}
                className={optionClass(option === "paste")}
              >
                {demo.contextOptionPaste}
              </button>
              <button
                type="button"
                role="tab"
                id="demo-context-option-pdf"
                aria-selected={option === "pdf"}
                aria-controls="demo-context-panel"
                onClick={() => switchOption("pdf")}
                className={optionClass(option === "pdf")}
              >
                {demo.contextOptionPdf}
              </button>
            </div>
          </div>

          <div
            id="demo-context-panel"
            role="tabpanel"
            aria-labelledby={`demo-context-option-${option}`}
          >
            {option === "pdf" ? (
              <div className="mt-2">
                <p className="mb-1.5 text-[11px] text-chat-muted">
                  {demo.pdfHelper}
                </p>

                {extracting ? (
                  <motion.p
                    role="status"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: reduce ? 1 : [1, 0.55, 1] }}
                    transition={{
                      duration: askAiMotion.typing.duration,
                      repeat: reduce ? 0 : Infinity,
                    }}
                    className="mb-1.5 text-[12px] text-chat-text"
                  >
                    {demo.pdfLoading}
                  </motion.p>
                ) : null}

                {extractErrorLine ? (
                  <p
                    role="alert"
                    className="mb-1.5 text-[11px] text-chat-text [overflow-wrap:anywhere]"
                  >
                    {extractErrorLine}
                  </p>
                ) : null}

                {pdfFile ? (
                  <div className="mb-2 flex items-center gap-2">
                    <div className="min-w-0 flex-1 rounded-[12px] bg-chat-input px-3 py-2 ring-1 ring-chat-border">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate text-[13px] text-chat-text">
                          {pdfFile.name}
                        </span>
                        <span className="shrink-0 text-[11px] text-chat-muted">
                          {formatFileSize(pdfFile.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePdf}
                      className="flex h-10 shrink-0 items-center rounded-full bg-chat-control px-4 text-[13px] font-medium text-chat-control-fg transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent"
                    >
                      {demo.pdfRemove}
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={extracting}
                  onClick={() => {
                    const input = contextInputRef.current;
                    if (input) {
                      input.value = "";
                      input.click();
                    }
                  }}
                  className="flex h-11 w-full items-center justify-center rounded-[12px] bg-chat-control text-[14px] font-medium text-chat-control-fg ring-1 ring-chat-border transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent disabled:pointer-events-none disabled:opacity-40"
                >
                  {demo.pdfChoose}
                </button>
                {/* The real file input — the picker button above triggers it
                    so the picking button itself stays a comfortable target. */}
                <input
                  ref={contextInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  disabled={extracting}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void handleFileChange(file ?? null);
                  }}
                />
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-chat-muted">
                {demo.contextHelper}
              </p>
            )}

            <textarea
              id="demo-context"
              aria-label={demo.contextLabel}
              value={context}
              onChange={(event) => applyContext(event.target.value)}
              rows={8}
              className={`${FIELD_CLASS} mt-2 resize-none`}
            />

            {/* Counter + limit notice — the same row both textareas share. */}
            <div className="mt-1 flex min-h-[16px] items-start justify-between gap-3">
              <LimitNotice line={contextNotice} />
              <CharCounter
                count={context.length}
                max={MAX_CONTEXT}
                atLimit={contextAtLimit}
              />
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        variants={itemVariants}
        className="mt-6 flex items-center gap-2 pb-[calc(env(safe-area-inset-bottom)+4px)]"
      >
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 items-center rounded-full bg-chat-control px-5 text-[14px] font-medium text-chat-control-fg transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent"
        >
          {demo.backLabel}
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="ml-auto flex h-10 items-center rounded-full bg-chat-primary px-5 text-[14px] font-medium text-chat-primary-fg transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent disabled:pointer-events-none disabled:opacity-30"
        >
          {demo.startLabel}
        </button>
      </motion.div>
    </motion.div>
  );
}

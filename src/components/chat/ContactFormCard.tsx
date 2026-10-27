"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import { CheckIcon } from "@/components/icons";
import {
  submitChatDiscoveryMessage,
} from "@/lib/contact/actions";
import {
  DISCOVERY_LIMITS,
  DISCOVERY_OTHER,
  DISCOVERY_TIMES,
  DISCOVERY_TYPES,
  type DiscoveryPayload,
  type DiscoveryType,
  type DiscoveryTime,
} from "@/lib/contact/discovery";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Five steps: type → business → need → time → email. */
const STEP_COUNT = 5;
const LAST_STEP = STEP_COUNT - 1;

/** Stable step-viewport height: every step fits inside it, so the Back/Next
 * row (and the whole card) never jumps when the answer content changes. */
const STEP_VIEWPORT_MIN = 320;

const choice = DISCOVERY_TYPES;
const times = DISCOVERY_TIMES;

const FIELD_LABEL_CLASS =
  "mb-1.5 block text-[11px] font-medium tracking-[0.14em] uppercase text-chat-muted";

const FIELD_CLASS =
  "w-full min-w-0 rounded-[10px] bg-chat-input px-3.5 py-2.5 text-[16px] leading-snug text-chat-text outline-none placeholder:text-chat-muted ring-1 ring-chat-border focus-visible:ring-chat-accent disabled:opacity-50 sm:text-[14px]";

const QUESTION_CLASS = "mb-2.5 text-[14px] font-medium leading-snug text-chat-text";

const CHOICE_CLASS =
  "flex w-full min-w-0 items-center justify-between gap-2 rounded-[12px] bg-chat-input px-3.5 py-2 text-left text-[14px] leading-snug text-chat-text outline-none ring-1 ring-chat-border transition-opacity focus-visible:ring-chat-accent focus-visible:ring-2 disabled:opacity-50";

const PRIMARY_BUTTON_CLASS =
  "flex h-9 min-w-[96px] shrink-0 items-center justify-center rounded-full bg-chat-primary px-5 text-[13px] font-medium text-chat-primary-fg transition-opacity disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent";

const BACK_BUTTON_CLASS =
  "flex h-9 items-center justify-center rounded-full px-2 text-[13px] font-medium text-chat-muted transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent disabled:cursor-not-allowed disabled:opacity-40";

/** Every answer the wizard keeps while the visitor walks forward/back. */
type Answers = {
  type: DiscoveryType | "";
  typeOther: string;
  business: string;
  need: string;
  time: DiscoveryTime | "";
  extra: string;
  email: string;
};

const INITIAL_ANSWERS: Answers = {
  type: "",
  typeOther: "",
  business: "",
  need: "",
  time: "",
  extra: "",
  email: "",
};

type WizardState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success" }
  | { status: "error"; message: string };

/** Is the given step's answer valid right now (drives the Next/Send state)? */
function stepValid(step: number, answers: Answers): boolean {
  switch (step) {
    case 0: {
      if (!(choice as readonly string[]).includes(answers.type)) return false;
      if (answers.type === DISCOVERY_OTHER) {
        const other = answers.typeOther.trim();
        return (
          other.length >= DISCOVERY_LIMITS.otherMin &&
          other.length <= DISCOVERY_LIMITS.otherMax
        );
      }
      return true;
    }
    case 1: {
      const value = answers.business.trim();
      return (
        value.length >= DISCOVERY_LIMITS.textMin &&
        value.length <= DISCOVERY_LIMITS.textMax
      );
    }
    case 2: {
      const value = answers.need.trim();
      return (
        value.length >= DISCOVERY_LIMITS.textMin &&
        value.length <= DISCOVERY_LIMITS.textMax
      );
    }
    case 3:
      return (
        (times as readonly string[]).includes(answers.time) &&
        answers.extra.trim().length <= DISCOVERY_LIMITS.extraMax
      );
    case 4:
      return EMAIL_RE.test(answers.email.trim());
    default:
      return false;
  }
}

/**
 * The in-chat "Discovery form" wizard.
 *
 * The Contact agent's `show_contact_form` tool only signals the UI — this
 * card is rendered under a settled assistant answer. One question is visible
 * at a time; Next moves forward, Back returns and every earlier answer is
 * kept in this component's state. Submitting goes through
 * `submitChatDiscoveryMessage` (validate + honeypot + the chat rate-limit
 * budget + insert into `messages`). Nothing typed here goes into
 * chat_messages and never to the model — every value stays in local state.
 */
export default function ContactFormCard({
  fresh,
  renderDelay,
}: {
  /** `true` on the fresh settle (the whole card fades in like the actions row). */
  fresh: boolean;
  /** Extra delay (seconds) — the same beat the speaker/copy buttons use. */
  renderDelay: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [step, setStep] = useState(0);
  /** +1 = the next step slides in from the right, -1 = back from the left. */
  const [direction, setDirection] = useState(1);
  const [state, setState] = useState<WizardState>({ status: "idle" });
  const honeypotRef = useRef<HTMLInputElement | null>(null);

  const { discovery: copy } = content.askAi;

  const cardMotion = {
    duration: askAiMotion.contactForm.enter,
    ease: askAiMotion.easeOut,
  };

  const stepMotion = {
    duration: askAiMotion.discovery.step,
    ease: askAiMotion.discovery.ease,
  };

  const valid = stepValid(step, answers);
  const progressText = useMemo(
    () => copy.progress.replace("{current}", String(step + 1)),
    [copy.progress, step],
  );

  const update = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const goNext = () => {
    if (!valid || state.status === "sending") return;
    setState({ status: "idle" });
    setDirection(1);
    setStep((current) => Math.min(current + 1, LAST_STEP));
  };

  const goBack = () => {
    if (state.status === "sending") return;
    setState({ status: "idle" });
    setDirection(-1);
    setStep((current) => Math.max(current - 1, 0));
  };

  const submit = async () => {
    if (!valid || state.status === "sending") return;

    const payload: DiscoveryPayload = {
      type: answers.type,
      typeOther: answers.typeOther,
      business: answers.business,
      need: answers.need,
      time: answers.time,
      extra: answers.extra,
      email: answers.email.trim(),
      // The honeypot input stays uncontrolled in the DOM, like the popup's.
      company: honeypotRef.current?.value ?? "",
    };

    setState({ status: "sending" });
    try {
      const result = await submitChatDiscoveryMessage(payload);
      if (result.status === "success") {
        setState({ status: "success" });
        return;
      }
      if (result.status === "error") {
        setState({
          status: "error",
          message: result.message || copy.errors.invalid,
        });
        return;
      }
    } catch {
      // The action call itself failed (offline / server unreachable).
      setState({ status: "error", message: copy.errors.network });
    }
  };

  /** Enter = Next on single-line inputs (never inside a textarea). */
  const handleEnter =
    (isLast: boolean) => (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (isLast) {
        if (valid) void submit();
      } else {
        goNext();
      }
    };

  const stepVariants = {
    enter: (dir: number) =>
      reduce
        ? { opacity: 0, x: 0 }
        : { opacity: 0, x: dir * askAiMotion.discovery.distance },
    center: { opacity: 1, x: 0 },
    exit: (dir: number) =>
      reduce
        ? { opacity: 0, x: 0 }
        : { opacity: 0, x: dir * -askAiMotion.discovery.distance },
  };

  const question = (text: string) => (
    <p className={QUESTION_CLASS}>{text}</p>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div>
            {question(copy.steps.type.question)}
            <div role="radiogroup" aria-label={copy.steps.type.question} className="flex flex-col gap-1.5">
              {choice.map((value) => {
                const selected = answers.type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={state.status === "sending"}
                    onClick={() => {
                      update("type", value);
                      setState({ status: "idle" });
                    }}
                    className={`${CHOICE_CLASS} ${
                      selected ? "ring-chat-accent ring-2" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{value}</span>
                    {selected ? (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-chat-accent" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {answers.type === DISCOVERY_OTHER ? (
              <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...cardMotion }}
                className="mt-2"
              >
                <input
                  type="text"
                  value={answers.typeOther}
                  maxLength={DISCOVERY_LIMITS.otherMax}
                  placeholder={copy.steps.type.otherPlaceholder}
                  autoComplete="off"
                  disabled={state.status === "sending"}
                  onChange={(event) => update("typeOther", event.target.value)}
                  onKeyDown={handleEnter(step === LAST_STEP)}
                  className={FIELD_CLASS}
                />
              </motion.div>
            ) : null}
          </div>
        );
      case 1:
        return (
          <div>
            {question(copy.steps.business.question)}
            <textarea
              rows={3}
              value={answers.business}
              maxLength={DISCOVERY_LIMITS.textMax}
              placeholder={copy.steps.business.placeholder}
              autoComplete="off"
              disabled={state.status === "sending"}
              onChange={(event) => update("business", event.target.value)}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>
        );
      case 2: {
        const ask =
          copy.steps.need.questions[answers.type as DiscoveryType] ??
          copy.steps.need.questions[DISCOVERY_OTHER];
        return (
          <div>
            {question(ask)}
            <textarea
              rows={3}
              value={answers.need}
              maxLength={DISCOVERY_LIMITS.textMax}
              placeholder={copy.steps.need.placeholder}
              autoComplete="off"
              disabled={state.status === "sending"}
              onChange={(event) => update("need", event.target.value)}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>
        );
      }
      case 3:
        return (
          <div>
            {question(copy.steps.time.question)}
            <div role="radiogroup" aria-label={copy.steps.time.question} className="grid grid-cols-2 gap-1.5">
              {times.map((value) => {
                const selected = answers.time === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={state.status === "sending"}
                    onClick={() => {
                      update("time", value);
                      setState({ status: "idle" });
                    }}
                    className={`${CHOICE_CLASS} ${
                      selected ? "ring-chat-accent ring-2" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{value}</span>
                    {selected ? (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-chat-accent" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5">
              <label
                htmlFor="chat-discovery-extra"
                className={FIELD_LABEL_CLASS}
              >
                {copy.steps.time.extraLabel}
              </label>
              <input
                id="chat-discovery-extra"
                type="text"
                value={answers.extra}
                maxLength={DISCOVERY_LIMITS.extraMax}
                placeholder={copy.steps.time.extraPlaceholder}
                autoComplete="off"
                disabled={state.status === "sending"}
                onChange={(event) => update("extra", event.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div>
            <label htmlFor="chat-discovery-email" className={FIELD_LABEL_CLASS}>
              {copy.steps.email.question}
            </label>
            <input
              id="chat-discovery-email"
              type="email"
              inputMode="email"
              value={answers.email}
              placeholder={copy.steps.email.emailPlaceholder}
              autoComplete="email"
              disabled={state.status === "sending"}
              onChange={(event) => update("email", event.target.value)}
              onKeyDown={handleEnter(true)}
              className={FIELD_CLASS}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={
        fresh
          ? { opacity: 0, y: reduce ? 0 : askAiMotion.contactForm.distance }
          : false
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...cardMotion,
        delay: fresh ? renderDelay : 0,
      }}
      style={{
        willChange: fresh && !reduce ? "transform, opacity" : undefined,
      }}
      className="mt-2 w-full max-w-[85%] min-w-0"
    >
      {state.status === "success" ? (
        <p className="flex items-center gap-2 text-[13px] leading-snug text-chat-muted">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-chat-primary text-chat-primary-fg">
            <CheckIcon className="h-3 w-3" />
          </span>
          {copy.success}
        </p>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (step === LAST_STEP) void submit();
          }}
          className="flex min-w-0 flex-col rounded-[14px] bg-chat-surface p-3.5 ring-1 ring-chat-border"
        >
          <p
            aria-label={`Step ${step + 1} of ${STEP_COUNT}`}
            className="text-[11px] font-medium tracking-[0.14em] uppercase text-chat-muted"
          >
            {progressText}
          </p>

          {/* The stable viewport keeps the Back/Next row fixed while the
              steps change; steps move on opacity + translateX only. */}
          <div
            style={{ minHeight: STEP_VIEWPORT_MIN }}
            className="mt-3 flex flex-col"
          >
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={step}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepMotion}
                style={{
                  willChange: reduce ? undefined : "transform, opacity",
                }}
                className="flex flex-col"
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          {state.status === "error" ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: askAiMotion.contactForm.enter }}
              role="alert"
              className="mt-1 text-[12px] leading-snug text-chat-accent [overflow-wrap:anywhere]"
            >
              {state.message}
            </motion.p>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                disabled={state.status === "sending"}
                className={BACK_BUTTON_CLASS}
              >
                {copy.backLabel}
              </button>
            ) : (
              <span aria-hidden="true" />
            )}

            {step < LAST_STEP ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!valid || state.status === "sending"}
                className={PRIMARY_BUTTON_CLASS}
              >
                {copy.nextLabel}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!valid || state.status === "sending"}
                className={PRIMARY_BUTTON_CLASS}
              >
                {state.status === "sending" ? copy.sendingLabel : copy.sendLabel}
              </button>
            )}
          </div>

          {/* Honeypot — the SAME hidden field the Contact popup uses, hidden
              from users, catches naive bots. Never visible, never focused. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden"
          >
            <label htmlFor="chat-contact-company">Company</label>
            <input
              ref={honeypotRef}
              id="chat-contact-company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
        </form>
      )}
    </motion.div>
  );
}
